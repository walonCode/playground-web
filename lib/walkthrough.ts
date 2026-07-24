/**
 * The little 3D walkthrough each interactive service plays when you open it.
 *
 * Clicking a node flies the camera to it; this is what happens next — a short,
 * narrated sequence that lights the *real* edges the service's own request path
 * crosses, one hop at a time, so you watch how the service actually works before
 * you drive it in the panel.
 *
 * Every `edge` here is a real edge id from the mesh, so the glow you see is the
 * true topology, not a decorative animation. A `null` edge is a step that has no
 * wire — the live WebSocket broadcast, for instance — and lights nothing.
 */
export interface WalkStep {
  /** A real edge id to light for this step, or null for a step with no wire. */
  edge: string | null;
  caption: string;
}

export interface Walkthrough {
  steps: WalkStep[];
}

/** How long each step holds before the next hop. */
export const WALK_STEP_MS = 1600;

export const WALKTHROUGH: Record<string, Walkthrough> = {
  search: {
    steps: [
      {
        edge: "gateway→search",
        caption:
          "Your query enters the one public gateway and is routed to the search service over Kafka.",
      },
      {
        edge: "search→cache",
        caption:
          "Search asks Redis first — a cache-aside lookup. A hit comes back in a few milliseconds.",
      },
      {
        edge: "search→postgres",
        caption:
          "On a miss it runs a full-text query in Postgres, then caches the result for next time.",
      },
    ],
  },
  cache: {
    steps: [
      {
        edge: "gateway→cache",
        caption:
          "An evict enters the gateway and reaches the cache service over Kafka.",
      },
      {
        edge: "cache→redis",
        caption:
          "It drops the matching keys from Redis — so the next search has to hit Postgres again, and you can watch it slow down.",
      },
    ],
  },
  task: {
    steps: [
      {
        edge: "gateway→task",
        caption:
          "Creating a todo enters the gateway and reaches the task service over Kafka.",
      },
      {
        edge: "task→postgres",
        caption:
          "The todo is a real row, persisted in the task's own Postgres.",
      },
      {
        edge: "task→redis",
        caption:
          "Run it and it becomes a BullMQ job in Redis — real retries, real dead-lettering.",
      },
    ],
  },
  payment: {
    steps: [
      {
        edge: "gateway→payment",
        caption:
          "Checkout enters the gateway and reaches the payment service over Kafka.",
      },
      {
        edge: "payment→postgres",
        caption:
          "Each saga step — reserve, charge, confirm — is written to Postgres…",
      },
      {
        edge: "payment→postgres",
        caption:
          "…and if a step fails, the ones before it are compensated, unwinding the saga.",
      },
    ],
  },
  chat: {
    steps: [
      {
        edge: "gateway→chat",
        caption:
          "Room history backfills through the gateway and Kafka when a client joins.",
      },
      {
        edge: "chat→postgres",
        caption: "Every message is persisted in the chat service's Postgres…",
      },
      {
        edge: null,
        caption:
          "…then broadcast live over the WebSocket to every client in the room — no polling.",
      },
    ],
  },
};
