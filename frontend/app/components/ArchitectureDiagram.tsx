"use client";

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
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

const NODE_ICONS: Record<string, string> = {
  frontend: "🖥",
  backend:  "⚙",
  database: "🗄",
  queue:    "📨",
  external: "🔗",
  service:  "🔧",
};

const GROUP_COLORS: Record<string, string> = {
  frontend: "#3b82f6",
  backend:  "#10b981",
  database: "#f59e0b",
  queue:    "#8b5cf6",
  external: "#6b7280",
  service:  "#ef4444",
};

const GROUP_LABELS: Record<number, string> = {
  0: "CLIENTS",
  1: "GATEWAY",
  2: "SERVICES",
  3: "DATA LAYER",
  4: "EXTERNAL",
};

const GROUP_ICONS: Record<number, string> = {
  0: "👤",
  1: "🔀",
  2: "⚙",
  3: "🗄",
  4: "🔗",
};

// Layout constants
const GROUP_PADDING_TOP = 50;
const GROUP_PADDING_X = 20;
const GROUP_PADDING_BOTTOM = 20;
const NODE_W = 100;
const NODE_H = 80;
const NODE_GAP_X = 20;
const NODE_GAP_Y = 20;
const GROUP_GAP = 40;
const NODES_PER_ROW = 2;

function computeGroupedPositions(rawNodes: ArchNode[]): Node[] {
  // Group nodes by layer
  const layers: Record<number, ArchNode[]> = {};
  for (const n of rawNodes) {
    if (!layers[n.layer]) layers[n.layer] = [];
    layers[n.layer].push(n);
  }
  // Sort each layer by order
  for (const layer of Object.values(layers)) {
    layer.sort((a, b) => a.order - b.order);
  }

  const sortedLayers = Object.keys(layers).map(Number).sort((a, b) => a - b);
  const allNodes: Node[] = [];
  let groupX = 30;

  for (const layerIdx of sortedLayers) {
    const layerNodes = layers[layerIdx];
    const cols = Math.min(NODES_PER_ROW, layerNodes.length);
    const rows = Math.ceil(layerNodes.length / NODES_PER_ROW);

    const groupW = GROUP_PADDING_X * 2 + cols * NODE_W + (cols - 1) * NODE_GAP_X;
    const groupH = GROUP_PADDING_TOP + rows * NODE_H + (rows - 1) * NODE_GAP_Y + GROUP_PADDING_BOTTOM;

    // Determine group color from most common node_type
    const typeCounts: Record<string, number> = {};
    for (const n of layerNodes) {
      typeCounts[n.node_type] = (typeCounts[n.node_type] ?? 0) + 1;
    }
    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
    const groupColor = GROUP_COLORS[dominantType] ?? "#6b7280";

    // Add group node
    const groupId = `group-${layerIdx}`;
    allNodes.push({
      id: groupId,
      type: "groupNode",
      position: { x: groupX, y: 30 },
      data: {
        label: GROUP_LABELS[layerIdx] ?? `LAYER ${layerIdx}`,
        icon: GROUP_ICONS[layerIdx] ?? "📦",
        color: groupColor,
        width: groupW,
        height: groupH,
      },
      style: { width: groupW, height: groupH },
    });

    // Add child nodes positioned relative to the group
    for (let i = 0; i < layerNodes.length; i++) {
      const n = layerNodes[i];
      const col = i % NODES_PER_ROW;
      const row = Math.floor(i / NODES_PER_ROW);
      allNodes.push({
        id: n.id,
        type: "architectureNode",
        position: {
          x: GROUP_PADDING_X + col * (NODE_W + NODE_GAP_X),
          y: GROUP_PADDING_TOP + row * (NODE_H + NODE_GAP_Y),
        },
        parentId: groupId,
        extent: "parent" as const,
        data: {
          label: n.label,
          description: n.description,
          technology: n.technology,
          node_type: n.node_type,
          icon: NODE_ICONS[n.node_type] ?? "📦",
        },
      });
    }

    groupX += groupW + GROUP_GAP;
  }

  return allNodes;
}

function GroupNode({ data }: { data: Record<string, unknown> }) {
  const color = data.color as string;
  return (
    <div
      style={{
        width: data.width as number,
        height: data.height as number,
        border: `1px solid ${color}40`,
        background: `${color}08`,
        borderRadius: 12,
      }}
      className="relative"
    >
      <div
        className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase"
        style={{ color: `${color}cc` }}
      >
        <span>{data.icon as string}</span>
        {data.label as string}
      </div>
    </div>
  );
}

function ArchitectureNode({ data }: { data: Record<string, string> }) {
  return (
    <div
      style={{ width: NODE_W, height: NODE_H }}
      className="rounded-lg bg-zinc-900/80 border border-zinc-700/50 flex flex-col items-center justify-center text-center px-2 hover:border-zinc-500/70 transition-colors"
    >
      <Handle type="target" position={Position.Left} style={{ background: "#94a3b8", width: 6, height: 6 }} />
      <span className="text-xl leading-none mb-1">{data.icon}</span>
      <div className="font-medium text-[11px] leading-tight text-zinc-200">{data.label}</div>
      {data.technology && (
        <div className="text-[9px] text-zinc-500 mt-0.5">{data.technology}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#94a3b8", width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  architectureNode: ArchitectureNode,
  groupNode: GroupNode,
};

function ArchitectureDiagramInner({
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

  const rfNodes = computeGroupedPositions(uniqueNodes);
  const rfEdges: Edge[] = rawEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b" },
      style: { stroke: "#64748b", strokeWidth: 1.5 },
      labelStyle: { fill: "#94a3b8", fontSize: 9, fontWeight: 500 },
      labelBgStyle: { fill: "#0f172a", fillOpacity: 0.9 },
    }));

  const [nodes, , onNodesChange] = useNodesState(rfNodes);
  const [edges, , onEdgesChange] = useEdgesState(rfEdges);
  const { fitView } = useReactFlow();

  return (
    <div style={{ width: "100%", height: "100%", background: "#0a0f1a", borderRadius: 12 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
      >
        <Background color="#1a2030" gap={24} size={1} />
        <Controls showFitView={false}>
          <ControlButton onClick={() => fitView({ padding: 0.15 })} title="Fit view">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="1" />
            </svg>
          </ControlButton>
        </Controls>
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "groupNode") return "transparent";
            return GROUP_COLORS[(n.data as Record<string, string>).node_type] ?? "#374151";
          }}
          style={{ background: "#0f172a" }}
        />
      </ReactFlow>
    </div>
  );
}

export function ArchitectureDiagram(props: { nodes: ArchNode[]; edges: ArchEdge[] }) {
  return (
    <ReactFlowProvider>
      <ArchitectureDiagramInner {...props} />
    </ReactFlowProvider>
  );
}
