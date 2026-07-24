"use client";

import { NODE_META, nodeColor } from "@/lib/mesh";
import { useThemeValue } from "@/lib/theme";

/**
 * The caption card for the little per-service 3D walkthrough.
 *
 * It sits in the open area left of the docked panel and narrates each hop as the
 * matching edge lights in the scene. Non-blocking: the panel behind it is live
 * the whole time, and a skip is always one click away.
 */
export function WalkthroughHud({
  nodeId,
  step,
  total,
  caption,
  onSkip,
}: {
  nodeId: string;
  step: number;
  total: number;
  caption: string;
  onSkip: () => void;
}) {
  const theme = useThemeValue();
  const color = nodeColor(nodeId, theme);
  const meta = NODE_META[nodeId];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 hidden justify-center px-6 sm:right-[27rem] sm:flex">
      <div
        key={step}
        className="animate-rise pointer-events-auto w-full max-w-md border border-line bg-void/95 p-4 backdrop-blur-sm"
        style={{ borderLeftColor: color, borderLeftWidth: 2 }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] uppercase">
            <span style={{ color }}>{meta?.icon}</span>
            <span className="text-text-low">walkthrough · {nodeId}</span>
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="border border-line px-2 py-0.5 font-mono text-[10px] text-text-low uppercase transition-colors hover:border-line-bright hover:text-text-hi"
          >
            skip
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-text-hi">{caption}</p>

        {/* Step progress — a dot per hop, the current one filled with identity. */}
        <div className="mt-3 flex items-center gap-1.5">
          {Array.from({ length: total }, (_, i) => `hop-${i}`).map((id, i) => (
            <span
              key={id}
              className="h-1 flex-1 transition-colors"
              style={{
                background: i <= step ? color : "var(--color-line)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
