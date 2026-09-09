import {
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_LENGTH,
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_WINDOW_MS,
  PLAYER_NAME_MAX_LENGTH,
} from "./constants.ts";
import type { ChatMessage, RoomState } from "./types.ts";

export function sanitizeName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 1 || name.length > PLAYER_NAME_MAX_LENGTH) return null;
  if (/[\u0000-\u001F\u007F]/.test(name)) return null;
  return name;
}

export function clampChatText(raw: string): string | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length < 1) return null;
  if (text.length > CHAT_MAX_LENGTH) return null;
  if (/[\u0000-\u001F\u007F]/.test(text)) return null;
  return text;
}

export function canSendChat(
  timestamps: readonly number[],
  now: number,
): boolean {
  const recent = timestamps.filter((ts) => now - ts < CHAT_RATE_WINDOW_MS);
  return recent.length < CHAT_RATE_LIMIT_COUNT;
}

export function recordChatSend(
  timestamps: readonly number[],
  now: number,
): number[] {
  return [...timestamps.filter((ts) => now - ts < CHAT_RATE_WINDOW_MS), now];
}

export function trimChat(messages: readonly ChatMessage[]): ChatMessage[] {
  if (messages.length <= CHAT_HISTORY_LIMIT) return [...messages];
  return messages.slice(messages.length - CHAT_HISTORY_LIMIT);
}

export function appendChat(
  state: RoomState,
  message: Omit<ChatMessage, "id">,
): RoomState {
  const next: ChatMessage = {
    ...message,
    id: `msg_${state.nextChatSeq}`,
  };
  return {
    ...state,
    nextChatSeq: state.nextChatSeq + 1,
    chat: trimChat([...state.chat, next]),
  };
}
