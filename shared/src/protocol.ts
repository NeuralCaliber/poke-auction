import type {
  ChatMessage,
  PublicState,
  SettingsPatch,
  YourRosterPayload,
} from "./types.ts";

export type ClientMessage =
  | { type: "JOIN"; roomCode: string; playerId: string; name: string }
  | { type: "SET_READY"; ready: boolean }
  | { type: "UPDATE_SETTINGS"; settings: SettingsPatch }
  | { type: "KICK_PLAYER"; playerId: string }
  | { type: "TRANSFER_HOST"; playerId: string }
  | { type: "CHAT"; text: string }
  | { type: "START_MATCH" }
  | { type: "BID"; lotId: string; amount: number }
  | { type: "PASS"; lotId: string }
  | { type: "RETURN_TO_LOBBY" }
  | { type: "TAKE_SEAT" };

export type ServerMessage =
  | { type: "STATE"; version: number; publicState: PublicState }
  | { type: "YOUR_ROSTER"; pokemon: YourRosterPayload }
  | { type: "CHAT_HISTORY"; messages: ChatMessage[] }
  | { type: "CHAT_MESSAGE"; message: ChatMessage }
  | { type: "ERROR"; code: string; message: string };

export type ClientMessageType = ClientMessage["type"];
export type ServerMessageType = ServerMessage["type"];

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return (
    type === "JOIN" ||
    type === "SET_READY" ||
    type === "UPDATE_SETTINGS" ||
    type === "KICK_PLAYER" ||
    type === "TRANSFER_HOST" ||
    type === "CHAT" ||
    type === "START_MATCH" ||
    type === "BID" ||
    type === "PASS" ||
    type === "RETURN_TO_LOBBY" ||
    type === "TAKE_SEAT"
  );
}
