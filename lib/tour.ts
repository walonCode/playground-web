/**
 * The guided tour — a scripted descent through the whole deployment so a visitor
 * is never dropped into a free 3D scene wondering what to do.
 *
 * Each step names a scope and (optionally) a node to spotlight. The explorer
 * flies to that scope, focuses the node, and opens its demo when it has one; the
 * copy tells the visitor exactly what to try. The tour drives the framing, they
 * drive the action.
 */
import type { ScopeId } from "./topology";

export interface TourStep {
  /** Which level of the map this step lives at. */
  scope: ScopeId;
  /** Node to spotlight and focus. null keeps the whole scope in view. */
  nodeId: string | null;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    scope: "root",
    nodeId: "aws",
    title: "The whole thing",
    body: "Two platforms. AWS runs the server on one EC2 box; Vercel runs this web app. The tour flies you into each — you can also click any node yourself.",
  },
  {
    scope: "aws",
    nodeId: "ec2",
    title: "Into AWS",
    body: "A request resolves through Route 53, meets the load balancer and its TLS cert, and lands on one EC2 box. That box is where everything runs.",
  },
  {
    scope: "ec2",
    nodeId: "gateway",
    title: "Inside the box",
    body: "PM2 keeps the Node apps alive; Docker runs Kafka, Postgres and Redis. The gateway is the one public door into the services.",
  },
  {
    scope: "mesh",
    nodeId: "search",
    title: "Run a search",
    body: "This is the service mesh. Search 60,000 documents — note the time, and that it came from Redis.",
  },
  {
    scope: "mesh",
    nodeId: "cache",
    title: "Drop the cache",
    body: "Evict, then run the same search again. It's slower now — it had to reach Postgres instead of Redis. That gap is the whole point.",
  },
  {
    scope: "mesh",
    nodeId: "task",
    title: "Queue a job",
    body: "Add a todo and run it — it becomes a real BullMQ job. Tick the failure box first to watch it retry and dead-letter.",
  },
  {
    scope: "mesh",
    nodeId: "payment",
    title: "Run a payment saga",
    body: "Checkout with a failing card to watch the saga compensate — undoing the steps that already ran. All simulated.",
  },
  {
    scope: "mesh",
    nodeId: "chat",
    title: "Send a live message",
    body: "Two live clients share one room. Type in either and watch it appear in the other instantly, over a real WebSocket.",
  },
  {
    scope: "vercel",
    nodeId: "app-router",
    title: "The web half",
    body: "Back on Vercel: Better Auth on Neon, the wake/sleep control for the box, and the same-origin proxy. Every route is a real handler.",
  },
  {
    scope: "root",
    nodeId: null,
    title: "That's the stack",
    body: "Top to bottom, every node was something real. Drag to orbit, click any node, and copy the curl under any panel to check it yourself.",
  },
];
