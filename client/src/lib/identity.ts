const PLAYER_ID_KEY = "poke-auction:playerId";
const NAME_KEY = "poke-auction:name";

export function getPlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

export function getStoredName(): string | null {
  const name = localStorage.getItem(NAME_KEY)?.trim() ?? "";
  return name.length > 0 ? name : null;
}

export function setStoredName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim());
}
