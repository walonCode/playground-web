"use client";

import { MESH_NODES, nodeColor } from "@/lib/mesh";
import { useThemeValue } from "@/lib/theme";

/**
 * Teaches the three channels the scene uses, none of which overlap:
 * shape is what kind of thing a node is, its colour is which service it is,
 * and the lamp beside its label is how it's doing. Read once, the whole mesh
 * becomes legible.
 */
export function Legend() {
  const theme = useThemeValue();
  const services = MESH_NODES.filter((n) => n.kind === "service");

  return (
    <div className="pointer-events-none flex max-w-[19rem] flex-col gap-2.5 border border-line bg-void/85 p-3 backdrop-blur-sm">
      <Row label="shape">
        <Diamond />
        <span className="text-text-mid">gateway</span>
        <Square />
        <span className="text-text-mid">service</span>
        <Circle />
        <span className="text-text-mid">infra</span>
      </Row>

      <Row label="lamp">
        <Dot className="bg-nominal" />
        <span className="text-text-mid">up</span>
        <Dot className="bg-down" />
        <span className="text-text-mid">down</span>
        <Dot className="bg-action" />
        <span className="text-text-mid">your action</span>
      </Row>

      <div className="flex flex-col gap-1.5 border-t border-line pt-2.5">
        <span className="font-mono text-[10px] tracking-[0.12em] text-text-low uppercase">
          colour = service
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {services.map((node) => {
            return (
              <span
                key={node.id}
                className="flex items-center gap-1 font-mono text-[10px]"
              >
                <span
                  className="size-2"
                  style={{ background: nodeColor(node.id, theme) }}
                  aria-hidden="true"
                />
                <span className="text-text-mid">{node.label}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px]">
      <span className="w-12 shrink-0 tracking-[0.12em] text-text-low uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`size-2 ${className}`} aria-hidden="true" />;
}
function Square() {
  return (
    <span className="size-2.5 border border-text-mid" aria-hidden="true" />
  );
}
function Diamond() {
  return (
    <span
      className="size-2.5 rotate-45 border border-text-mid"
      aria-hidden="true"
    />
  );
}
function Circle() {
  return (
    <span
      className="size-2.5 rounded-full border border-text-mid"
      aria-hidden="true"
    />
  );
}
