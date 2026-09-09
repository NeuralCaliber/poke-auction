import type {
  BidderView,
  EngineError,
  Holding,
  InternalLot,
  MatchSettings,
  Player,
  Pokemon,
  PublicState,
  RoomState,
} from "./types.ts";
import type { Rng } from "./rng.ts";

export function minNextBid(currentBid: number, increment: number): number {
  return currentBid === 0 ? increment : currentBid + increment;
}

export function isEligibleToBid(
  bidder: BidderView,
  currentBid: number,
  rosterSize: number,
  increment: number,
): boolean {
  return (
    bidder.rosterCount < rosterSize &&
    bidder.budget >= minNextBid(currentBid, increment)
  );
}

export function budgetExceedsBid(budget: number, currentBid: number): boolean {
  return budget > currentBid;
}

export function isEligibleForLot(
  bidder: BidderView,
  currentBid: number,
  rosterSize: number,
): boolean {
  return bidder.rosterCount < rosterSize && budgetExceedsBid(bidder.budget, currentBid);
}

export function bidderFromPlayer(
  player: Player,
  rosterCount: number,
): BidderView {
  return { id: player.id, budget: player.budget, rosterCount };
}

export function rosterCountOf(state: RoomState, playerId: string): number {
  return state.rosters[playerId]?.length ?? 0;
}

function bidderView(state: RoomState, player: Player): BidderView {
  return bidderFromPlayer(player, rosterCountOf(state, player.id));
}

export function canAffordRaise(
  state: RoomState,
  player: Player,
  lot: InternalLot,
): boolean {
  return isEligibleToBid(
    bidderView(state, player),
    lot.currentBid,
    state.settings.rosterSize,
    state.settings.bidIncrement,
  );
}

export function hasPassed(lot: InternalLot, playerId: string): boolean {
  return lot.passedPlayerIds.includes(playerId);
}

export function canActThisTurn(
  state: RoomState,
  lot: InternalLot,
  playerId: string,
): boolean {
  if (hasPassed(lot, playerId)) return false;
  if (lot.currentBidderId === playerId) return false;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return false;
  return canAffordRaise(state, player, lot);
}

export function nextActor(
  state: RoomState,
  lot: InternalLot,
  afterPlayerId: string | null,
): string | null {
  const order = state.turnOrder;
  if (order.length === 0) return null;
  const start =
    afterPlayerId && order.includes(afterPlayerId)
      ? (order.indexOf(afterPlayerId) + 1) % order.length
      : state.nextTurnCursor % order.length;

  for (let i = 0; i < order.length; i++) {
    const id = order[(start + i) % order.length];
    if (id && canActThisTurn(state, lot, id)) return id;
  }
  return null;
}

export function activeBiddersRemain(
  state: RoomState,
  lot: InternalLot,
): boolean {
  return state.players.some((player) => {
    if (player.id === lot.currentBidderId) return false;
    if (hasPassed(lot, player.id)) return false;
    return canAffordRaise(state, player, lot);
  });
}

export function anyoneEligibleForNewLot(state: RoomState): boolean {
  return state.players.some((player) =>
    isEligibleToBid(
      bidderView(state, player),
      0,
      state.settings.rosterSize,
      state.settings.bidIncrement,
    ),
  );
}

export function shouldEndAuction(state: RoomState): boolean {
  const remaining =
    state.pool.length + (state.currentLot ? 1 : 0);
  if (remaining === 0) return true;
  return !anyoneEligibleForNewLot(state);
}

export function validateBid(
  state: RoomState,
  actorId: string,
  lotId: string,
  amount: number,
): EngineError | null {
  if (state.phase !== "AUCTION") {
    return { code: "INVALID_PHASE", message: "Bidding is only allowed during the auction." };
  }
  const lot = state.currentLot;
  if (!lot) return { code: "NO_ACTIVE_LOT", message: "There is no active lot." };
  if (lot.lotId !== lotId) {
    return { code: "LOT_MISMATCH", message: "That lot is no longer active." };
  }
  if (!state.players.some((p) => p.id === actorId)) {
    return { code: "NOT_SEATED", message: "Spectators cannot bid." };
  }
  if (lot.turnPlayerId !== actorId) {
    return { code: "NOT_YOUR_TURN", message: "It is not your turn." };
  }
  if (hasPassed(lot, actorId)) {
    return { code: "ALREADY_PASSED", message: "You have already passed this lot." };
  }

  const player = state.players.find((p) => p.id === actorId)!;
  const increment = state.settings.bidIncrement;
  const min = minNextBid(lot.currentBid, increment);

  if (!Number.isInteger(amount) || amount < min) {
    return {
      code: "BID_TOO_LOW",
      message: `Bid must be at least $${min}.`,
    };
  }
  if (amount % increment !== 0) {
    return {
      code: "BID_NOT_INCREMENT",
      message: `Bids must be in steps of $${increment}.`,
    };
  }
  if (amount > player.budget) {
    return { code: "BID_EXCEEDS_BUDGET", message: "Bid exceeds your remaining budget." };
  }
  if (rosterCountOf(state, actorId) >= state.settings.rosterSize) {
    return { code: "ROSTER_FULL", message: "Your roster is already full." };
  }
  return null;
}

export function validatePass(
  state: RoomState,
  actorId: string,
  lotId: string,
): EngineError | null {
  if (state.phase !== "AUCTION") {
    return { code: "INVALID_PHASE", message: "Passing is only allowed during the auction." };
  }
  const lot = state.currentLot;
  if (!lot) return { code: "NO_ACTIVE_LOT", message: "There is no active lot." };
  if (lot.lotId !== lotId) {
    return { code: "LOT_MISMATCH", message: "That lot is no longer active." };
  }
  if (!state.players.some((p) => p.id === actorId)) {
    return { code: "NOT_SEATED", message: "Spectators cannot pass." };
  }
  if (lot.turnPlayerId !== actorId) {
    return { code: "NOT_YOUR_TURN", message: "It is not your turn." };
  }
  if (hasPassed(lot, actorId)) {
    return { code: "ALREADY_PASSED", message: "You have already passed this lot." };
  }
  return null;
}

export function applyBidToLot(
  lot: InternalLot,
  actorId: string,
  amount: number,
): InternalLot {
  return {
    ...lot,
    currentBid: amount,
    currentBidderId: actorId,
  };
}

export function applyPassToLot(lot: InternalLot, actorId: string): InternalLot {
  if (lot.passedPlayerIds.includes(actorId)) return lot;
  return {
    ...lot,
    passedPlayerIds: [...lot.passedPlayerIds, actorId],
  };
}

export function lotIsWon(state: RoomState, lot: InternalLot): boolean {
  return lot.currentBidderId !== null && !activeBiddersRemain(state, lot);
}

export function lotIsAllPass(state: RoomState, lot: InternalLot): boolean {
  if (lot.currentBidderId !== null) return false;
  return !state.turnOrder.some((id) => canActThisTurn(state, lot, id));
}

export function actionBlockReason(
  state: RoomState,
  playerId: string,
): string | null {
  if (state.phase !== "AUCTION") return "Auction is not in progress.";
  const lot = state.currentLot;
  if (!lot) return "No active lot.";
  if (!state.players.some((p) => p.id === playerId)) {
    return "Spectators cannot bid.";
  }
  if (rosterCountOf(state, playerId) >= state.settings.rosterSize) {
    return "Your roster is full.";
  }
  const player = state.players.find((p) => p.id === playerId)!;
  if (!canAffordRaise(state, player, lot)) {
    return "Not enough budget to raise.";
  }
  if (hasPassed(lot, playerId)) return "You have passed this lot.";
  if (lot.currentBidderId === playerId) return "You are the high bidder.";
  if (lot.turnPlayerId !== playerId) return "Waiting for another player.";
  return null;
}

export function publicBidBlockReason(
  state: Pick<PublicState, "phase" | "settings" | "currentLot" | "players">,
  playerId: string,
): string | null {
  if (state.phase !== "AUCTION") return "Auction is not in progress.";
  const lot = state.currentLot;
  if (!lot) return "No active lot.";
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Spectators cannot bid.";
  if (player.rosterCount >= state.settings.rosterSize) {
    return "Your roster is full.";
  }
  if (player.budget < minNextBid(lot.currentBid, state.settings.bidIncrement)) {
    return "Not enough budget to raise.";
  }
  if (lot.passedPlayerIds.includes(playerId)) return "You have passed this lot.";
  if (lot.currentBidderId === playerId) return "You are the high bidder.";
  if (lot.turnPlayerId !== playerId) return "Waiting for another player.";
  return null;
}

export function awardLot(
  state: RoomState,
  lot: InternalLot,
): { state: RoomState; winnerId: string; holding: Holding } {
  const winnerId = lot.currentBidderId;
  if (!winnerId) {
    throw new Error("Cannot award a lot with no bidder.");
  }
  const holding: Holding = {
    lotId: lot.lotId,
    pokemon: lot.pokemon,
    cost: lot.currentBid,
  };
  const winnerIndex = state.turnOrder.indexOf(winnerId);
  const nextTurnCursor =
    winnerIndex >= 0
      ? (winnerIndex + 1) % Math.max(state.turnOrder.length, 1)
      : state.nextTurnCursor;

  return {
    winnerId,
    holding,
    state: {
      ...state,
      currentLot: null,
      nextTurnCursor,
      players: state.players.map((player) =>
        player.id === winnerId
          ? { ...player, budget: player.budget - lot.currentBid }
          : player,
      ),
      rosters: {
        ...state.rosters,
        [winnerId]: [...(state.rosters[winnerId] ?? []), holding],
      },
    },
  };
}

export function recycleLot(state: RoomState, lot: InternalLot): RoomState {
  const startIndex = state.turnOrder.indexOf(lot.turnPlayerId ?? "");
  const nextTurnCursor =
    startIndex >= 0
      ? (startIndex + 1) % Math.max(state.turnOrder.length, 1)
      : (state.nextTurnCursor + 1) % Math.max(state.turnOrder.length, 1);

  return {
    ...state,
    currentLot: null,
    nextTurnCursor,
    pool: [...state.pool, lot.pokemon],
  };
}

export function openLot(
  state: RoomState,
  pokemon: Pokemon,
  now: number,
): RoomState {
  const lot: InternalLot = {
    lotId: `lot_${state.nextLotSeq}`,
    pokemon,
    currentBid: 0,
    currentBidderId: null,
    passedPlayerIds: [],
    turnPlayerId: null,
    turnEndsAt: null,
  };

  const withLot: RoomState = {
    ...state,
    nextLotSeq: state.nextLotSeq + 1,
    currentLot: lot,
  };

  const turnPlayerId = nextActor(withLot, lot, null);
  return {
    ...withLot,
    currentLot: {
      ...lot,
      turnPlayerId,
      turnEndsAt:
        turnPlayerId === null
          ? null
          : now + state.settings.turnTimerSeconds * 1000,
    },
  };
}

export function advanceTurn(
  state: RoomState,
  lot: InternalLot,
  afterPlayerId: string,
  now: number,
): InternalLot {
  const turnPlayerId = nextActor(
    { ...state, currentLot: lot },
    lot,
    afterPlayerId,
  );
  return {
    ...lot,
    turnPlayerId,
    turnEndsAt:
      turnPlayerId === null
        ? null
        : now + state.settings.turnTimerSeconds * 1000,
  };
}

export function playersNeedingPokemon(state: RoomState): Player[] {
  return state.players.filter(
    (player) => rosterCountOf(state, player.id) < state.settings.rosterSize,
  );
}

export function leftoverQueue(state: RoomState): Pokemon[] {
  const current = state.currentLot ? [state.currentLot.pokemon] : [];
  return [...current, ...state.pool];
}

export function distributeLeftovers(state: RoomState, rng: Rng): RoomState {
  const leftovers = rng.shuffle(leftoverQueue(state));
  let rosters: Record<string, Holding[]> = { ...state.rosters };
  let seq = state.nextLotSeq;

  for (const pokemon of leftovers) {
    const needy = state.players.filter(
      (player) => (rosters[player.id]?.length ?? 0) < state.settings.rosterSize,
    );
    if (needy.length === 0) break;
    const chosen = needy[rng.int(needy.length)]!;
    const lotId = `leftover_${seq}`;
    seq += 1;
    rosters = {
      ...rosters,
      [chosen.id]: [
        ...(rosters[chosen.id] ?? []),
        { lotId, pokemon, cost: 0 },
      ],
    };
  }

  return {
    ...state,
    pool: [],
    currentLot: null,
    rosters,
    nextLotSeq: seq,
  };
}
