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

/**
 * A short-lived JWT for the box, cached until shortly before it expires.
 *
 * The session cookie proves who you are to *this* origin; the box is a separate
 * origin that trusts only a signed token, so every write carries one. Minting is
 * a round trip, hence the cache.
 */
let tokenCache: { token: string; expiresAt: number } | null = null;

async function boxToken(): Promise<string | null> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  try {
    const res = await fetch("/api/auth/token", { credentials: "include" });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string };
    if (!body.token) return null;
    // Tokens live 15 minutes; refresh a minute early to avoid edge misses.
    tokenCache = { token: body.token, expiresAt: Date.now() + 14 * 60_000 };
    return body.token;
  } catch {
    return null;
  }
}

/** Drops the cached token — call on sign-out so the next request is anonymous. */
export function clearBoxToken(): void {
  tokenCache = null;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let response: Response;

  // Attach identity when we have it. Reads stay usable anonymously; the box
  // decides which routes actually demand a token.
  const token = typeof window !== "undefined" ? await boxToken() : null;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
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
    // A guarded route refusing an anonymous caller is not an error to debug —
    // it is a prompt. Say what to do rather than echoing "Unauthorized".
    if (response.status === 401) {
      throw new ApiError("sign in to run this", 401);
    }

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

// --- task -------------------------------------------------------------------

export type TaskStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "dead_lettered"
  | "canceled";

export const TASK_KINDS = [
  "resize-image",
  "send-digest",
  "transcode",
  "reindex",
  "export-csv",
] as const;

export interface TaskDto {
  id: string;
  title: string;
  done: boolean;
  kind: string;
  status: TaskStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatsResponse {
  byStatus: Record<TaskStatus, number>;
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

export interface TaskSubmitBody {
  kind: string;
  durationMs?: number;
  shouldFail?: boolean;
  maxAttempts?: number;
}

// --- todos: per-user CRUD whose items are real queue jobs -------------------

export function todoList(): Promise<{ tasks: TaskDto[] }> {
  return request<{ tasks: TaskDto[] }>("/todos");
}

export function todoCreate(title: string): Promise<TaskDto> {
  return request<TaskDto>("/todos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function todoUpdate(
  id: string,
  patch: { title?: string; done?: boolean },
): Promise<TaskDto> {
  return request<TaskDto>(`/todos/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export function todoDelete(id: string): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`/todos/${id}`, { method: "DELETE" });
}

/** Pushes the todo through the real BullMQ queue. */
export function todoRun(id: string, shouldFail = false): Promise<TaskDto> {
  return request<TaskDto>(`/todos/${id}/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ shouldFail }),
  });
}

export function taskStats(): Promise<TaskStatsResponse> {
  return request<TaskStatsResponse>("/tasks/stats");
}

export function taskList(limit = 8): Promise<{ tasks: TaskDto[] }> {
  return request<{ tasks: TaskDto[] }>(`/tasks?limit=${limit}`);
}

export function taskGet(id: string): Promise<TaskDto> {
  return request<TaskDto>(`/tasks/${id}`);
}

export function taskSubmit(body: TaskSubmitBody): Promise<TaskDto> {
  return request<TaskDto>("/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function taskRetry(id: string): Promise<TaskDto> {
  return request<TaskDto>(`/tasks/${id}/retry`, { method: "POST" });
}

export function taskCancel(id: string): Promise<TaskDto> {
  return request<TaskDto>(`/tasks/${id}/cancel`, { method: "POST" });
}

// --- payment ----------------------------------------------------------------

export type PaymentStatus =
  | "pending"
  | "reserved"
  | "charged"
  | "confirmed"
  | "failed"
  | "compensated"
  | "refunded";

export type SagaStep = "reserve" | "charge" | "confirm";
export type StepStatus = "started" | "succeeded" | "failed" | "compensated";

export interface PaymentStepDto {
  step: SagaStep;
  status: StepStatus;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentDto {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  intentId: string | null;
  failAtStep: SagaStep | null;
  steps: PaymentStepDto[];
  createdAt: string;
  updatedAt: string;
}

export interface Instrument {
  number: string;
  label: string;
}

export interface CheckoutBody {
  amountCents: number;
  instrument: string;
  idempotencyKey: string;
  failAtStep?: SagaStep;
}

export function paymentInstruments(): Promise<{
  simulated: boolean;
  instruments: Instrument[];
}> {
  return request("/payments/instruments");
}

export function paymentList(limit = 6): Promise<{ payments: PaymentDto[] }> {
  return request<{ payments: PaymentDto[] }>(`/payments?limit=${limit}`);
}

export function paymentCheckout(body: CheckoutBody): Promise<PaymentDto> {
  return request<PaymentDto>("/payments/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function paymentRefund(id: string): Promise<PaymentDto> {
  return request<PaymentDto>(`/payments/${id}/refund`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

// --- chat -------------------------------------------------------------------

/**
 * Where the browser opens the live socket.
 *
 * Direct to the chat service, not through the /api proxy: Vercel's serverless
 * layer cannot forward a WebSocket upgrade, so in production this points at the
 * backend's own wss:// origin. Local dev talks to the chat port over ws://.
 */
export const CHAT_WS_URL =
  process.env.NEXT_PUBLIC_CHAT_WS_URL || "ws://localhost:3003/ws";

export interface ChatMessageDto {
  id: string;
  roomId: string;
  roomSlug: string;
  userId: string | null;
  username: string;
  body: string;
  createdAt: string;
}

export interface ChatHistoryResponse {
  room: { slug: string; name: string; messageCount: number };
  messages: ChatMessageDto[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** REST backfill: the recent history a socket joiner starts from. */
export function chatHistory(
  slug: string,
  limit = 30,
): Promise<ChatHistoryResponse> {
  return request<ChatHistoryResponse>(
    `/chat/rooms/${encodeURIComponent(slug)}/messages?limit=${limit}`,
  );
}

// --- demo power (wake/sleep) ------------------------------------------------
// These hit the Next app's own routes, not the backend, so they resolve even
// while the box is asleep. Same-origin, so no proxy and no configured base.

export type DemoState = "asleep" | "waking" | "awake" | "sleeping";

export interface DemoStatus {
  state: DemoState;
  estimatedSeconds?: number;
  dryRun?: boolean;
}

export async function demoStatus(): Promise<DemoStatus> {
  const res = await fetch("/api/status", { cache: "no-store" });
  return (await res.json()) as DemoStatus;
}

export async function demoWake(): Promise<DemoStatus> {
  const res = await fetch("/api/wake", { method: "POST" });
  return (await res.json()) as DemoStatus;
}

/** Records real activity so the idle timer resets; fire-and-forget. */
export function demoTouch(): void {
  void fetch("/api/touch", { method: "POST" }).catch(() => {});
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
