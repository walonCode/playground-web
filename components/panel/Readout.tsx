import type { ReactNode } from "react";

export type ReadoutTone = "default" | "nominal" | "degraded" | "down";

const TONE: Record<ReadoutTone, string> = {
  default: "text-text-hi",
  nominal: "text-nominal",
  degraded: "text-degraded",
  down: "text-down",
};

/**
 * A single measurement: label above, value below, monospace and tabular.
 *
 * `value` of null renders an em dash rather than a plausible-looking zero. A
 * pending or failed reading must never be mistakable for a real one — the whole
 * pitch is that these numbers are measured.
 */
export function Readout({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: ReactNode | null;
  unit?: string;
  tone?: ReadoutTone;
}) {
  const pending = value === null || value === undefined;

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-[0.16em] text-text-low uppercase">
        {label}
      </span>
      <span
        className={`tabular font-mono text-lg leading-none ${
          pending ? "text-text-low" : TONE[tone]
        }`}
      >
        {pending ? "—" : value}
        {!pending && unit && (
          <span className="ml-1 text-xs text-text-mid">{unit}</span>
        )}
      </span>
    </div>
  );
}

/** Readouts sit in a grid so their digits line up in columns. */
export function ReadoutGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
      {children}
    </div>
  );
}
