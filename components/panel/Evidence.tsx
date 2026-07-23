"use client";

import { useState } from "react";

/**
 * The real path a click took: HTTP route, Kafka pattern, measured duration.
 * Naming the pattern is the point — it shows there is a broker behind the
 * button rather than a function call pretending to be one.
 */
export function WireTrace({
  method,
  path,
  pattern,
  tookMs,
  failed = false,
}: {
  method: string;
  path: string;
  pattern: string;
  tookMs: number | null;
  failed?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 font-mono text-[11px]">
      <span className="tracking-[0.14em] text-text-low uppercase">wire</span>
      <span className={failed ? "text-down" : "text-text-mid"}>
        {method} {path}
      </span>
      <span className="text-text-low">→</span>
      <span className={failed ? "text-down" : "text-text-mid"}>{pattern}</span>
      <span className="text-text-low">→</span>
      <span className={`tabular ${failed ? "text-down" : "text-nominal"}`}>
        {tookMs === null ? "no reply" : `${Math.round(tookMs)}ms`}
      </span>
    </p>
  );
}

/**
 * The exact command that reproduces what is on screen.
 *
 * A recruiter's default assumption is that a dashboard like this is a mock.
 * Looking live is not enough; this lets them check. It is the only proof here
 * that a screenshot cannot imitate.
 */
export function CopyCurl({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked without a secure context or permission. The
      // command is on screen and selectable, so this stays silent rather than
      // throwing an error at someone who can simply select the text.
    }
  }

  return (
    <div className="flex items-start gap-3">
      <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[11px] whitespace-pre text-text-mid">
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 border border-line px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-text-low uppercase transition-colors hover:border-line-bright hover:text-text-hi"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

/** Points a claim at the code that answers it. */
export function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[11px] text-text-low underline decoration-line-bright underline-offset-4 transition-colors hover:text-nominal"
    >
      {label}
    </a>
  );
}
