/**
 * The guided tour — a scripted path through the demos so a visitor is never
 * dropped into a free 3D scene wondering what to do.
 *
 * Each step focuses a node (the camera flies there, the rest dims) and, when the
 * node has a demo, opens it. The copy tells the visitor exactly what to click;
 * the tour drives the framing, they drive the action.
 */
export interface TourStep {
  /** Node to spotlight and focus. null keeps the whole mesh in view. */
  nodeId: string | null;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    nodeId: "gateway",
    title: "Wake the box",
    body: "The demos run on one EC2 box that sleeps when idle. If it says asleep, hit Wake (top right) and watch it come up — the state only flips to awake once a real health check passes.",
  },
  {
    nodeId: "search",
    title: "Run a search",
    body: "This searches 60,000 documents. Type a query and hit Run — note the time and that it came from Redis.",
  },
  {
    nodeId: "cache",
    title: "Drop the cache",
    body: "Hit Evict, then run the exact same search again. It's slower now — it had to reach Postgres instead of Redis. That gap is the whole point.",
  },
  {
    nodeId: "task",
    title: "Add a todo, then run it",
    body: "Add a todo — it is yours, tied to your account. Hit run and it becomes a real BullMQ job: watch it queue, run, and complete. Tick the failure box first to see retries climb and the job dead-letter.",
  },
  {
    nodeId: "payment",
    title: "Run a payment saga",
    body: "Pick a test card and checkout. Choose a failing card to watch the saga compensate — undoing the steps that already ran. All simulated.",
  },
  {
    nodeId: "chat",
    title: "Send a live message",
    body: "This is a real WebSocket. Send a message — open a second tab to watch it broadcast between clients instantly.",
  },
  {
    nodeId: null,
    title: "Explore freely",
    body: "That's the tour. Every number was measured on a real backend — copy the curl under any panel and check it yourself. Drag to orbit, click any node.",
  },
];
