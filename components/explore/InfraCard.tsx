"use client";

import type { Reading } from "@/components/hero/Mesh3d";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { Readout, ReadoutGrid } from "@/components/panel/Readout";
import type { Status } from "@/components/panel/StatusDot";
import type { SceneNode } from "@/lib/topology";

/**
 * The panel for a node that has no interactive demo — a platform, a piece of
 * infrastructure, or a route. It states plainly what the thing is, shows its
 * real health when there is a reading, and offers the check a skeptic would run.
 *
 * Honesty is explicit: a `planned` node says so and carries no health lamp or
 * latency it cannot back up.
 */
export function InfraCard({
  node,
  reading,
}: {
  node: SceneNode;
  reading: Reading | undefined;
}) {
  const status: Status = node.planned
    ? "unknown"
    : reading?.status === "up"
      ? "nominal"
      : reading?.status === "down"
        ? "down"
        : "unknown";

  return (
    <Panel
      label={node.label}
      status={status}
      statusLabel={node.planned ? "planned" : undefined}
    >
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">{node.blurb}</p>
        {node.planned && (
          <p className="mt-2 font-mono text-[11px] text-degraded">
            planned — shown for the full picture, not yet verifiable from the
            repo
          </p>
        )}
      </PanelSection>

      {node.statusKey && !node.planned && (
        <PanelSection>
          <ReadoutGrid>
            <Readout
              label="status"
              value={reading ? reading.status : null}
              tone={
                reading?.status === "up"
                  ? "nominal"
                  : reading?.status === "down"
                    ? "down"
                    : "default"
              }
            />
            <Readout
              label="latency"
              value={reading?.latency != null ? reading.latency : null}
              unit="ms"
            />
          </ReadoutGrid>
        </PanelSection>
      )}

      {node.verify && (
        <PanelSection>
          <p className="font-mono text-[10px] tracking-[0.16em] text-text-low uppercase">
            verify · {node.verify.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-text-mid">
            {node.verify.how}
          </p>
        </PanelSection>
      )}
    </Panel>
  );
}
