import { describe, expect, it } from "vitest";
import { SCORING } from "../src/constants.ts";
import { buildMatchResults, compareResults, scoreRoster } from "../src/scoring.ts";
import { holding, player, poke } from "./helpers.ts";

const venusaur = poke(3, "venusaur", 1, ["grass", "poison"], 525);
const charizard = poke(6, "charizard", 1, ["fire", "flying"], 534);
const tyranitar = poke(248, "tyranitar", 2, ["rock", "dark"], 600);

describe("scoring", () => {
  it("exports the four scoring constants from one object", () => {
    expect(SCORING).toEqual({
      coveragePerDistinctType: 40,
      spreadPerDistinctGeneration: 30,
      frugalityPerUnspentDollar: 10,
    });
  });

  it("scores base BST, distinct types, distinct generations, and unspent dollars", () => {
    const breakdown = scoreRoster(
      [holding(venusaur, 5), holding(charizard, 8), holding(tyranitar, 4)],
      8,
    );

    expect(breakdown.base).toBe(525 + 534 + 600);
    expect(breakdown.coverage).toBe(6 * 40);
    expect(breakdown.spread).toBe(2 * 30);
    expect(breakdown.frugality).toBe(8 * 10);
    expect(breakdown.dollarsSpent).toBe(17);
    expect(breakdown.total).toBe(
      breakdown.base + breakdown.coverage + breakdown.spread + breakdown.frugality,
    );
  });

  it("does not double-count a repeated type or generation", () => {
    const twoFires = scoreRoster(
      [
        holding(charizard, 1),
        holding(poke(250, "ho-oh", 2, ["fire", "flying"], 680), 1),
      ],
      0,
    );
    expect(twoFires.coverage).toBe(2 * 40);
    expect(twoFires.spread).toBe(2 * 30);
  });

  it("breaks ties by fewest dollars spent", () => {
    const players = [
      player({ id: "a", name: "Ash", budget: 5, isHost: true }),
      player({ id: "b", name: "Brock", budget: 5 }),
    ];
    const results = buildMatchResults(players, {
      a: [holding(venusaur, 20)],
      b: [holding(venusaur, 10)],
    });
    expect(results[0]?.playerId).toBe("b");
    expect(results[0]?.isWinner).toBe(true);
    expect(results[1]?.isWinner).toBe(false);
    expect(compareResults(results[0]!, results[1]!)).toBeLessThan(0);
  });
});
