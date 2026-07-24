"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  MESH_EDGES,
  MESH_NODES,
  NODE_BY_ID,
  NODE_META,
  type NodeKind,
  nodeColor,
} from "@/lib/mesh";
import { type Theme, useThemeValue } from "@/lib/theme";
import type { NodeStatus } from "./MeshSvg";
import { useTraffic } from "./TrafficContext";

/**
 * Theme-dependent scene values. Node colours no longer live here — those are
 * per-service identity hues from NODE_META. What remains is the atmosphere: the
 * edges, the fog that gives the scene depth, and the lighting.
 */
const SCENE = {
  dark: {
    idleEdge: "#252c34",
    fog: "#08090b",
    fogNear: 7,
    fogFar: 17,
    ambient: 0.75,
    key: 26,
    bloom: 0.9,
    // Emissive scale. Dark leans on the glow + bloom; light must not, or the
    // nodes blow out to near-white and vanish against the pale background.
    nodeEmissive: 1,
  },
  light: {
    idleEdge: "#94a0b0",
    fog: "#f6f7f9",
    fogNear: 8,
    fogFar: 19,
    ambient: 0.85,
    key: 10,
    bloom: 0.35,
    nodeEmissive: 0.32,
  },
} as const;

const STATUS_HEX: Record<NodeStatus, string> = {
  up: "#34d8e8",
  down: "#ff4d4d",
  unknown: "#79808a",
};

const SPREAD = { x: 3.4, y: 1.9, z: 1.5 };
const ORIGIN = new THREE.Vector3(0, 0, 0);

function position(x: number, y: number, z: number): [number, number, number] {
  return [x * SPREAD.x, y * SPREAD.y, z * SPREAD.z];
}

export interface Reading {
  status: NodeStatus;
  latency: number | null;
}

interface SceneProps {
  readings: Record<string, Reading>;
  selectedId: string | null;
  hoveredId: string | null;
  spotlightId?: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/**
 * One node. Three channels, none overlapping: SHAPE is kind, the body COLOUR is
 * which service this is, and the lamp on its label is health.
 *
 * Emissive is deliberately pushed past 1 with toneMapped off — that is what the
 * bloom pass keys on, so a node glows without a per-object bloom pass.
 */
function Node({
  node,
  reading,
  selected,
  hovered,
  dimmed,
  index,
  theme,
  onSelect,
  onHover,
}: {
  node: (typeof MESH_NODES)[number];
  reading: Reading | undefined;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  index: number;
  theme: Theme;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const appeared = useRef(0);

  const status = reading?.status ?? "unknown";
  const hex = nodeColor(node.id, theme);
  const identity = useMemo(() => new THREE.Color(hex), [hex]);

  const base =
    node.kind === "gateway" ? 0.2 : node.kind === "infra" ? 0.14 : 0.13;
  const delay = 0.15 + index * 0.055;

  useFrame((state, dt) => {
    const g = group.current;
    const m = mat.current;
    if (!g || !m) return;
    const t = state.clock.elapsedTime;

    if (appeared.current < 1 && t > delay) {
      appeared.current = Math.min(1, appeared.current + dt * 2.2);
    }
    const intro = appeared.current < 1 ? easeOut(appeared.current) : 1;

    // Healthy nodes breathe; a down node sits still, which reads as wrong.
    const breathe = status === "up" ? 1 + Math.sin(t * 1.3 + index) * 0.035 : 1;
    const focus = selected ? 1.45 : hovered ? 1.25 : 1;
    g.scale.setScalar(intro * breathe * focus);
    g.rotation.y += dt * (node.kind === "gateway" ? 0.25 : 0.08);

    // Above 1 so the bloom pass picks it up (dark). Dimmed nodes drop below the
    // threshold entirely and stop glowing, which is what makes a spotlight read.
    // In light mode the whole thing is scaled down so nodes stay their solid,
    // darker identity colour rather than washing out to white.
    const rest = status === "down" ? 0.7 : status === "unknown" ? 0.4 : 1.35;
    const pulse = status === "up" ? Math.sin(t * 1.3 + index) * 0.18 : 0;
    const target =
      (selected || hovered ? 2.4 : rest + pulse) *
      (dimmed ? 0.22 : 1) *
      SCENE[theme].nodeEmissive;
    m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 8);
    m.opacity += ((dimmed ? 0.45 : 1) - m.opacity) * Math.min(1, dt * 8);
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: three.js scene object, not DOM; the flat fallback carries the accessible <button> controls.
    <group
      ref={group}
      position={position(node.x, node.y, node.z)}
      scale={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(node.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      <mesh castShadow={false}>
        <NodeGeometry kind={node.kind} size={base} />
        <meshStandardMaterial
          ref={mat}
          color={identity}
          emissive={identity}
          emissiveIntensity={0}
          roughness={0.35}
          metalness={0.1}
          transparent
          opacity={1}
          toneMapped={false}
        />
      </mesh>

      <NodeLabel
        id={node.id}
        label={node.label}
        status={status}
        latency={reading?.latency ?? null}
        hidden={dimmed}
        emphasised={selected || hovered}
        theme={theme}
      />
    </group>
  );
}

/**
 * A persistent label with the status lamp.
 *
 * Research on 3D graphs is blunt that overlapping labels are the main thing
 * that ruins them, so these stay small, sit below the node, and fade out when
 * the node is dimmed by a spotlight. The lamp is the health channel now that
 * the body colour names the service.
 */
function NodeLabel({
  id,
  label,
  status,
  latency,
  hidden,
  emphasised,
  theme,
}: {
  id: string;
  label: string;
  status: NodeStatus;
  latency: number | null;
  hidden: boolean;
  emphasised: boolean;
  theme: Theme;
}) {
  const meta = NODE_META[id];
  return (
    <Html
      position={[0, -0.3, 0]}
      center
      distanceFactor={9}
      zIndexRange={[10, 0]}
      style={{
        opacity: hidden ? 0 : 1,
        transition: "opacity 300ms",
        pointerEvents: "none",
      }}
    >
      <div className="flex items-center gap-1.5 border border-line bg-void/85 px-1.5 py-0.5 font-mono text-[9px] whitespace-nowrap backdrop-blur-sm">
        <span style={{ color: nodeColor(id, theme) }}>{meta?.icon}</span>
        <span
          className="size-1.5 shrink-0"
          style={{ background: STATUS_HEX[status] }}
          aria-hidden="true"
        />
        <span className="tracking-[0.1em] text-text-hi uppercase">{label}</span>
        {emphasised && latency != null && (
          <span className="tabular text-text-low">{latency}ms</span>
        )}
      </div>
    </Html>
  );
}

function NodeGeometry({ kind, size }: { kind: NodeKind; size: number }) {
  if (kind === "gateway") return <octahedronGeometry args={[size * 1.15]} />;
  if (kind === "infra")
    return (
      <cylinderGeometry args={[size * 0.85, size * 0.85, size * 1.5, 24]} />
    );
  return <boxGeometry args={[size, size, size]} />;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function Nodes({
  readings,
  selectedId,
  hoveredId,
  spotlightId,
  theme,
  onSelect,
  onHover,
}: SceneProps & { theme: Theme }) {
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <>
      {MESH_NODES.map((node, index) => (
        <Node
          key={node.id}
          node={node}
          index={index}
          reading={readings[node.id]}
          selected={node.id === selectedId}
          hovered={node.id === hoveredId}
          dimmed={Boolean(spotlightId) && node.id !== spotlightId}
          theme={theme}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
    </>
  );
}

/** Every edge in one lineSegments — one draw call, and it dodges R3F's <line>. */
function Edges({ theme }: { theme: "dark" | "light" }) {
  const { pulses } = useTraffic();
  const lit = useMemo(() => new Set(pulses.map((p) => p.edgeId)), [pulses]);
  const colorAttr = useRef<THREE.BufferAttribute>(null);

  const idle = useMemo(() => new THREE.Color(SCENE[theme].idleEdge), [theme]);
  // The action fuchsia, per theme — the deep magenta reads on light, the bright
  // one glows on dark.
  const action = useMemo(
    () => new THREE.Color(theme === "light" ? "#a81a7a" : "#f42bb0"),
    [theme],
  );

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

  useEffect(() => {
    const attr = colorAttr.current;
    if (!attr) return;
    order.forEach((id, index) => {
      const c = lit.has(id) ? action : idle;
      attr.setXYZ(index * 2, c.r, c.g, c.b);
      attr.setXYZ(index * 2 + 1, c.r, c.g, c.b);
    });
    attr.needsUpdate = true;
  }, [lit, order, idle, action]);

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
        opacity={0.9}
        toneMapped={false}
      />
    </lineSegments>
  );
}

type Controls = React.ComponentRef<typeof OrbitControls>;

function CameraRig({
  controls,
  focusId,
}: {
  controls: React.RefObject<Controls | null>;
  focusId: string | null;
}) {
  const focus = useRef<{ until: number; pos: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!focusId) {
      focus.current = null;
      return;
    }
    const node = NODE_BY_ID.get(focusId);
    if (node) {
      focus.current = {
        until: performance.now() + 1400,
        pos: new THREE.Vector3(...position(node.x, node.y, node.z)),
      };
    }
  }, [focusId]);

  useFrame(({ camera }) => {
    const c = controls.current;
    if (!c) return;
    const f = focus.current;
    c.target.lerp(f ? f.pos : ORIGIN, 0.08);
    if (f && performance.now() < f.until) {
      const desired = f.pos.clone().add(new THREE.Vector3(0.9, 0.5, 2.1));
      camera.position.lerp(desired, 0.06);
    }
    c.update();
  });

  return null;
}

/** Fog is the cheapest honest depth cue on a flat screen — near nodes read closer. */
function Atmosphere({ theme }: { theme: "dark" | "light" }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const s = SCENE[theme];
    scene.fog = new THREE.Fog(s.fog, s.fogNear, s.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [scene, theme]);
  return null;
}

export default function Mesh3d({
  active,
  ...props
}: SceneProps & { active: boolean }) {
  const controls = useRef<Controls>(null);
  const theme = useThemeValue();
  const scene = SCENE[theme];
  const focusId = props.spotlightId ?? props.selectedId;

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.7, 6.6], fov: 42 }}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onSelect("")}
    >
      <Atmosphere theme={theme} />
      <ambientLight intensity={scene.ambient} />
      <pointLight position={[4, 5, 6]} intensity={scene.key} distance={26} />
      <pointLight
        position={[-5, -2, -4]}
        intensity={scene.key * 0.4}
        distance={22}
      />

      <Edges theme={theme} />
      <Nodes {...props} theme={theme} />

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        minDistance={3.5}
        maxDistance={11}
      />
      <CameraRig controls={controls} focusId={focusId} />

      {/*
        Selective bloom, dark theme only. The pass keys on materials whose
        emissive exceeds 1, so only the glowing nodes bloom and the labels and
        edges stay crisp. On a near-white light background the same pass washes
        the whole frame out — so light mode renders the scene directly, and the
        nodes read as solid saturated shapes instead of glows.
      */}
      {theme === "dark" && (
        <EffectComposer enableNormalPass={false}>
          <Bloom
            intensity={scene.bloom}
            luminanceThreshold={1}
            luminanceSmoothing={0.15}
            mipmapBlur
          />
        </EffectComposer>
      )}
    </Canvas>
  );
}
