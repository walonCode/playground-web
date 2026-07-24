import { BACKEND_ORIGIN } from "./config";

/**
 * Whether the box's deep health check reports every dependency up.
 *
 * Called server-side from the route handlers, so it hits the backend directly
 * rather than through the browser proxy. Unreachable — the box is still
 * booting — is treated as not-ready, never as an error.
 */
export async function deepHealthReady(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/health/deep`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "ready";
  } catch {
    return false;
  }
}
