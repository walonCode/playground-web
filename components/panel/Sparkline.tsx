export interface Sample {
  /** Stable identity assigned when the sample is recorded. */
  id: number;
  /** Milliseconds the call actually took. */
  tookMs: number;
  /** Served from Redis, or from Postgres. */
  cached: boolean;
  /** True on the first query after an eviction — the causal moment. */
  afterEvict?: boolean;
}

/**
 * A record of *your* queries, in order, coloured by where each was served from.
 *
 * This is the whole argument of the panel: evict the cache, run the same query,
 * and the bar jumps. Cause and effect sit in one frame rather than being
 * claimed in prose. Bars are drawn from real `tookMs` values with no smoothing —
 * a chart that eases its way to the truth is not evidence.
 */
export function Sparkline({
  samples,
  max = 20,
}: {
  samples: Sample[];
  max?: number;
}) {
  const shown = samples.slice(-max);

  if (shown.length === 0) {
    return (
      <div className="flex h-16 items-end gap-[3px] border-b border-line pb-px">
        <p className="pb-2 font-mono text-[11px] text-text-low">
          run a query to start the trace
        </p>
      </div>
    );
  }

  // Scale to the tallest bar so the shape of the jump is legible whatever the
  // absolute numbers are. A fixed ceiling would flatten fast queries to nothing.
  const peak = Math.max(...shown.map((s) => s.tookMs), 1);

  return (
    <div>
      <div
        className="flex h-16 items-end gap-[3px] border-b border-line pb-px"
        role="img"
        aria-label={`Latency of your last ${shown.length} queries, newest on the right. Peak ${Math.round(peak)} milliseconds.`}
      >
        {shown.map((sample) => {
          // 6% floor so a sub-millisecond cache hit still registers as a mark
          // rather than disappearing and looking like a missing reading.
          const height = Math.max(6, (sample.tookMs / peak) * 100);
          const tone = sample.cached ? "bg-nominal" : "bg-degraded";

          return (
            <div
              key={sample.id}
              className="group relative flex-1"
              style={{ height: `${height}%` }}
            >
              <div className={`h-full w-full ${tone}`} />
              {sample.afterEvict && (
                <span
                  className="absolute -top-3 left-1/2 h-2 w-px -translate-x-1/2 bg-action"
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="font-mono text-[10px] tracking-[0.14em] text-text-low uppercase">
          your last {shown.length} {shown.length === 1 ? "query" : "queries"} ·
          peak {Math.round(peak)}ms
        </p>
        <div className="flex items-center gap-4 font-mono text-[10px] text-text-low">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 bg-nominal" aria-hidden="true" />
            cached
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 bg-degraded" aria-hidden="true" />
            from postgres
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-px bg-action" aria-hidden="true" />
            you evicted
          </span>
        </div>
      </div>
    </div>
  );
}
