import type { ClientMessage, PublicState } from "@poke-auction/shared";

export function PlayerList({
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
  const isHost = me?.isHost ?? false;
  const inMatch = state.phase !== "LOBBY";

  return (
    <section className="border-line bg-panel rounded-3xl border p-4">
      <h2 className="font-display mb-3 text-sm tracking-wide uppercase">Trainers</h2>
      <ul className="flex flex-col gap-3">
        {state.players.map((player) => (
          <li key={player.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span
                className="size-3.5 shrink-0 rounded-full"
                style={{ background: player.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {player.name}
                  {player.id === playerId ? " (you)" : ""}
                </p>
                <p className="text-muted text-xs">
                  {player.isHost ? "Host · " : ""}
                  {player.connected ? "Online" : "Offline"}
                  {state.phase === "LOBBY"
                    ? player.isHost
                      ? " · Starts the match"
                      : player.ready
                        ? " · Ready"
                        : " · Not ready"
                    : ""}
                  {player.wins > 0 ? ` · ${player.wins} win${player.wins === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              {inMatch && (
                <div className="text-right text-sm">
                  <p className="font-semibold">${player.budget}</p>
                  <p className="text-muted text-xs">
                    {player.rosterCount}/{state.settings.rosterSize}
                    {state.currentLot?.turnPlayerId === player.id ? " · Turn" : ""}
                  </p>
                </div>
              )}
            </div>
            {player.id !== playerId && (
              <div className="flex flex-wrap gap-2 pl-7">
                <HostButton
                  disabled={pending || !isHost || inMatch}
                  onClick={() => send({ type: "KICK_PLAYER", playerId: player.id })}
                >
                  Kick
                </HostButton>
                <HostButton
                  disabled={pending || !isHost || inMatch}
                  onClick={() => send({ type: "TRANSFER_HOST", playerId: player.id })}
                >
                  Make host
                </HostButton>
              </div>
            )}
          </li>
        ))}
      </ul>
      {state.spectators.length > 0 && (
        <div className="border-line mt-4 border-t pt-3">
          <h3 className="text-muted mb-2 text-xs tracking-wide uppercase">Spectators</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {state.spectators.map((spectator) => (
              <li key={spectator.id} className="text-muted">
                {spectator.name}
                {spectator.id === playerId ? " (you)" : ""}
                {spectator.connected ? "" : " · offline"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function HostButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "Only the host can do that in the lobby." : undefined}
      onClick={onClick}
      className="border-line min-h-11 rounded-xl border px-3 text-sm disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function ReadyAndStart({
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
  const spectator = !me;
  const seated = state.players.length;
  const unready = state.players.filter((player) => !player.isHost && !player.ready);
  const canStart = seated >= 2 && unready.length === 0;
  const startReason = !me?.isHost
    ? "Only the host can start."
    : seated < 2
      ? "Need at least 2 players."
      : unready.length > 0
        ? "Everyone must be ready."
        : undefined;

  return (
    <div className="flex flex-col gap-2">
      {spectator && state.phase === "LOBBY" && (
        <button
          type="button"
          disabled={pending || state.openSeats < 1}
          onClick={() => send({ type: "TAKE_SEAT" })}
          className="bg-gold text-ink min-h-12 rounded-2xl font-semibold disabled:opacity-40"
        >
          {state.openSeats < 1 ? "No seats left" : "Take a seat"}
        </button>
      )}
      {me && !me.isHost && state.phase === "LOBBY" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => send({ type: "SET_READY", ready: !me.ready })}
          className="border-gold text-gold min-h-12 rounded-2xl border-2 font-semibold disabled:opacity-40"
        >
          {me.ready ? "Unready" : "Ready up"}
        </button>
      )}
      {state.phase === "LOBBY" && (
        <button
          type="button"
          disabled={pending || !canStart || !me?.isHost}
          title={startReason}
          onClick={() => send({ type: "START_MATCH" })}
          className="bg-gold text-ink min-h-12 rounded-2xl font-semibold disabled:opacity-40"
        >
          Start match
        </button>
      )}
      {startReason && state.phase === "LOBBY" && (
        <p className="text-muted text-center text-xs">{startReason}</p>
      )}
    </div>
  );
}
