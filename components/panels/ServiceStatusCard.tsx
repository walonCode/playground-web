"use client";

import type { Reading } from "@/components/hero/Mesh3d";
import { SourceLink } from "@/components/panel/Evidence";
import { Panel, PanelSection } from "@/components/panel/Panel";
import { Readout, ReadoutGrid } from "@/components/panel/Readout";
import { REPO_BASE } from "@/lib/api";
import { NODE_META } from "@/lib/mesh";

/** Which repo file answers for a node, for the evidence link. */
const SOURCE: Record<string, string> = {
  gateway: "apps/gateway/src/app.controller.ts",
  auth: "apps/auth/src/auth.controller.ts",
  lifecycle: "apps/lifecycle/src/lifecycle.controller.ts",
  kafka: "docker-compose.yml",
  postgres: "docker-compose.yml",
  redis: "docker-compose.yml",
};

/**
 * The overlay for a node that has no full demo yet.
 *
 * It still shows real data — the live status and latency already measured by
 * the mesh poll — and says plainly that a fuller demo is coming, rather than
 * dressing up a control that does not exist.
 */
export function ServiceStatusCard({
  nodeId,
  label,
  reading,
}: {
  nodeId: string;
  label: string;
  reading: Reading | undefined;
}) {
  const meta = NODE_META[nodeId];
  const status =
    reading?.status === "up"
      ? "nominal"
      : reading?.status === "down"
        ? "down"
        : "unknown";
  const isInfra = meta?.demo === "infra";

  return (
    <Panel label={label} status={status}>
      <PanelSection>
        <p className="text-sm leading-relaxed text-text-mid">{meta?.blurb}</p>
      </PanelSection>

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
            label={isInfra ? "probe" : "ping"}
            value={reading?.latency != null ? reading.latency : null}
            unit="ms"
          />
          <Readout label="kind" value={isInfra ? "infra" : "service"} />
        </ReadoutGrid>
      </PanelSection>

      <PanelSection>
        <p className="font-mono text-[11px] text-text-low">
          {isInfra
            ? "infrastructure — health is probed by the lifecycle service"
            : "live status only · an interactive demo for this service is coming"}
        </p>
        {SOURCE[nodeId] && (
          <div className="mt-2">
            <SourceLink
              href={`${REPO_BASE}/${SOURCE[nodeId]}`}
              label={SOURCE[nodeId].split("/").pop() ?? "source"}
            />
          </div>
        )}
      </PanelSection>
    </Panel>
  );
}
