import { DEFAULT_SETTINGS } from "../src/constants.ts";
import type {
  Holding,
  InternalLot,
  Player,
  Pokemon,
  PokemonType,
  RoomState,
  Spectator,
} from "../src/types.ts";
import type { Generation } from "../src/constants.ts";

export function poke(
  id: number,
  name: string,
  generation: Generation,
  types: PokemonType[],
  baseStatTotal: number,
): Pokemon {
  return {
    id,
    name,
    generation,
    types,
    spriteUrl: `https://sprites.test/${name}.png`,
    baseStatTotal,
  };
}

export const CATALOG: Pokemon[] = [
  poke(25, "pikachu", 1, ["electric"], 320),
  poke(6, "charizard", 1, ["fire", "flying"], 534),
  poke(9, "blastoise", 1, ["water"], 530),
  poke(3, "venusaur", 1, ["grass", "poison"], 525),
  poke(150, "mewtwo", 1, ["psychic"], 680),
  poke(94, "gengar", 1, ["ghost", "poison"], 500),
  poke(248, "tyranitar", 2, ["rock", "dark"], 600),
  poke(250, "ho-oh", 2, ["fire", "flying"], 680),
  poke(384, "rayquaza", 3, ["dragon", "flying"], 680),
  poke(448, "lucario", 4, ["fighting", "steel"], 525),
  poke(658, "greninja", 6, ["water", "dark"], 530),
  poke(887, "dragapult", 8, ["dragon", "ghost"], 600),
];

export function player(partial: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return {
    color: "#E63946",
    isHost: false,
    ready: false,
    connected: true,
    budget: 25,
    wins: 0,
    seatedAt: 0,
    connectedAt: 0,
    disconnectedAt: null,
    ...partial,
  };
}

export function lot(partial: Partial<InternalLot> & Pick<InternalLot, "pokemon">): InternalLot {
  return {
    lotId: "lot_1",
    currentBid: 0,
    currentBidderId: null,
    passedPlayerIds: [],
    turnPlayerId: "a",
    turnEndsAt: 20_000,
    ...partial,
  };
}

export function room(partial: Partial<RoomState> = {}): RoomState {
  const players = partial.players ?? [
    player({ id: "a", name: "Ash", isHost: true, color: "#E63946" }),
    player({ id: "b", name: "Brock", color: "#2A9D8F" }),
  ];
  return {
    roomCode: "ABCD",
    version: 1,
    phase: "LOBBY",
    settings: {
      ...DEFAULT_SETTINGS,
      generations: [...DEFAULT_SETTINGS.generations],
    },
    createdAt: 0,
    players,
    spectators: [] as Spectator[],
    chat: [],
    chatRate: {},
    nextChatSeq: 1,
    nextLotSeq: 2,
    pool: [],
    currentLot: null,
    rosters: Object.fromEntries(players.map((p) => [p.id, [] as Holding[]])),
    turnOrder: players.map((p) => p.id),
    nextTurnCursor: 0,
    allPassStreak: 0,
    results: null,
    ...partial,
  };
}

export function holding(pokemon: Pokemon, cost: number, lotId = `lot_${pokemon.id}`): Holding {
  return { lotId, pokemon, cost };
}
