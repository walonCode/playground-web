/**
 * Typed client for the Glass Box gateway.
 *
 * Response shapes mirror `api/libs/contracts/src/{search,cache}.ts` — the same
 * contracts the Nest services compile against. They are duplicated rather than
 * imported because the two repos deploy separately; if a field is renamed there
 * it must be renamed here, and the panel will show `—` rather than silently
 * rendering undefined.
 */

/**
 * Where the browser sends requests.
 *
 * Defaults to this origin's own `/api`, which the Next rewrite forwards to the
 * backend server-side — the only arrangement that works from an HTTPS page in
 * front of an HTTP box. Local development sets `NEXT_PUBLIC_API_URL` to hit the
 * gateway directly and skip the proxy.
 */
// `||` not `??`: a var set to an empty string in a dashboard must still fall
// back, or the base becomes "" and every request hits the wrong path.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/** The deployed origin, for building absolute URLs. Empty in local dev. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

/**
 * The public, absolute form of the API base, for the copyable curl.
 *
 * A relative `/api` is what the browser uses, but a recruiter pasting it into a
 * terminal needs a real host. Resolved from env rather than `window` so the
 * server and client render the same string and hydration does not mismatch.
 */
export const PUBLIC_API_BASE = /^https?:\/\//.test(API_BASE)
  ? API_BASE
  : `${SITE_URL}${API_BASE}`;

/** Where the source lives, for the evidence links on each panel. */
export const REPO_BASE =
  "https://github.com/walonCode/playground-api/blob/main";

export interface SearchHit {
  id: string;
  title: string;
  author: string;
  category: string;
  rank: number;
  snippet: string;
}

export interface SearchQueryResponse {
  query: string;
  hits: SearchHit[];
  total: number;
  /** True when served from Redis rather than Postgres. */
  cached: boolean;
  /** Wall-clock ms for the whole lookup — the number the demo turns on. */
  tookMs: number;
  cacheKey: string;
}

export interface CacheStatsResponse {
  hits: number;
  misses: number;
  hitRate: number;
  keyCount: number;
  connected: boolean;
}

export interface CacheEvictResponse {
  evicted: number;
  keys: string[];
}

/**
 * One shape for both readings. The gateway answers `/services/status` and the
 * lifecycle service answers `/health/deep` in the same envelope, so the mesh
 * holds a single type and one renderer instead of two that drift.
 */
export interface ComponentHealth {
  service: string;
  status: "up" | "down";
  /** Null when the probe failed or timed out — there is no honest number. */
  latency_ms: number | null;
}

export interface HealthReport {
  status: "ready" | "degraded";
  services: ComponentHealth[];
}

/** A failed call carries the status so a panel can tell 404 from 504. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { accept: "application/json", ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    // No status: the gateway is unreachable, or the box is still waking.
    const reason =
      error instanceof DOMException && error.name === "TimeoutError"
        ? `no response within ${timeoutMs / 1000}s`
        : "gateway unreachable";
    throw new ApiError(reason, null);
  }

  if (!response.ok) {
    // The gateway maps downstream failures onto real statuses, so its message
    // is worth surfacing verbatim instead of inventing one.
    let detail = `${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body?.message) detail = body.message;
    } catch {
      // Non-JSON error body; the status alone will have to do.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}

export interface SearchArgs {
  q: string;
  limit?: number;
  skipCache?: boolean;
}

/** Builds the query string once so the panel and its curl cannot disagree. */
export function searchPath({ q, limit, skipCache }: SearchArgs): string {
  const params = new URLSearchParams({ q });
  if (limit !== undefined) params.set("limit", String(limit));
  if (skipCache) params.set("skipCache", "true");
  return `/search?${params.toString()}`;
}

export function search(args: SearchArgs): Promise<SearchQueryResponse> {
  return request<SearchQueryResponse>(searchPath(args));
}

/** All seven services in one round trip, for the mesh poll. */
export function servicesStatus(): Promise<HealthReport> {
  return request<HealthReport>("/services/status", {}, 15_000);
}

/** Postgres, Redis and Kafka as probed on the box itself. */
export function deepHealth(): Promise<HealthReport> {
  return request<HealthReport>("/health/deep", {}, 15_000);
}

export function cacheStats(): Promise<CacheStatsResponse> {
  return request<CacheStatsResponse>("/cache/stats");
}

export function cacheEvict(pattern: string): Promise<CacheEvictResponse> {
  return request<CacheEvictResponse>("/cache/evict", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pattern }),
  });
}

/**
 * The exact command that reproduces a call, for the evidence layer. A visitor
 * who pastes this into a terminal gets the same numbers — the one proof of
 * liveness that cannot be faked by a screenshot.
 */
export function curlFor(
  path: string,
  init?: { method?: string; body?: unknown },
): string {
  const url = `${PUBLIC_API_BASE}${path}`;
  if (!init?.method || init.method === "GET") {
    return `curl -s '${url}'`;
  }
  const body = init.body ? ` \\\n  -d '${JSON.stringify(init.body)}'` : "";
  return `curl -s -X ${init.method} '${url}' \\\n  -H 'content-type: application/json'${body}`;
}
