import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from "./constants.ts";
import type { Rng } from "./rng.ts";

export function generateRoomCode(rng: Rng): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[rng.int(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== ROOM_CODE_LENGTH) return false;
  for (const char of normalized) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}
