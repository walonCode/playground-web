"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type DemoState, demoStatus, demoWake } from "@/lib/api";

const LABEL: Record<DemoState, { text: string; tone: string }> = {
  asleep: { text: "asleep", tone: "text-text-low" },
  waking: { text: "waking", tone: "text-degraded" },
  awake: { text: "awake", tone: "text-nominal" },
  sleeping: { text: "sleeping", tone: "text-degraded" },
};

/**
 * The box's power control, docked in the explorer HUD.
 *
 * The box that runs the demos sleeps when idle to save money; this wakes it.
 * State is the real wake/sleep machine — waking only flips to awake once the
 * deep health check genuinely passes, so the button never lies about readiness.
 */
export function PowerControl() {
  const [state, setState] = useState<DemoState | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const timer = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      setState((await demoStatus()).state);
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    void poll();
    // Poll briskly while waking, calmly otherwise — set below once we know.
    timer.current = window.setInterval(() => void poll(), 4000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [poll]);

  async function wake() {
    if (busy) return;
    setBusy(true);
    setDenied(false);
    try {
      const result = await demoWake();
      // Waking costs money, so it is gated. Say so plainly instead of failing
      // silently — the sign-in control is right beside this button.
      if (!result.state) {
        setDenied(true);
        return;
      }
      setState(result.state);
      void poll();
    } finally {
      setBusy(false);
    }
  }

  const chrome = state ? LABEL[state] : { text: "—", tone: "text-text-low" };
  const canWake = state === "asleep" || state === "sleeping";

  return (
    <div className="pointer-events-auto flex items-center gap-3 border border-line bg-void/90 px-3 py-2 backdrop-blur-sm">
      <span className="font-mono text-[10px] tracking-[0.16em] text-text-low uppercase">
        box
      </span>
      <span className={`font-mono text-[11px] uppercase ${chrome.tone}`}>
        {chrome.text}
      </span>
      {canWake && (
        <button
          type="button"
          onClick={wake}
          disabled={busy}
          className="border border-nominal px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-nominal uppercase transition-colors hover:bg-nominal-dim disabled:opacity-50"
        >
          {busy ? "…" : "wake"}
        </button>
      )}
      {denied && (
        <span className="font-mono text-[10px] text-degraded">
          sign in first
        </span>
      )}
    </div>
  );
}
