"use client";

import type { Tier } from "@/lib/capability";
import { MESH_EDGES, MESH_NODES, NODE_BY_ID, nodeColor } from "@/lib/mesh";
import { useThemeValue } from "@/lib/theme";
import { PULSE_MS, useTraffic } from "./TrafficContext";

export type NodeStatus = "up" | "down" | "unknown";

/** The status lamp, matching the 3D scene and the panels. */
const STATUS_FILL: Record<NodeStatus, string> = {
  up: "var(--color-nominal)",
  down: "var(--color-down)",
  unknown: "var(--color-text-low)",
};

const VIEW_W = 1000;
const VIEW_H = 560;

/** Unit coords to viewBox. z shrinks and dims a node so depth still reads flat. */
function project(x: number, y: number, z: number) {
  const scale = 0.78 + z * 0.12;
  return {
    px: VIEW_W / 2 + x * 330 * scale,
    py: VIEW_H / 2 - y * 175 * scale,
    scale,
  };
}

/**
 * The flat mesh. Serves the `reduced` and `static` tiers, and is what every
 * phone gets.
 *
 * It carries exactly the same nodes, edges, colours and live statuses as the 3D
 * scene — only the dimension is missing. A fallback that dropped the information
 * would punish the visitor for their device.
 */
export function MeshSvg({
  statuses,
  tier,
}: {
  statuses: Record<string, NodeStatus>;
  tier: Tier;
}) {
  const { pulses } = useTraffic();
  const theme = useThemeValue();
  const animate = tier !== "static";
  const litEdges = new Set(pulses.map((p) => p.edgeId));

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-full w-full"
      role="img"
      aria-label="Live service mesh. Each node is a running service, coloured by its current health."
    >
      <title>Live service mesh</title>

      {MESH_EDGES.map((edge) => {
        const from = NODE_BY_ID.get(edge.from);
        const to = NODE_BY_ID.get(edge.to);
        if (!from || !to) return null;

        const a = project(from.x, from.y, from.z);
        const b = project(to.x, to.y, to.z);
        const lit = litEdges.has(edge.id);

        return (
          <line
            key={edge.id}
            x1={a.px}
            y1={a.py}
            x2={b.px}
            y2={b.py}
            stroke={lit ? "var(--color-action)" : "var(--color-mesh-edge)"}
            strokeWidth={lit ? 1.8 : 1}
            opacity={lit ? 1 : 0.9}
            style={
              animate
                ? { transition: `stroke ${PULSE_MS / 3}ms, opacity 200ms` }
                : undefined
            }
          />
        );
      })}

      {MESH_NODES.map((node) => {
        const { px, py, scale } = project(node.x, node.y, node.z);
        const status = statuses[node.id] ?? "unknown";
        // Body colour is the service's identity; the lamp below carries health.
        const stroke = nodeColor(node.id, theme);
        const size = (node.kind === "gateway" ? 13 : 9) * scale;
        const sw = node.kind === "gateway" ? 2 : 1.4;
        const shapeStyle = animate ? { transition: "stroke 300ms" } : undefined;

        return (
          <g key={node.id}>
            {/* Shape encodes kind, mirroring the 3D scene: gateway a diamond,
                infra a circle, a service a square. Colour stays for status. */}
            {node.kind === "gateway" ? (
              <rect
                x={px - size / 2}
                y={py - size / 2}
                width={size}
                height={size}
                transform={`rotate(45 ${px} ${py})`}
                fill="var(--color-void)"
                stroke={stroke}
                strokeWidth={sw}
                style={shapeStyle}
              />
            ) : node.kind === "infra" ? (
              <circle
                cx={px}
                cy={py}
                r={size / 2}
                fill="var(--color-void)"
                stroke={stroke}
                strokeWidth={sw}
                style={shapeStyle}
              />
            ) : (
              <rect
                x={px - size / 2}
                y={py - size / 2}
                width={size}
                height={size}
                fill="var(--color-void)"
                stroke={stroke}
                strokeWidth={sw}
                style={shapeStyle}
              />
            )}
            {/* Status lamp, left of the label — the health channel. */}
            <rect
              x={px - size / 2 - 7}
              y={py + size / 2 + 8}
              width={4}
              height={4}
              fill={STATUS_FILL[status]}
              style={shapeStyle}
            />
            <text
              x={px}
              y={py + size / 2 + 14}
              textAnchor="middle"
              className="font-mono"
              fontSize={10 * scale}
              letterSpacing="0.12em"
              fill="var(--color-text-mid)"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
