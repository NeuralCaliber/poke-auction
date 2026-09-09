export function apiUrl(path: string): string {
  const origin = import.meta.env.VITE_API_ORIGIN ?? "";
  return `${origin}${path}`;
}

export function wsUrl(roomCode: string): string {
  const origin = import.meta.env.VITE_API_ORIGIN;
  if (origin) {
    const url = new URL(origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${url.origin}/api/rooms/${roomCode}/ws`;
  }
  if (import.meta.env.DEV) {
    return `ws://localhost:8787/api/rooms/${roomCode}/ws`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/rooms/${roomCode}/ws`;
}

export async function createRoom(): Promise<{ roomCode: string; joinPath: string }> {
  const response = await fetch(apiUrl("/api/rooms"), { method: "POST" });
  if (!response.ok) {
    throw new Error("Could not create a room.");
  }
  return response.json() as Promise<{ roomCode: string; joinPath: string }>;
}

export async function fetchRoom(code: string): Promise<{
  exists: boolean;
  phase?: string;
  seated?: number;
  openSeats?: number;
}> {
  const response = await fetch(apiUrl(`/api/rooms/${code}`));
  if (response.status === 404) return { exists: false };
  if (!response.ok) throw new Error("Could not look up that room.");
  return response.json() as Promise<{
    exists: boolean;
    phase?: string;
    seated?: number;
    openSeats?: number;
  }>;
}
