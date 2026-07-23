"use client";

import { MeshSvg } from "@/components/hero/MeshSvg";
import { TrafficProvider } from "@/components/hero/TrafficContext";

/**
 * A walk through the runtime, for someone who will never open the repo.
 *
 * It reuses the hero's mesh — same `lib/mesh.ts` nodes and edges — rather than
 * drawing a second diagram that could drift from the first. Here it is pinned to
 * the `static` tier and given an all-up status, because this panel explains the
 * shape of the system, not its live health; that job belongs to the hero.
 */
const STEPS = [
  {
    n: "01",
    title: "one public door",
    body: "Every request enters the gateway on a single origin. Nothing else is exposed — the services have no public port.",
  },
  {
    n: "02",
    title: "fan out over kafka",
    body: "The gateway holds one Kafka client per service and uses request/reply: it sends on a topic and waits on that topic's reply. No service calls another over HTTP.",
  },
  {
    n: "03",
    title: "a database each",
    body: "Five services own a Postgres database apiece — separate databases, not shared schemas, so a cross-service join is structurally impossible. cache and the task queue share one Redis.",
  },
  {
    n: "04",
    title: "one real hand-off",
    body: "search asks cache directly before it touches Postgres — the one service-to-service call in the system, and the reason the cache demo above has anything to show.",
  },
];

const ALL_UP = Object.fromEntries(
  [
    "gateway",
    "auth",
    "task",
    "chat",
    "payment",
    "search",
    "cache",
    "lifecycle",
    "kafka",
    "postgres",
    "redis",
  ].map((id) => [id, "up" as const]),
);

export function Architecture() {
  return (
    <section className="border border-line bg-void">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[11px] tracking-[0.18em] text-text-mid uppercase">
          how it fits together
        </h2>
      </header>

      <div className="grid gap-px bg-line lg:grid-cols-[1.1fr_1fr]">
        <div className="bg-void p-4">
          {/* Static tier: this is a reference diagram, not a live readout. */}
          <TrafficProvider>
            <div className="aspect-[16/10] w-full">
              <MeshSvg statuses={ALL_UP} tier="static" />
            </div>
          </TrafficProvider>
        </div>

        <ol className="flex flex-col bg-void">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="flex gap-3 border-b border-line px-4 py-4 last:border-b-0"
            >
              <span className="tabular font-mono text-[11px] text-text-low">
                {step.n}
              </span>
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-text-hi uppercase">
                  {step.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-mid">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
