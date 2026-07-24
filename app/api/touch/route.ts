import { getStateStore } from "@/lib/demo/state";

export const dynamic = "force-dynamic";

/**
 * Records that a visitor did something real, resetting the idle clock.
 *
 * The frontend calls this when a demo is actually used, not on passive status
 * polls — otherwise the box would never look idle and never sleep.
 */
export async function POST() {
  await getStateStore().touchActivity();
  return Response.json({ ok: true });
}
