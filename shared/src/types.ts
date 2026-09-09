import type {
  BidIncrement,
  Generation,
  TurnTimerSeconds,
} from "./constants.ts";

export type Phase = "LOBBY" | "AUCTION" | "REVEALED";

export type PoolScarcity = "exact" | "tight";

export type PokemonType =
  | "normal"
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy";

export interface Pokemon {
  id: number;
  name: string;
  generation: Generation;
  types: PokemonType[];
  spriteUrl: string;
  baseStatTotal: number;
}

export interface MatchSettings {
  startingBudget: number;
  rosterSize: number;
  turnTimerSeconds: TurnTimerSeconds;
  bidIncrement: BidIncrement;
  generations: Generation[];
  poolScarcity: PoolScarcity;
}

export type SettingsPatch = {
  startingBudget?: number;
  rosterSize?: number;
  turnTimerSeconds?: TurnTimerSeconds;
  bidIncrement?: BidIncrement;
  generations?: Generation[];
  poolScarcity?: PoolScarcity;
};

export interface Player {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  budget: number;
  wins: number;
  seatedAt: number;
  connectedAt: number;
  disconnectedAt: number | null;
}

export interface Spectator {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: number;
  connectedAt: number;
  disconnectedAt: number | null;
}

export interface ChatMessage {
  id: string;
  kind: "player" | "system";
  playerId: string | null;
  name: string | null;
  text: string;
  ts: number;
}

export interface Holding {
  lotId: string;
  pokemon: Pokemon;
  cost: number;
}

export interface InternalLot {
  lotId: string;
  pokemon: Pokemon;
  currentBid: number;
  currentBidderId: string | null;
  passedPlayerIds: string[];
  turnPlayerId: string | null;
  turnEndsAt: number | null;
}

export interface PublicLot {
  lotId: string;
  generation: Generation;
  types: PokemonType[];
  currentBid: number;
  currentBidderId: string | null;
  passedPlayerIds: string[];
  turnPlayerId: string | null;
  turnEndsAt: number | null;
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  budget: number;
  rosterCount: number;
  wins: number;
}

export interface PublicSpectator {
  id: string;
  name: string;
  connected: boolean;
}

export interface HiddenHolding {
  lotId: string;
  generation: Generation;
  types: PokemonType[];
  cost: number;
}

export interface RevealedHolding {
  lotId: string;
  pokemon: Pokemon;
  cost: number;
}

export interface ScoreBreakdown {
  base: number;
  coverage: number;
  spread: number;
  frugality: number;
  total: number;
  dollarsSpent: number;
}

export interface MatchResult {
  playerId: string;
  name: string;
  color: string;
  holdings: RevealedHolding[];
  remainingBudget: number;
  score: ScoreBreakdown;
  placement: number;
  isWinner: boolean;
}

export interface PublicMatchResult {
  playerId: string;
  name: string;
  color: string;
  holdings: HiddenHolding[] | RevealedHolding[];
  remainingBudget: number;
  score: ScoreBreakdown;
  placement: number;
  isWinner: boolean;
}

export interface PublicState {
  version: number;
  phase: Phase;
  roomCode: string;
  settings: MatchSettings;
  players: PublicPlayer[];
  spectators: PublicSpectator[];
  chat: ChatMessage[];
  turnOrder: string[];
  currentLot: PublicLot | null;
  winTally: Record<string, number>;
  openSeats: number;
  results: PublicMatchResult[] | null;
}

export interface RoomState {
  roomCode: string;
  version: number;
  phase: Phase;
  settings: MatchSettings;
  createdAt: number;
  players: Player[];
  spectators: Spectator[];
  chat: ChatMessage[];
  chatRate: Record<string, number[]>;
  nextChatSeq: number;
  nextLotSeq: number;
  pool: Pokemon[];
  currentLot: InternalLot | null;
  rosters: Record<string, Holding[]>;
  turnOrder: string[];
  nextTurnCursor: number;
  allPassStreak: number;
  results: MatchResult[] | null;
}

export interface BidderView {
  id: string;
  budget: number;
  rosterCount: number;
}

export type ErrorCode =
  | "NOT_HOST"
  | "INVALID_PHASE"
  | "NOT_YOUR_TURN"
  | "ALREADY_PASSED"
  | "BID_TOO_LOW"
  | "BID_NOT_INCREMENT"
  | "BID_EXCEEDS_BUDGET"
  | "ROSTER_FULL"
  | "LOT_MISMATCH"
  | "NO_ACTIVE_LOT"
  | "NOT_SEATED"
  | "ROOM_FULL"
  | "NO_SEAT_AVAILABLE"
  | "ALREADY_SEATED"
  | "INVALID_SETTINGS"
  | "INVALID_NAME"
  | "INVALID_PLAYER"
  | "CHAT_TOO_LONG"
  | "CHAT_RATE_LIMIT"
  | "NOT_ENOUGH_PLAYERS"
  | "PLAYERS_NOT_READY"
  | "CANNOT_TARGET_SELF"
  | "UNKNOWN_MESSAGE"
  | "NO_CATALOG";

export interface EngineError {
  code: ErrorCode;
  message: string;
}

export type EngineEffect =
  | { type: "BROADCAST_STATE" }
  | { type: "SEND_YOUR_ROSTER"; playerId: string }
  | { type: "SEND_CHAT_HISTORY"; playerId: string }
  | { type: "CHAT_MESSAGE"; message: ChatMessage };

export interface ApplyResult {
  state: RoomState;
  effects: EngineEffect[];
  error?: EngineError;
}

export type YourRosterPayload = HiddenHolding[] | RevealedHolding[];
