import type { ConnectionStatus } from "../hooks/useRoomConnection.ts";

export function ConnectionDot({ status }: { status: ConnectionStatus }) {
  const label =
    status === "connected"
      ? "Connected"
      : status === "reconnecting"
        ? "Reconnecting…"
        : status === "connecting"
          ? "Connecting…"
          : "Offline";
  const color =
    status === "connected"
      ? "bg-emerald-400"
      : status === "disconnected"
        ? "bg-rose-400"
        : "bg-amber-400";

  return (
    <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted uppercase">
      <span className={`size-2.5 shrink-0 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

export function ReconnectingBanner({ status }: { status: ConnectionStatus }) {
  if (status !== "reconnecting" && status !== "connecting") return null;
  return (
    <div className="bg-gold/15 text-gold px-3 py-2 text-center text-sm font-medium">
      {status === "reconnecting"
        ? "Connection lost — trying to get you back in the room."
        : "Connecting to the room…"}
    </div>
  );
}

export function ErrorToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border-gold/40 bg-panel-2 fixed inset-x-3 bottom-3 z-50 flex items-start gap-3 rounded-2xl border p-3 shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96"
    >
      <p className="flex-1 text-sm text-paper">{message}</p>
      <button
        type="button"
        className="text-muted min-h-11 min-w-11 rounded-xl px-2 text-sm"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
