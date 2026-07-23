"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { deepHealth, servicesStatus } from "@/lib/api";
import { useCapabilityTier, useIsActive } from "@/lib/capability";
import { MeshSvg, type NodeStatus } from "./MeshSvg";

/**
 * `ssr: false` is only permitted inside a Client Component, and this is the
 * boundary. Because the import sits behind the `full` branch, the three.js
 * chunk is requested only by devices that reached that tier — a phone never
 * downloads it.
 */
const Mesh3d = dynamic(() => import("./Mesh3d"), {
  ssr: false,
  loading: () => null,
});

/** Slow enough to be honest, fast enough that a killed service shows up. */
const POLL_MS = 6000;

export function Hero() {
  const tier = useCapabilityTier();
  const containerRef = useRef<HTMLDivElement>(null);
  const active = useIsActive(containerRef);

  // Nothing has been measured yet, so nothing claims to be healthy.
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [overall, setOverall] = useState<"ready" | "degraded" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const [services, infra] = await Promise.allSettled([
        servicesStatus(),
        deepHealth(),
      ]);

      if (cancelled) return;

      const next: Record<string, NodeStatus> = {};
      let ready = true;

      for (const settled of [services, infra]) {
        if (settled.status !== "fulfilled") {
          // The gateway itself is unreachable. Leaving nodes unknown is the
          // honest reading — down would assert something we did not observe.
          ready = false;
          continue;
        }
        if (settled.value.status !== "ready") ready = false;
        for (const component of settled.value.services) {
          next[component.service] = component.status;
        }
      }

      // The gateway answered, so it is up by definition of having replied.
      if (services.status === "fulfilled") next.gateway = "up";
      else ready = false;

      setStatuses(next);
      setOverall(ready ? "ready" : "degraded");
    }

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const measured = Object.keys(statuses).length > 0;

  return (
    <section
      ref={containerRef}
      // Fixed height so raising the tier after mount swaps the renderer without
      // moving anything below it.
      className="relative h-[42vh] min-h-[320px] w-full overflow-hidden border-b border-line sm:h-[60vh]"
    >
      <div className="absolute inset-0" aria-hidden={tier === "full"}>
        {tier === "full" ? (
          <Mesh3d statuses={statuses} active={active} />
        ) : (
          <MeshSvg statuses={statuses} tier={tier} />
        )}
      </div>

      {/* Keeps the headline legible over the mesh without hiding it. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-void via-void/70 to-transparent" />

      <div className="relative flex h-full flex-col justify-end px-5 pb-8 sm:px-8 sm:pb-12">
        <h1 className="display-wide max-w-2xl text-3xl leading-[0.95] text-text-hi sm:text-5xl lg:text-6xl">
          One box.
          <br />
          Every layer visible.
        </h1>

        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.14em] text-text-low uppercase">
          <span>
            {measured
              ? `${Object.values(statuses).filter((s) => s === "up").length}/${
                  Object.keys(statuses).length
                } components up`
              : "measuring…"}
          </span>
          {overall && (
            <span
              className={overall === "ready" ? "text-nominal" : "text-degraded"}
            >
              {overall}
            </span>
          )}
          <span className="text-text-low">
            {tier === "full" ? "webgl" : tier === "reduced" ? "2d" : "static"}
          </span>
        </p>
      </div>
    </section>
  );
}
