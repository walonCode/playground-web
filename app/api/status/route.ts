import { HEALTH_THROTTLE_MS, MIN_WAKE_MS } from "@/lib/demo/config";
import { deepHealthReady } from "@/lib/demo/health";
import { getStateStore } from "@/lib/demo/state";

export const dynamic = "force-dynamic";

/**
 * The frequently-polled read the frontend drives while waking.
 *
 * Favours honesty over optimism: it only flips `waking → awake` once the deep
 * health check genuinely passes, because flipping early is the single most
 * likely way this shows a visitor a broken demo. It also does not health-check
 * a box that cannot be up yet, nor on every awake poll.
 */
export async function GET() {
  const store = getStateStore();
  const snap = await store.snapshot();

  if (snap.state === "asleep" || snap.state === "sleeping") {
    return Response.json({ state: snap.state });
  }

  if (snap.state === "waking") {
    const elapsed = Date.now() - (snap.wokenAt ?? 0);
    if (elapsed >= MIN_WAKE_MS && (await deepHealthReady())) {
      await store.compareAndSet("waking", "awake");
      await store.markHealthChecked();
      return Response.json({ state: "awake" });
    }
    return Response.json({ state: "waking" });
  }

  // awake: re-check health, but throttled so we don't hammer the box.
  const stale =
    !snap.lastHealthAt || Date.now() - snap.lastHealthAt > HEALTH_THROTTLE_MS;
  if (stale) {
    await store.markHealthChecked();
    // A blip does not force a state change; the box is still "up", just noisy.
    await deepHealthReady();
  }
  return Response.json({ state: "awake" });
}
