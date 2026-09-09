import { useEffect, useState } from "react";

export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function remainingSeconds(turnEndsAt: number | null, now: number): number | null {
  if (turnEndsAt === null) return null;
  return Math.max(0, Math.ceil((turnEndsAt - now) / 1000));
}
