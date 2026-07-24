"use client";

import { ChatPanel } from "@/components/panels/ChatPanel";
import { HealthBoard } from "@/components/panels/HealthBoard";
import { PaymentPanel } from "@/components/panels/PaymentPanel";
import { SearchCachePanel } from "@/components/panels/SearchCachePanel";
import { TaskPanel } from "@/components/panels/TaskPanel";
import { NODE_BY_ID, NODE_META, nodeColor } from "@/lib/mesh";
import { useThemeValue } from "@/lib/theme";

/**
 * Picks the right panel for a selected node.
 *
 * Every node opens a working surface: search/cache/task/payment/chat open their
 * interactive demo, and gateway/auth/lifecycle/infra open the live health board.
 * Nothing opens to a dead end.
 */
export function NodeOverlay({
  nodeId,
  onClose,
}: {
  nodeId: string;
  onClose: () => void;
}) {
  const theme = useThemeValue();
  const node = NODE_BY_ID.get(nodeId);
  if (!node) return null;
  const demo = NODE_META[nodeId]?.demo ?? "status";
  const color = nodeColor(nodeId, theme);

  return (
    <div className="pointer-events-auto flex h-full flex-col">
      {/* A tint of the service's identity colour so the panel is unmistakably
          the node you just opened. */}
      <div
        className="flex items-center justify-between border-b border-line px-4 py-2"
        style={{
          background: `linear-gradient(to right, ${color}1f, transparent)`,
        }}
      >
        <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] uppercase">
          <span style={{ color }}>{NODE_META[nodeId]?.icon}</span>
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
        {demo === "search-cache" ? (
          <SearchCachePanel />
        ) : demo === "task" ? (
          <TaskPanel />
        ) : demo === "payment" ? (
          <PaymentPanel />
        ) : demo === "chat" ? (
          <ChatPanel />
        ) : (
          <HealthBoard nodeId={nodeId} />
        )}
      </div>
    </div>
  );
}
