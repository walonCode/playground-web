/**
 * The deploy journey, as a stage machine.
 *
 * Two things this deliberately does NOT do: claim a GitHub Actions run that does
 * not exist (this repo has no `.github/workflows` yet), and invent timings. Each
 * stage carries its real command and a provenance flag — `measured` values were
 * timed on this machine at the commit shown; `network` stages are the parts a
 * push genuinely performs but whose duration depends on the wire, not the code.
 *
 * The component consuming this is source-agnostic. When the CI webhook receiver
 * lands, the same machine takes real `StageEvent`s off an EventSource with no
 * change here — the replay is just the first driver.
 */

export type StageState = "pending" | "running" | "passed" | "failed";

export type Provenance = "measured" | "network";

export interface Stage {
  id: string;
  /** Imperative label, matching the command's own vocabulary. */
  title: string;
  /** The actual command this stage runs. */
  command: string;
  /** One line on what it proved, shown once the stage passes. */
  result: string;
  provenance: Provenance;
  /** Real duration in ms; null for network stages we do not time. */
  durationMs: number | null;
}

/**
 * A single transition, the unit both the replay and the future EventSource emit.
 * Keeping the driver behind this shape is what lets the live source drop in
 * later without touching the view.
 */
export interface StageEvent {
  stageId: string;
  state: StageState;
  at: number;
}

/**
 * Captured against commit 5fc4c52 on main. `measured` durations are wall-clock
 * from this repo; update them by re-timing, not by editing to taste.
 */
export const RECORDED_COMMIT = "5fc4c52";

export const STAGES: Stage[] = [
  {
    id: "commit",
    title: "commit",
    command: 'git commit -m "style(cache): reformat the e2e suite"',
    result: `${RECORDED_COMMIT} on main`,
    provenance: "network",
    durationMs: null,
  },
  {
    id: "push",
    title: "push",
    command: "git push origin main",
    result: "→ origin/main",
    provenance: "network",
    durationMs: null,
  },
  {
    id: "lint",
    title: "lint",
    command: "pnpm lint",
    result: "0 problems",
    provenance: "measured",
    durationMs: 6409,
  },
  {
    id: "build",
    title: "build",
    command: "pnpm build:all",
    result: "8 / 8 apps compiled",
    provenance: "measured",
    durationMs: 28615,
  },
  {
    id: "test",
    title: "test",
    command: "pnpm test:e2e",
    result: "10 passed, 0 failed",
    provenance: "measured",
    durationMs: 3410,
  },
  {
    id: "provision",
    title: "provision",
    command: "docker compose up -d && create-topics && create-databases",
    result: "3 containers · 5 databases · topics ready",
    provenance: "measured",
    durationMs: 1902,
  },
  {
    id: "boot",
    title: "boot",
    command: "pnpm dev:all",
    result: "gateway + 7 services listening",
    provenance: "network",
    durationMs: null,
  },
  {
    id: "verify",
    title: "verify",
    command: "curl -s /api/health/deep",
    result: "status: ready — postgres · redis · kafka up",
    provenance: "measured",
    durationMs: 129,
  },
];

/**
 * How long a stage should appear to run in the replay.
 *
 * Real measured durations, compressed onto a log scale so a 28s build does not
 * make the viewer wait 28 seconds while a 129ms check flashes past invisibly.
 * Network stages get a fixed beat. The compression is honest because the true
 * number is shown on the stage itself — the animation paces, the label reports.
 */
export function replayMs(stage: Stage): number {
  if (stage.durationMs === null) return 700;
  // 1s→~300ms, 30s→~1.5s: enough to read the transition, never a real wait.
  return Math.round(300 + Math.log10(stage.durationMs) * 320);
}
