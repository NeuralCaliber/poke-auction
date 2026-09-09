import {
  ALL_GENERATIONS,
  BID_INCREMENT_OPTIONS,
  DEFAULT_SETTINGS,
  MAX_BUDGET,
  MAX_ROSTER_SIZE,
  MIN_BUDGET,
  MIN_ROSTER_SIZE,
  TURN_TIMER_OPTIONS,
  type BidIncrement,
  type Generation,
  type TurnTimerSeconds,
} from "./constants.ts";
import type { MatchSettings, PoolScarcity, SettingsPatch } from "./types.ts";

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isGeneration(value: unknown): value is Generation {
  return isInteger(value) && value >= 1 && value <= 9;
}

export function clampSettings(
  patch: SettingsPatch,
  base: MatchSettings = DEFAULT_SETTINGS,
): MatchSettings {
  const startingBudget = isInteger(patch.startingBudget)
    ? clampInt(patch.startingBudget, MIN_BUDGET, MAX_BUDGET)
    : base.startingBudget;

  const rosterSize = isInteger(patch.rosterSize)
    ? clampInt(patch.rosterSize, MIN_ROSTER_SIZE, MAX_ROSTER_SIZE)
    : base.rosterSize;

  const turnTimerSeconds: TurnTimerSeconds =
    patch.turnTimerSeconds !== undefined &&
    (TURN_TIMER_OPTIONS as readonly number[]).includes(patch.turnTimerSeconds)
      ? patch.turnTimerSeconds
      : base.turnTimerSeconds;

  const bidIncrement: BidIncrement =
    patch.bidIncrement !== undefined &&
    (BID_INCREMENT_OPTIONS as readonly number[]).includes(patch.bidIncrement)
      ? patch.bidIncrement
      : base.bidIncrement;

  let generations = base.generations;
  if (patch.generations !== undefined) {
    const unique = [...new Set(patch.generations.filter(isGeneration))].sort(
      (a, b) => a - b,
    );
    if (unique.length > 0) generations = unique;
  }

  const poolScarcity: PoolScarcity =
    patch.poolScarcity === "exact" || patch.poolScarcity === "tight"
      ? patch.poolScarcity
      : base.poolScarcity;

  return {
    startingBudget,
    rosterSize,
    turnTimerSeconds,
    bidIncrement,
    generations,
    poolScarcity,
  };
}

export function settingsEqual(a: MatchSettings, b: MatchSettings): boolean {
  return (
    a.startingBudget === b.startingBudget &&
    a.rosterSize === b.rosterSize &&
    a.turnTimerSeconds === b.turnTimerSeconds &&
    a.bidIncrement === b.bidIncrement &&
    a.poolScarcity === b.poolScarcity &&
    a.generations.length === b.generations.length &&
    a.generations.every((g, i) => g === b.generations[i])
  );
}

export function formatSettingsChange(
  before: MatchSettings,
  after: MatchSettings,
): string {
  const parts: string[] = [];
  if (before.startingBudget !== after.startingBudget) {
    parts.push(`budget $${after.startingBudget}`);
  }
  if (before.rosterSize !== after.rosterSize) {
    parts.push(`roster ${after.rosterSize}`);
  }
  if (before.turnTimerSeconds !== after.turnTimerSeconds) {
    parts.push(`timer ${after.turnTimerSeconds}s`);
  }
  if (before.bidIncrement !== after.bidIncrement) {
    parts.push(`increment $${after.bidIncrement}`);
  }
  if (before.poolScarcity !== after.poolScarcity) {
    parts.push(`pool ${after.poolScarcity}`);
  }
  if (before.generations.join(",") !== after.generations.join(",")) {
    parts.push(
      after.generations.length === ALL_GENERATIONS.length
        ? "gens all"
        : `gens ${after.generations.join(",")}`,
    );
  }
  return parts.length > 0 ? parts.join(", ") : "settings unchanged";
}

export function isValidSettings(settings: MatchSettings): boolean {
  if (
    !isInteger(settings.startingBudget) ||
    settings.startingBudget < MIN_BUDGET ||
    settings.startingBudget > MAX_BUDGET
  ) {
    return false;
  }
  if (
    !isInteger(settings.rosterSize) ||
    settings.rosterSize < MIN_ROSTER_SIZE ||
    settings.rosterSize > MAX_ROSTER_SIZE
  ) {
    return false;
  }
  if (
    !(TURN_TIMER_OPTIONS as readonly number[]).includes(
      settings.turnTimerSeconds,
    )
  ) {
    return false;
  }
  if (
    !(BID_INCREMENT_OPTIONS as readonly number[]).includes(
      settings.bidIncrement,
    )
  ) {
    return false;
  }
  if (settings.generations.length < 1) return false;
  if (!settings.generations.every(isGeneration)) return false;
  if (settings.poolScarcity !== "exact" && settings.poolScarcity !== "tight") {
    return false;
  }
  return true;
}
