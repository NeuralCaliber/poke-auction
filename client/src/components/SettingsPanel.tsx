import {
  ALL_GENERATIONS,
  BID_INCREMENT_OPTIONS,
  MAX_BUDGET,
  MAX_ROSTER_SIZE,
  MIN_BUDGET,
  MIN_ROSTER_SIZE,
  TURN_TIMER_OPTIONS,
  type ClientMessage,
  type Generation,
  type MatchSettings,
  type PublicState,
} from "@poke-auction/shared";
import type { ReactNode } from "react";

export function SettingsPanel({
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
  const me = state.players.find((player) => player.id === playerId);
  const locked = state.phase !== "LOBBY" || !me?.isHost;
  const settings = state.settings;

  function patch(partial: Partial<MatchSettings>) {
    send({ type: "UPDATE_SETTINGS", settings: partial });
  }

  return (
    <section
      className={`border-line bg-panel rounded-3xl border p-4 ${locked ? "opacity-70" : ""}`}
    >
      <h2 className="font-display mb-1 text-sm tracking-wide uppercase">Match settings</h2>
      <p className="text-muted mb-4 text-xs">
        {state.phase !== "LOBBY"
          ? "Settings are locked during a match."
          : me?.isHost
            ? "Changing settings unreadies everyone."
            : "Only the host can change these."}
      </p>
      <fieldset disabled={locked || pending} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Starting budget (${settings.startingBudget})
          <input
            type="range"
            min={MIN_BUDGET}
            max={MAX_BUDGET}
            value={settings.startingBudget}
            onChange={(event) => patch({ startingBudget: Number(event.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Roster size ({settings.rosterSize})
          <input
            type="range"
            min={MIN_ROSTER_SIZE}
            max={MAX_ROSTER_SIZE}
            value={settings.rosterSize}
            onChange={(event) => patch({ rosterSize: Number(event.target.value) })}
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm">Turn timer</legend>
          <div className="flex flex-wrap gap-2">
            {TURN_TIMER_OPTIONS.map((seconds) => (
              <Chip
                key={seconds}
                active={settings.turnTimerSeconds === seconds}
                onClick={() => patch({ turnTimerSeconds: seconds })}
              >
                {seconds}s
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm">Bid increment</legend>
          <div className="flex flex-wrap gap-2">
            {BID_INCREMENT_OPTIONS.map((increment) => (
              <Chip
                key={increment}
                active={settings.bidIncrement === increment}
                onClick={() => patch({ bidIncrement: increment })}
              >
                ${increment}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm">Generations</legend>
          <div className="flex flex-wrap gap-2">
            {ALL_GENERATIONS.map((generation) => {
              const selected = settings.generations.includes(generation);
              return (
                <Chip
                  key={generation}
                  active={selected}
                  onClick={() => {
                    const next = selected
                      ? settings.generations.filter((item) => item !== generation)
                      : [...settings.generations, generation].sort((a, b) => a - b);
                    if (next.length < 1) return;
                    patch({ generations: next as Generation[] });
                  }}
                >
                  {generation}
                </Chip>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm">Pool scarcity</legend>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={settings.poolScarcity === "exact"}
              onClick={() => patch({ poolScarcity: "exact" })}
            >
              Exact
            </Chip>
            <Chip
              active={settings.poolScarcity === "tight"}
              onClick={() => patch({ poolScarcity: "tight" })}
            >
              Tight
            </Chip>
          </div>
        </fieldset>
      </fieldset>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-xl px-3 text-sm ${
        active ? "bg-gold text-ink" : "border-line border"
      }`}
    >
      {children}
    </button>
  );
}
