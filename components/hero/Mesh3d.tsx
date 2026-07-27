"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { type Theme, useThemeValue } from "@/lib/theme";
import {
  type SceneNode,
  type Scope,
  type Shape,
  sceneColor,
} from "@/lib/topology";
import type { NodeStatus } from "./MeshSvg";
import { useTraffic } from "./TrafficContext";

/**
 * Theme-dependent atmosphere. Node colours are per-node identity hues from the
 * topology; what lives here is the edges, the fog that gives depth, the lighting,
 * and the emissive scale that keeps light mode from washing the nodes out.
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

/**
 * Per-scope atmosphere, so each level feels like its own place rather than the
 * same room re-lit. The tint is deliberately subtle — a temperature shift in the
 * fog and idle edges — so it reads as "a different world" without leaving the
 * palette. AWS runs warm, Vercel cool-monochrome, the box a colder cyan.
 */
const LOOK = {
  root: { edge: ["#2a3038", "#94a0b0"], fog: ["#08090b", "#f6f7f9"] },
  aws: { edge: ["#3b3227", "#b09a84"], fog: ["#0b0906", "#f8f6f1"] },
  vercel: { edge: ["#262b33", "#9aa4b2"], fog: ["#08090c", "#f5f6f9"] },
  ec2: { edge: ["#20323a", "#88a1ac"], fog: ["#070a0b", "#f2f7f8"] },
  mesh: { edge: ["#252c34", "#94a0b0"], fog: ["#08090b", "#f6f7f9"] },
} as const;

type Look = keyof typeof LOOK;
const themeIndex = (theme: "dark" | "light") => (theme === "light" ? 1 : 0);

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
  scope: Scope;
  readings: Record<string, Reading>;
  selectedId: string | null;
  hoveredId: string | null;
  spotlightId?: string | null;
  onActivate: (node: SceneNode) => void;
  onHover: (id: string | null) => void;
  onBackground: () => void;
}

/**
 * One node. Three channels, none overlapping: SHAPE is what kind of thing it is,
 * the body COLOUR is which thing it is, and the lamp on its label is health.
 *
 * Emissive is pushed past 1 with toneMapped off so the dark-mode bloom pass keys
 * on it; light mode scales it down so nodes stay solid rather than blowing out.
 */
function Node({
  node,
  reading,
  selected,
  hovered,
  dimmed,
  index,
  theme,
  onActivate,
  onHover,
}: {
  node: SceneNode;
  reading: Reading | undefined;
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  index: number;
  theme: Theme;
  onActivate: (node: SceneNode) => void;
  onHover: (id: string | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const appeared = useRef(0);

  const status = reading?.status ?? "unknown";
  const hex = sceneColor(node, theme);
  const identity = useMemo(() => new THREE.Color(hex), [hex]);

  const base = 0.14 * node.size;
  const delay = 0.12 + index * 0.05;
  const spin =
    node.shape === "diamond" ? 0.25 : node.shape === "sphere" ? 0.12 : 0.08;
  const muted = node.planned ? 0.5 : 1;

  useFrame((state, dt) => {
    const g = group.current;
    const m = mat.current;
    if (!g || !m) return;
    const t = state.clock.elapsedTime;

    if (appeared.current < 1 && t > delay) {
      appeared.current = Math.min(1, appeared.current + dt * 2.2);
    }
    const intro = appeared.current < 1 ? easeOut(appeared.current) : 1;

    // Healthy nodes breathe; anything else sits still, which reads as wrong.
    const breathe = status === "up" ? 1 + Math.sin(t * 1.3 + index) * 0.035 : 1;
    const focus = selected ? 1.45 : hovered ? 1.25 : 1;
    g.scale.setScalar(intro * breathe * focus);
    g.rotation.y += dt * spin;

    const rest = status === "down" ? 0.7 : status === "unknown" ? 0.4 : 1.35;
    const pulse = status === "up" ? Math.sin(t * 1.3 + index) * 0.18 : 0;
    const target =
      (selected || hovered ? 2.4 : rest + pulse) *
      (dimmed ? 0.22 : 1) *
      muted *
      SCENE[theme].nodeEmissive;
    m.emissiveIntensity += (target - m.emissiveIntensity) * Math.min(1, dt * 8);
    const opacityTarget = dimmed ? 0.45 : node.planned ? 0.72 : 1;
    m.opacity += (opacityTarget - m.opacity) * Math.min(1, dt * 8);
  });

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: three.js scene object, not DOM; the flat fallback carries the accessible <button> controls.
    <group
      ref={group}
      position={position(node.x, node.y, node.z)}
      scale={0}
      onClick={(e) => {
        e.stopPropagation();
        onActivate(node);
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
        <NodeGeometry shape={node.shape} size={base} />
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
        node={node}
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
 * A persistent label with the status lamp. Kept small and below the node so
 * labels do not overlap. The lamp only shows for nodes that have a real health
 * reading; a route or a cert makes no health claim.
 */
function NodeLabel({
  node,
  status,
  latency,
  hidden,
  emphasised,
  theme,
}: {
  node: SceneNode;
  status: NodeStatus;
  latency: number | null;
  hidden: boolean;
  emphasised: boolean;
  theme: Theme;
}) {
  return (
    <Html
      position={[0, -0.32 * node.size, 0]}
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
        <span style={{ color: sceneColor(node, theme) }}>{node.icon}</span>
        {node.statusKey && (
          <span
            className="size-1.5 shrink-0"
            style={{ background: STATUS_HEX[status] }}
            aria-hidden="true"
          />
        )}
        <span className="tracking-[0.1em] text-text-hi uppercase">
          {node.label}
        </span>
        {node.planned && (
          <span className="text-text-low tracking-[0.08em] lowercase">
            planned
          </span>
        )}
        {emphasised && latency != null && (
          <span className="tabular text-text-low">{latency}ms</span>
        )}
      </div>
    </Html>
  );
}

function NodeGeometry({ shape, size }: { shape: Shape; size: number }) {
  if (shape === "diamond") return <octahedronGeometry args={[size * 1.15]} />;
  if (shape === "sphere") return <sphereGeometry args={[size, 32, 32]} />;
  if (shape === "cylinder")
    return (
      <cylinderGeometry args={[size * 0.85, size * 0.85, size * 1.5, 24]} />
    );
  return <boxGeometry args={[size, size, size]} />;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function Nodes({
  scope,
  readings,
  selectedId,
  hoveredId,
  spotlightId,
  theme,
  onActivate,
  onHover,
}: SceneProps & { theme: Theme }) {
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <>
      {scope.nodes.map((node, index) => (
        <Node
          key={node.id}
          node={node}
          index={index}
          reading={node.statusKey ? readings[node.statusKey] : undefined}
          selected={node.id === selectedId}
          hovered={node.id === hoveredId}
          dimmed={Boolean(spotlightId) && node.id !== spotlightId}
          theme={theme}
          onActivate={onActivate}
          onHover={onHover}
        />
      ))}
    </>
  );
}

/** Every edge in one lineSegments — one draw call, and it dodges R3F's <line>. */
function Edges({ scope, theme }: { scope: Scope; theme: "dark" | "light" }) {
  const { pulses } = useTraffic();
  const lit = useMemo(() => new Set(pulses.map((p) => p.edgeId)), [pulses]);
  const colorAttr = useRef<THREE.BufferAttribute>(null);

  const idle = useMemo(
    () =>
      new THREE.Color(
        LOOK[scope.look as Look].edge[themeIndex(theme)] ??
          SCENE[theme].idleEdge,
      ),
    [theme, scope.look],
  );
  const action = useMemo(
    () => new THREE.Color(theme === "light" ? "#a81a7a" : "#f42bb0"),
    [theme],
  );

  const { positions, colors, order } = useMemo(() => {
    const byId = new Map(scope.nodes.map((n) => [n.id, n]));
    const pos: number[] = [];
    const ids: string[] = [];
    for (const edge of scope.edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
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
  }, [scope]);

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
    <lineSegments key={scope.id}>
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
  scope,
  controls,
  focusId,
}: {
  scope: Scope;
  controls: React.RefObject<Controls | null>;
  focusId: string | null;
}) {
  const focus = useRef<{ until: number; pos: THREE.Vector3 } | null>(null);

  // On every scope change, pull the camera back in from a slight push so the
  // descent reads as flying *into* the new level rather than a hard cut.
  const enter = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the scope change is exactly the signal we arm the entry dolly on
  useEffect(() => {
    enter.current = performance.now() + 900;
  }, [scope.id]);

  useEffect(() => {
    if (!focusId) {
      focus.current = null;
      return;
    }
    const node = scope.nodes.find((n) => n.id === focusId);
    if (node) {
      focus.current = {
        until: performance.now() + 1400,
        pos: new THREE.Vector3(...position(node.x, node.y, node.z)),
      };
    }
  }, [focusId, scope]);

  useFrame(({ camera }) => {
    const c = controls.current;
    if (!c) return;
    const f = focus.current;
    c.target.lerp(f ? f.pos : ORIGIN, 0.08);
    if (f && performance.now() < f.until) {
      const desired = f.pos.clone().add(new THREE.Vector3(0.9, 0.5, 2.1));
      camera.position.lerp(desired, 0.06);
    } else if (performance.now() < enter.current) {
      // Ease toward the resting frame after a scope change.
      camera.position.lerp(new THREE.Vector3(0, 0.7, 6.6), 0.05);
    }
    c.update();
  });

  return null;
}

/** Fog is the cheapest honest depth cue on a flat screen — near nodes read closer. */
function Atmosphere({ theme, look }: { theme: "dark" | "light"; look: Look }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const s = SCENE[theme];
    const fog = LOOK[look].fog[themeIndex(theme)] ?? s.fog;
    scene.fog = new THREE.Fog(fog, s.fogNear, s.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [scene, theme, look]);
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
      onPointerMissed={() => props.onBackground()}
    >
      <Atmosphere theme={theme} look={props.scope.look as Look} />
      <ambientLight intensity={scene.ambient} />
      <pointLight position={[4, 5, 6]} intensity={scene.key} distance={26} />
      <pointLight
        position={[-5, -2, -4]}
        intensity={scene.key * 0.4}
        distance={22}
      />

      <Edges scope={props.scope} theme={theme} />
      {/* Keyed by scope so the intro reveal replays each time you descend. */}
      <group key={props.scope.id}>
        <Nodes {...props} theme={theme} />
      </group>

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        minDistance={3.5}
        maxDistance={11}
      />
      <CameraRig scope={props.scope} controls={controls} focusId={focusId} />

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
