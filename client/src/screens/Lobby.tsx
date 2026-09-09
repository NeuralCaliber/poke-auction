import type { ClientMessage, PublicState } from "@poke-auction/shared";
import { useState } from "react";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { PlayerList, ReadyAndStart } from "../components/PlayerList.tsx";
import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { joinUrl } from "../lib/format.ts";

export function Lobby({
  state,
  playerId,
  pending,
  send,
}: {
  state: PublicState;
  playerId: string;
  pending: ClientMessage["type"] | null;
  send: (message: ClientMessage) => boolean;
}) {
  const [copied, setCopied] = useState(false);
  const url = joinUrl(state.roomCode);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <section className="border-line bg-panel flex flex-col items-center gap-3 rounded-3xl border px-4 py-6">
        <p className="text-muted text-xs tracking-[0.3em] uppercase">Room code</p>
        <p className="font-display text-6xl tracking-[0.2em]">{state.roomCode}</p>
        <button
          type="button"
          onClick={() => void copy()}
          className="border-line min-h-11 rounded-2xl border px-4 text-sm"
        >
          {copied ? "Copied" : "Copy join link"}
        </button>
      </section>
      <PlayerList state={state} playerId={playerId} pending={pending !== null} send={send} />
      <SettingsPanel state={state} playerId={playerId} pending={pending !== null} send={send} />
      <ReadyAndStart state={state} playerId={playerId} pending={pending !== null} send={send} />
      <ChatPanel
        state={state}
        playerId={playerId}
        pending={pending === "CHAT"}
        onSend={(text) => send({ type: "CHAT", text })}
      />
    </div>
  );
}

export function SpectatingNote() {
  return (
    <p className="border-gold/40 bg-gold/10 text-gold rounded-2xl border px-4 py-3 text-sm">
      You're spectating. You'll see bids and budgets, but never hidden identities — even after the reveal.
    </p>
  );
}
