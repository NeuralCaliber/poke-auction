import {
  DEFAULT_SETTINGS,
  LOBBY_DISCONNECT_DROP_MS,
  MAX_PLAYERS,
  PLAYER_COLORS,
} from "./constants.ts";
import {
  actionBlockReason,
  advanceTurn,
  anyoneEligibleForNewLot,
  applyBidToLot,
  applyPassToLot,
  awardLot,
  distributeLeftovers,
  leftoverQueue,
  lotIsAllPass,
  lotIsWon,
  openLot,
  recycleLot,
  shouldEndAuction,
  validateBid,
  validatePass,
} from "./auction.ts";
import { appendChat, canSendChat, clampChatText, recordChatSend, sanitizeName } from "./chat.ts";
import { authorize, canStartMatch, longestConnectedSeated, seatedPlayer, transferHostState } from "./permissions.ts";
import { selectPool } from "./pool.ts";
import type { ClientMessage } from "./protocol.ts";
import type { Rng } from "./rng.ts";
import { normalizeRoomCode } from "./room-code.ts";
import { buildMatchResults } from "./scoring.ts";
import { clampSettings, formatSettingsChange, settingsEqual } from "./settings.ts";
import type {
  ApplyResult,
  ChatMessage,
  EngineEffect,
  EngineError,
  InternalLot,
  Player,
  Pokemon,
  RoomState,
  Spectator,
} from "./types.ts";

export type EngineContext = {
  now: number;
  rng: Rng;
  actorId: string;
  catalog?: Pokemon[];
};

function ok(state: RoomState, effects: EngineEffect[]): ApplyResult {
  return { state, effects };
}

function fail(state: RoomState, error: EngineError): ApplyResult {
  return { state, effects: [], error };
}

function bump(state: RoomState): RoomState {
  return { ...state, version: state.version + 1 };
}

function systemText(state: RoomState, text: string, now: number): {
  state: RoomState;
  message: ChatMessage;
} {
  const withChat = appendChat(state, {
    kind: "system",
    playerId: null,
    name: null,
    text,
    ts: now,
  });
  const message = withChat.chat[withChat.chat.length - 1]!;
  return { state: withChat, message };
}

function pushSystem(
  state: RoomState,
  effects: EngineEffect[],
  text: string,
  now: number,
): { state: RoomState; effects: EngineEffect[] } {
  const result = systemText(state, text, now);
  return {
    state: result.state,
    effects: [...effects, { type: "CHAT_MESSAGE", message: result.message }],
  };
}

function broadcast(effects: EngineEffect[]): EngineEffect[] {
  if (effects.some((e) => e.type === "BROADCAST_STATE")) return effects;
  return [...effects, { type: "BROADCAST_STATE" }];
}

function unusedColor(players: readonly Player[]): string {
  const used = new Set(players.map((p) => p.color));
  return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0]!;
}

export function createRoom(roomCode: string, now: number): RoomState {
  return {
    roomCode: normalizeRoomCode(roomCode),
    version: 0,
    phase: "LOBBY",
    settings: {
      ...DEFAULT_SETTINGS,
      generations: [...DEFAULT_SETTINGS.generations],
    },
    createdAt: now,
    players: [],
    spectators: [],
    chat: [],
    chatRate: {},
    nextChatSeq: 1,
    nextLotSeq: 1,
    pool: [],
    currentLot: null,
    rosters: {},
    turnOrder: [],
    nextTurnCursor: 0,
    allPassStreak: 0,
    results: null,
  };
}

function finishMatch(
  state: RoomState,
  rng: Rng,
  now: number,
  effects: EngineEffect[],
): { state: RoomState; effects: EngineEffect[] } {
  let next = distributeLeftovers(state, rng);
  const results = buildMatchResults(next.players, next.rosters);
  const winner = results[0];
  next = {
    ...next,
    phase: "REVEALED",
    results,
    currentLot: null,
    pool: [],
    players: next.players.map((player) =>
      winner && player.id === winner.playerId
        ? { ...player, wins: player.wins + 1 }
        : player,
    ),
  };

  const announcement = winner
    ? `${winner.name} wins with ${winner.score.total} points.`
    : "Match over.";
  const pushed = pushSystem(next, effects, announcement, now);
  for (const player of pushed.state.players) {
    pushed.effects.push({ type: "SEND_YOUR_ROSTER", playerId: player.id });
  }
  return { state: pushed.state, effects: broadcast(pushed.effects) };
}

function continueAuction(
  state: RoomState,
  now: number,
  rng: Rng,
  effects: EngineEffect[],
): { state: RoomState; effects: EngineEffect[] } {
  let next = state;
  let nextEffects = effects;

  while (next.currentLot === null) {
    if (shouldEndAuction(next) || next.pool.length === 0 || !anyoneEligibleForNewLot(next)) {
      return finishMatch(next, rng, now, nextEffects);
    }

    if (
      next.allPassStreak > 0 &&
      next.pool.length > 0 &&
      next.allPassStreak >= leftoverQueue(next).length
    ) {
      return finishMatch(next, rng, now, nextEffects);
    }

    const pokemon = next.pool[0]!;
    next = openLot({ ...next, pool: next.pool.slice(1) }, pokemon, now);
    if (next.currentLot?.turnPlayerId) break;

    if (next.currentLot) {
      next = recycleLot(next, next.currentLot);
      next = { ...next, allPassStreak: next.allPassStreak + 1 };
    }
  }

  return { state: next, effects: nextEffects };
}

function resolveAfterBid(
  state: RoomState,
  lot: InternalLot,
  now: number,
  rng: Rng,
  effects: EngineEffect[],
): { state: RoomState; effects: EngineEffect[] } {
  if (lotIsWon(state, lot)) {
    const awarded = awardLot({ ...state, currentLot: lot }, lot);
    const withRoster: EngineEffect[] = [
      ...effects,
      { type: "SEND_YOUR_ROSTER", playerId: awarded.winnerId },
    ];
    return continueAuction(
      { ...awarded.state, allPassStreak: 0 },
      now,
      rng,
      withRoster,
    );
  }

  const advanced = advanceTurn(state, lot, lot.currentBidderId ?? lot.turnPlayerId ?? "", now);
  if (advanced.turnPlayerId === null && lotIsWon(state, advanced)) {
    const awarded = awardLot({ ...state, currentLot: advanced }, advanced);
    return continueAuction(
      { ...awarded.state, allPassStreak: 0 },
      now,
      rng,
      [...effects, { type: "SEND_YOUR_ROSTER", playerId: awarded.winnerId }],
    );
  }

  return {
    state: { ...state, currentLot: advanced },
    effects,
  };
}

function resolveAfterPass(
  state: RoomState,
  lot: InternalLot,
  actorId: string,
  now: number,
  rng: Rng,
  effects: EngineEffect[],
): { state: RoomState; effects: EngineEffect[] } {
  const withLot = { ...state, currentLot: lot };

  if (lotIsWon(withLot, lot)) {
    const awarded = awardLot(withLot, lot);
    return continueAuction(
      { ...awarded.state, allPassStreak: 0 },
      now,
      rng,
      [...effects, { type: "SEND_YOUR_ROSTER", playerId: awarded.winnerId }],
    );
  }

  if (lotIsAllPass(withLot, lot)) {
    const recycled = recycleLot(withLot, lot);
    return continueAuction(
      { ...recycled, allPassStreak: recycled.allPassStreak + 1 },
      now,
      rng,
      effects,
    );
  }

  const advanced = advanceTurn(withLot, lot, actorId, now);
  if (advanced.turnPlayerId === null) {
    if (lotIsWon({ ...withLot, currentLot: advanced }, advanced)) {
      const awarded = awardLot({ ...withLot, currentLot: advanced }, advanced);
      return continueAuction(
        { ...awarded.state, allPassStreak: 0 },
        now,
        rng,
        [...effects, { type: "SEND_YOUR_ROSTER", playerId: awarded.winnerId }],
      );
    }
    if (lotIsAllPass({ ...withLot, currentLot: advanced }, advanced)) {
      const recycled = recycleLot({ ...withLot, currentLot: advanced }, advanced);
      return continueAuction(
        { ...recycled, allPassStreak: recycled.allPassStreak + 1 },
        now,
        rng,
        effects,
      );
    }
  }

  return { state: { ...state, currentLot: advanced }, effects };
}

function joinAsSeated(
  state: RoomState,
  playerId: string,
  name: string,
  now: number,
): RoomState {
  const player: Player = {
    id: playerId,
    name,
    color: unusedColor(state.players),
    isHost: state.players.length === 0,
    ready: false,
    connected: true,
    budget: state.settings.startingBudget,
    wins: 0,
    seatedAt: now,
    connectedAt: now,
    disconnectedAt: null,
  };
  return {
    ...state,
    players: [...state.players, player],
    rosters: { ...state.rosters, [playerId]: state.rosters[playerId] ?? [] },
  };
}

function joinAsSpectator(
  state: RoomState,
  playerId: string,
  name: string,
  now: number,
): RoomState {
  const spectator: Spectator = {
    id: playerId,
    name,
    connected: true,
    joinedAt: now,
    connectedAt: now,
    disconnectedAt: null,
  };
  return { ...state, spectators: [...state.spectators, spectator] };
}

function handleJoin(
  state: RoomState,
  message: Extract<ClientMessage, { type: "JOIN" }>,
  ctx: EngineContext,
): ApplyResult {
  if (message.playerId !== ctx.actorId) {
    return fail(state, { code: "INVALID_PLAYER", message: "playerId does not match this connection." });
  }
  if (normalizeRoomCode(message.roomCode) !== state.roomCode) {
    return fail(state, { code: "INVALID_PLAYER", message: "Wrong room code." });
  }
  const name = sanitizeName(message.name);
  if (!name) {
    return fail(state, { code: "INVALID_NAME", message: "Enter a name between 1 and 20 characters." });
  }

  const seated = state.players.find((p) => p.id === ctx.actorId);
  const spectating = state.spectators.find((s) => s.id === ctx.actorId);
  let next = state;
  let effects: EngineEffect[] = [
    { type: "SEND_CHAT_HISTORY", playerId: ctx.actorId },
  ];
  let announced = false;

  if (seated) {
    next = {
      ...next,
      players: next.players.map((p) =>
        p.id === ctx.actorId
          ? {
              ...p,
              name,
              connected: true,
              connectedAt: ctx.now,
              disconnectedAt: null,
            }
          : p,
      ),
    };
  } else if (spectating) {
    next = {
      ...next,
      spectators: next.spectators.map((s) =>
        s.id === ctx.actorId
          ? {
              ...s,
              name,
              connected: true,
              connectedAt: ctx.now,
              disconnectedAt: null,
            }
          : s,
      ),
    };
  } else if (state.phase === "LOBBY" && state.players.length < MAX_PLAYERS) {
    next = joinAsSeated(next, ctx.actorId, name, ctx.now);
    const pushed = pushSystem(next, effects, `${name} joined.`, ctx.now);
    next = pushed.state;
    effects = pushed.effects;
    announced = true;
  } else {
    next = joinAsSpectator(next, ctx.actorId, name, ctx.now);
    const pushed = pushSystem(
      next,
      effects,
      `${name} is spectating.`,
      ctx.now,
    );
    next = pushed.state;
    effects = pushed.effects;
    announced = true;
  }

  if (!announced && seated && seated.name !== name) {
    const pushed = pushSystem(next, effects, `${name} updated their name.`, ctx.now);
    next = pushed.state;
    effects = pushed.effects;
  }

  effects.push({ type: "SEND_YOUR_ROSTER", playerId: ctx.actorId });
  return ok(bump(next), broadcast(effects));
}

export function applyMessage(
  state: RoomState,
  message: ClientMessage,
  ctx: EngineContext,
): ApplyResult {
  switch (message.type) {
    case "JOIN":
      return handleJoin(state, message, ctx);

    case "SET_READY": {
      const auth = authorize(state, ctx.actorId, "SET_READY");
      if (auth) return fail(state, auth);
      const player = seatedPlayer(state, ctx.actorId);
      if (!player) return fail(state, { code: "NOT_SEATED", message: "You don't have a seat." });
      if (player.ready === message.ready) {
        return ok(state, []);
      }
      const next = {
        ...state,
        players: state.players.map((p) =>
          p.id === ctx.actorId ? { ...p, ready: message.ready } : p,
        ),
      };
      return ok(bump(next), [{ type: "BROADCAST_STATE" }]);
    }

    case "UPDATE_SETTINGS": {
      const auth = authorize(state, ctx.actorId, "UPDATE_SETTINGS");
      if (auth) return fail(state, auth);
      const settings = clampSettings(message.settings, state.settings);
      if (settingsEqual(settings, state.settings)) {
        return ok(state, []);
      }
      const host = seatedPlayer(state, ctx.actorId);
      let next: RoomState = {
        ...state,
        settings,
        players: state.players.map((p) => ({ ...p, ready: false })),
      };
      const summary = formatSettingsChange(state.settings, settings);
      const pushed = pushSystem(
        next,
        [],
        `${host?.name ?? "Host"} updated settings: ${summary}.`,
        ctx.now,
      );
      return ok(bump(pushed.state), broadcast(pushed.effects));
    }

    case "KICK_PLAYER": {
      const auth = authorize(state, ctx.actorId, "KICK_PLAYER");
      if (auth) return fail(state, auth);
      if (message.playerId === ctx.actorId) {
        return fail(state, { code: "CANNOT_TARGET_SELF", message: "You cannot kick yourself." });
      }
      const targetPlayer = state.players.find((p) => p.id === message.playerId);
      const targetSpec = state.spectators.find((s) => s.id === message.playerId);
      if (!targetPlayer && !targetSpec) {
        return fail(state, { code: "INVALID_PLAYER", message: "That player is not in the room." });
      }
      const name = targetPlayer?.name ?? targetSpec?.name ?? "Player";
      let next: RoomState = {
        ...state,
        players: state.players.filter((p) => p.id !== message.playerId),
        spectators: state.spectators.filter((s) => s.id !== message.playerId),
      };
      const { [message.playerId]: _, ...rosters } = next.rosters;
      next = { ...next, rosters };
      const pushed = pushSystem(next, [], `${name} was kicked.`, ctx.now);
      return ok(bump(pushed.state), broadcast(pushed.effects));
    }

    case "TRANSFER_HOST": {
      const auth = authorize(state, ctx.actorId, "TRANSFER_HOST");
      if (auth) return fail(state, auth);
      if (message.playerId === ctx.actorId) {
        return fail(state, { code: "CANNOT_TARGET_SELF", message: "You already are the host." });
      }
      const target = seatedPlayer(state, message.playerId);
      if (!target) {
        return fail(state, { code: "INVALID_PLAYER", message: "Host can only be transferred to a seated player." });
      }
      const next = transferHostState(state, target.id);
      const pushed = pushSystem(next, [], `${target.name} is now the host.`, ctx.now);
      return ok(bump(pushed.state), broadcast(pushed.effects));
    }

    case "CHAT": {
      const text = clampChatText(message.text);
      if (!text) {
        return fail(state, {
          code: "CHAT_TOO_LONG",
          message: "Chat must be 1–200 characters.",
        });
      }
      const timestamps = state.chatRate[ctx.actorId] ?? [];
      if (!canSendChat(timestamps, ctx.now)) {
        return fail(state, {
          code: "CHAT_RATE_LIMIT",
          message: "Slow down — 5 messages per 10 seconds.",
        });
      }
      const actor =
        seatedPlayer(state, ctx.actorId) ??
        state.spectators.find((s) => s.id === ctx.actorId);
      if (!actor) {
        return fail(state, { code: "INVALID_PLAYER", message: "Join the room before chatting." });
      }
      const withRate: RoomState = {
        ...state,
        chatRate: {
          ...state.chatRate,
          [ctx.actorId]: recordChatSend(timestamps, ctx.now),
        },
      };
      const withChat = appendChat(withRate, {
        kind: "player",
        playerId: ctx.actorId,
        name: actor.name,
        text,
        ts: ctx.now,
      });
      const chatMessage = withChat.chat[withChat.chat.length - 1]!;
      return ok(bump(withChat), broadcast([
        { type: "CHAT_MESSAGE", message: chatMessage },
      ]));
    }

    case "START_MATCH": {
      const auth = authorize(state, ctx.actorId, "START_MATCH");
      if (auth) return fail(state, auth);
      const startError = canStartMatch(state);
      if (startError) return fail(state, startError);
      if (!ctx.catalog) {
        return fail(state, { code: "NO_CATALOG", message: "Pokémon catalog is not ready." });
      }

      const pool = selectPool(
        ctx.catalog,
        state.players.length,
        state.settings,
        ctx.rng,
      );
      if (pool.length === 0) {
        return fail(state, {
          code: "INVALID_SETTINGS",
          message: "No Pokémon available for the selected generations.",
        });
      }

      const turnOrder = ctx.rng.shuffle(state.players.map((p) => p.id));
      let next: RoomState = {
        ...state,
        phase: "AUCTION",
        pool,
        currentLot: null,
        results: null,
        allPassStreak: 0,
        nextTurnCursor: 0,
        turnOrder,
        rosters: Object.fromEntries(state.players.map((p) => [p.id, []])),
        players: state.players.map((p) => ({
          ...p,
          ready: false,
          budget: state.settings.startingBudget,
        })),
      };

      const started = pushSystem(next, [], "Match started. Bid blind!", ctx.now);
      const progressed = continueAuction(started.state, ctx.now, ctx.rng, started.effects);
      for (const player of progressed.state.players) {
        if (!progressed.effects.some((e) => e.type === "SEND_YOUR_ROSTER" && e.playerId === player.id)) {
          progressed.effects.push({ type: "SEND_YOUR_ROSTER", playerId: player.id });
        }
      }
      return ok(bump(progressed.state), broadcast(progressed.effects));
    }

    case "BID": {
      const auth = authorize(state, ctx.actorId, "BID");
      if (auth) return fail(state, auth);
      const invalid = validateBid(state, ctx.actorId, message.lotId, message.amount);
      if (invalid) return fail(state, invalid);
      const lot = applyBidToLot(state.currentLot!, ctx.actorId, message.amount);
      const resolved = resolveAfterBid(state, lot, ctx.now, ctx.rng, []);
      return ok(bump(resolved.state), broadcast(resolved.effects));
    }

    case "PASS": {
      const auth = authorize(state, ctx.actorId, "PASS");
      if (auth) return fail(state, auth);
      const invalid = validatePass(state, ctx.actorId, message.lotId);
      if (invalid) return fail(state, invalid);
      const lot = applyPassToLot(state.currentLot!, ctx.actorId);
      const resolved = resolveAfterPass(state, lot, ctx.actorId, ctx.now, ctx.rng, []);
      return ok(bump(resolved.state), broadcast(resolved.effects));
    }

    case "RETURN_TO_LOBBY": {
      const auth = authorize(state, ctx.actorId, "RETURN_TO_LOBBY");
      if (auth) return fail(state, auth);
      let next: RoomState = {
        ...state,
        phase: "LOBBY",
        pool: [],
        currentLot: null,
        turnOrder: [],
        nextTurnCursor: 0,
        allPassStreak: 0,
        results: null,
        rosters: Object.fromEntries(state.players.map((p) => [p.id, []])),
        players: state.players.map((p) => ({
          ...p,
          ready: false,
          budget: state.settings.startingBudget,
        })),
      };
      const pushed = pushSystem(next, [], "Back to the lobby. Ready up for another match.", ctx.now);
      const effects: EngineEffect[] = [...pushed.effects];
      for (const player of pushed.state.players) {
        effects.push({ type: "SEND_YOUR_ROSTER", playerId: player.id });
      }
      return ok(bump(pushed.state), broadcast(effects));
    }

    case "TAKE_SEAT": {
      const auth = authorize(state, ctx.actorId, "TAKE_SEAT");
      if (auth) return fail(state, auth);
      if (seatedPlayer(state, ctx.actorId)) {
        return fail(state, { code: "ALREADY_SEATED", message: "You already have a seat." });
      }
      const spectator = state.spectators.find((s) => s.id === ctx.actorId);
      if (!spectator) {
        return fail(state, { code: "INVALID_PLAYER", message: "Only spectators can take a seat." });
      }
      if (state.players.length >= MAX_PLAYERS) {
        return fail(state, { code: "NO_SEAT_AVAILABLE", message: "The room is full." });
      }
      let next: RoomState = {
        ...state,
        spectators: state.spectators.filter((s) => s.id !== ctx.actorId),
      };
      next = joinAsSeated(next, spectator.id, spectator.name, ctx.now);
      const pushed = pushSystem(next, [], `${spectator.name} took a seat.`, ctx.now);
      return ok(bump(pushed.state), broadcast(pushed.effects));
    }

    default:
      return fail(state, { code: "UNKNOWN_MESSAGE", message: "Unknown message." });
  }
}

export function onDisconnect(
  state: RoomState,
  playerId: string,
  now: number,
): ApplyResult {
  const seated = state.players.find((p) => p.id === playerId);
  const spectating = state.spectators.find((s) => s.id === playerId);
  if (!seated && !spectating) return ok(state, []);
  if (seated?.connected === false || spectating?.connected === false) {
    return ok(state, []);
  }

  let next: RoomState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, connected: false, disconnectedAt: now }
        : p,
    ),
    spectators: state.spectators.map((s) =>
      s.id === playerId
        ? { ...s, connected: false, disconnectedAt: now }
        : s,
    ),
  };

  const name = seated?.name ?? spectating?.name ?? "Player";
  let effects: EngineEffect[] = [];
  const left = pushSystem(next, effects, `${name} disconnected.`, now);
  next = left.state;
  effects = left.effects;

  if (seated?.isHost) {
    const successor = longestConnectedSeated(next, playerId);
    if (successor) {
      next = transferHostState(next, successor.id);
      const promoted = pushSystem(
        next,
        effects,
        `${successor.name} is now the host.`,
        now,
      );
      next = promoted.state;
      effects = promoted.effects;
    }
  }

  return ok(bump(next), broadcast(effects));
}

function dropLobbyDisconnects(state: RoomState, now: number): {
  state: RoomState;
  effects: EngineEffect[];
  changed: boolean;
} {
  if (state.phase !== "LOBBY") {
    return { state, effects: [], changed: false };
  }

  const stalePlayers = state.players.filter(
    (p) =>
      !p.connected &&
      p.disconnectedAt !== null &&
      now - p.disconnectedAt >= LOBBY_DISCONNECT_DROP_MS,
  );
  const staleSpectators = state.spectators.filter(
    (s) =>
      !s.connected &&
      s.disconnectedAt !== null &&
      now - s.disconnectedAt >= LOBBY_DISCONNECT_DROP_MS,
  );
  if (stalePlayers.length === 0 && staleSpectators.length === 0) {
    return { state, effects: [], changed: false };
  }

  let next = state;
  let effects: EngineEffect[] = [];

  for (const player of stalePlayers) {
    next = {
      ...next,
      players: next.players.filter((p) => p.id !== player.id),
    };
    const { [player.id]: _, ...rosters } = next.rosters;
    next = { ...next, rosters };
    const pushed = pushSystem(next, effects, `${player.name} left.`, now);
    next = pushed.state;
    effects = pushed.effects;

    if (player.isHost) {
      const successor = longestConnectedSeated(next);
      if (successor) {
        next = transferHostState(next, successor.id);
        const promoted = pushSystem(
          next,
          effects,
          `${successor.name} is now the host.`,
          now,
        );
        next = promoted.state;
        effects = promoted.effects;
      }
    }
  }

  if (staleSpectators.length > 0) {
    next = {
      ...next,
      spectators: next.spectators.filter(
        (s) => !staleSpectators.some((stale) => stale.id === s.id),
      ),
    };
  }

  return { state: next, effects, changed: true };
}

export function tick(state: RoomState, now: number, rng: Rng): ApplyResult {
  let next = state;
  let effects: EngineEffect[] = [];
  let changed = false;

  const dropped = dropLobbyDisconnects(next, now);
  next = dropped.state;
  effects = dropped.effects;
  changed = dropped.changed;

  while (
    next.phase === "AUCTION" &&
    next.currentLot?.turnPlayerId &&
    next.currentLot.turnEndsAt !== null &&
    next.currentLot.turnEndsAt <= now
  ) {
    const actorId = next.currentLot.turnPlayerId;
    const lot = applyPassToLot(next.currentLot, actorId);
    const resolved = resolveAfterPass(next, lot, actorId, now, rng, effects);
    next = resolved.state;
    effects = resolved.effects;
    changed = true;
    if (next.phase !== "AUCTION") break;
  }

  if (!changed) return ok(state, []);
  return ok(bump(next), broadcast(effects));
}

export function ineligibilityReason(
  state: RoomState,
  playerId: string,
): string | null {
  return actionBlockReason(state, playerId);
}
