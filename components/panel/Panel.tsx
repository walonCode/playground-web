import type { ReactNode } from "react";
import { type Status, StatusDot } from "./StatusDot";

/**
 * Hairline flat: 1px rules, zero radius, no shadow, surface the same value as
 * the page. Dividers carry the structure — a deliberate rejection of the
 * rounded, soft-shadowed card that every dashboard template reaches for.
 */
export function Panel({
  label,
  status,
  statusLabel,
  children,
}: {
  /** Short technical name, e.g. "search · cache". */
  label: string;
  status?: Status;
  statusLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-void">
      <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <h2 className="font-mono text-[11px] tracking-[0.18em] text-text-mid uppercase">
          {label}
        </h2>
        {status && <StatusDot status={status} label={statusLabel} />}
      </header>
      {children}
    </section>
  );
}

/** A hairline-separated band inside a panel. Sections stack; they never nest. */
export function PanelSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-b border-line px-4 py-4 last:border-b-0 ${className}`}
    >
      {children}
    </div>
  );
}
