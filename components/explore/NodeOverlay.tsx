"use client";

import type { Reading } from "@/components/hero/Mesh3d";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { HealthBoard } from "@/components/panels/HealthBoard";
import { PaymentPanel } from "@/components/panels/PaymentPanel";
import { SearchCachePanel } from "@/components/panels/SearchCachePanel";
import { TaskPanel } from "@/components/panels/TaskPanel";
import { useThemeValue } from "@/lib/theme";
import { type SceneNode, sceneColor } from "@/lib/topology";
import { InfraCard } from "./InfraCard";

/**
 * Picks the right panel for a selected node.
 *
 * A demo node opens its interactive panel; the gateway opens the live system
 * health board; everything else — platforms, infra, routes — opens an InfraCard.
 * Nothing opens to a dead end.
 */
export function NodeOverlay({
  node,
  reading,
  onClose,
}: {
  node: SceneNode;
  reading: Reading | undefined;
  onClose: () => void;
}) {
  const theme = useThemeValue();
  const color = sceneColor(node, theme);

  return (
    <div className="pointer-events-auto flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b border-line px-4 py-2"
        style={{
          background: `linear-gradient(to right, ${color}1f, transparent)`,
        }}
      >
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
          <span style={{ color }}>{node.icon}</span>
          <span className="text-text-hi">{node.label}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="border border-line px-2 py-0.5 font-mono text-[11px] text-text-low transition-colors hover:border-line-bright hover:text-text-hi"
        >
          esc
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Body node={node} reading={reading} />
      </div>
    </div>
  );
}

function Body({
  node,
  reading,
}: {
  node: SceneNode;
  reading: Reading | undefined;
}) {
  if (node.action.kind === "demo") {
    switch (node.action.demo) {
      case "search-cache":
        return <SearchCachePanel />;
      case "task":
        return <TaskPanel />;
      case "payment":
        return <PaymentPanel />;
      case "chat":
        return <ChatPanel />;
    }
  }
  // The gateway is the natural place to see the whole box's health at once.
  if (node.statusKey === "gateway") return <HealthBoard nodeId="gateway" />;
  return <InfraCard node={node} reading={reading} />;
}
