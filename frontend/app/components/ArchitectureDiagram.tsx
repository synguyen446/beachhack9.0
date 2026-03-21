"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export interface ArchNode {
  id: string;
  label: string;
  description: string;
  technology: string;
  node_type: "frontend" | "backend" | "database" | "queue" | "external" | "service";
  layer: number;
  order: number;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

const NODE_COLORS: Record<string, string> = {
  frontend: "#3b82f6",
  backend:  "#10b981",
  database: "#f59e0b",
  queue:    "#8b5cf6",
  external: "#6b7280",
  service:  "#ef4444",
};

const LAYER_GAP = 280;
const NODE_GAP = 140;
const X_OFFSET = 60;
const Y_OFFSET = 60;

function computePositions(rawNodes: ArchNode[]): Node[] {
  const layerCounts: Record<number, number> = {};
  for (const n of rawNodes) {
    layerCounts[n.layer] = Math.max(layerCounts[n.layer] ?? 0, n.order + 1);
  }
  const maxCount = Math.max(1, ...Object.values(layerCounts));

  return rawNodes.map((n) => {
    const layerHeight = (layerCounts[n.layer] ?? 1) * NODE_GAP;
    const totalHeight = maxCount * NODE_GAP;
    const yOffset = (totalHeight - layerHeight) / 2;
    return {
      id: n.id,
      position: {
        x: X_OFFSET + n.layer * LAYER_GAP,
        y: Y_OFFSET + yOffset + n.order * NODE_GAP,
      },
      data: {
        label: n.label,
        description: n.description,
        technology: n.technology,
        node_type: n.node_type,
      },
      type: "architectureNode",
    };
  });
}

function ArchitectureNode({ data }: { data: Record<string, string> }) {
  const color = NODE_COLORS[data.node_type] ?? "#374151";
  return (
    <div
      style={{ background: color, minWidth: 130 }}
      className="rounded-lg px-3 py-2 text-white text-xs shadow-lg border border-white/20"
    >
      <Handle type="target" position={Position.Left} style={{ background: "#94a3b8" }} />
      <div className="font-semibold text-sm leading-tight">{data.label}</div>
      <div className="opacity-75 mt-0.5 text-[11px]">{data.technology}</div>
      {data.description && (
        <div className="opacity-60 mt-1 text-[10px] leading-tight line-clamp-2">
          {data.description}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#94a3b8" }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { architectureNode: ArchitectureNode };

export function ArchitectureDiagram({
  nodes: rawNodes,
  edges: rawEdges,
}: {
  nodes: ArchNode[];
  edges: ArchEdge[];
}) {
  // Deduplicate nodes by id
  const seen = new Set<string>();
  const uniqueNodes = rawNodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const nodeIds = new Set(uniqueNodes.map((n) => n.id));

  const rfNodes = computePositions(uniqueNodes);
  const rfEdges: Edge[] = rawEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#94a3b8" },
      labelStyle: { fill: "#cbd5e1", fontSize: 10 },
      labelBgStyle: { fill: "#1e293b", fillOpacity: 0.8 },
    }));

  const [nodes, , onNodesChange] = useNodesState(rfNodes);
  const [edges, , onEdgesChange] = useEdgesState(rfEdges);

  return (
    <div style={{ width: "100%", height: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background color="#374151" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) =>
            NODE_COLORS[(n.data as Record<string, string>).node_type] ?? "#374151"
          }
        />
      </ReactFlow>
    </div>
  );
}
