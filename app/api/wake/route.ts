import { auth } from "@/lib/auth/auth";
import { WAKE_ESTIMATE_S } from "@/lib/demo/config";
import { getInstanceController } from "@/lib/demo/instance";
import { getStateStore } from "@/lib/demo/state";

// Runtime, never cached: this has side effects and reads live state.
export const dynamic = "force-dynamic";

/**
 * Wake the box.
 *
 * Idempotent and cheap to call repeatedly — the anti-spam protection is the
 * state check, not a trust that the frontend behaves. If it is already awake or
 * waking, no AWS call is made. Otherwise the first caller to flip the state to
 * `waking` is the only one that starts the instance.
 */
export async function POST(request: Request) {
  /*
   * Starting an instance costs real money, so it is the one action that demands
   * a real account. An unauthenticated caller is refused with a 401 and nothing
   * moves — deliberately NOT a shutdown, which would hand anyone a way to keep
   * the demo permanently offline by sending bad credentials.
   */
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return Response.json({ error: "sign in to wake the box" }, { status: 401 });
  }

  const store = getStateStore();
  const snap = await store.snapshot();

  if (snap.state === "awake" || snap.state === "waking") {
    return Response.json({
      state: snap.state,
      estimatedSeconds: WAKE_ESTIMATE_S,
    });
  }

  // Claim the wake atomically. Two visitors racing here: exactly one wins.
  const claimed =
    (await store.compareAndSet("asleep", "waking")) ||
    (await store.compareAndSet("sleeping", "waking"));

  if (!claimed) {
    const now = await store.snapshot();
    return Response.json({
      state: now.state,
      estimatedSeconds: WAKE_ESTIMATE_S,
    });
  }

  await store.markWoken();
  await store.touchActivity();

  const instance = getInstanceController();
  try {
    // Defensive: confirm it is actually stopped rather than trusting the key.
    const state = await instance.describeState();
    if (state !== "running") {
      await instance.start();
    }
  } catch (error) {
    // Leave state as waking; /status will resolve it once the box answers, or
    // it will simply never flip to awake — which reads honestly as "waking".
    console.error("[wake] start failed", (error as Error).message);
  }

  return Response.json({
    state: "waking",
    estimatedSeconds: WAKE_ESTIMATE_S,
    dryRun: !instance.live,
  });
}
