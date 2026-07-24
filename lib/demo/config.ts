/**
 * Wake/sleep configuration.
 *
 * This half of the lifecycle feature lives in the Next app, never on EC2 — the
 * thing that powers a box on cannot run on the box it powers. Every knob is an
 * env var so the behaviour can be tuned per deployment without a rebuild.
 */

export type DemoState = "asleep" | "waking" | "awake" | "sleeping";

/** Shown to the visitor as a rough wait; real readiness is decided by /health. */
export const WAKE_ESTIMATE_S = 90;

/**
 * How long after a wake before /status bothers health-checking. Pinging a box
 * that cannot be up yet is wasted work. Short by default so the demo is not
 * tedious; raise it toward ~60s for a real cold EC2 start.
 */
export const MIN_WAKE_MS = Number(process.env.DEMO_MIN_WAKE_MS ?? 5_000);

/** Idle threshold before the box is put back to sleep. */
export const IDLE_MS = Number(process.env.DEMO_IDLE_MS ?? 25 * 60 * 1_000);

/** Don't run the deep health check on every awake poll — throttle it. */
export const HEALTH_THROTTLE_MS = 8_000;

/** Reached server-side from the route handlers, so HTTP to the box is fine. */
export const BACKEND_ORIGIN = process.env.API_ORIGIN || "http://localhost:3001";

export const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID;
export const AWS_REGION = process.env.AWS_REGION;

/**
 * The safety catch. StartInstances / StopInstances only fire for real when this
 * is explicitly "true" AND an instance id is set — otherwise the controller
 * dry-runs and logs what it would have done. So the wiring ships complete and
 * inert; flipping one env var arms it.
 */
export const AWS_LIVE =
  process.env.AWS_LIVE === "true" && Boolean(EC2_INSTANCE_ID);

/** Protects the cron sleep route from being triggered by anyone. */
export const CRON_SECRET = process.env.CRON_SECRET;
