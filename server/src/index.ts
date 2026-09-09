import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "@poke-auction/shared";
import { jsonResponse, optionsResponse } from "./cors.ts";
import { createCryptoRng } from "./rng.ts";
import { RoomDurableObject, type Env } from "./room.ts";

export { RoomDurableObject };
export type { Env };

const rng = createCryptoRng();

function roomStub(env: Env, code: string) {
  return env.ROOM.getByName(code);
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  for (let attempt = 0; attempt < 24; attempt++) {
    const roomCode = generateRoomCode(rng);
    const created = await roomStub(env, roomCode).ensureCreated(roomCode);
    if (created.ok) {
      return jsonResponse(
        request,
        { roomCode, joinPath: `/r/${roomCode}` },
        201,
      );
    }
  }
  return jsonResponse(
    request,
    { error: "Could not allocate a room code. Try again." },
    503,
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return optionsResponse(request);
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse(request, { ok: true });
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      return createRoom(request, env);
    }

    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)(\/ws)?$/);
    if (!match) {
      return jsonResponse(request, { error: "Not found" }, 404);
    }

    const roomCode = normalizeRoomCode(match[1] ?? "");
    if (!isValidRoomCode(roomCode)) {
      return jsonResponse(request, { error: "Invalid room code" }, 400);
    }

    const stub = roomStub(env, roomCode);
    const wantsSocket =
      request.headers.get("Upgrade")?.toLowerCase() === "websocket" ||
      match[2] === "/ws";

    if (wantsSocket) {
      return stub.fetch(request);
    }

    if (request.method === "GET") {
      const summary = await stub.summary();
      if (!summary.exists) {
        return jsonResponse(request, { exists: false }, 404);
      }
      return jsonResponse(request, summary);
    }

    return jsonResponse(request, { error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
