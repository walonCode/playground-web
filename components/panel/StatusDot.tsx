export type Status = "nominal" | "degraded" | "down" | "unknown";

/**
 * The status language, in one place. Every panel, graph and pipeline stage
 * reads from this map, so a visitor learns the colours once.
 *
 * Fuchsia is deliberately absent: it marks what the visitor caused, never how
 * the system is doing.
 */
const STATUS: Record<Status, { dot: string; text: string; label: string }> = {
  nominal: {
    dot: "bg-nominal",
    text: "text-nominal",
    label: "nominal",
  },
  degraded: {
    dot: "bg-degraded",
    text: "text-degraded",
    label: "degraded",
  },
  down: { dot: "bg-down", text: "text-down", label: "down" },
  unknown: {
    dot: "bg-text-low",
    text: "text-text-low",
    label: "unknown",
  },
};

export function StatusDot({
  status,
  label,
  showLabel = true,
}: {
  status: Status;
  /** Overrides the default word, e.g. "waking" or "compensating". */
  label?: string;
  showLabel?: boolean;
}) {
  const tone = STATUS[status];

  return (
    <span className="inline-flex items-center gap-2">
      <span
        // Square, not round. Nothing in this system is rounded, and a 6px
        // square reads as an indicator lamp rather than a decorative bullet.
        className={`size-1.5 shrink-0 ${tone.dot}`}
        aria-hidden="true"
      />
      {showLabel && (
        <span
          className={`font-mono text-[11px] tracking-[0.14em] uppercase ${tone.text}`}
        >
          {label ?? tone.label}
        </span>
      )}
    </span>
  );
}
