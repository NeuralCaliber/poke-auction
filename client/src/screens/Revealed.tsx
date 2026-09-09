import {
  SCORING,
  type ClientMessage,
  type PublicMatchResult,
  type PublicState,
} from "@poke-auction/shared";
import { ChatPanel } from "../components/ChatPanel.tsx";
import { generationLabel, isRevealedHolding } from "../lib/format.ts";
import { SpectatingNote } from "./Lobby.tsx";

export function Revealed({
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
  const me = state.players.find((player) => player.id === playerId);
  const seated = Boolean(me);
  const results = state.results ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      {!seated && <SpectatingNote />}
      <header className="flex flex-col gap-1">
        <p className="text-gold font-display text-xs tracking-[0.3em] uppercase">Results</p>
        <h1 className="font-display text-3xl">The lots are open</h1>
      </header>
      {results.map((result) => (
        <ResultCard key={result.playerId} result={result} reveal={seated} />
      ))}
      <p className="text-muted text-xs leading-relaxed">
        Scoring: BST + {SCORING.coveragePerDistinctType} per distinct type +{" "}
        {SCORING.spreadPerDistinctGeneration} per distinct generation +{" "}
        {SCORING.frugalityPerUnspentDollar} per unspent dollar. Ties go to whoever spent less.
      </p>
      <button
        type="button"
        disabled={pending !== null || !me?.isHost}
        title={me?.isHost ? undefined : "Only the host can return to the lobby."}
        onClick={() => send({ type: "RETURN_TO_LOBBY" })}
        className="bg-gold text-ink min-h-12 rounded-2xl font-semibold disabled:opacity-40"
      >
        Back to lobby
      </button>
      <ChatPanel
        state={state}
        playerId={playerId}
        pending={pending === "CHAT"}
        onSend={(text) => send({ type: "CHAT", text })}
      />
    </div>
  );
}

function ResultCard({
  result,
  reveal,
}: {
  result: PublicMatchResult;
  reveal: boolean;
}) {
  return (
    <article
      className={`border-line bg-panel rounded-3xl border p-4 ${result.isWinner ? "ring-gold ring-2" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: result.color }} />
          <h2 className="font-semibold">
            {result.placement}. {result.name}
            {result.isWinner ? " — winner" : ""}
          </h2>
        </div>
        <p className="font-display text-2xl">{result.score.total}</p>
      </div>
      <ul className="mb-3 flex flex-col gap-2">
        {result.holdings.map((holding) => (
          <li key={holding.lotId} className="flex items-center gap-3 text-sm">
            {reveal && isRevealedHolding(holding) ? (
              <>
                <img
                  src={holding.pokemon.spriteUrl}
                  alt={holding.pokemon.name}
                  className="size-12 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate capitalize">{holding.pokemon.name}</p>
                  <p className="text-muted text-xs">
                    {generationLabel(holding.pokemon.generation)} · {holding.pokemon.types.join("/")} · BST{" "}
                    {holding.pokemon.baseStatTotal}
                  </p>
                </div>
              </>
            ) : (
              <div className="min-w-0 flex-1">
                <p>
                  {"generation" in holding
                    ? `${generationLabel(holding.generation)} · ${holding.types.join("/")}`
                    : "Sealed lot"}
                </p>
              </div>
            )}
            <span className="text-gold font-semibold">${holding.cost}</span>
          </li>
        ))}
      </ul>
      <dl className="text-muted grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div>Base {result.score.base}</div>
        <div>Coverage {result.score.coverage}</div>
        <div>Spread {result.score.spread}</div>
        <div>Frugality {result.score.frugality}</div>
        <div>Spent ${result.score.dollarsSpent}</div>
        <div>Unspent ${result.remainingBudget}</div>
      </dl>
    </article>
  );
}
