"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthControl } from "@/components/auth/AuthControl";
import type { Reading } from "@/components/hero/Mesh3d";
import { MeshSvg } from "@/components/hero/MeshSvg";
import { usePulse } from "@/components/hero/TrafficContext";
import { deepHealth, demoTouch, servicesStatus } from "@/lib/api";
import { useCapabilityTier, useIsActive } from "@/lib/capability";
import { MESH_NODES, NODE_META, nodeColor } from "@/lib/mesh";
import { useThemeValue } from "@/lib/theme";
import { TOUR_STEPS } from "@/lib/tour";
import { WALK_STEP_MS, WALKTHROUGH } from "@/lib/walkthrough";
import { Legend } from "./Legend";
import { NodeOverlay } from "./NodeOverlay";
import { PowerControl } from "./PowerControl";
import { ThemeToggle } from "./ThemeToggle";
import { Tour } from "./Tour";
import { WalkthroughHud } from "./Walkthrough";

/** ssr:false only works inside a Client Component; this is that boundary. */
const Mesh3d = dynamic(() => import("@/components/hero/Mesh3d"), {
  ssr: false,
  loading: () => null,
});

const POLL_MS = 6000;

type Readings = Record<string, Reading>;

/**
 * The 3D-first landing surface.
 *
 * On a capable device the mesh fills the viewport and is the control surface:
 * orbit to explore, click a node to open its demo. On a weak device or with
 * reduced motion, the same nodes render as a flat, clickable list beside the
 * SVG mesh — nothing is lost, it just is not spatial.
 */
export function Explorer() {
  const tier = useCapabilityTier();
  const pulse = usePulse();
  const ref = useRef<HTMLDivElement>(null);
  const active = useIsActive(ref);

  const [readings, setReadings] = useState<Readings>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // null when the tour is not running, else the current step index.
  const [tourStep, setTourStep] = useState<number | null>(null);
  // The per-service 3D walkthrough: which node is narrating, and which hop.
  const [walk, setWalk] = useState<{ node: string; step: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const [services, infra] = await Promise.allSettled([
        servicesStatus(),
        deepHealth(),
      ]);
      if (cancelled) return;

      const next: Readings = {};
      for (const settled of [services, infra]) {
        if (settled.status !== "fulfilled") continue;
        for (const c of settled.value.services) {
          next[c.service] = { status: c.status, latency: c.latency_ms };
        }
      }
      // The gateway answered if the services call resolved.
      if (services.status === "fulfilled") {
        next.gateway = { status: "up", latency: null };
      }
      setReadings(next);
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Close the overlay on Escape, the shortcut the close button advertises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        setTourStep(null);
        setWalk(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Each tour step focuses its node and opens its demo (if it has one), so the
  // camera flies there and the right panel is already up when the card explains
  // what to click.
  useEffect(() => {
    if (tourStep === null) return;
    const node = TOUR_STEPS[tourStep]?.nodeId ?? null;
    const demo = node ? NODE_META[node]?.demo : undefined;
    setSelectedId(demo && demo !== "infra" && demo !== "status" ? node : null);
  }, [tourStep]);

  const spotlightId =
    tourStep !== null ? (TOUR_STEPS[tourStep]?.nodeId ?? null) : null;

  // Empty string comes from a click on empty 3D space; treat it as deselect.
  // Opening a real demo counts as activity, so the idle timer resets.
  const select = useCallback(
    (id: string) => {
      setSelectedId(id || null);
      const demo = id ? NODE_META[id]?.demo : undefined;
      if (demo && demo !== "infra" && demo !== "status") demoTouch();
      // Only the interactive services have a walkthrough, and it only plays in
      // the 3D tier — on the flat fallback there is no scene to narrate.
      setWalk(
        id && WALKTHROUGH[id] && tier === "full" ? { node: id, step: 0 } : null,
      );
    },
    [tier],
  );

  // Drive the walkthrough: light the current hop's real edge, hold, then advance.
  useEffect(() => {
    if (!walk) return;
    const steps = WALKTHROUGH[walk.node]?.steps;
    if (!steps || walk.step >= steps.length) {
      setWalk(null);
      return;
    }
    const edge = steps[walk.step].edge;
    if (edge) pulse([edge]);
    const timer = window.setTimeout(
      () => setWalk((w) => (w ? { ...w, step: w.step + 1 } : null)),
      WALK_STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [walk, pulse]);

  const upCount = Object.values(readings).filter(
    (r) => r.status === "up",
  ).length;
  const total = Object.keys(readings).length;

  return (
    <section
      ref={ref}
      className="relative h-[100svh] w-full overflow-hidden border-b border-line"
    >
      {tier === "full" ? (
        <div className="absolute inset-0">
          <Mesh3d
            readings={readings}
            active={active}
            selectedId={selectedId}
            hoveredId={hoveredId}
            spotlightId={spotlightId}
            onSelect={select}
            onHover={setHoveredId}
          />
        </div>
      ) : (
        <FlatExplorer
          readings={readings}
          selectedId={selectedId}
          onSelect={select}
          tier={tier}
        />
      )}

      {/* Session, power control and theme, top-right above the canvas. */}
      <div className="absolute top-5 right-5 z-20 flex flex-wrap items-center justify-end gap-2 sm:top-8 sm:right-8">
        <AuthControl />
        <PowerControl />
        <ThemeToggle />
      </div>

      {/* Legend, bottom-left: shape = kind, colour = status. */}
      <div className="animate-rise absolute bottom-5 left-5 z-20 hidden sm:block">
        <Legend />
      </div>

      {/* HUD: what this is and how it reads. Non-interactive so it never eats
          a drag on the canvas beneath it. */}
      <div className="animate-rise pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.2em] text-text-low uppercase">
          Glass Box
        </p>
        <h1 className="display-wide max-w-2xl text-2xl leading-[0.95] text-text-hi sm:text-4xl">
          One box. Every layer visible.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-text-mid">
          {tier === "full"
            ? "Drag to orbit. Click a service to walk through how it works, then drive it live."
            : "Tap a service to open its live demo."}
        </p>
        {tourStep === null && (
          <button
            type="button"
            onClick={() => {
              setWalk(null);
              setTourStep(0);
            }}
            className="pointer-events-auto mt-2 w-fit border border-nominal px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-nominal uppercase transition-colors hover:bg-nominal-dim"
          >
            ▸ take the tour
          </button>
        )}
        <p className="mt-1 font-mono text-[11px] tracking-[0.14em] text-text-low uppercase">
          {total > 0 ? (
            <>
              {upCount}/{total} components up{" "}
              <span
                className={upCount === total ? "text-nominal" : "text-degraded"}
              >
                {upCount === total ? "ready" : "degraded"}
              </span>
            </>
          ) : (
            "measuring…"
          )}
        </p>
      </div>

      {/* The demo overlay, docked right on desktop, full-width on phones.
          Keyed by node so it re-runs the slide-in each time the demo changes. */}
      {selectedId && (
        <div
          key={selectedId}
          className={`animate-slide-in absolute inset-y-0 right-0 z-10 w-full border-l border-line bg-void/95 backdrop-blur-sm ${
            NODE_META[selectedId]?.demo === "chat"
              ? "sm:w-[34rem]"
              : "sm:w-[26rem]"
          }`}
        >
          <NodeOverlay
            nodeId={selectedId}
            onClose={() => {
              setSelectedId(null);
              setWalk(null);
            }}
          />
        </div>
      )}

      {/* The little 3D walkthrough, narrating the open service's real request
          path hop by hop. Only while its node is the one on screen. */}
      {walk &&
        selectedId === walk.node &&
        WALKTHROUGH[walk.node]?.steps[walk.step] && (
          <WalkthroughHud
            nodeId={walk.node}
            step={walk.step}
            total={WALKTHROUGH[walk.node].steps.length}
            caption={WALKTHROUGH[walk.node].steps[walk.step].caption}
            onSkip={() => setWalk(null)}
          />
        )}

      {tourStep !== null && (
        <Tour
          step={tourStep}
          onNext={() => setTourStep((s) => (s === null ? s : s + 1))}
          onBack={() =>
            setTourStep((s) => (s === null ? s : Math.max(0, s - 1)))
          }
          onExit={() => {
            setTourStep(null);
            setSelectedId(null);
            setWalk(null);
          }}
        />
      )}
    </section>
  );
}

/**
 * The non-3D path: the flat SVG mesh plus a clickable list of every node. Same
 * data, same demos, no WebGL — this is what a phone and reduced-motion get.
 */
function FlatExplorer({
  readings,
  selectedId,
  onSelect,
  tier,
}: {
  readings: Readings;
  selectedId: string | null;
  onSelect: (id: string) => void;
  tier: "reduced" | "static";
}) {
  const theme = useThemeValue();
  const statuses = Object.fromEntries(
    Object.entries(readings).map(([k, v]) => [k, v.status]),
  );

  return (
    <div className="absolute inset-0 overflow-y-auto pt-40">
      <div className="mx-auto max-w-3xl px-5 pb-12 sm:px-8">
        <div className="mb-6 aspect-[16/10] w-full">
          <MeshSvg statuses={statuses} tier={tier} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MESH_NODES.map((node) => {
            const r = readings[node.id];
            const active = node.id === selectedId;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelect(node.id)}
                className={`flex items-center justify-between border px-3 py-2 text-left font-mono text-[11px] transition-colors ${
                  active
                    ? "border-line-bright text-text-hi"
                    : "border-line text-text-mid hover:border-line-bright"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span style={{ color: nodeColor(node.id, theme) }}>
                    {NODE_META[node.id]?.icon}
                  </span>
                  <span className="truncate tracking-[0.12em] uppercase">
                    {node.label}
                  </span>
                </span>
                <span
                  className={
                    r?.status === "up"
                      ? "text-nominal"
                      : r?.status === "down"
                        ? "text-down"
                        : "text-text-low"
                  }
                >
                  ●
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
