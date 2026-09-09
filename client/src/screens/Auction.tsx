import type { ClientMessage, PublicState, YourRosterPayload } from "@poke-auction/shared";
import { BidBar } from "../components/BidBar.tsx";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { PlayerList } from "../components/PlayerList.tsx";
import { SealedLots, SilhouetteCard } from "../components/SilhouetteCard.tsx";
import { SpectatingNote } from "./Lobby.tsx";

export function Auction({
  state,
  playerId,
  roster,
  pending,
  send,
}: {
  state: PublicState;
  playerId: string;
  roster: YourRosterPayload;
  pending: ClientMessage["type"] | null;
  send: (message: ClientMessage) => boolean;
}) {
  const seated = state.players.some((player) => player.id === playerId);
  const lot = state.currentLot;

  return (
    <div className="flex flex-col gap-4 pb-4">
      {!seated && <SpectatingNote />}
      {lot ? <SilhouetteCard lot={lot} /> : (
        <p className="text-muted text-center">Waiting for the next lot…</p>
      )}
      <PlayerList state={state} playerId={playerId} pending={pending !== null} send={send} />
      {seated && (
        <section className="border-line bg-panel rounded-3xl border p-4">
          <h2 className="font-display mb-3 text-sm tracking-wide uppercase">Your sealed lots</h2>
          <SealedLots roster={roster} />
        </section>
      )}
      <ChatPanel
        state={state}
        playerId={playerId}
        pending={pending === "CHAT"}
        onSend={(text) => send({ type: "CHAT", text })}
      />
      {seated && (
        <BidBar
          state={state}
          playerId={playerId}
          pending={pending === "BID" || pending === "PASS"}
          send={send}
        />
      )}
    </div>
  );
}
