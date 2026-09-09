import type { HiddenHolding, PublicLot, YourRosterPayload } from "@poke-auction/shared";
import { generationLabel, TYPE_COLORS } from "../lib/format.ts";

export function SilhouetteCard({ lot }: { lot: PublicLot }) {
  const glow = TYPE_COLORS[lot.types[0] ?? "normal"];
  return (
    <article
      className="border-line relative overflow-hidden rounded-3xl border p-5"
      style={{ background: `radial-gradient(circle at 50% 20%, ${glow}33, #151821 58%)` }}
    >
      <p className="text-gold font-display text-xs tracking-[0.25em] uppercase">
        Hidden lot
      </p>
      <div className="mt-4 flex flex-col items-center gap-4">
        <svg viewBox="0 0 120 140" className="h-40 w-36" aria-hidden>
          <ellipse cx="60" cy="128" rx="32" ry="6" fill="#000" opacity="0.35" />
          <path
            d="M60 18c14 0 28 12 32 30 3 14-2 24-8 32 8 6 16 18 14 30-2 16-18 24-38 24s-36-8-38-24c-2-12 6-24 14-30-6-8-11-18-8-32C32 30 46 18 60 18z"
            fill="#0b0c10"
          />
          <circle cx="48" cy="52" r="4" fill={glow} opacity="0.85" />
          <circle cx="72" cy="52" r="4" fill={glow} opacity="0.85" />
        </svg>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="bg-panel-2 rounded-full px-3 py-1 text-sm font-semibold">
            {generationLabel(lot.generation)}
          </span>
          {lot.types.map((type) => (
            <span
              key={type}
              className="rounded-full px-3 py-1 text-sm font-semibold text-ink"
              style={{ background: TYPE_COLORS[type] }}
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function SealedLots({ roster }: { roster: YourRosterPayload }) {
  const lots = roster.filter((item): item is HiddenHolding => !("pokemon" in item));
  if (lots.length === 0) {
    return (
      <p className="text-muted text-sm">You haven't won a lot yet. Identities stay sealed until the reveal.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {lots.map((lot) => (
        <li key={lot.lotId} className="border-line bg-panel-2 flex items-center justify-between rounded-2xl border px-3 py-2 text-sm">
          <span>
            {generationLabel(lot.generation)} · {lot.types.join("/")}
          </span>
          <span className="text-gold font-semibold">${lot.cost}</span>
        </li>
      ))}
    </ul>
  );
}
