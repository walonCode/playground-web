"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsActive } from "@/lib/capability";
import {
  RECORDED_COMMIT,
  replayMs,
  STAGES,
  type Stage,
  type StageState,
} from "@/lib/journey";

type StateMap = Record<string, StageState>;

const ALL_PENDING: StateMap = Object.fromEntries(
  STAGES.map((s) => [s.id, "pending" as StageState]),
);

/**
 * The code → ship → verify journey, driven by a replay of a real run.
 *
 * The driver is deliberately thin and behind the `StageEvent` shape in
 * lib/journey: swapping this setTimeout walk for an EventSource off the CI
 * webhook receiver, when that exists, touches nothing below.
 */
export function Journey() {
  const [states, setStates] = useState<StateMap>(ALL_PENDING);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = useIsActive(ref);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  }, []);

  const run = useCallback(() => {
    clearTimers();
    setStates(ALL_PENDING);
    setPlaying(true);

    let clock = 300;
    STAGES.forEach((stage, index) => {
      timers.current.push(
        window.setTimeout(() => {
          setStates((prev) => ({ ...prev, [stage.id]: "running" }));
        }, clock),
      );
      clock += replayMs(stage);
      timers.current.push(
        window.setTimeout(() => {
          setStates((prev) => ({ ...prev, [stage.id]: "passed" }));
          if (index === STAGES.length - 1) setPlaying(false);
        }, clock),
      );
      clock += 120;
    });
  }, [clearTimers]);

  // Play once when it first scrolls into view; never auto-loop, so a visitor
  // reading the page is not pestered by motion they did not ask for.
  const hasPlayed = useRef(false);
  useEffect(() => {
    if (active && !hasPlayed.current) {
      hasPlayed.current = true;
      run();
    }
  }, [active, run]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <section ref={ref} className="border border-line bg-void">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[11px] tracking-[0.18em] text-text-mid uppercase">
          commit → ship → verify
        </h2>
        <button
          type="button"
          onClick={run}
          disabled={playing}
          className="border border-line px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-text-low uppercase transition-colors hover:border-line-bright hover:text-text-hi disabled:opacity-50"
        >
          {playing ? "running" : "replay"}
        </button>
      </header>

      <ol>
        {STAGES.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            state={states[stage.id]}
          />
        ))}
      </ol>

      <footer className="border-t border-line px-4 py-3">
        <p className="font-mono text-[10px] leading-relaxed text-text-low">
          replay of a real run at commit {RECORDED_COMMIT}. durations marked
          measured are wall-clock from this repo; the animation compresses them
          onto a log scale, but each stage reports its true time. the same
          component will take live events once the CI webhook receiver is wired.
        </p>
      </footer>
    </section>
  );
}

const STATE_TONE: Record<StageState, string> = {
  pending: "text-text-low",
  running: "text-degraded",
  passed: "text-nominal",
  failed: "text-down",
};

const STATE_MARK: Record<StageState, string> = {
  pending: "·",
  running: "▸",
  passed: "✓",
  failed: "✕",
};

function StageRow({
  stage,
  index,
  state,
}: {
  stage: Stage;
  index: number;
  state: StageState;
}) {
  const passed = state === "passed";

  return (
    <li className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex items-baseline gap-3">
        <span className="tabular font-mono text-[11px] text-text-low">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className={`font-mono text-sm ${STATE_TONE[state]}`}>
          {STATE_MARK[state]}
        </span>
        <span
          className={`font-mono text-[11px] tracking-[0.16em] uppercase ${
            state === "pending" ? "text-text-low" : "text-text-hi"
          }`}
        >
          {stage.title}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {stage.durationMs !== null && (
            <span
              className={`tabular font-mono text-[11px] ${
                passed ? "text-nominal" : "text-text-low"
              }`}
            >
              {stage.durationMs >= 1000
                ? `${(stage.durationMs / 1000).toFixed(1)}s`
                : `${stage.durationMs}ms`}
            </span>
          )}
          <span
            className="font-mono text-[9px] tracking-[0.12em] text-text-low uppercase"
            title={
              stage.provenance === "measured"
                ? "wall-clock, timed on this repo"
                : "network step, not timed"
            }
          >
            {stage.provenance === "measured" ? "measured" : "net"}
          </span>
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1 pl-9">
        <code className="overflow-x-auto font-mono text-[11px] whitespace-pre text-text-mid">
          $ {stage.command}
        </code>
        {passed && (
          <p className="font-mono text-[11px] text-text-low">{stage.result}</p>
        )}
      </div>
    </li>
  );
}
