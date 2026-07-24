"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePulse } from "@/components/hero/TrafficContext";
import { CopyCurl, WireTrace } from "@/components/panel/Evidence";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { Readout, ReadoutGrid } from "@/components/panel/Readout";
import { type Sample, Sparkline } from "@/components/panel/Sparkline";
import type { Status } from "@/components/panel/StatusDot";
import {
  ApiError,
  type CacheStatsResponse,
  cacheEvict,
  cacheStats,
  curlFor,
  type SearchQueryResponse,
  type SearchStatsResponse,
  search,
  searchGenerate,
  searchPath,
  searchStats,
} from "@/lib/api";
import { TRAFFIC_PATHS } from "@/lib/mesh";

const EVICT_PATTERN = "search:*";
// Matches the seeded corpus and is genuinely expensive uncached — measured at
// ~11ms from Redis against ~91ms from Postgres, which is the swing the panel
// exists to show. A query returning nothing would demonstrate nothing.
const DEFAULT_QUERY = "consumer lag";

export function SearchCachePanel() {
  const pulse = usePulse();
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [skipCache, setSkipCache] = useState(false);

  const [result, setResult] = useState<SearchQueryResponse | null>(null);
  const [stats, setStats] = useState<CacheStatsResponse | null>(null);
  const [corpus, setCorpus] = useState<SearchStatsResponse | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedNote, setSeedNote] = useState<string | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  // Monotonic, so each bar keeps its identity as the window slides.
  const nextSampleId = useRef(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set by an eviction, consumed by the next query so the bar can be marked as
  // the causal moment rather than guessed at from timings.
  const [evictPending, setEvictPending] = useState(false);
  const [lastEvicted, setLastEvicted] = useState<number | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await cacheStats());
    } catch {
      // Cache stats are context, not the headline. A failure here leaves the
      // readouts pending rather than blanking the whole panel.
      setStats(null);
    }
  }, []);

  const refreshCorpus = useCallback(async () => {
    try {
      setCorpus(await searchStats());
    } catch {
      setCorpus(null);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
    void refreshCorpus();
  }, [refreshStats, refreshCorpus]);

  async function runSeed() {
    if (seeding) return;
    setSeeding(true);
    setError(null);
    setSeedNote(null);
    pulse(["gateway→search"]);
    try {
      const res = await searchGenerate();
      setSeedNote(
        res.inserted > 0
          ? `seeded ${res.inserted} documents · search them now`
          : "corpus is at capacity",
      );
      await refreshCorpus();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "seeding failed");
    } finally {
      setSeeding(false);
    }
  }

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    if (busy || query.trim().length === 0) return;

    setBusy(true);
    setError(null);
    // Fired before the await so the mesh lights as the request leaves, which is
    // when it actually crosses the wire.
    pulse(TRAFFIC_PATHS.search);

    try {
      const response = await search({ q: query, skipCache });
      setResult(response);
      nextSampleId.current += 1;
      setSamples((prev) => [
        ...prev,
        {
          id: nextSampleId.current,
          tookMs: response.tookMs,
          cached: response.cached,
          afterEvict: evictPending,
        },
      ]);
      setEvictPending(false);
      await refreshStats();
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : "search failed";
      setError(message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  async function runEvict() {
    if (busy) return;
    setBusy(true);
    setError(null);
    pulse(TRAFFIC_PATHS.evict);

    try {
      const response = await cacheEvict(EVICT_PATTERN);
      setLastEvicted(response.evicted);
      setEvictPending(true);
      await refreshStats();
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : "evict failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  // Honest about what is known. Before the first call nothing has been measured,
  // so the panel says unknown rather than assuming health.
  const status: Status = error
    ? "down"
    : result === null && stats === null
      ? "unknown"
      : stats?.connected === false
        ? "degraded"
        : "nominal";

  const path = searchPath({ q: query, skipCache });

  return (
    <Panel label="search · cache" status={status}>
      <PanelSection>
        <form onSubmit={runSearch} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="search-q">
              Search query
            </label>
            <input
              id="search-q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="consumer lag"
              className="min-w-0 flex-1 border border-line bg-panel px-3 py-2 font-mono text-sm text-text-hi placeholder:text-text-low focus:border-line-bright focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="border border-line-bright px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-text-hi uppercase transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:text-text-low"
            >
              {busy ? "running" : "run"}
            </button>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 font-mono text-[11px] text-text-mid">
            <input
              type="checkbox"
              checked={skipCache}
              onChange={(e) => setSkipCache(e.target.checked)}
              className="size-3.5 accent-[var(--color-action)]"
            />
            bypass cache
          </label>
        </form>
      </PanelSection>

      <PanelSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-text-mid">
            corpus{" "}
            <span className="tabular text-text-hi">
              {corpus ? corpus.totalDocuments.toLocaleString() : "—"}
            </span>{" "}
            docs
            {corpus && (
              <span className="text-text-low">
                {" · "}
                {corpus.seededDocuments.toLocaleString()} seeded ·{" "}
                {corpus.generatedDocuments.toLocaleString()}/{corpus.capacity}{" "}
                generated
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={runSeed}
            disabled={seeding || corpus?.canGenerateMore === false}
            className="border border-line-bright px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-text-hi uppercase transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:text-text-low"
          >
            {seeding
              ? "seeding…"
              : corpus?.canGenerateMore === false
                ? "at capacity"
                : "seed documents"}
          </button>
        </div>
        {seedNote && (
          <p className="mt-2 font-mono text-[11px] text-nominal">{seedNote}</p>
        )}
      </PanelSection>

      <PanelSection>
        <ReadoutGrid>
          <Readout
            label="took"
            value={result ? result.tookMs.toFixed(1) : null}
            unit="ms"
            tone={result?.cached ? "nominal" : "degraded"}
          />
          <Readout
            label="source"
            value={result ? (result.cached ? "redis" : "postgres") : null}
          />
          <Readout label="results" value={result ? result.total : null} />
          <Readout
            label="hit rate"
            value={stats ? stats.hitRate.toFixed(3) : null}
          />
          <Readout
            label="keys"
            value={stats ? stats.keyCount.toLocaleString() : null}
          />
          <Readout
            label="hits / misses"
            value={stats ? `${stats.hits} / ${stats.misses}` : null}
          />
        </ReadoutGrid>
      </PanelSection>

      <PanelSection>
        <Sparkline samples={samples} />
      </PanelSection>

      <PanelSection>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={runEvict}
            disabled={busy}
            // Fuchsia marks this as the visitor's own doing. It is the only
            // control here that changes server state, and the only one that
            // earns the causality colour.
            className="border border-action px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-action uppercase transition-colors hover:bg-action-dim disabled:cursor-not-allowed disabled:opacity-50"
          >
            evict {EVICT_PATTERN}
          </button>
          {lastEvicted !== null && (
            <p className="tabular font-mono text-[11px] text-text-mid">
              dropped {lastEvicted} {lastEvicted === 1 ? "key" : "keys"}
              {evictPending && " · run the same query again"}
            </p>
          )}
        </div>
      </PanelSection>

      {error && (
        <PanelSection>
          <p className="font-mono text-[11px] text-down">{error}</p>
        </PanelSection>
      )}

      {result && result.hits.length > 0 && (
        <PanelSection>
          <ol className="flex flex-col gap-3">
            {result.hits.slice(0, 5).map((hit, index) => (
              <li key={hit.id} className="flex gap-3">
                <span className="tabular font-mono text-[11px] text-text-low">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-hi">{hit.title}</p>
                  <p className="font-mono text-[11px] text-text-low">
                    {hit.author} · {hit.category} · rank {hit.rank.toFixed(4)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </PanelSection>
      )}

      <PanelSection className="flex flex-col gap-3">
        <WireTrace
          method="GET"
          path={path}
          pattern="search.query"
          tookMs={result?.tookMs ?? null}
          failed={Boolean(error)}
        />
        <CopyCurl command={curlFor(path)} />
      </PanelSection>
    </Panel>
  );
}
