"use client";

import { useTheme } from "@/lib/theme";

/** Flips dark/light. Icon shows the theme you'd switch TO, the usual convention. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="pointer-events-auto flex size-8 items-center justify-center border border-line bg-void/90 font-mono text-xs text-text-mid backdrop-blur-sm transition-colors hover:border-line-bright hover:text-text-hi"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
