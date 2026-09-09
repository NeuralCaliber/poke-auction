import { DurableObject } from "cloudflare:workers";
import {
  applyMessage,
  createRoom,
  isClientMessage,
  LOBBY_DISCONNECT_DROP_MS,
  normalizeRoomCode,
  onDisconnect,
  ROOM_IDLE_TTL_MS,
  MAX_PLAYERS,
  tick,
  toPublicState,
  toYourRoster,
  type ClientMessage,
  type EngineEffect,
  type RoomState,
  type ServerMessage,
} from "@poke-auction/shared";
import { loadCatalog, type CatalogRecord } from "./pokemon.ts";
import { createCryptoRng } from "./rng.ts";

export interface Env {
  ROOM: DurableObjectNamespace<RoomDurableObject>;
}

type SocketAttachment = {
  playerId: string | null;
};

export type RoomSummary = {
  exists: boolean;
  roomCode?: string;
  phase?: RoomState["phase"];
  seated?: number;
  spectators?: number;
  openSeats?: number;
};

export type CreateResult = {
  ok: boolean;
  occupied?: boolean;
};

export class RoomDurableObject extends DurableObject<Env> {
  private room: RoomState | null = null;
  private catalog: CatalogRecord | null = null;
  private idleSince: number | null = null;
  private readonly rng = createCryptoRng();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ensureSchema();
    this.room = this.readJson<RoomState>("state");
    this.catalog = this.readJson<CatalogRecord>("catalog");
    const idle = this.readJson<number>("idleSince");
    this.idleSince = typeof idle === "number" ? idle : null;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    if (!this.room) {
      return new Response("Room not found", { status: 404 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null } satisfies SocketAttachment);
    this.markActivity();
    await this.scheduleAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async ensureCreated(roomCode: string): Promise<CreateResult> {
    const code = normalizeRoomCode(roomCode);
    if (
      this.room &&
      (this.room.players.length > 0 ||
        this.room.spectators.length > 0 ||
        this.ctx.getWebSockets().length > 0)
    ) {
      return { ok: false, occupied: true };
    }
    if (!this.room) {
      this.room = createRoom(code, Date.now());
      this.persist();
    }
    this.markActivity();
    await this.scheduleAlarm();
    return { ok: true };
  }

  summary(): RoomSummary {
    if (!this.room) return { exists: false };
    return {
      exists: true,
      roomCode: this.room.roomCode,
      phase: this.room.phase,
      seated: this.room.players.length,
      spectators: this.room.spectators.length,
      openSeats: Math.max(0, MAX_PLAYERS - this.room.players.length),
    };
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.room) {
      this.send(ws, {
        type: "ERROR",
        code: "ROOM_NOT_FOUND",
        message: "This room no longer exists.",
      });
      ws.close(4004, "Room not found");
      return;
    }

    await this.runTick();

    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.send(ws, {
        type: "ERROR",
        code: "UNKNOWN_MESSAGE",
        message: "Message must be JSON.",
      });
      return;
    }
    if (!isClientMessage(parsed)) {
      this.send(ws, {
        type: "ERROR",
        code: "UNKNOWN_MESSAGE",
        message: "Unknown message.",
      });
      return;
    }

    const attachment = this.attachment(ws);
    const actorId =
      parsed.type === "JOIN" ? parsed.playerId : attachment.playerId;
    if (!actorId) {
      this.send(ws, {
        type: "ERROR",
        code: "INVALID_PLAYER",
        message: "Join the room first.",
      });
      return;
    }

    let catalog = this.catalog?.pokemon;
    if (parsed.type === "START_MATCH") {
      this.catalog = await loadCatalog(
        this.room.settings.generations,
        this.catalog,
      );
      catalog = this.catalog.pokemon;
      this.persist();
    }

    const result = applyMessage(this.room, parsed, {
      actorId,
      now: Date.now(),
      rng: this.rng,
      catalog,
    });

    if (parsed.type === "JOIN" && !result.error) {
      this.evictDuplicateSockets(ws, parsed.playerId);
      ws.serializeAttachment({
        playerId: parsed.playerId,
      } satisfies SocketAttachment);
    }

    await this.commit(result, ws, parsed);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    if (this.ctx.getWebSockets().length === 0) {
      const idle = this.idleSince ?? now;
      if (now - idle >= ROOM_IDLE_TTL_MS) {
        await this.destroyRoom();
        return;
      }
    }
    await this.runTick();
    await this.scheduleAlarm();
  }

  private async handleSocketGone(ws: WebSocket): Promise<void> {
    const playerId = this.attachment(ws).playerId;
    if (playerId && this.room && !this.hasOtherSocket(ws, playerId)) {
      const result = onDisconnect(this.room, playerId, Date.now());
      await this.commit(result, null);
    }
    if (this.ctx.getWebSockets().filter((socket) => socket !== ws).length === 0) {
      this.idleSince = Date.now();
      this.persist();
    }
    await this.scheduleAlarm();
  }

  private async runTick(): Promise<void> {
    if (!this.room) return;
    const result = tick(this.room, Date.now(), this.rng);
    if (result.state.version !== this.room.version) {
      await this.commit(result, null);
    }
  }

  private async commit(
    result: { state: RoomState; effects: EngineEffect[]; error?: { code: string; message: string } },
    origin: WebSocket | null,
    message?: ClientMessage,
  ): Promise<void> {
    if (result.error && origin) {
      this.send(origin, {
        type: "ERROR",
        code: result.error.code,
        message: result.error.message,
      });
    }

    const mutated = result.state.version !== (this.room?.version ?? -1);
    if (mutated) {
      this.room = result.state;
      this.persist();
      this.dispatch(result.effects, origin);
    } else if (!result.error) {
      this.dispatch(result.effects, origin);
    }

    if (message?.type === "KICK_PLAYER" && !result.error) {
      this.closePlayerSockets(message.playerId, 4000, "Kicked");
    }

    await this.scheduleAlarm();
  }

  private dispatch(effects: EngineEffect[], origin: WebSocket | null): void {
    if (!this.room) return;
    for (const effect of effects) {
      switch (effect.type) {
        case "BROADCAST_STATE":
          this.broadcastState();
          break;
        case "SEND_YOUR_ROSTER":
          this.sendToPlayer(effect.playerId, {
            type: "YOUR_ROSTER",
            pokemon: toYourRoster(this.room, effect.playerId),
          });
          break;
        case "SEND_CHAT_HISTORY":
          this.sendToSockets(effect.playerId, origin, {
            type: "CHAT_HISTORY",
            messages: this.room.chat,
          });
          break;
        case "CHAT_MESSAGE":
          this.broadcast({ type: "CHAT_MESSAGE", message: effect.message });
          break;
      }
    }
  }

  private broadcastState(): void {
    if (!this.room) return;
    for (const socket of this.ctx.getWebSockets()) {
      const playerId = this.attachment(socket).playerId;
      if (!playerId) continue;
      const publicState = toPublicState(this.room, { playerId });
      this.send(socket, {
        type: "STATE",
        version: publicState.version,
        publicState,
      });
    }
  }

  private broadcast(message: ServerMessage): void {
    for (const socket of this.ctx.getWebSockets()) {
      this.send(socket, message);
    }
  }

  private sendToPlayer(playerId: string, message: ServerMessage): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (this.attachment(socket).playerId === playerId) {
        this.send(socket, message);
      }
    }
  }

  private sendToSockets(
    playerId: string,
    origin: WebSocket | null,
    message: ServerMessage,
  ): void {
    let sent = false;
    for (const socket of this.ctx.getWebSockets()) {
      if (this.attachment(socket).playerId === playerId) {
        this.send(socket, message);
        sent = true;
      }
    }
    if (!sent && origin) this.send(origin, message);
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Socket may already be closing.
    }
  }

  private attachment(ws: WebSocket): SocketAttachment {
    const value = ws.deserializeAttachment() as SocketAttachment | null;
    return value ?? { playerId: null };
  }

  private hasOtherSocket(ws: WebSocket, playerId: string): boolean {
    return this.ctx.getWebSockets().some((socket) => {
      return socket !== ws && this.attachment(socket).playerId === playerId;
    });
  }

  private evictDuplicateSockets(keep: WebSocket, playerId: string): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === keep) continue;
      if (this.attachment(socket).playerId === playerId) {
        try {
          socket.close(4001, "Reconnected elsewhere");
        } catch {
          // ignore
        }
      }
    }
  }

  private closePlayerSockets(playerId: string, code: number, reason: string): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (this.attachment(socket).playerId === playerId) {
        try {
          socket.close(code, reason);
        } catch {
          // ignore
        }
      }
    }
  }

  private markActivity(): void {
    if (this.ctx.getWebSockets().length > 0) {
      this.idleSince = null;
    } else if (this.idleSince === null) {
      this.idleSince = Date.now();
    }
    this.persist();
  }

  private async scheduleAlarm(): Promise<void> {
    const now = Date.now();
    const times: number[] = [];
    const sockets = this.ctx.getWebSockets().length;

    if (sockets === 0) {
      const idle = this.idleSince ?? now;
      this.idleSince = idle;
      times.push(idle + ROOM_IDLE_TTL_MS);
    } else {
      this.idleSince = null;
    }

    if (this.room?.phase === "AUCTION" && this.room.currentLot?.turnEndsAt) {
      times.push(this.room.currentLot.turnEndsAt);
    }

    if (this.room?.phase === "LOBBY") {
      for (const person of [...this.room.players, ...this.room.spectators]) {
        if (!person.connected && person.disconnectedAt !== null) {
          times.push(person.disconnectedAt + LOBBY_DISCONNECT_DROP_MS);
        }
      }
    }

    this.writeJson("idleSince", this.idleSince);

    if (times.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.max(Math.min(...times), now + 25));
  }

  private async destroyRoom(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.close(4004, "Room expired");
      } catch {
        // ignore
      }
    }
    await this.ctx.storage.deleteAll();
    this.room = null;
    this.catalog = null;
    this.idleSince = null;
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    );
  }

  private persist(): void {
    if (this.room) this.writeJson("state", this.room);
    if (this.catalog) this.writeJson("catalog", this.catalog);
    this.writeJson("idleSince", this.idleSince);
  }

  private writeJson(key: string, value: unknown): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)",
      key,
      JSON.stringify(value),
    );
  }

  private readJson<T>(key: string): T | null {
    const rows = this.ctx.storage.sql
      .exec("SELECT value FROM kv WHERE key = ?", key)
      .toArray() as Array<{ value: string }>;
    const row = rows[0];
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }
}
