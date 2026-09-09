import { describe, expect, it } from "vitest";
import { jsonContainsIdentity, toPublicState, toYourRoster } from "../src/public-state.ts";
import { holding, lot, player, poke, room } from "./helpers.ts";

const mewtwo = poke(150, "mewtwo", 1, ["psychic"], 680);
const gengar = poke(94, "gengar", 1, ["ghost", "poison"], 500);

describe("public state redaction", () => {
  it("strips names, sprites, and stats from public state during AUCTION", () => {
    const state = room({
      phase: "AUCTION",
      pool: [gengar],
      currentLot: lot({
        pokemon: mewtwo,
        currentBid: 7,
        currentBidderId: "a",
        turnPlayerId: "b",
        turnEndsAt: 1_700_000_000_000,
      }),
      rosters: {
        a: [holding(gengar, 3)],
        b: [],
      },
    });

    const publicState = toPublicState(state, { playerId: "a" });
    const json = JSON.stringify(publicState);

    expect(publicState.currentLot).toMatchObject({
      generation: 1,
      types: ["psychic"],
      currentBid: 7,
      currentBidderId: "a",
      turnPlayerId: "b",
    });
    expect(publicState.players[0]?.rosterCount).toBe(1);
    expect(publicState.players[0]?.budget).toBe(25);

    expect(json).not.toContain("mewtwo");
    expect(json).not.toContain("gengar");
    expect(json).not.toContain(mewtwo.spriteUrl);
    expect(json).not.toContain(gengar.spriteUrl);
    expect(json).not.toContain("spriteUrl");
    expect(json).not.toContain("baseStatTotal");
    expect(jsonContainsIdentity(publicState, "mewtwo", mewtwo.spriteUrl)).toBe(false);

    expect(JSON.stringify(state.currentLot)).toContain("mewtwo");
  });

  it("keeps a player's own holdings hidden until REVEALED", () => {
    const state = room({
      phase: "AUCTION",
      rosters: { a: [holding(mewtwo, 12)] },
    });
    const hidden = toYourRoster(state, "a");
    expect(hidden).toEqual([
      { lotId: "lot_150", generation: 1, types: ["psychic"], cost: 12 },
    ]);
    expect(jsonContainsIdentity(hidden, "mewtwo", mewtwo.spriteUrl)).toBe(false);
  });

  it("reveals identities to seated players after the match, but not to spectators", () => {
    const state = room({
      phase: "REVEALED",
      spectators: [
        {
          id: "s",
          name: "Watcher",
          connected: true,
          joinedAt: 0,
          connectedAt: 0,
          disconnectedAt: null,
        },
      ],
      results: [
        {
          playerId: "a",
          name: "Ash",
          color: "#E63946",
          holdings: [holding(mewtwo, 12)],
          remainingBudget: 13,
          score: {
            base: 680,
            coverage: 40,
            spread: 30,
            frugality: 130,
            total: 880,
            dollarsSpent: 12,
          },
          placement: 1,
          isWinner: true,
        },
      ],
    });

    const seated = toPublicState(state, { playerId: "a" });
    expect(JSON.stringify(seated)).toContain("mewtwo");
    expect(JSON.stringify(seated)).toContain(mewtwo.spriteUrl);

    const spectator = toPublicState(state, { playerId: "s" });
    expect(jsonContainsIdentity(spectator, "mewtwo", mewtwo.spriteUrl)).toBe(false);
    expect(spectator.results?.[0]?.holdings).toEqual([
      { lotId: "lot_150", generation: 1, types: ["psychic"], cost: 12 },
    ]);

    const stranger = toPublicState(state, { playerId: "unknown" });
    expect(jsonContainsIdentity(stranger, "mewtwo", mewtwo.spriteUrl)).toBe(false);
  });
});
