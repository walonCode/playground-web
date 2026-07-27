/**
 * The deployment, as a nested scope graph.
 *
 * The landing is no longer one flat mesh — it is a map you fly *into*. The top
 * scope shows two platforms, AWS and Vercel; clicking one descends a level, and
 * the deepest AWS level is the original 7-service mesh (reused verbatim from
 * `mesh.ts`, so there is one source of truth for the services).
 *
 * The site's whole thesis is that the pretty thing IS the real thing, so every
 * node maps to something that exists. Where a piece of infrastructure cannot yet
 * be verified from the repo, it is marked `planned` and rendered muted — shown,
 * but never dressed up as confirmed. Same honesty the CI deploy journey uses.
 */

import { MESH_EDGES, MESH_NODES, NODE_META, type NodeKind } from "./mesh";
import type { Theme } from "./theme";

/** Geometry primitive, decoupled from semantics so any scope can mix shapes. */
export type Shape = "diamond" | "box" | "cylinder" | "sphere";

/** What happens when a node is clicked. */
export type NodeAction =
  | { kind: "drill"; to: ScopeId } // descend into a child scope
  | { kind: "demo"; demo: string } // open an interactive panel (NodeOverlay)
  | { kind: "card"; card: string }; // open an infra info card (InfraCard)

export interface SceneNode {
  id: string;
  label: string;
  /** Unit coords, -1..1; renderers scale to their own space. */
  x: number;
  y: number;
  z: number;
  shape: Shape;
  /** Relative size; 1 is a normal service node. */
  size: number;
  /** Identity colour, per theme. */
  color: string;
  colorLight: string;
  icon: string;
  action: NodeAction;
  /**
   * Key into the live readings map (a service slug or infra name). When set, the
   * node shows a health lamp fed by the real status poll.
   */
  statusKey?: string;
  /** Shown, but honestly muted — real existence not yet verifiable from the repo. */
  planned?: boolean;
  /** One plain line about what this is. */
  blurb: string;
  /** The check a skeptic would run to confirm it — surfaced in the infra card. */
  verify?: { label: string; how: string };
}

export interface SceneEdge {
  id: string;
  from: string;
  to: string;
  transport: "https" | "http" | "kafka" | "tcp" | "proxy";
}

export type ScopeId = "root" | "aws" | "ec2" | "mesh" | "vercel";

export interface Scope {
  id: ScopeId;
  /** Breadcrumb label. */
  title: string;
  /** Parent to pop back to; root has none. */
  parent?: ScopeId;
  /** Drives per-platform framing and atmosphere. */
  look: "root" | "aws" | "vercel" | "ec2" | "mesh";
  nodes: SceneNode[];
  edges: SceneEdge[];
}

/** The identity colour for a scene node in the active theme. */
export function sceneColor(node: SceneNode, theme: Theme): string {
  return theme === "light" ? node.colorLight : node.color;
}

// --- palette (extends the locked system; platforms get their own identity) ----

const AWS = { color: "#ff9900", light: "#c2570c" }; // AWS orange
const VERCEL = { color: "#e8eaed", light: "#111418" }; // monochrome edge
const EDGE_INFRA = { color: "#8b5cf6", light: "#7c3aed" }; // dns/lb/cert = violet
const COMPUTE = { color: "#34d8e8", light: "#0e7490" }; // ec2 = cyan
const CONTAINER = { color: "#7dd3fc", light: "#0369a1" }; // docker = sky
const ROUTE = { color: "#10b981", light: "#059669" }; // vercel routes = emerald

// --- root: the two platforms and the viewer ----------------------------------

const ROOT: Scope = {
  id: "root",
  title: "internet",
  look: "root",
  nodes: [
    {
      id: "you",
      label: "you",
      x: 0,
      y: 0.05,
      z: 1.05,
      shape: "sphere",
      size: 0.8,
      color: "#e8eaed",
      colorLight: "#0c0e12",
      icon: "◎",
      action: { kind: "card", card: "you" },
      blurb: "Your browser — the only thing that talks to Vercel over HTTPS.",
    },
    {
      id: "vercel",
      label: "Vercel",
      x: -0.72,
      y: 0.15,
      z: -0.1,
      shape: "sphere",
      size: 1.6,
      color: VERCEL.color,
      colorLight: VERCEL.light,
      icon: "▲",
      action: { kind: "drill", to: "vercel" },
      statusKey: "vercel",
      blurb: "The web, on Next.js. Always on — it never sleeps.",
    },
    {
      id: "aws",
      label: "AWS",
      x: 0.75,
      y: -0.08,
      z: -0.3,
      shape: "sphere",
      size: 1.6,
      color: AWS.color,
      colorLight: AWS.light,
      icon: "◆",
      action: { kind: "drill", to: "aws" },
      statusKey: "aws",
      blurb: "The server, on one EC2 box that sleeps when idle.",
    },
  ],
  edges: [
    { id: "you→vercel", from: "you", to: "vercel", transport: "https" },
    { id: "vercel→aws", from: "vercel", to: "aws", transport: "proxy" },
  ],
};

// --- aws: the edge + hosting path --------------------------------------------

const AWS_SCOPE: Scope = {
  id: "aws",
  title: "AWS",
  parent: "root",
  look: "aws",
  nodes: [
    {
      id: "route53",
      label: "Route 53",
      x: -1.0,
      y: 0.5,
      z: 0.6,
      shape: "cylinder",
      size: 0.9,
      color: EDGE_INFRA.color,
      colorLight: EDGE_INFRA.light,
      icon: "❖",
      action: { kind: "card", card: "route53" },
      planned: true,
      blurb: "DNS — resolves the hostname to the load balancer.",
      verify: {
        label: "resolves",
        how: "dig the hostname; it returns the ALB",
      },
    },
    {
      id: "alb",
      label: "ALB",
      x: -0.35,
      y: 0.15,
      z: 0.15,
      shape: "cylinder",
      size: 1.1,
      color: EDGE_INFRA.color,
      colorLight: EDGE_INFRA.light,
      icon: "⇄",
      action: { kind: "card", card: "alb" },
      planned: true,
      blurb: "Application Load Balancer — terminates TLS, forwards to the box.",
      verify: {
        label: "https",
        how: "the hostname serves HTTPS, not the box directly",
      },
    },
    {
      id: "acm",
      label: "ACM cert",
      x: -0.4,
      y: 0.72,
      z: -0.1,
      shape: "diamond",
      size: 0.7,
      color: EDGE_INFRA.color,
      colorLight: EDGE_INFRA.light,
      icon: "⚿",
      action: { kind: "card", card: "acm" },
      planned: true,
      blurb: "The TLS certificate the ALB presents.",
      verify: {
        label: "issuer",
        how: "inspect the cert chain on the hostname",
      },
    },
    {
      id: "ec2",
      label: "EC2",
      x: 0.55,
      y: -0.15,
      z: -0.35,
      shape: "box",
      size: 1.4,
      color: COMPUTE.color,
      colorLight: COMPUTE.light,
      icon: "▦",
      action: { kind: "drill", to: "ec2" },
      statusKey: "gateway",
      blurb: "One instance running the whole backend. Click to look inside.",
      verify: {
        label: "reachable",
        how: "curl /api/health/deep returns ready",
      },
    },
  ],
  edges: [
    { id: "route53→alb", from: "route53", to: "alb", transport: "https" },
    { id: "acm→alb", from: "acm", to: "alb", transport: "tcp" },
    { id: "alb→ec2", from: "alb", to: "ec2", transport: "http" },
  ],
};

// --- ec2: what runs on the box -----------------------------------------------

const EC2_SCOPE: Scope = {
  id: "ec2",
  title: "EC2",
  parent: "aws",
  look: "ec2",
  nodes: [
    {
      id: "pm2",
      label: "PM2",
      x: -0.7,
      y: 0.35,
      z: 0.4,
      shape: "cylinder",
      size: 1.1,
      color: COMPUTE.color,
      colorLight: COMPUTE.light,
      icon: "⛭",
      action: { kind: "drill", to: "mesh" },
      planned: true,
      blurb: "Process manager keeping the Node apps alive. Click to see them.",
      verify: {
        label: "processes",
        how: "pm2 list on the box (not externally checkable)",
      },
    },
    {
      id: "gateway",
      label: "gateway",
      x: 0.0,
      y: -0.05,
      z: 0.1,
      shape: "diamond",
      size: 1.2,
      color: "#e8eaed",
      colorLight: "#334155",
      icon: "◈",
      action: { kind: "drill", to: "mesh" },
      statusKey: "gateway",
      blurb: "The one public door into the mesh. Click to enter the services.",
    },
    {
      id: "kafka",
      label: "kafka",
      x: 0.75,
      y: 0.5,
      z: -0.3,
      shape: "box",
      size: 0.85,
      color: CONTAINER.color,
      colorLight: CONTAINER.light,
      icon: "≋",
      action: { kind: "card", card: "kafka" },
      statusKey: "kafka",
      blurb: "Docker container: apache/kafka:3.9.1 — the broker.",
      verify: {
        label: "image",
        how: "apache/kafka:3.9.1 in docker-compose.yml",
      },
    },
    {
      id: "postgres",
      label: "postgres",
      x: 0.5,
      y: -0.6,
      z: -0.4,
      shape: "box",
      size: 0.85,
      color: CONTAINER.color,
      colorLight: CONTAINER.light,
      icon: "▤",
      action: { kind: "card", card: "postgres" },
      statusKey: "postgres",
      blurb: "Docker container: postgres:17-alpine — one database per service.",
      verify: {
        label: "image",
        how: "postgres:17-alpine in docker-compose.yml",
      },
    },
    {
      id: "redis",
      label: "redis",
      x: 0.95,
      y: -0.25,
      z: -0.5,
      shape: "box",
      size: 0.85,
      color: CONTAINER.color,
      colorLight: CONTAINER.light,
      icon: "▣",
      action: { kind: "card", card: "redis" },
      statusKey: "redis",
      blurb: "Docker container: redis:7-alpine — cache and the task queue.",
      verify: { label: "image", how: "redis:7-alpine in docker-compose.yml" },
    },
  ],
  edges: [
    { id: "pm2→gateway", from: "pm2", to: "gateway", transport: "tcp" },
    { id: "gateway→kafka", from: "gateway", to: "kafka", transport: "kafka" },
    {
      id: "gateway→postgres",
      from: "gateway",
      to: "postgres",
      transport: "tcp",
    },
    { id: "gateway→redis", from: "gateway", to: "redis", transport: "tcp" },
  ],
};

// --- mesh: the original 7-service mesh, reused verbatim -----------------------

/** Shape for a mesh node's kind — mirrors the original hero geometry. */
const MESH_SHAPE: Record<NodeKind, Shape> = {
  gateway: "diamond",
  service: "box",
  infra: "cylinder",
};

const MESH_SCOPE: Scope = {
  id: "mesh",
  title: "services",
  parent: "ec2",
  look: "mesh",
  nodes: MESH_NODES.map((n): SceneNode => {
    const meta = NODE_META[n.id];
    const demo = meta?.demo;
    const isInteractive =
      demo === "search-cache" ||
      demo === "task" ||
      demo === "payment" ||
      demo === "chat";
    return {
      id: n.id,
      label: n.label,
      x: n.x,
      y: n.y,
      z: n.z,
      shape: MESH_SHAPE[n.kind],
      size: n.kind === "gateway" ? 1.2 : n.kind === "infra" ? 0.9 : 1,
      color: meta?.color ?? "#9ba1a9",
      colorLight: meta?.colorLight ?? "#475569",
      icon: meta?.icon ?? "●",
      statusKey: n.id,
      blurb: meta?.blurb ?? "",
      action: isInteractive
        ? { kind: "demo", demo }
        : { kind: "card", card: n.id },
    };
  }),
  edges: MESH_EDGES.map(
    (e): SceneEdge => ({
      id: e.id,
      from: e.from,
      to: e.to,
      transport: e.transport,
    }),
  ),
};

// --- vercel: the Next.js App Router ------------------------------------------

const VERCEL_SCOPE: Scope = {
  id: "vercel",
  title: "Vercel",
  parent: "root",
  look: "vercel",
  nodes: [
    {
      id: "app-router",
      label: "App Router",
      x: 0,
      y: 0.1,
      z: 0.4,
      shape: "diamond",
      size: 1.3,
      color: VERCEL.color,
      colorLight: VERCEL.light,
      icon: "▲",
      action: { kind: "card", card: "app-router" },
      statusKey: "vercel",
      blurb: "Next.js 16 App Router — every route below is a real handler.",
    },
    {
      id: "better-auth",
      label: "Better Auth",
      x: -0.85,
      y: 0.5,
      z: -0.1,
      shape: "box",
      size: 1,
      color: ROUTE.color,
      colorLight: ROUTE.light,
      icon: "⚿",
      action: { kind: "card", card: "better-auth" },
      blurb: "/api/auth/* — email + JWT, backed by Neon Postgres.",
      verify: { label: "jwks", how: "GET /api/auth/jwks returns signing keys" },
    },
    {
      id: "wake",
      label: "wake",
      x: -0.55,
      y: -0.5,
      z: 0.05,
      shape: "box",
      size: 0.9,
      color: ROUTE.color,
      colorLight: ROUTE.light,
      icon: "⏻",
      action: { kind: "card", card: "wake" },
      blurb: "/api/wake — the only thing that can start the EC2 box.",
    },
    {
      id: "sleep-cron",
      label: "sleep cron",
      x: 0.15,
      y: -0.62,
      z: -0.1,
      shape: "box",
      size: 0.9,
      color: ROUTE.color,
      colorLight: ROUTE.light,
      icon: "◷",
      action: { kind: "card", card: "sleep-cron" },
      blurb:
        "/api/cron/sleep — Vercel's scheduler calls this to stop an idle box.",
      verify: { label: "declared", how: "the cron is declared in vercel.json" },
    },
    {
      id: "proxy",
      label: "API proxy",
      x: 0.85,
      y: 0.35,
      z: -0.2,
      shape: "box",
      size: 1,
      color: ROUTE.color,
      colorLight: ROUTE.light,
      icon: "⇉",
      action: { kind: "card", card: "proxy" },
      blurb: "/api/* forwarded server-side to the box — same origin, no CORS.",
    },
  ],
  edges: [
    {
      id: "app-router→better-auth",
      from: "app-router",
      to: "better-auth",
      transport: "https",
    },
    {
      id: "app-router→wake",
      from: "app-router",
      to: "wake",
      transport: "https",
    },
    {
      id: "app-router→sleep-cron",
      from: "app-router",
      to: "sleep-cron",
      transport: "https",
    },
    {
      id: "app-router→proxy",
      from: "app-router",
      to: "proxy",
      transport: "proxy",
    },
  ],
};

export const SCOPES: Record<ScopeId, Scope> = {
  root: ROOT,
  aws: AWS_SCOPE,
  ec2: EC2_SCOPE,
  mesh: MESH_SCOPE,
  vercel: VERCEL_SCOPE,
};

/** Breadcrumb trail from root down to the given scope. */
export function scopeTrail(id: ScopeId): Scope[] {
  const trail: Scope[] = [];
  let cur: ScopeId | undefined = id;
  while (cur) {
    const s: Scope = SCOPES[cur];
    trail.unshift(s);
    cur = s.parent;
  }
  return trail;
}
