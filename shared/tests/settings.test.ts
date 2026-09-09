import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/constants.ts";
import { computePoolSize } from "../src/pool.ts";
import { clampSettings, isValidSettings } from "../src/settings.ts";

describe("settings validation and clamping", () => {
  it("starts from the documented defaults", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      startingBudget: 25,
      rosterSize: 6,
      turnTimerSeconds: 20,
      bidIncrement: 1,
      poolScarcity: "exact",
    });
    expect(DEFAULT_SETTINGS.generations).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(isValidSettings(DEFAULT_SETTINGS)).toBe(true);
  });

  it("clamps budget and roster size to their legal ranges", () => {
    const low = clampSettings({ startingBudget: 1, rosterSize: 1 });
    expect(low.startingBudget).toBe(10);
    expect(low.rosterSize).toBe(3);

    const high = clampSettings({ startingBudget: 999, rosterSize: 99 });
    expect(high.startingBudget).toBe(100);
    expect(high.rosterSize).toBe(8);
  });

  it("keeps the previous timer and increment when given an illegal option", () => {
    const clamped = clampSettings({
      turnTimerSeconds: 15 as never,
      bidIncrement: 2 as never,
    });
    expect(clamped.turnTimerSeconds).toBe(20);
    expect(clamped.bidIncrement).toBe(1);
  });

  it("accepts the four legal timers and both increments", () => {
    for (const turnTimerSeconds of [10, 20, 30, 60] as const) {
      expect(clampSettings({ turnTimerSeconds }).turnTimerSeconds).toBe(turnTimerSeconds);
    }
    expect(clampSettings({ bidIncrement: 5 }).bidIncrement).toBe(5);
  });

  it("drops invalid generations and refuses an empty selection by keeping the previous list", () => {
    const filtered = clampSettings({ generations: [1, 9, 12 as never, 1] });
    expect(filtered.generations).toEqual([1, 9]);

    const empty = clampSettings({ generations: [] }, filtered);
    expect(empty.generations).toEqual([1, 9]);
  });

  it("ignores an unknown scarcity value", () => {
    expect(clampSettings({ poolScarcity: "loose" as never }).poolScarcity).toBe("exact");
    expect(clampSettings({ poolScarcity: "tight" }).poolScarcity).toBe("tight");
  });

  it("computes exact and tight pool sizes from seated players and roster size", () => {
    expect(computePoolSize(4, 6, "exact")).toBe(24);
    expect(computePoolSize(4, 6, "tight")).toBe(19);
    expect(computePoolSize(2, 3, "tight")).toBe(4);
  });
});
