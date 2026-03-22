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

export interface ERColumn {
  name: string;
  type: string;
  constraints: string;
}

export interface ERNodeData {
  id: string;
  label: string;
  columns: ERColumn[];
}

export interface EREdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  source_label: string;
  target_label: string;
}

// Layout constants
const TABLE_W = 220;
const ROW_H = 22;
const HEADER_H = 32;
const COLS_PER_ROW = 3;
const GAP_X = 80;
const GAP_Y = 60;

function getTableHeight(columns: ERColumn[]): number {
  return HEADER_H + Math.max(columns.length, 1) * ROW_H + 8;
}

function isPK(constraints: string) {
  return /\bPK\b/i.test(constraints);
}

function isFK(constraints: string) {
  return /\bFK\b/i.test(constraints);
}

function TableNode({ data }: { data: Record<string, unknown> }) {
  const label = data.label as string;
  const columns = (data.columns as ERColumn[]) ?? [];
  const height = getTableHeight(columns);

  return (
    <div
      style={{ width: TABLE_W, height, minHeight: HEADER_H + ROW_H }}
      className="rounded-lg overflow-hidden border border-amber-500/30 bg-zinc-900/90 shadow-lg shadow-black/30"
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#f59e0b", width: 7, height: 7, top: HEADER_H / 2 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#f59e0b", width: 7, height: 7, top: HEADER_H / 2 }}
      />

      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-2.5 font-semibold text-[12px] text-amber-200 tracking-wide"
        style={{
          height: HEADER_H,
          background: "linear-gradient(135deg, #78350f 0%, #451a03 100%)",
          borderBottom: "1px solid rgba(245,158,11,0.25)",
        }}
      >
        <span>🗄</span>
        {label}
      </div>

      {/* Columns */}
      <div className="px-1.5 py-1">
        {columns.length > 0 ? (
          columns.map((col, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-1.5 rounded text-[10px] leading-none"
              style={{ height: ROW_H }}
            >
              {/* Constraint badge */}
              {isPK(col.constraints) ? (
                <span className="text-[8px] font-bold text-amber-400 w-[18px] shrink-0">PK</span>
              ) : isFK(col.constraints) ? (
                <span className="text-[8px] font-bold text-blue-400 w-[18px] shrink-0">FK</span>
              ) : (
                <span className="w-[18px] shrink-0" />
              )}
              {/* Name */}
              <span className="font-medium text-zinc-200 truncate flex-1">{col.name}</span>
              {/* Type */}
              <span className="text-zinc-500 text-[9px] truncate max-w-[70px] text-right">
                {col.type}
              </span>
            </div>
          ))
        ) : (
          <div className="text-[10px] text-zinc-600 px-1.5 py-1">No columns</div>
        )}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
};

function computeLayout(rawNodes: ERNodeData[]): Node[] {
  const nodes: Node[] = [];

  for (let i = 0; i < rawNodes.length; i++) {
    const n = rawNodes[i];
    const col = i % COLS_PER_ROW;
    const row = Math.floor(i / COLS_PER_ROW);
    const height = getTableHeight(n.columns);

    // Stagger Y based on max height in the row for neat spacing
    nodes.push({
      id: n.id,
      type: "tableNode",
      position: {
        x: 30 + col * (TABLE_W + GAP_X),
        y: 30 + row * (200 + GAP_Y),
      },
      data: {
        label: n.label,
        columns: n.columns,
      },
      style: { width: TABLE_W, height },
    });
  }

  return nodes;
}

export function ERDiagram({
  nodes: rawNodes,
  edges: rawEdges,
}: {
  nodes: ERNodeData[];
  edges: EREdgeData[];
}) {
  // Deduplicate nodes
  const seen = new Set<string>();
  const uniqueNodes = rawNodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const nodeIds = new Set(uniqueNodes.map((n) => n.id));
  const rfNodes = computeLayout(uniqueNodes);

  const rfEdges: Edge[] = rawEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || "",
      markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
      style: { stroke: "#f59e0b", strokeWidth: 1.5, opacity: 0.7 },
      labelStyle: { fill: "#fbbf24", fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
    }));

  const [nodes, , onNodesChange] = useNodesState(rfNodes);
  const [edges, , onEdgesChange] = useEdgesState(rfEdges);

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0f1a", borderRadius: 12 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background color="#1a2030" gap={24} size={1} />
        <Controls />
        <MiniMap
          nodeColor={() => "#78350f"}
          style={{ background: "#0f172a" }}
        />
      </ReactFlow>
    </div>
  );
}
