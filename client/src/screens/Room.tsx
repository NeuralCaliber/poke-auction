import { isValidRoomCode, normalizeRoomCode } from "@poke-auction/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConnectionDot, ErrorToast, ReconnectingBanner } from "../components/ConnectionBar.tsx";
import { NamePrompt } from "../components/NamePrompt.tsx";
import { SettingsPanel } from "../components/SettingsPanel.tsx";
import { useRoomConnection } from "../hooks/useRoomConnection.ts";
import { fetchRoom } from "../lib/api.ts";
import { getPlayerId, getStoredName, setStoredName } from "../lib/identity.ts";
import { Auction } from "./Auction.tsx";
import { Lobby } from "./Lobby.tsx";
import { Revealed } from "./Revealed.tsx";

export function Room() {
  const params = useParams();
  const roomCode = normalizeRoomCode(params.code ?? "");
  const playerId = useMemo(() => getPlayerId(), []);
  const [name, setName] = useState<string | null>(() => getStoredName());
  const [lookup, setLookup] = useState<"loading" | "missing" | "ready" | "invalid">(
    isValidRoomCode(roomCode) ? "loading" : "invalid",
  );

  useEffect(() => {
    if (!isValidRoomCode(roomCode)) return;
    let cancelled = false;
    void fetchRoom(roomCode)
      .then((room) => {
        if (cancelled) return;
        setLookup(room.exists ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setLookup("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  if (lookup === "invalid" || lookup === "missing") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <h1 className="font-display text-3xl">
          {lookup === "invalid" ? "That code isn't valid." : "Room not found."}
        </h1>
        <p className="text-muted">Ask the host for a fresh link, or open a new room.</p>
        <Link to="/" className="bg-gold text-ink flex min-h-12 items-center justify-center rounded-2xl font-semibold">
          Back home
        </Link>
      </main>
    );
  }

  if (lookup === "loading") {
    return (
      <main className="text-muted flex min-h-dvh items-center justify-center">Looking up the room…</main>
    );
  }

  if (!name) {
    return (
      <NamePrompt
        initialName=""
        onSubmit={(value) => {
          setStoredName(value);
          setName(value);
        }}
      />
    );
  }

  return (
    <ConnectedRoom roomCode={roomCode} playerId={playerId} name={name} />
  );
}

function ConnectedRoom({
  roomCode,
  playerId,
  name,
}: {
  roomCode: string;
  playerId: string;
  name: string;
}) {
  const { status, state, roster, error, pending, send, dismissError } =
    useRoomConnection({ roomCode, playerId, name });

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="font-display text-lg">Poké Auction</p>
          <p className="text-muted text-xs tracking-[0.2em] uppercase">{roomCode}</p>
        </div>
        <ConnectionDot status={status} />
      </header>
      <ReconnectingBanner status={status} />
      <main className="flex flex-1 flex-col px-4">
        {!state && (
          <p className="text-muted py-10 text-center">Waiting for room state…</p>
        )}
        {state?.phase === "LOBBY" && (
          <Lobby state={state} playerId={playerId} pending={pending} send={send} />
        )}
        {state?.phase === "AUCTION" && (
          <>
            <Auction
              state={state}
              playerId={playerId}
              roster={roster}
              pending={pending}
              send={send}
            />
            <div className="pb-4">
              <SettingsPanel state={state} playerId={playerId} pending={pending !== null} send={send} />
            </div>
          </>
        )}
        {state?.phase === "REVEALED" && (
          <>
            <Revealed state={state} playerId={playerId} pending={pending} send={send} />
            <SettingsPanel state={state} playerId={playerId} pending={pending !== null} send={send} />
          </>
        )}
      </main>
      <ErrorToast message={error} onDismiss={dismissError} />
    </div>
  );
}
