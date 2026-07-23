"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export interface Pulse {
  id: number;
  edgeId: string;
  /** When it started, so a renderer can compute its own progress. */
  startedAt: number;
}

interface TrafficValue {
  pulses: Pulse[];
  /** Light the given edges, in order, spaced to suggest the hop sequence. */
  pulse: (edgeIds: readonly string[]) => void;
}

const TrafficContext = createContext<TrafficValue | null>(null);

/** How long a single edge stays lit. */
export const PULSE_MS = 900;
/** Gap between consecutive hops of one action, so the path reads as a path. */
const HOP_STAGGER_MS = 160;

/**
 * Carries "a request just crossed this edge" from the panels to the hero.
 *
 * A context rather than a global event bus so the dependency is visible in the
 * tree, and so a panel rendered without the provider fails loudly at build time
 * instead of silently pulsing nothing.
 */
export function TrafficProvider({ children }: { children: ReactNode }) {
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const nextId = useRef(0);

  const pulse = useCallback((edgeIds: readonly string[]) => {
    edgeIds.forEach((edgeId, hop) => {
      // Stagger so a two-hop path reads as gateway→search then search→cache,
      // rather than both edges flashing at once and losing the direction.
      window.setTimeout(() => {
        nextId.current += 1;
        const entry: Pulse = {
          id: nextId.current,
          edgeId,
          startedAt: performance.now(),
        };
        setPulses((prev) => [...prev, entry]);

        window.setTimeout(() => {
          setPulses((prev) => prev.filter((p) => p.id !== entry.id));
        }, PULSE_MS);
      }, hop * HOP_STAGGER_MS);
    });
  }, []);

  const value = useMemo(() => ({ pulses, pulse }), [pulses, pulse]);

  return (
    <TrafficContext.Provider value={value}>{children}</TrafficContext.Provider>
  );
}

export function useTraffic(): TrafficValue {
  const value = useContext(TrafficContext);
  if (!value) {
    throw new Error("useTraffic must be used inside a TrafficProvider");
  }
  return value;
}

/** Convenience for panels, which only ever need to fire pulses. */
export function usePulse(): TrafficValue["pulse"] {
  return useTraffic().pulse;
}
