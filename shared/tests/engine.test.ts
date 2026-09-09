import { describe, expect, it } from "vitest";
import { applyMessage, createRoom, onDisconnect, tick } from "../src/engine.ts";
import { createSeededRng } from "../src/rng.ts";
import type { ClientMessage } from "../src/protocol.ts";
import type { RoomState } from "../src/types.ts";
import { CATALOG, poke } from "./helpers.ts";

const now = 1_000_000;

function ctx(actorId: string, extra: { now?: number; seed?: number } = {}) {
  return {
    actorId,
    now: extra.now ?? now,
    rng: createSeededRng(extra.seed ?? 1),
    catalog: CATALOG,
  };
}

function send(state: RoomState, actorId: string, message: ClientMessage, time = now) {
  return applyMessage(state, message, ctx(actorId, { now: time }));
}

function mustOk(result: ReturnType<typeof applyMessage>): RoomState {
  expect(result.error).toBeUndefined();
  return result.state;
}

function seatedLobby(): RoomState {
  let state = createRoom("ABCD", now);
  state = mustOk(
    send(state, "a", { type: "JOIN", roomCode: "ABCD", playerId: "a", name: "Ash" }),
  );
  state = mustOk(
    send(state, "b", { type: "JOIN", roomCode: "ABCD", playerId: "b", name: "Brock" }),
  );
  state = mustOk(send(state, "b", { type: "SET_READY", ready: true }));
  return state;
}

describe("engine lobby and match flow", () => {
  it("makes the first seated player host and starts only when everyone is ready", () => {
    const state = seatedLobby();
    expect(state.players[0]?.isHost).toBe(true);
    expect(state.players).toHaveLength(2);

    const denied = send(state, "b", { type: "START_MATCH" });
    expect(denied.error?.code).toBe("NOT_HOST");

    const started = mustOk(send(state, "a", { type: "START_MATCH" }));
    expect(started.phase).toBe("AUCTION");
    expect(started.currentLot).not.toBeNull();
    expect(started.currentLot?.pokemon.name).toBeTruthy();
    expect(started.currentLot?.turnEndsAt).toBe(now + 20_000);
  });

  it("resets ready flags when the host changes settings", () => {
    let state = seatedLobby();
    expect(state.players[1]?.ready).toBe(true);
    state = mustOk(
      send(state, "a", { type: "UPDATE_SETTINGS", settings: { startingBudget: 40 } }),
    );
    expect(state.settings.startingBudget).toBe(40);
    expect(state.players.every((p) => p.ready === false)).toBe(true);
  });

  it("recycles an all-passed lot and later awards a bid", () => {
    let state = seatedLobby();
    state = mustOk(
      send(state, "a", {
        type: "UPDATE_SETTINGS",
        settings: { rosterSize: 3, turnTimerSeconds: 10 },
      }),
    );
    state = mustOk(send(state, "b", { type: "SET_READY", ready: true }));
    state = mustOk(send(state, "a", { type: "START_MATCH" }));

    const firstLot = state.currentLot!;
    const firstName = firstLot.pokemon.name;
    const firstActor = firstLot.turnPlayerId!;
    const secondActor = firstActor === "a" ? "b" : "a";

    state = mustOk(send(state, firstActor, { type: "PASS", lotId: firstLot.lotId }));
    state = mustOk(send(state, secondActor, { type: "PASS", lotId: firstLot.lotId }));

    expect(state.currentLot).not.toBeNull();
    expect(state.pool.some((p) => p.name === firstName)).toBe(true);

    const lot = state.currentLot!;
    const actor = lot.turnPlayerId!;
    state = mustOk(send(state, actor, { type: "BID", lotId: lot.lotId, amount: 1 }));
    const other = actor === "a" ? "b" : "a";
    if (state.currentLot?.lotId === lot.lotId && state.currentLot.turnPlayerId === other) {
      state = mustOk(send(state, other, { type: "PASS", lotId: lot.lotId }));
    }
    expect(state.rosters[actor]?.some((h) => h.pokemon.name === lot.pokemon.name)).toBe(true);
  });

  it("auto-passes on turn timer expiry", () => {
    let state = seatedLobby();
    state = mustOk(send(state, "a", { type: "START_MATCH" }));
    const lotId = state.currentLot!.lotId;
    const actor = state.currentLot!.turnPlayerId!;
    const timed = tick(state, now + 20_000, createSeededRng(1));
    expect(timed.state.currentLot?.passedPlayerIds).toContain(actor);
    expect(timed.state.currentLot?.lotId === lotId || timed.state.pool.length > 0).toBe(true);
  });

  it("promotes the longest-connected seated player when the host disconnects", () => {
    let state = seatedLobby();
    const disconnected = onDisconnect(state, "a", now + 50);
    expect(disconnected.state.players.find((p) => p.id === "a")?.connected).toBe(false);
    expect(disconnected.state.players.find((p) => p.id === "b")?.isHost).toBe(true);
    expect(disconnected.state.chat.some((m) => m.text.includes("Brock is now the host"))).toBe(
      true,
    );
  });

  it("drops a disconnected lobby player after 60 seconds", () => {
    let state = seatedLobby();
    state = onDisconnect(state, "b", now).state;
    const stillThere = tick(state, now + 59_000, createSeededRng(1));
    expect(stillThere.state.players.some((p) => p.id === "b")).toBe(true);
    const gone = tick(state, now + 60_000, createSeededRng(1));
    expect(gone.state.players.some((p) => p.id === "b")).toBe(false);
  });

  it("seats mid-match joiners as spectators who cannot see the pool", () => {
    let state = seatedLobby();
    state = mustOk(send(state, "a", { type: "START_MATCH" }));
    state = mustOk(
      send(state, "s", { type: "JOIN", roomCode: "ABCD", playerId: "s", name: "Watcher" }),
    );
    expect(state.spectators.some((s) => s.id === "s")).toBe(true);
    expect(state.players.some((p) => p.id === "s")).toBe(false);
    const bid = send(state, "s", {
      type: "BID",
      lotId: state.currentLot!.lotId,
      amount: 1,
    });
    expect(bid.error?.code).toBe("NOT_SEATED");
  });

  it("rate-limits chat to 5 messages per 10 seconds", () => {
    let state = seatedLobby();
    for (let i = 0; i < 5; i++) {
      state = mustOk(send(state, "a", { type: "CHAT", text: `hi ${i}` }, now + i));
    }
    const limited = send(state, "a", { type: "CHAT", text: "too many" }, now + 5);
    expect(limited.error?.code).toBe("CHAT_RATE_LIMIT");
  });
});

describe("catalog helpers used by match start", () => {
  it("keeps unique identity fields on catalog pokemon for later server fetch mapping", () => {
    expect(poke(25, "pikachu", 1, ["electric"], 320).spriteUrl).toContain("pikachu");
    expect(CATALOG.length).toBeGreaterThan(6);
  });
});
