import { describe, expect, it } from "vitest";
import { authorize, canStartMatch, isHost } from "../src/permissions.ts";
import { player, room } from "./helpers.ts";

describe("host-permission checks", () => {
  const lobby = () =>
    room({
      players: [
        player({ id: "a", name: "Ash", isHost: true, ready: true }),
        player({ id: "b", name: "Brock", ready: true }),
      ],
    });

  it("recognizes the seated host", () => {
    expect(isHost(lobby(), "a")).toBe(true);
    expect(isHost(lobby(), "b")).toBe(false);
  });

  it("rejects host-only actions from non-hosts", () => {
    const state = lobby();
    for (const action of [
      "UPDATE_SETTINGS",
      "KICK_PLAYER",
      "TRANSFER_HOST",
      "START_MATCH",
      "RETURN_TO_LOBBY",
    ]) {
      expect(authorize(state, "b", action)?.code).toBe("NOT_HOST");
      if (action !== "RETURN_TO_LOBBY") {
        expect(authorize(state, "a", action)).toBeNull();
      }
    }
  });

  it("rejects lobby actions during an auction and auction actions in the lobby", () => {
    const duringAuction = room({ phase: "AUCTION" });
    expect(authorize(duringAuction, "a", "UPDATE_SETTINGS")?.code).toBe("INVALID_PHASE");
    expect(authorize(duringAuction, "a", "START_MATCH")?.code).toBe("INVALID_PHASE");
    expect(authorize(duringAuction, "a", "SET_READY")?.code).toBe("INVALID_PHASE");
    expect(authorize(duringAuction, "a", "KICK_PLAYER")?.code).toBe("INVALID_PHASE");
    expect(authorize(duringAuction, "a", "TAKE_SEAT")?.code).toBe("INVALID_PHASE");

    expect(authorize(lobby(), "a", "BID")?.code).toBe("INVALID_PHASE");
    expect(authorize(lobby(), "a", "PASS")?.code).toBe("INVALID_PHASE");
    expect(authorize(lobby(), "a", "RETURN_TO_LOBBY")?.code).toBe("INVALID_PHASE");
  });

  it("only allows RETURN_TO_LOBBY from the host during REVEALED", () => {
    const revealed = room({ phase: "REVEALED" });
    expect(authorize(revealed, "a", "RETURN_TO_LOBBY")).toBeNull();
    expect(authorize(revealed, "b", "RETURN_TO_LOBBY")?.code).toBe("NOT_HOST");
    expect(authorize(lobby(), "a", "RETURN_TO_LOBBY")?.code).toBe("INVALID_PHASE");
  });

  it("requires at least two seated players and every non-host ready", () => {
    expect(canStartMatch(room({ players: [player({ id: "a", name: "Ash", isHost: true })] }))?.code).toBe(
      "NOT_ENOUGH_PLAYERS",
    );

    const unready = lobby();
    unready.players[1]!.ready = false;
    expect(canStartMatch(unready)?.code).toBe("PLAYERS_NOT_READY");

    expect(canStartMatch(lobby())).toBeNull();
  });
});
