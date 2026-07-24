"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { deepHealth, servicesStatus } from "@/lib/api";
import { NODE_META, nodeColor } from "@/lib/mesh";
import { useThemeValue } from "@/lib/theme";

/** Services across the top, infrastructure below — the order the mesh reads in. */
const SERVICE_ORDER = [
  "gateway",
  "auth",
  "task",
  "chat",
  "payment",
  "search",
  "cache",
  "lifecycle",
];
const INFRA_ORDER = ["postgres", "redis", "kafka"];

type Health = "up" | "down" | "unknown";

interface Row {
  status: Health;
  latency: number | null;
}

const REFRESH_MS = 4000;

const TONE: Record<Health, string> = {
  up: "text-nominal",
  down: "text-down",
  unknown: "text-text-low",
};

const LAMP: Record<Health, string> = {
  up: "var(--color-nominal)",
  down: "var(--color-down)",
  unknown: "var(--color-text-low)",
};

/**
 * A live health console for the whole box.
 *
 * Every "status" and "infra" node opens this: rather than a single ping, it
 * polls all seven services and the three dependencies on its own interval and
 * lays them out as one board, so a visitor can watch the box's health while the
 * EC2 instance is up. The node they clicked is highlighted so the board still
 * answers "how is *this* one" as well as "how is everything".
 *
 * Honest by construction: a component that has not answered yet is grey
 * `unknown`, never green, and a null latency shows `—` rather than a made-up
 * number.
 */
export function HealthBoard({ nodeId }: { nodeId: string }) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [ready, setReady] = useState<boolean | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const [services, infra] = await Promise.allSettled([
        servicesStatus(),
        deepHealth(),
      ]);
      if (cancelled) return;

      const next: Record<string, Row> = {};
      for (const settled of [services, infra]) {
        if (settled.status !== "fulfilled") continue;
        for (const c of settled.value.services) {
          next[c.service] = { status: c.status, latency: c.latency_ms };
        }
      }
      // The gateway answered if the services call resolved at all.
      const gatewayUp = services.status === "fulfilled";
      if (gatewayUp) next.gateway = { status: "up", latency: null };

      setReachable(gatewayUp || infra.status === "fulfilled");
      setReady(
        services.status === "fulfilled"
          ? services.value.status === "ready" &&
              (infra.status !== "fulfilled" || infra.value.status === "ready")
          : null,
      );
      setRows(next);
    }

    void poll();
    timer.current = window.setInterval(() => void poll(), REFRESH_MS);
    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const all = [...SERVICE_ORDER, ...INFRA_ORDER];
  const measured = all.filter((id) => rows[id]);
  const up = measured.filter((id) => rows[id]?.status === "up").length;

  const status =
    reachable === false
      ? "down"
      : ready === true
        ? "nominal"
        : ready === false
          ? "degraded"
          : "unknown";

  return (
    <Panel
      label="system health"
      status={status}
      statusLabel={
        reachable === false
          ? "unreachable"
          : ready === true
            ? "ready"
            : ready === false
              ? "degraded"
              : "measuring"
      }
    >
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">
          Live health of the whole box, polled every {REFRESH_MS / 1000}s while
          the EC2 instance is up. Each row is a real ping or dependency probe.
        </p>
        <p className="mt-2 font-mono text-[11px] tracking-[0.14em] text-text-low uppercase">
          {measured.length > 0 ? (
            <>
              {up}/{measured.length} up ·{" "}
              <span
                className={
                  up === measured.length ? "text-nominal" : "text-degraded"
                }
              >
                {up === measured.length ? "all healthy" : "degraded"}
              </span>
            </>
          ) : reachable === false ? (
            <span className="text-down">box unreachable — is it awake?</span>
          ) : (
            "measuring…"
          )}
        </p>
      </PanelSection>

      <PanelSection>
        <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-text-low uppercase">
          services
        </p>
        <div className="flex flex-col">
          {SERVICE_ORDER.map((id) => (
            <HealthRow
              key={id}
              id={id}
              row={rows[id]}
              highlight={id === nodeId}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection>
        <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-text-low uppercase">
          infrastructure
        </p>
        <div className="flex flex-col">
          {INFRA_ORDER.map((id) => (
            <HealthRow
              key={id}
              id={id}
              row={rows[id]}
              highlight={id === nodeId}
            />
          ))}
        </div>
      </PanelSection>
    </Panel>
  );
}

function HealthRow({
  id,
  row,
  highlight,
}: {
  id: string;
  row: Row | undefined;
  highlight: boolean;
}) {
  const theme = useThemeValue();
  const meta = NODE_META[id];
  const color = nodeColor(id, theme);
  const status: Health = row?.status ?? "unknown";

  return (
    <div
      className={`flex items-center gap-2 border-l-2 py-1.5 pl-2 font-mono text-[11px] ${
        highlight ? "bg-panel" : ""
      }`}
      style={{ borderColor: highlight ? color : "transparent" }}
    >
      <span className="w-4 text-center" style={{ color }}>
        {meta?.icon}
      </span>
      <span className="w-24 truncate tracking-[0.1em] text-text-hi uppercase">
        {id}
      </span>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: LAMP[status] }}
        aria-hidden="true"
      />
      <span className={`w-16 ${TONE[status]}`}>{status}</span>
      <span className="tabular ml-auto text-text-low">
        {row?.latency != null ? `${row.latency}ms` : "—"}
      </span>
    </div>
  );
}
