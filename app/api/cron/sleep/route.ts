import { CRON_SECRET, IDLE_MS } from "@/lib/demo/config";
import { getInstanceController } from "@/lib/demo/instance";
import { getStateStore } from "@/lib/demo/state";

export const dynamic = "force-dynamic";

/**
 * Idle detection, on a schedule (Vercel cron, see vercel.json).
 *
 * Runs independently of the box's own uptime so it can force a stop even if the
 * box became unresponsive. If the demo has been idle past the threshold and is
 * awake, it stops the instance: awake → sleeping → StopInstances → asleep.
 */
export async function GET(request: Request) {
  // Vercel sends the cron secret as a bearer token; reject anything else so the
  // stop cannot be triggered by a random request.
  if (CRON_SECRET) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  const store = getStateStore();
  const snap = await store.snapshot();

  if (snap.state !== "awake") {
    return Response.json({ state: snap.state, action: "none" });
  }

  const idleFor = Date.now() - (snap.lastActivity ?? Date.now());
  if (idleFor < IDLE_MS) {
    return Response.json({ state: "awake", action: "none", idleMs: idleFor });
  }

  if (!(await store.compareAndSet("awake", "sleeping"))) {
    return Response.json({
      state: (await store.snapshot()).state,
      action: "none",
    });
  }

  const instance = getInstanceController();
  try {
    await instance.stop();
    await store.setState("asleep");
  } catch (error) {
    // Roll the state back so a failed stop is retried on the next tick rather
    // than leaving the box stuck as sleeping.
    await store.setState("awake");
    console.error("[cron] stop failed", (error as Error).message);
    return Response.json({ action: "stop-failed" }, { status: 500 });
  }

  return Response.json({
    state: "asleep",
    action: "stopped",
    dryRun: !instance.live,
  });
}
