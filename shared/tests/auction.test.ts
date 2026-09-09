import { describe, expect, it } from "vitest";
import {
  canAffordRaise,
  isEligibleForLot,
  isEligibleToBid,
  minNextBid,
  validateBid,
  validatePass,
} from "../src/auction.ts";
import { lot, player, poke, room } from "./helpers.ts";

const mewtwo = poke(150, "mewtwo", 1, ["psychic"], 680);

describe("bid eligibility", () => {
  it("requires room on the roster and enough budget to make the next increment", () => {
    expect(isEligibleToBid({ id: "a", budget: 25, rosterCount: 0 }, 0, 6, 1)).toBe(true);
    expect(isEligibleToBid({ id: "a", budget: 0, rosterCount: 0 }, 0, 6, 1)).toBe(false);
    expect(isEligibleToBid({ id: "a", budget: 25, rosterCount: 6 }, 0, 6, 1)).toBe(false);
    expect(isEligibleToBid({ id: "a", budget: 5, rosterCount: 0 }, 4, 6, 1)).toBe(true);
    expect(isEligibleToBid({ id: "a", budget: 5, rosterCount: 0 }, 5, 6, 1)).toBe(false);
    expect(isEligibleToBid({ id: "a", budget: 4, rosterCount: 0 }, 0, 6, 5)).toBe(false);
  });

  it("follows the spec rule that remaining budget must exceed the current bid", () => {
    expect(isEligibleForLot({ id: "a", budget: 5, rosterCount: 0 }, 4, 6)).toBe(true);
    expect(isEligibleForLot({ id: "a", budget: 5, rosterCount: 0 }, 5, 6)).toBe(false);
    expect(isEligibleForLot({ id: "a", budget: 5, rosterCount: 6 }, 0, 6)).toBe(false);
  });

  it("opens at $0 so the first legal bid equals the increment", () => {
    expect(minNextBid(0, 1)).toBe(1);
    expect(minNextBid(0, 5)).toBe(5);
    expect(minNextBid(5, 5)).toBe(10);
  });

  it("treats a player as unable to raise when they cannot afford the next step", () => {
    const state = room({
      phase: "AUCTION",
      currentLot: lot({
        pokemon: mewtwo,
        currentBid: 20,
        currentBidderId: "b",
        turnPlayerId: "a",
      }),
      settings: { ...room().settings, bidIncrement: 5 },
      players: [
        player({ id: "a", name: "Ash", budget: 21, isHost: true }),
        player({ id: "b", name: "Brock", budget: 25 }),
      ],
    });
    expect(canAffordRaise(state, state.players[0]!, state.currentLot!)).toBe(false);
  });
});

describe("bid and pass validation", () => {
  const auction = () =>
    room({
      phase: "AUCTION",
      settings: {
        ...room().settings,
        bidIncrement: 5,
        rosterSize: 3,
      },
      currentLot: lot({
        pokemon: mewtwo,
        lotId: "lot_9",
        currentBid: 5,
        currentBidderId: "b",
        turnPlayerId: "a",
      }),
      players: [
        player({ id: "a", name: "Ash", budget: 20, isHost: true }),
        player({ id: "b", name: "Brock", budget: 25 }),
      ],
    });

  it("rejects a bid that is not the acting player's turn", () => {
    const error = validateBid(auction(), "b", "lot_9", 10);
    expect(error?.code).toBe("NOT_YOUR_TURN");
  });

  it("rejects an amount below current bid plus increment", () => {
    const error = validateBid(auction(), "a", "lot_9", 9);
    expect(error?.code).toBe("BID_TOO_LOW");
  });

  it("rejects an amount that is not an increment step", () => {
    const error = validateBid(auction(), "a", "lot_9", 11);
    expect(error?.code).toBe("BID_NOT_INCREMENT");
  });

  it("rejects a bid over remaining budget", () => {
    const error = validateBid(auction(), "a", "lot_9", 25);
    expect(error?.code).toBe("BID_EXCEEDS_BUDGET");
  });

  it("rejects a bid when the roster is already full", () => {
    const state = auction();
    state.rosters.a = [
      { lotId: "x", pokemon: mewtwo, cost: 1 },
      { lotId: "y", pokemon: mewtwo, cost: 1 },
      { lotId: "z", pokemon: mewtwo, cost: 1 },
    ];
    expect(validateBid(state, "a", "lot_9", 10)?.code).toBe("ROSTER_FULL");
  });

  it("rejects a bid for a stale lotId", () => {
    expect(validateBid(auction(), "a", "lot_other", 10)?.code).toBe("LOT_MISMATCH");
  });

  it("rejects pass when it is not that player's turn or they already passed", () => {
    expect(validatePass(auction(), "b", "lot_9")?.code).toBe("NOT_YOUR_TURN");
    const passed = auction();
    passed.currentLot!.passedPlayerIds = ["a"];
    expect(validatePass(passed, "a", "lot_9")?.code).toBe("ALREADY_PASSED");
  });
});
