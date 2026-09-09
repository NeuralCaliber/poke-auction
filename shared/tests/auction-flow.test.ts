import { describe, expect, it } from "vitest";
import {
  applyPassToLot,
  awardLot,
  distributeLeftovers,
  leftoverQueue,
  lotIsAllPass,
  lotIsWon,
  recycleLot,
  shouldEndAuction,
} from "../src/auction.ts";
import { createSeededRng } from "../src/rng.ts";
import { holding, lot, player, poke, room } from "./helpers.ts";

const mewtwo = poke(150, "mewtwo", 1, ["psychic"], 680);
const gengar = poke(94, "gengar", 1, ["ghost", "poison"], 500);
const pikachu = poke(25, "pikachu", 1, ["electric"], 320);

describe("lot resolution", () => {
  it("awards the lot to the remaining bidder and charges their bid", () => {
    const state = room({
      phase: "AUCTION",
      currentLot: lot({
        pokemon: mewtwo,
        currentBid: 12,
        currentBidderId: "a",
        passedPlayerIds: ["b"],
        turnPlayerId: null,
      }),
    });

    expect(lotIsWon(state, state.currentLot!)).toBe(true);
    const awarded = awardLot(state, state.currentLot!);
    expect(awarded.winnerId).toBe("a");
    expect(awarded.state.players.find((p) => p.id === "a")?.budget).toBe(13);
    expect(awarded.state.rosters.a).toEqual([
      expect.objectContaining({ cost: 12, pokemon: mewtwo }),
    ]);
    expect(awarded.state.currentLot).toBeNull();
  });

  it("ends the lot as soon as nobody else can raise", () => {
    const state = room({
      phase: "AUCTION",
      currentLot: lot({
        pokemon: mewtwo,
        currentBid: 24,
        currentBidderId: "a",
        turnPlayerId: "b",
      }),
      players: [
        player({ id: "a", name: "Ash", budget: 25, isHost: true }),
        player({ id: "b", name: "Brock", budget: 24 }),
      ],
    });
    expect(lotIsWon(state, state.currentLot!)).toBe(true);
  });
});

describe("all-pass handling", () => {
  it("returns the lot to the bottom of the pool when everyone passes with no bid", () => {
    const active = lot({
      pokemon: mewtwo,
      passedPlayerIds: ["a", "b"],
      turnPlayerId: "b",
    });
    const state = room({
      phase: "AUCTION",
      pool: [gengar, pikachu],
      currentLot: active,
    });

    expect(lotIsAllPass(state, active)).toBe(true);
    const recycled = recycleLot(state, active);
    expect(recycled.currentLot).toBeNull();
    expect(recycled.pool.map((p) => p.name)).toEqual(["gengar", "pikachu", "mewtwo"]);
  });

  it("is not an all-pass if someone has already bid", () => {
    const active = applyPassToLot(
      lot({
        pokemon: mewtwo,
        currentBid: 5,
        currentBidderId: "a",
        passedPlayerIds: ["b"],
      }),
      "b",
    );
    const state = room({ phase: "AUCTION", currentLot: active });
    expect(lotIsAllPass(state, active)).toBe(false);
    expect(lotIsWon(state, active)).toBe(true);
  });
});

describe("end-of-auction detection", () => {
  it("ends when the pool and current lot are empty", () => {
    expect(shouldEndAuction(room({ phase: "AUCTION", pool: [], currentLot: null }))).toBe(true);
  });

  it("ends when nobody can afford another opening bid", () => {
    const state = room({
      phase: "AUCTION",
      pool: [mewtwo],
      currentLot: null,
      settings: { ...room().settings, bidIncrement: 5, rosterSize: 6 },
      players: [
        player({ id: "a", name: "Ash", budget: 4, isHost: true }),
        player({ id: "b", name: "Brock", budget: 3 }),
      ],
    });
    expect(shouldEndAuction(state)).toBe(true);
  });

  it("continues while at least one player has roster space and can open", () => {
    const state = room({
      phase: "AUCTION",
      pool: [mewtwo],
      players: [
        player({ id: "a", name: "Ash", budget: 1, isHost: true }),
        player({ id: "b", name: "Brock", budget: 0 }),
      ],
    });
    expect(shouldEndAuction(state)).toBe(false);
  });

  it("ends when every seated player already has a full roster", () => {
    const state = room({
      phase: "AUCTION",
      pool: [mewtwo],
      settings: { ...room().settings, rosterSize: 1 },
      rosters: {
        a: [holding(gengar, 5)],
        b: [holding(pikachu, 2)],
      },
    });
    expect(shouldEndAuction(state)).toBe(true);
  });
});

describe("leftover distribution", () => {
  it("gives remaining pokemon at cost 0 until rosters are full or the pool empties", () => {
    const state = room({
      phase: "AUCTION",
      settings: { ...room().settings, rosterSize: 2 },
      pool: [gengar, pikachu],
      currentLot: lot({ pokemon: mewtwo }),
      rosters: {
        a: [holding(poke(6, "charizard", 1, ["fire", "flying"], 534), 8)],
        b: [],
      },
    });

    const leftover = leftoverQueue(state);
    expect(leftover.map((p) => p.name)).toEqual(["mewtwo", "gengar", "pikachu"]);

    const filled = distributeLeftovers(state, createSeededRng(7));
    expect(filled.pool).toEqual([]);
    expect(filled.currentLot).toBeNull();

    const counts = [
      filled.rosters.a?.length ?? 0,
      filled.rosters.b?.length ?? 0,
    ];
    expect(counts.reduce((sum, n) => sum + n, 0)).toBe(4);
    expect(counts[0]).toBeLessThanOrEqual(2);
    expect(counts[1]).toBeLessThanOrEqual(2);
    expect(filled.rosters.a?.every((h) => h.cost === 0 || h.cost === 8)).toBe(true);
    expect(filled.rosters.b?.every((h) => h.cost === 0)).toBe(true);
  });

  it("stops when every roster is already full even if pokemon remain", () => {
    const state = room({
      phase: "AUCTION",
      settings: { ...room().settings, rosterSize: 1 },
      pool: [mewtwo, gengar],
      rosters: {
        a: [holding(pikachu, 1)],
        b: [holding(poke(9, "blastoise", 1, ["water"], 530), 2)],
      },
    });
    const filled = distributeLeftovers(state, createSeededRng(1));
    expect(filled.rosters.a).toHaveLength(1);
    expect(filled.rosters.b).toHaveLength(1);
  });
});
