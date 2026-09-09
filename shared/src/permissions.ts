import { MIN_PLAYERS } from "./constants.ts";
import type {
  EngineError,
  Phase,
  Player,
  RoomState,
} from "./types.ts";

export type HostAction =
  | "UPDATE_SETTINGS"
  | "KICK_PLAYER"
  | "TRANSFER_HOST"
  | "START_MATCH"
  | "RETURN_TO_LOBBY";

const HOST_ACTIONS = new Set<HostAction>([
  "UPDATE_SETTINGS",
  "KICK_PLAYER",
  "TRANSFER_HOST",
  "START_MATCH",
  "RETURN_TO_LOBBY",
]);

const LOBBY_ONLY_ACTIONS = new Set<string>([
  "SET_READY",
  "UPDATE_SETTINGS",
  "KICK_PLAYER",
  "TRANSFER_HOST",
  "START_MATCH",
  "TAKE_SEAT",
]);

const AUCTION_ONLY_ACTIONS = new Set<string>(["BID", "PASS"]);

export function isHost(state: RoomState, playerId: string): boolean {
  return state.players.some((p) => p.id === playerId && p.isHost);
}

export function seatedPlayer(
  state: RoomState,
  playerId: string,
): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function requireHost(
  state: RoomState,
  playerId: string,
): EngineError | null {
  if (!isHost(state, playerId)) {
    return { code: "NOT_HOST", message: "Only the host can do that." };
  }
  return null;
}

export function requirePhase(
  state: RoomState,
  phase: Phase,
): EngineError | null {
  if (state.phase !== phase) {
    return {
      code: "INVALID_PHASE",
      message: `That action is not allowed during ${state.phase}.`,
    };
  }
  return null;
}

export function authorize(
  state: RoomState,
  playerId: string,
  action: string,
): EngineError | null {
  if (HOST_ACTIONS.has(action as HostAction)) {
    const hostError = requireHost(state, playerId);
    if (hostError) return hostError;
  }

  if (LOBBY_ONLY_ACTIONS.has(action)) {
    return requirePhase(state, "LOBBY");
  }

  if (AUCTION_ONLY_ACTIONS.has(action)) {
    return requirePhase(state, "AUCTION");
  }

  if (action === "RETURN_TO_LOBBY") {
    return requirePhase(state, "REVEALED");
  }

  return null;
}

export function canStartMatch(state: RoomState): EngineError | null {
  if (state.phase !== "LOBBY") {
    return { code: "INVALID_PHASE", message: "The match can only start from the lobby." };
  }
  if (state.players.length < MIN_PLAYERS) {
    return {
      code: "NOT_ENOUGH_PLAYERS",
      message: `Need at least ${MIN_PLAYERS} players to start.`,
    };
  }
  const unready = state.players.filter((p) => !p.isHost && !p.ready);
  if (unready.length > 0) {
    return {
      code: "PLAYERS_NOT_READY",
      message: "Every player must be ready before starting.",
    };
  }
  return null;
}

export function longestConnectedSeated(
  state: RoomState,
  excludingId?: string,
): Player | undefined {
  return state.players
    .filter((p) => p.connected && p.id !== excludingId)
    .sort((a, b) => a.seatedAt - b.seatedAt || a.id.localeCompare(b.id))[0];
}

export function transferHostState(
  state: RoomState,
  newHostId: string,
): RoomState {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      isHost: player.id === newHostId,
    })),
  };
}
