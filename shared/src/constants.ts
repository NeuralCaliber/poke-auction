export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export const MIN_BUDGET = 10;
export const MAX_BUDGET = 100;
export const DEFAULT_BUDGET = 25;

export const MIN_ROSTER_SIZE = 3;
export const MAX_ROSTER_SIZE = 8;
export const DEFAULT_ROSTER_SIZE = 6;

export const TURN_TIMER_OPTIONS = [10, 20, 30, 60] as const;
export type TurnTimerSeconds = (typeof TURN_TIMER_OPTIONS)[number];
export const DEFAULT_TURN_TIMER: TurnTimerSeconds = 20;

export const BID_INCREMENT_OPTIONS = [1, 5] as const;
export type BidIncrement = (typeof BID_INCREMENT_OPTIONS)[number];
export const DEFAULT_BID_INCREMENT: BidIncrement = 1;

export const ALL_GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type Generation = (typeof ALL_GENERATIONS)[number];

export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 100;
export const CHAT_RATE_LIMIT_COUNT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;

export const PLAYER_NAME_MAX_LENGTH = 20;

export const LOBBY_DISCONNECT_DROP_MS = 60_000;
export const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;

export const PLAYER_COLORS = [
  "#E63946",
  "#2A9D8F",
  "#E9C46A",
  "#7B2CBF",
  "#00B4D8",
  "#F4A261",
] as const;

export const SCORING = {
  coveragePerDistinctType: 40,
  spreadPerDistinctGeneration: 30,
  frugalityPerUnspentDollar: 10,
} as const;

export const DEFAULT_SETTINGS = {
  startingBudget: DEFAULT_BUDGET,
  rosterSize: DEFAULT_ROSTER_SIZE,
  turnTimerSeconds: DEFAULT_TURN_TIMER,
  bidIncrement: DEFAULT_BID_INCREMENT,
  generations: [...ALL_GENERATIONS],
  poolScarcity: "exact" as const,
};
