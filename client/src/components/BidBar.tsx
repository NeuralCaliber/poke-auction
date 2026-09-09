import {
  minNextBid,
  publicBidBlockReason,
  type ClientMessage,
  type PublicState,
} from "@poke-auction/shared";
import { remainingSeconds, useNow } from "../hooks/useNow.ts";

export function BidBar({
  state,
  playerId,
  pending,
  send,
}: {
  state: PublicState;
  playerId: string;
  pending: boolean;
  send: (message: ClientMessage) => boolean;
}) {
  const lot = state.currentLot;
  const me = state.players.find((player) => player.id === playerId);
  const now = useNow();
  if (!lot) return null;

  const reason = publicBidBlockReason(state, playerId);
  const minBid = minNextBid(lot.currentBid, state.settings.bidIncrement);
  const seconds = remainingSeconds(lot.turnEndsAt, now);
  const myTurn = lot.turnPlayerId === playerId;
  const turnPlayer = state.players.find((player) => player.id === lot.turnPlayerId);
  const disabled = pending || Boolean(reason);

  return (
    <section className="border-line bg-panel/95 sticky bottom-0 z-20 flex flex-col gap-3 rounded-t-3xl border p-4 backdrop-blur">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-muted text-xs tracking-wide uppercase">Current bid</p>
          <p className="font-display text-3xl">${lot.currentBid}</p>
          {lot.currentBidderId && (
            <p className="text-muted text-xs">
              High bidder: {state.players.find((p) => p.id === lot.currentBidderId)?.name ?? "—"}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-muted text-xs tracking-wide uppercase">Turn</p>
          <p className="font-semibold">{myTurn ? "You" : (turnPlayer?.name ?? "—")}</p>
          <p className="text-gold text-sm">{seconds === null ? "—" : `${seconds}s`}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => send({ type: "BID", lotId: lot.lotId, amount: minBid })}
          className="bg-gold text-ink min-h-12 flex-1 rounded-2xl font-semibold disabled:opacity-40"
        >
          Bid ${minBid}
        </button>
        <button
          type="button"
          disabled={pending || !myTurn || lot.passedPlayerIds.includes(playerId) || !me}
          onClick={() => send({ type: "PASS", lotId: lot.lotId })}
          className="border-line min-h-12 flex-1 rounded-2xl border font-semibold disabled:opacity-40"
        >
          Pass
        </button>
      </div>
      {reason && <p className="text-muted text-center text-xs">{reason}</p>}
    </section>
  );
}
