import { PLAYER_NAME_MAX_LENGTH } from "@poke-auction/shared";
import { FormEvent, useState } from "react";

export function NamePrompt({
  initialName,
  onSubmit,
}: {
  initialName: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    onSubmit(trimmed);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <p className="text-gold font-display text-sm tracking-[0.2em] uppercase">
        Take your seat
      </p>
      <h1 className="font-display text-4xl leading-none">What should we call you?</h1>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="text-muted text-sm" htmlFor="trainer-name">
          Trainer name
        </label>
        <input
          id="trainer-name"
          autoFocus
          maxLength={PLAYER_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="border-line bg-panel min-h-12 rounded-2xl border px-4 text-lg outline-none focus:border-gold"
          placeholder="Ash"
        />
        <button
          type="submit"
          disabled={name.trim().length < 1}
          className="bg-gold text-ink min-h-12 rounded-2xl font-semibold disabled:opacity-40"
        >
          Enter lobby
        </button>
      </form>
    </main>
  );
}
