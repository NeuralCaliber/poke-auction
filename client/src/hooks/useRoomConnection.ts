import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  PublicState,
  ServerMessage,
  YourRosterPayload,
} from "@poke-auction/shared";
import { wsUrl } from "../lib/api.ts";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

type Options = {
  roomCode: string;
  playerId: string;
  name: string | null;
};

export function useRoomConnection({ roomCode, playerId, name }: Options) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [state, setState] = useState<PublicState | null>(null);
  const [roster, setRoster] = useState<YourRosterPayload>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ClientMessage["type"] | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const versionRef = useRef(0);
  const retriesRef = useRef(0);
  const unmountedRef = useRef(false);
  const nameRef = useRef(name);
  nameRef.current = name;

  const handleMessage = useCallback((raw: string) => {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === "STATE") {
      if (message.version < versionRef.current) return;
      versionRef.current = message.version;
      setState(message.publicState);
      setPending(null);
      return;
    }
    if (message.type === "YOUR_ROSTER") {
      setRoster(message.pokemon);
      return;
    }
    if (message.type === "CHAT_HISTORY") {
      setState((current) =>
        current ? { ...current, chat: message.messages } : current,
      );
      return;
    }
    if (message.type === "CHAT_MESSAGE") {
      setState((current) => {
        if (!current) return current;
        if (current.chat.some((item) => item.id === message.message.id)) {
          return current;
        }
        return { ...current, chat: [...current.chat, message.message] };
      });
      return;
    }
    if (message.type === "ERROR") {
      setError(message.message);
      setPending(null);
    }
  }, []);

  useEffect(() => {
    unmountedRef.current = false;
    if (!name) {
      setStatus("disconnected");
      return;
    }

    let timer: number | undefined;

    const connect = () => {
      if (unmountedRef.current) return;
      setStatus(retriesRef.current === 0 ? "connecting" : "reconnecting");
      const socket = new WebSocket(wsUrl(roomCode));
      wsRef.current = socket;

      socket.onopen = () => {
        if (wsRef.current !== socket) return;
        retriesRef.current = 0;
        setStatus("connected");
        socket.send(
          JSON.stringify({
            type: "JOIN",
            roomCode,
            playerId,
            name: nameRef.current ?? name ?? "Trainer",
          } satisfies ClientMessage),
        );
      };

      socket.onmessage = (event) => {
        if (wsRef.current !== socket) return;
        handleMessage(String(event.data));
      };

      socket.onclose = () => {
        if (wsRef.current !== socket || unmountedRef.current) return;
        setStatus("reconnecting");
        const delay = Math.min(8000, 500 * 2 ** retriesRef.current);
        retriesRef.current += 1;
        timer = window.setTimeout(connect, delay);
      };

      socket.onerror = () => {
        if (wsRef.current !== socket) return;
        socket.close();
      };
    };

    connect();
    return () => {
      unmountedRef.current = true;
      if (timer) window.clearTimeout(timer);
      const socket = wsRef.current;
      wsRef.current = null;
      socket?.close();
    };
  }, [handleMessage, name, playerId, roomCode]);

  const send = useCallback((message: ClientMessage) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    setPending(message.type);
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return { status, state, roster, error, pending, send, dismissError };
}
