"use client";

import { useEffect, useState } from "react";

/**
 * How much the device should be asked to do.
 *
 * - `full`    WebGL scene, continuous animation
 * - `reduced` flat SVG, CSS transitions
 * - `static`  flat SVG, no motion at all
 */
export type Tier = "full" | "reduced" | "static";

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/**
 * A cheap probe for whether WebGL2 will actually work.
 *
 * Core count and memory say nothing about whether the GPU is available — WebGL
 * can be blocked by policy, a driver blocklist or a headless environment. Asking
 * for a context is the only reliable answer, and the alternative is a blank
 * canvas where the hero should be.
 */
function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

function measure(): Tier {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "static";
  }

  const nav = navigator as NavigatorWithHints;

  const weak =
    window.matchMedia("(pointer: coarse)").matches ||
    window.innerWidth < 900 ||
    (nav.hardwareConcurrency ?? 8) <= 4 ||
    (nav.deviceMemory ?? 8) <= 4 ||
    nav.connection?.saveData === true ||
    !hasWebGL2();

  return weak ? "reduced" : "full";
}

/**
 * Server render always returns `reduced`, and the tier is only raised after
 * mount.
 *
 * That ordering is the whole point: the 3D chunk is imported by the `full`
 * branch alone, so a phone that never reaches `full` never requests it. Starting
 * optimistic and downgrading would ship the bundle to exactly the devices it is
 * meant to spare.
 */
export function useCapabilityTier(): Tier {
  const [tier, setTier] = useState<Tier>("reduced");

  useEffect(() => {
    setTier(measure());

    // Reduced-motion can be toggled while the page is open, and a laptop can be
    // resized past the width threshold. Re-measure rather than trusting mount.
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setTier(measure());

    motion.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      motion.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return tier;
}

/**
 * True while the element is on screen and the tab is visible.
 *
 * A render loop that keeps running in a background tab is the most common way an
 * ambient 3D scene quietly drains a laptop battery.
 */
export function useIsActive(ref: React.RefObject<Element | null>): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let onScreen = false;
    const sync = () => setActive(onScreen && !document.hidden);

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        sync();
      },
      { threshold: 0.01 },
    );
    observer.observe(element);

    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);

  return active;
}
