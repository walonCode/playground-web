/**
 * The service mesh, as data.
 *
 * Every node and edge here corresponds to something in the backend. The hero is
 * the site's thesis — that the pretty thing IS the real thing — so a decorative
 * link that does not exist in the code would undo the whole argument.
 *
 * Layout is hand-placed rather than force-directed: a simulation would settle
 * differently on every load, and a diagram that moves when nothing changed
 * teaches the visitor that the motion is meaningless.
 */

export type NodeKind = "gateway" | "service" | "infra";

export interface MeshNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** Unit coordinates, -1..1. The renderers scale these to their own space. */
  x: number;
  y: number;
  z: number;
}

export interface MeshEdge {
  id: string;
  from: string;
  to: string;
  /** How this hop actually travels, shown on hover and in the legend. */
  transport: "kafka" | "tcp" | "http";
}

/**
 * Gateway at the front, the seven services in an arc behind it, infrastructure
 * at the back. Depth encodes the actual request direction: traffic enters at
 * the gateway and moves away from the viewer.
 */
export const MESH_NODES: MeshNode[] = [
  { id: "gateway", label: "gateway", kind: "gateway", x: 0, y: 0.05, z: 1 },

  { id: "auth", label: "auth", kind: "service", x: -0.95, y: 0.55, z: 0 },
  { id: "task", label: "task", kind: "service", x: -0.6, y: -0.5, z: 0.15 },
  { id: "chat", label: "chat", kind: "service", x: -0.15, y: 0.62, z: -0.1 },
  { id: "payment", label: "payment", kind: "service", x: 0.3, y: -0.6, z: 0.1 },
  { id: "search", label: "search", kind: "service", x: 0.72, y: 0.42, z: 0.05 },
  { id: "cache", label: "cache", kind: "service", x: 1.0, y: -0.18, z: -0.15 },
  {
    id: "lifecycle",
    label: "lifecycle",
    kind: "service",
    x: -1.05,
    y: 0.02,
    z: -0.3,
  },

  { id: "kafka", label: "kafka", kind: "infra", x: 0, y: 0.0, z: -1.05 },
  {
    id: "postgres",
    label: "postgres",
    kind: "infra",
    x: -0.5,
    y: -0.75,
    z: -0.9,
  },
  { id: "redis", label: "redis", kind: "infra", x: 0.55, y: -0.72, z: -0.95 },
];

const SERVICE_IDS = [
  "auth",
  "task",
  "chat",
  "payment",
  "search",
  "cache",
  "lifecycle",
] as const;

/** Services that own a Postgres database — one database each, never shared. */
const HAS_POSTGRES = ["auth", "task", "chat", "payment", "search"];

/** cache is Redis-backed; task's BullMQ queue lives in the same Redis. */
const HAS_REDIS = ["cache", "task"];

export const MESH_EDGES: MeshEdge[] = [
  // The gateway reaches every service by Kafka request/reply — it holds one
  // client per service, each with its own consumer group.
  ...SERVICE_IDS.map(
    (id): MeshEdge => ({
      id: `gateway→${id}`,
      from: "gateway",
      to: id,
      transport: "kafka",
    }),
  ),

  // The one genuine service-to-service call in the system: SearchService injects
  // the cache client and does cache-aside around its Postgres query.
  // apps/search/src/search.service.ts:41
  { id: "search→cache", from: "search", to: "cache", transport: "kafka" },

  ...HAS_POSTGRES.map(
    (id): MeshEdge => ({
      id: `${id}→postgres`,
      from: id,
      to: "postgres",
      transport: "tcp",
    }),
  ),
  ...HAS_REDIS.map(
    (id): MeshEdge => ({
      id: `${id}→redis`,
      from: id,
      to: "redis",
      transport: "tcp",
    }),
  ),

  // Every service holds a broker connection; drawn from the broker outward so
  // the picture stays legible instead of becoming a starburst from each node.
  ...SERVICE_IDS.map(
    (id): MeshEdge => ({
      id: `kafka→${id}`,
      from: "kafka",
      to: id,
      transport: "kafka",
    }),
  ),

  {
    id: "lifecycle→postgres",
    from: "lifecycle",
    to: "postgres",
    transport: "tcp",
  },
  { id: "lifecycle→redis", from: "lifecycle", to: "redis", transport: "tcp" },
  { id: "lifecycle→kafka", from: "lifecycle", to: "kafka", transport: "tcp" },
];

export const NODE_BY_ID = new Map(MESH_NODES.map((n) => [n.id, n]));

/**
 * What clicking a node opens, and one honest line about it.
 *
 * `demo` picks the overlay: `search-cache` is the full interactive demo; `status`
 * nodes show a live ping card (real data, fuller demo later); `infra` nodes show
 * their dependency health. Nothing here promises a control that does not exist.
 */
export type NodeDemo =
  | "search-cache"
  | "task"
  | "payment"
  | "chat"
  | "status"
  | "infra";

export interface NodeMeta {
  demo: NodeDemo;
  blurb: string;
  /**
   * The service's own identity colour — what it IS, not how it's doing.
   *
   * Health moved to a lamp beside the label so this channel could be freed up:
   * a mesh where every node is the same cyan tells you nothing about which node
   * you are looking at. Now colour names the service and the lamp reports it.
   */
  color: string;
  /**
   * The same identity, darkened for the light theme. The dark hues (pale blues,
   * near-white gateway) are chosen to glow on a black scene and simply vanish on
   * a near-white one, so light mode gets its own visible variant of each.
   */
  colorLight: string;
  /** A glyph so a node is identifiable without reading the label. */
  icon: string;
}

/** The identity colour for a node in the active theme. */
export function nodeColor(id: string, theme: "dark" | "light"): string {
  const meta = NODE_META[id];
  if (!meta) return theme === "light" ? "#475569" : "#9ba1a9";
  return theme === "light" ? meta.colorLight : meta.color;
}

export const NODE_META: Record<string, NodeMeta> = {
  gateway: {
    demo: "status",
    color: "#e8eaed",
    colorLight: "#334155",
    icon: "◈",
    blurb:
      "The single public door. Every request enters here and fans out over Kafka.",
  },
  search: {
    demo: "search-cache",
    color: "#06b6d4",
    colorLight: "#0891b2",
    icon: "⌕",
    blurb:
      "Full-text search over 60k documents, cached in Redis. Try the cache demo.",
  },
  cache: {
    demo: "search-cache",
    color: "#fb923c",
    colorLight: "#ea580c",
    icon: "⚡",
    blurb:
      "The Redis cache search reads through. Evict it and watch search slow down.",
  },
  task: {
    demo: "task",
    color: "#f59e0b",
    colorLight: "#d97706",
    icon: "⚙",
    blurb:
      "Your todo list, where each item is a real queue job — run one and watch it retry or dead-letter.",
  },
  payment: {
    demo: "payment",
    color: "#f43f5e",
    colorLight: "#e11d48",
    icon: "◉",
    blurb:
      "A simulated payment saga with compensating steps. No real money moves.",
  },
  chat: {
    demo: "chat",
    color: "#10b981",
    colorLight: "#059669",
    icon: "◈",
    blurb:
      "Real-time rooms over WebSockets. Two live clients, one room — message one from the other.",
  },
  auth: {
    demo: "status",
    color: "#8b5cf6",
    colorLight: "#7c3aed",
    icon: "⚿",
    blurb: "Better Auth — email/password and JWT, verified at the gateway.",
  },
  lifecycle: {
    demo: "status",
    color: "#6366f1",
    colorLight: "#4f46e5",
    icon: "◐",
    blurb: "The health service that reports whether this box is usable.",
  },
  kafka: {
    demo: "infra",
    color: "#94a3b8",
    colorLight: "#475569",
    icon: "≋",
    blurb: "The broker every service talks through.",
  },
  postgres: {
    demo: "infra",
    color: "#7dd3fc",
    colorLight: "#0369a1",
    icon: "▤",
    blurb: "One database per service, never shared.",
  },
  redis: {
    demo: "infra",
    color: "#fca5a5",
    colorLight: "#dc2626",
    icon: "▣",
    blurb: "Backs the cache and the task queue.",
  },
};

/**
 * The edges a given visitor action actually traverses.
 *
 * Running a search enters the gateway, reaches search over Kafka, and search
 * then asks cache — three real hops. Evicting only touches cache. Nothing else
 * lights up, because nothing else happened.
 */
export const TRAFFIC_PATHS = {
  search: ["gateway→search", "search→cache"],
  evict: ["gateway→cache"],
} as const;
