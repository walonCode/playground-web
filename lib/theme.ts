"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

function current(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

/**
 * Reads and flips the theme.
 *
 * The actual initial value is set by the inline script in the layout before
 * paint; this hook just syncs React to it after mount and persists changes. The
 * 3D scene reads the same attribute, so both stay in step.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>("dark");

  // Adopt whatever the pre-paint script decided, once mounted.
  useEffect(() => setTheme(current()), []);

  function toggle() {
    const next: Theme = current() === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode or storage disabled — the choice just won't persist.
    }
    setTheme(next);
    // Let the scene re-read the theme without prop-drilling through the canvas.
    window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
  }

  return { theme, toggle };
}

/**
 * Read-only theme signal for consumers that only need to react — the 3D scene
 * repaints its colours on it. Updates on the toggle's custom event.
 */
export function useThemeValue(): Theme {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(current());
    const onChange = () => setTheme(current());
    window.addEventListener("themechange", onChange);
    return () => window.removeEventListener("themechange", onChange);
  }, []);
  return theme;
}
