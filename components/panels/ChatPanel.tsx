"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { usePulse } from "@/components/hero/TrafficContext";
import { WireTrace } from "@/components/panel/Evidence";
import { Panel, PanelSection } from "@/components/panel/Panel";
import type { Status } from "@/components/panel/StatusDot";
import { type SocketStatus, useChatSocket } from "@/lib/useChatSocket";

const ROOM = "lobby";

const STATUS_TONE: Record<SocketStatus, string> = {
  connecting: "text-degraded",
  open: "text-nominal",
  closed: "text-down",
  error: "text-down",
};

/**
 * Two chat participants, given distinct non-status hues so the panel never
 * confuses "which client" with "is it healthy". Both are safely clear of the
 * cyan/amber/red status language and of the fuchsia action colour.
 */
const CLIENTS = [
  { key: "a", accent: "#a78bfa" }, // violet
  { key: "b", accent: "#2dd4bf" }, // teal
] as const;

/** A short, stable guest name so two panes read as two different people. */
function guestName() {
  return `guest-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Chat, demonstrable on one screen.
 *
 * Two independent WebSocket clients sit side by side, each with its own identity
 * and its own socket. Send from one and it appears in both — because the message
 * really does travel the socket, persist, and broadcast. No second tab required,
 * though opening one still works: it joins the same room.
 */
export function ChatPanel() {
  const pulse = usePulse();
  const [statuses, setStatuses] = useState<Record<string, SocketStatus>>({});
  // Light the backfill edge once, when the first client's REST history lands.
  const pulsed = useRef(false);

  const reportStatus = (key: string, status: SocketStatus) => {
    setStatuses((prev) =>
      prev[key] === status ? prev : { ...prev, [key]: status },
    );
    if (status === "open" && !pulsed.current) {
      pulsed.current = true;
      pulse(["gateway→chat"]);
    }
  };

  const values = Object.values(statuses);
  const anyOpen = values.includes("open");
  const anyError = values.includes("error");
  const panelStatus: Status = anyError
    ? "down"
    : anyOpen
      ? "nominal"
      : "degraded";
  const panelLabel = anyError ? "error" : anyOpen ? "live" : "connecting";

  return (
    <Panel
      label="chat · websocket"
      status={panelStatus}
      statusLabel={panelLabel}
    >
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">
          Two live clients, one room. Send from either side and watch it appear
          in the other — the message crosses a real WebSocket, is persisted,
          then broadcast back to everyone in the room.
        </p>
      </PanelSection>

      <PanelSection>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CLIENTS.map((c) => (
            <ChatClient
              key={c.key}
              accent={c.accent}
              onStatus={(s) => reportStatus(c.key, s)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection className="flex flex-col gap-3">
        <WireTrace
          method="WS"
          path="/ws room.send"
          pattern="persist → broadcast"
          tookMs={null}
          failed={anyError}
        />
        <p className="font-mono text-[11px] text-text-low">
          live delivery is a direct socket; history backfills over{" "}
          <span className="text-text-mid">
            GET /api/chat/rooms/{ROOM}/messages
          </span>
        </p>
      </PanelSection>
    </Panel>
  );
}

/** One participant: its own name, its own socket, its own outgoing input. */
function ChatClient({
  accent,
  onStatus,
}: {
  accent: string;
  onStatus: (status: SocketStatus) => void;
}) {
  const [name] = useState(guestName);
  const [draft, setDraft] = useState("");
  const { status, messages, error, send } = useChatSocket(ROOM, name);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onStatus(status);
  }, [status, onStatus]);

  // Keep the newest message in view. messages is the intended trigger even
  // though the body only reads the ref.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages triggers the scroll
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (send(draft)) setDraft("");
  }

  return (
    <div className="flex flex-col border border-line">
      <div
        className="flex items-center justify-between border-b border-line px-2.5 py-1.5"
        style={{
          background: `linear-gradient(to right, ${accent}1f, transparent)`,
        }}
      >
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden="true"
          />
          <span className="truncate text-text-hi">{name}</span>
        </span>
        <span
          className={`shrink-0 font-mono text-[10px] ${STATUS_TONE[status]}`}
        >
          {status === "open" ? "live" : status}
        </span>
      </div>

      <div
        ref={listRef}
        className="flex h-40 flex-col gap-1.5 overflow-y-auto bg-panel p-2.5"
      >
        {messages.length === 0 ? (
          <p className="m-auto font-mono text-[10px] text-text-low">
            no messages yet
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.username === name;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <span className="font-mono text-[9px] text-text-low">
                  {m.username}
                </span>
                <span
                  className={`max-w-[90%] break-words px-2 py-1 text-[13px] leading-snug ${
                    mine
                      ? "text-text-hi"
                      : "border border-line bg-void text-text-mid"
                  }`}
                  style={mine ? { background: `${accent}26` } : undefined}
                >
                  {m.body}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="flex gap-1.5 border-t border-line p-2"
      >
        <label className="sr-only" htmlFor={`chat-${name}`}>
          Message as {name}
        </label>
        <input
          id={`chat-${name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="type a message"
          disabled={status !== "open"}
          className="min-w-0 flex-1 border border-line bg-void px-2 py-1.5 font-mono text-[12px] text-text-hi placeholder:text-text-low focus:border-line-bright focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status !== "open"}
          className="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.14em] uppercase transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: accent, color: accent }}
        >
          send
        </button>
      </form>
      {error && (
        <p className="px-2 pb-2 font-mono text-[10px] text-down">{error}</p>
      )}
    </div>
  );
}
