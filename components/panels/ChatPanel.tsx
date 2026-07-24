"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePulse } from "@/components/hero/TrafficContext";
import { SourceLink, WireTrace } from "@/components/panel/Evidence";
import { Panel, PanelSection } from "@/components/panel/Panel";
import type { Status } from "@/components/panel/StatusDot";
import { REPO_BASE } from "@/lib/api";
import { type SocketStatus, useChatSocket } from "@/lib/useChatSocket";

const ROOM = "lobby";

const STATUS_LABEL: Record<SocketStatus, { text: string; status: Status }> = {
  connecting: { text: "connecting", status: "degraded" },
  open: { text: "live", status: "nominal" },
  closed: { text: "closed", status: "down" },
  error: { text: "error", status: "down" },
};

/** A stable-ish guest name so two tabs read as two people. */
function defaultName() {
  return `guest-${Math.random().toString(36).slice(2, 6)}`;
}

export function ChatPanel() {
  const pulse = usePulse();
  const [name] = useState(defaultName);
  const [draft, setDraft] = useState("");
  const { status, messages, error, send } = useChatSocket(ROOM, name);
  const listRef = useRef<HTMLDivElement>(null);

  // The REST backfill really does travel gateway → Kafka → chat, so lighting
  // that edge on connect is honest. Live send goes straight to the socket and
  // is deliberately not pulsed here.
  useEffect(() => {
    if (status === "open") pulse(["gateway→chat"]);
  }, [status, pulse]);

  // Keep the newest message in view. messages is the intended trigger even
  // though the body only touches the ref — a new message must scroll.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages triggers the scroll
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const chrome = STATUS_LABEL[status];

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (send(draft)) setDraft("");
  }

  const hint = useMemo(
    () =>
      "Open this in a second tab to see a message broadcast between clients in real time.",
    [],
  );

  return (
    <Panel
      label="chat · websocket"
      status={chrome.status}
      statusLabel={chrome.text}
    >
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">{hint}</p>
        <p className="mt-2 font-mono text-[11px] text-text-low">
          room <span className="text-text-mid">{ROOM}</span> · you are{" "}
          <span className="text-text-mid">{name}</span>
        </p>
      </PanelSection>

      <PanelSection>
        <div
          ref={listRef}
          className="flex h-56 flex-col gap-2 overflow-y-auto border border-line bg-panel p-3"
        >
          {messages.length === 0 ? (
            <p className="m-auto font-mono text-[11px] text-text-low">
              no messages yet — say something
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="flex flex-col">
                <span className="font-mono text-[10px] text-text-low">
                  {m.username}
                </span>
                <span className="text-sm text-text-hi">{m.body}</span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="type a message"
            disabled={status !== "open"}
            className="min-w-0 flex-1 border border-line bg-panel px-3 py-2 font-mono text-sm text-text-hi placeholder:text-text-low focus:border-line-bright focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={status !== "open"}
            className="border border-action px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-action uppercase transition-colors hover:bg-action-dim disabled:cursor-not-allowed disabled:opacity-50"
          >
            send
          </button>
        </form>
        {error && (
          <p className="mt-2 font-mono text-[11px] text-down">{error}</p>
        )}
      </PanelSection>

      <PanelSection className="flex flex-col gap-3">
        <WireTrace
          method="WS"
          path="/ws room.send"
          pattern="persist → broadcast"
          tookMs={null}
          failed={status === "error"}
        />
        <p className="font-mono text-[11px] text-text-low">
          live delivery is a direct socket; history backfills over{" "}
          <span className="text-text-mid">
            GET /api/chat/rooms/{ROOM}/messages
          </span>
        </p>
        <SourceLink
          href={`${REPO_BASE}/apps/chat/src/chat.gateway.ts`}
          label="chat.gateway.ts"
        />
      </PanelSection>
    </Panel>
  );
}
