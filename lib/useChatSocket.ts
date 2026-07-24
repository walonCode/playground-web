"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_WS_URL, type ChatMessageDto, chatHistory } from "@/lib/api";

export type SocketStatus = "connecting" | "open" | "closed" | "error";

/** The WS event envelope both ends speak: { event, data }. */
interface WsEnvelope {
  event: string;
  data: unknown;
}

/**
 * Drives one chat room over a WebSocket.
 *
 * Backfills recent history over REST, then keeps a live socket for new messages
 * — the split the backend is built around. Reconnects whenever the room or the
 * display name changes; a name is set at the handshake, so changing it means a
 * fresh connection.
 */
export function useChatSocket(room: string, name: string) {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Append without duplicating a message that history and the socket both saw.
  const append = useCallback((message: ChatMessageDto) => {
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message],
    );
  }, []);

  useEffect(() => {
    if (!name.trim()) return;
    let closed = false;
    setStatus("connecting");
    setMessages([]);
    setError(null);

    // Seed from REST, then open the socket for live delivery.
    void chatHistory(room)
      .then((h) => {
        if (!closed) setMessages(h.messages);
      })
      .catch(() => {
        // A missing room is fine — it is created on first send.
      });

    const url = `${CHAT_WS_URL}?name=${encodeURIComponent(name)}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      if (closed) return;
      setStatus("open");
      ws.send(JSON.stringify({ event: "room.join", data: { slug: room } }));
    };

    ws.onmessage = (event) => {
      let msg: WsEnvelope;
      try {
        msg = JSON.parse(event.data as string) as WsEnvelope;
      } catch {
        return;
      }
      if (msg.event === "message.created") {
        append(msg.data as ChatMessageDto);
      } else if (msg.event === "error") {
        setError((msg.data as { message?: string })?.message ?? "chat error");
      }
    };

    ws.onerror = () => {
      if (!closed) setStatus("error");
    };
    ws.onclose = () => {
      if (!closed) setStatus("closed");
    };

    return () => {
      closed = true;
      ws.close();
      socketRef.current = null;
    };
  }, [room, name, append]);

  const send = useCallback(
    (body: string) => {
      const ws = socketRef.current;
      const text = body.trim();
      if (!ws || ws.readyState !== WebSocket.OPEN || !text) return false;
      ws.send(
        JSON.stringify({
          event: "room.send",
          data: { slug: room, body: text },
        }),
      );
      return true;
    },
    [room],
  );

  return { status, messages, error, send };
}
