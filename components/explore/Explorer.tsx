"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthControl } from "@/components/auth/AuthControl";
import type { Reading } from "@/components/hero/Mesh3d";
import { MeshSvg } from "@/components/hero/MeshSvg";
import { useTraffic } from "@/components/hero/TrafficContext";
import { deepHealth, demoTouch, servicesStatus } from "@/lib/api";
import { useCapabilityTier, useIsActive } from "@/lib/capability";
import { useThemeValue } from "@/lib/theme";
import {
  SCOPES,
  type SceneNode,
  type Scope,
  type ScopeId,
  sceneColor,
  scopeTrail,
} from "@/lib/topology";
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
 * The deployment map — a landing you fly into.
 *
 * You start at the internet edge (AWS + Vercel); clicking a platform descends a
 * level, and the deepest AWS level is the original service mesh. On a weak device
 * or with reduced motion the same scopes render flat, with a clickable list.
 */
export function Explorer() {
  const tier = useCapabilityTier();
  const { pulse, pulses } = useTraffic();
  const ref = useRef<HTMLDivElement>(null);
  // A request in flight anywhere means it is crossing every layer above the one
  // you are looking at — the breadcrumb lights to show the whole path is live.
  const inFlight = pulses.length > 0;
  const active = useIsActive(ref);

  const [readings, setReadings] = useState<Readings>({});
  // The scope path from root; the last entry is what's on screen.
  const [stack, setStack] = useState<ScopeId[]>(["root"]);
  const [selected, setSelected] = useState<SceneNode | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [walk, setWalk] = useState<{ node: string; step: number } | null>(null);

  const scopeId = stack[stack.length - 1];
  const scope = SCOPES[scopeId];

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
      if (services.status === "fulfilled") {
        next.gateway = { status: "up", latency: null };
      }
      // Platform rollups: the box is up if the gateway answered; the web is
      // served from Vercel, so if this page is running, Vercel is up.
      next.aws = { status: next.gateway ? "up" : "down", latency: null };
      next.vercel = { status: "up", latency: null };
      setReadings(next);
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const goBack = useCallback(() => {
    setSelected(null);
    setWalk(null);
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  // Esc closes the overlay first, then walks back up a level.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setTourStep(null);
      if (selected) {
        setSelected(null);
        setWalk(null);
      } else {
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, goBack]);

  // A node click: descend, open a demo, or open an info card.
  const activate = useCallback(
    (node: SceneNode) => {
      demoTouch();
      if (node.action.kind === "drill") {
        setSelected(null);
        setWalk(null);
        setStack((s) => [...s, (node.action as { to: ScopeId }).to]);
        return;
      }
      setSelected(node);
      // The per-service walkthrough only exists in the mesh scope, in 3D.
      setWalk(
        tier === "full" && scopeId === "mesh" && WALKTHROUGH[node.id]
          ? { node: node.id, step: 0 }
          : null,
      );
    },
    [tier, scopeId],
  );

  // Each tour step names its scope; the explorer flies there, then opens the
  // step's node when it has a demo so the panel is up as the card explains it.
  useEffect(() => {
    if (tourStep === null) return;
    const step = TOUR_STEPS[tourStep];
    if (!step) return;
    setStack(scopeTrail(step.scope).map((s) => s.id));
    const node = step.nodeId
      ? SCOPES[step.scope].nodes.find((n) => n.id === step.nodeId)
      : undefined;
    setSelected(node && node.action.kind === "demo" ? node : null);
  }, [tourStep]);

  const spotlightId =
    tourStep !== null ? (TOUR_STEPS[tourStep]?.nodeId ?? null) : null;

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

  const startTour = useCallback(() => {
    setWalk(null);
    setSelected(null);
    setTourStep(0);
  }, []);

  const jumpTo = useCallback((depth: number) => {
    setSelected(null);
    setWalk(null);
    setTourStep(null);
    setStack((s) => s.slice(0, depth + 1));
  }, []);

  const upCount = Object.values(readings).filter(
    (r) => r.status === "up",
  ).length;
  const total = Object.keys(readings).length;
  const wide =
    selected?.action.kind === "demo" && selected.action.demo === "chat";

  return (
    <section
      ref={ref}
      className="relative h-[100svh] w-full overflow-hidden border-b border-line"
    >
      {tier === "full" ? (
        <div className="absolute inset-0">
          <Mesh3d
            scope={scope}
            readings={readings}
            active={active}
            selectedId={selected?.id ?? null}
            hoveredId={hoveredId}
            spotlightId={spotlightId}
            onActivate={activate}
            onHover={setHoveredId}
            onBackground={() => setSelected(null)}
          />
        </div>
      ) : (
        <FlatExplorer
          scope={scope}
          readings={readings}
          selectedId={selected?.id ?? null}
          onActivate={activate}
          tier={tier}
        />
      )}

      <div className="absolute top-5 right-5 z-20 flex flex-wrap items-center justify-end gap-2 sm:top-8 sm:right-8">
        <AuthControl />
        <PowerControl />
        <ThemeToggle />
      </div>

      {/* Legend, bottom-left. Only in the service mesh, where colour = service. */}
      {scopeId === "mesh" && (
        <div className="animate-rise absolute bottom-5 left-5 z-20 hidden sm:block">
          <Legend />
        </div>
      )}

      <div className="animate-rise pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.2em] text-text-low uppercase">
          Glass Box
        </p>

        {/* Breadcrumb — the depth you are at, each level clickable. */}
        <nav className="pointer-events-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px]">
          {scopeTrail(scopeId).map((s, i, all) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => jumpTo(i)}
                disabled={i === all.length - 1}
                className={`tracking-[0.14em] uppercase transition-colors ${
                  inFlight
                    ? "text-action"
                    : i === all.length - 1
                      ? "text-text-hi"
                      : "text-text-low hover:text-text-hi"
                }`}
              >
                {s.title}
              </button>
              {i < all.length - 1 && (
                <span className={inFlight ? "text-action" : "text-text-low"}>
                  ›
                </span>
              )}
            </span>
          ))}
        </nav>

        <h1 className="display-wide max-w-2xl text-2xl leading-[0.95] text-text-hi sm:text-4xl">
          One box. Every layer visible.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-text-mid">
          {scopeHint(scopeId, tier)}
        </p>

        <div className="pointer-events-auto flex items-center gap-2">
          {stack.length > 1 && (
            <button
              type="button"
              onClick={goBack}
              className="mt-2 w-fit border border-line-bright px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-text-hi uppercase transition-colors hover:bg-panel"
            >
              ‹ back
            </button>
          )}
          {tourStep === null && (
            <button
              type="button"
              onClick={startTour}
              className="mt-2 w-fit border border-nominal px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-nominal uppercase transition-colors hover:bg-nominal-dim"
            >
              ▸ take the tour
            </button>
          )}
        </div>

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

      {selected && (
        <div
          key={`${scopeId}:${selected.id}`}
          className={`animate-slide-in absolute inset-y-0 right-0 z-10 w-full border-l border-line bg-void/95 backdrop-blur-sm ${
            wide ? "sm:w-[34rem]" : "sm:w-[26rem]"
          }`}
        >
          <NodeOverlay
            node={selected}
            reading={
              selected.statusKey ? readings[selected.statusKey] : undefined
            }
            onClose={() => {
              setSelected(null);
              setWalk(null);
            }}
          />
        </div>
      )}

      {walk &&
        selected?.id === walk.node &&
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
            setSelected(null);
            setWalk(null);
          }}
        />
      )}
    </section>
  );
}

/** One honest line per scope on how to read it. */
function scopeHint(scopeId: ScopeId, tier: "full" | "reduced" | "static") {
  const verb = tier === "full" ? "Click" : "Tap";
  switch (scopeId) {
    case "root":
      return `${verb} AWS or Vercel to fly into how that half runs.`;
    case "aws":
      return `${verb} EC2 to look inside the box.`;
    case "ec2":
      return `${verb} the gateway to enter the services, or a container to inspect it.`;
    case "mesh":
      return `${verb} a service to walk through how it works, then drive it live.`;
    case "vercel":
      return `${verb} a route to see what it does.`;
  }
}

/**
 * The non-3D path: the flat SVG map of the current scope plus a clickable list.
 * Same data, same drill-downs, no WebGL.
 */
function FlatExplorer({
  scope,
  readings,
  selectedId,
  onActivate,
  tier,
}: {
  scope: Scope;
  readings: Readings;
  selectedId: string | null;
  onActivate: (node: SceneNode) => void;
  tier: "reduced" | "static";
}) {
  const theme = useThemeValue();
  const statuses = Object.fromEntries(
    Object.entries(readings).map(([k, v]) => [k, v.status]),
  );

  return (
    <div className="absolute inset-0 overflow-y-auto pt-44">
      <div className="mx-auto max-w-3xl px-5 pb-12 sm:px-8">
        <div className="mb-6 aspect-[16/10] w-full">
          <MeshSvg scope={scope} statuses={statuses} tier={tier} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {scope.nodes.map((node) => {
            const r = node.statusKey ? readings[node.statusKey] : undefined;
            const isActive = node.id === selectedId;
            const drills = node.action.kind === "drill";
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onActivate(node)}
                className={`flex items-center justify-between border px-3 py-2 text-left font-mono text-[11px] transition-colors ${
                  isActive
                    ? "border-line-bright text-text-hi"
                    : "border-line text-text-mid hover:border-line-bright"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span style={{ color: sceneColor(node, theme) }}>
                    {node.icon}
                  </span>
                  <span className="truncate tracking-[0.12em] uppercase">
                    {node.label}
                  </span>
                </span>
                <span
                  className={
                    drills
                      ? "text-text-low"
                      : r?.status === "up"
                        ? "text-nominal"
                        : r?.status === "down"
                          ? "text-down"
                          : "text-text-low"
                  }
                >
                  {drills ? "›" : "●"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
