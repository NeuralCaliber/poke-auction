import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isValidRoomCode, normalizeRoomCode } from "@poke-auction/shared";
import { createRoom } from "../lib/api.ts";

export function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom();
      navigate(`/r/${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a room.");
      setBusy(false);
    }
  }

  function onJoin(event: FormEvent) {
    event.preventDefault();
    const roomCode = normalizeRoomCode(code);
    if (!isValidRoomCode(roomCode)) {
      setError("Enter a 4-character room code.");
      return;
    }
    navigate(`/r/${roomCode}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-5 py-10">
      <header className="flex flex-col gap-3">
        <p className="text-gold font-display text-sm tracking-[0.35em] uppercase">
          Blind bidding
        </p>
        <h1 className="font-display text-5xl leading-none">Poké Auction</h1>
        <p className="text-muted text-base leading-relaxed">
          2–6 trainers, one hidden pool. You only see generation and type until the gavel falls.
        </p>
      </header>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onCreate()}
          className="bg-gold text-ink min-h-12 rounded-2xl font-semibold disabled:opacity-40"
        >
          {busy ? "Opening a room…" : "Create room"}
        </button>
        <form className="flex gap-2" onSubmit={onJoin}>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={4}
            placeholder="ABCD"
            aria-label="Room code"
            className="border-line bg-panel min-h-12 flex-1 rounded-2xl border px-4 tracking-[0.4em] uppercase outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="border-gold text-gold min-h-12 rounded-2xl border-2 px-4 font-semibold"
          >
            Join
          </button>
        </form>
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </main>
  );
}
