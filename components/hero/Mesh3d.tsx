"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MESH_EDGES, MESH_NODES, NODE_BY_ID } from "@/lib/mesh";
import type { NodeStatus } from "./MeshSvg";
import { useTraffic } from "./TrafficContext";

/** Resolved once here rather than read from CSS every frame. */
const COLOR = {
  up: new THREE.Color("#34d8e8"),
  down: new THREE.Color("#ff4d4d"),
  unknown: new THREE.Color("#79808a"),
  idleEdge: new THREE.Color("#1e2227"),
  action: new THREE.Color("#f42bb0"),
};

const SPREAD = { x: 3.4, y: 1.9, z: 1.5 };

function position(x: number, y: number, z: number): [number, number, number] {
  return [x * SPREAD.x, y * SPREAD.y, z * SPREAD.z];
}

function Nodes({ statuses }: { statuses: Record<string, NodeStatus> }) {
  return (
    <>
      {MESH_NODES.map((node) => {
        const status = statuses[node.id] ?? "unknown";
        const color = COLOR[status];
        const size = node.kind === "gateway" ? 0.17 : 0.11;

        return (
          <mesh key={node.id} position={position(node.x, node.y, node.z)}>
            {/* Boxes, not spheres — the flat UI uses square lamps and the hero
                should speak the same language. */}
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={status === "unknown" ? 0.25 : 1.1}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * Every edge in one `lineSegments`.
 *
 * Drawn as a single buffer with per-vertex colours rather than one object per
 * edge: it is one draw call instead of twenty-four, and it sidesteps R3F's
 * `<line>` element, which TypeScript resolves to the SVG intrinsic of the same
 * name.
 */
function Edges() {
  const { pulses } = useTraffic();
  const lit = useMemo(() => new Set(pulses.map((p) => p.edgeId)), [pulses]);
  const colorAttr = useRef<THREE.BufferAttribute>(null);

  const { positions, colors, order } = useMemo(() => {
    const pos: number[] = [];
    const ids: string[] = [];

    for (const edge of MESH_EDGES) {
      const from = NODE_BY_ID.get(edge.from);
      const to = NODE_BY_ID.get(edge.to);
      if (!from || !to) continue;
      pos.push(...position(from.x, from.y, from.z));
      pos.push(...position(to.x, to.y, to.z));
      ids.push(edge.id);
    }

    return {
      positions: new Float32Array(pos),
      colors: new Float32Array(ids.length * 6),
      order: ids,
    };
  }, []);

  // Repaint only the vertices whose edge changed state; geometry never moves.
  useEffect(() => {
    const attr = colorAttr.current;
    if (!attr) return;

    order.forEach((id, index) => {
      const c = lit.has(id) ? COLOR.action : COLOR.idleEdge;
      attr.setXYZ(index * 2, c.r, c.g, c.b);
      attr.setXYZ(index * 2 + 1, c.r, c.g, c.b);
    });
    attr.needsUpdate = true;
  }, [lit, order]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute
          ref={colorAttr}
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.8}
        toneMapped={false}
      />
    </lineSegments>
  );
}

/**
 * A slow drift, not a spin.
 *
 * The mesh is a diagram first: it has to stay readable, and labels that swing
 * past are worse than no motion. This is barely perceptible and stops entirely
 * when the hero scrolls away.
 */
function Drift({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t * 0.12) * 0.22;
    group.current.rotation.x = Math.sin(t * 0.09) * 0.06;
  });

  return <group ref={group}>{children}</group>;
}

export default function Mesh3d({
  statuses,
  active,
}: {
  statuses: Record<string, NodeStatus>;
  active: boolean;
}) {
  return (
    <Canvas
      // Capped rather than uncapped: a 3x retina display would otherwise render
      // nine times the pixels for a diagram that gains nothing from them.
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.35, 5.2], fov: 42 }}
      // Only draws when told to, so a scrolled-away or backgrounded hero costs
      // nothing at all.
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      {/* No postprocessing anywhere: bloom and DoF are the first things to cost
          frames on mid-range hardware, and this scene reads fine without them. */}
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 4, 6]} intensity={22} distance={24} />
      <Drift>
        <Edges />
        <Nodes statuses={statuses} />
      </Drift>
    </Canvas>
  );
}
