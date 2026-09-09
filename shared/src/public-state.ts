import { MAX_PLAYERS } from "./constants.ts";
import type {
  HiddenHolding,
  PublicLot,
  PublicMatchResult,
  PublicState,
  RevealedHolding,
  RoomState,
  YourRosterPayload,
} from "./types.ts";

export type Viewer = {
  playerId: string;
};

export function isSpectator(state: RoomState, playerId: string): boolean {
  return state.spectators.some((s) => s.id === playerId);
}

function toPublicLot(state: RoomState): PublicLot | null {
  const lot = state.currentLot;
  if (!lot) return null;
  return {
    lotId: lot.lotId,
    generation: lot.pokemon.generation,
    types: [...lot.pokemon.types],
    currentBid: lot.currentBid,
    currentBidderId: lot.currentBidderId,
    passedPlayerIds: [...lot.passedPlayerIds],
    turnPlayerId: lot.turnPlayerId,
    turnEndsAt: lot.turnEndsAt,
  };
}

function hideHolding(holding: {
  lotId: string;
  pokemon: { generation: number; types: string[] };
  cost: number;
}): HiddenHolding {
  return {
    lotId: holding.lotId,
    generation: holding.pokemon.generation as HiddenHolding["generation"],
    types: [...holding.pokemon.types] as HiddenHolding["types"],
    cost: holding.cost,
  };
}

function revealHolding(holding: {
  lotId: string;
  pokemon: RevealedHolding["pokemon"];
  cost: number;
}): RevealedHolding {
  return {
    lotId: holding.lotId,
    pokemon: { ...holding.pokemon, types: [...holding.pokemon.types] },
    cost: holding.cost,
  };
}

export function toPublicState(state: RoomState, viewer: Viewer): PublicState {
  const seated = state.players.some((p) => p.id === viewer.playerId);
  const revealIdentities = state.phase === "REVEALED" && seated;

  const results: PublicMatchResult[] | null = state.results
    ? state.results.map((result) => ({
        playerId: result.playerId,
        name: result.name,
        color: result.color,
        remainingBudget: result.remainingBudget,
        score: { ...result.score },
        placement: result.placement,
        isWinner: result.isWinner,
        holdings: revealIdentities
          ? result.holdings.map(revealHolding)
          : result.holdings.map(hideHolding),
      }))
    : null;

  return {
    version: state.version,
    phase: state.phase,
    roomCode: state.roomCode,
    settings: {
      ...state.settings,
      generations: [...state.settings.generations],
    },
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      isHost: player.isHost,
      ready: player.ready,
      connected: player.connected,
      budget: player.budget,
      rosterCount: state.rosters[player.id]?.length ?? 0,
      wins: player.wins,
    })),
    spectators: state.spectators.map((s) => ({
      id: s.id,
      name: s.name,
      connected: s.connected,
    })),
    chat: state.chat.map((m) => ({ ...m })),
    turnOrder: [...state.turnOrder],
    currentLot: toPublicLot(state),
    winTally: Object.fromEntries(state.players.map((p) => [p.id, p.wins])),
    openSeats: Math.max(0, MAX_PLAYERS - state.players.length),
    results,
  };
}

export function toYourRoster(
  state: RoomState,
  playerId: string,
): YourRosterPayload {
  const holdings = state.rosters[playerId] ?? [];
  if (state.phase === "REVEALED") {
    return holdings.map(revealHolding);
  }
  return holdings.map(hideHolding);
}

export function jsonContainsIdentity(
  value: unknown,
  pokemonName: string,
  spriteUrl: string,
): boolean {
  const json = JSON.stringify(value);
  return (
    json.includes(pokemonName) ||
    json.includes(spriteUrl) ||
    json.includes("spriteUrl") ||
    json.includes("baseStatTotal")
  );
}
