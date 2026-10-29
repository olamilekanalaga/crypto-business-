"use client";
import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Boxes,
  Globe,
  Lightbulb,
  Network,
  Users,
  Database,
} from "lucide-react";
import type { AnatomyData } from "./anatomy-types";
import { relationLabels } from "./anatomy-types";
type MapNode = Node<{ name: string; kind: string; center: boolean }, "anatomy">;
function AnatomyNodeCard({ data }: NodeProps<MapNode>) {
  const Icon =
    data.kind === "organisation"
      ? Globe
      : data.kind === "product"
        ? Boxes
        : data.kind === "need"
          ? Lightbulb
          : data.kind === "actor"
            ? Users
            : data.kind === "resource"
              ? Database
              : Network;
  return (
    <div className={"anatomy-node " + (data.center ? "is-centre" : "")}>
      <Handle type="target" position={Position.Left} />
      <button type="button" aria-label={"Centre on " + data.name}>
        <span className="anatomy-node-icon">
          <Icon size={18} />
        </span>
        <span>
          <small>
            {data.kind}
            {data.center ? " · CENTRE" : ""}
          </small>
          <strong>{data.name}</strong>
        </span>
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { anatomy: AnatomyNodeCard };
export default function AnatomyMap({
  data,
  onCenter,
  onEdge,
}: {
  data: AnatomyData;
  onCenter: (id: number) => void;
  onEdge: (id: number | string) => void;
}) {
  const { nodes, edges, limited } = useMemo(() => {
    const central = data.nodes.find((n) => n.id === data.center_id);
    const others = data.nodes
      .filter((n) => n.id !== data.center_id)
      .sort((a, b) => (a.distance ?? 1) - (b.distance ?? 1))
      .slice(0, 39);
    const ids = new Set([data.center_id, ...others.map((n) => n.id)]);
    const list = central ? [central, ...others] : others;
    const nodes: MapNode[] = list.map((n) => {
      const i = others.findIndex((o) => o.id === n.id),
        ring = Math.floor(Math.max(0, i) / 12),
        count = Math.min(12, others.length - ring * 12),
        angle = (2 * Math.PI * (Math.max(0, i) % 12)) / count - Math.PI / 2;
      return {
        id: String(n.id),
        type: "anatomy",
        data: { name: n.name, kind: n.kind, center: n.id === data.center_id },
        position:
          n.id === data.center_id
            ? { x: 0, y: 0 }
            : {
                x: Math.cos(angle) * (360 + ring * 290),
                y: Math.sin(angle) * (215 + ring * 210),
              },
        draggable: true,
      };
    });
    const edges: Edge[] = data.edges
      .filter((e) => ids.has(e.source_id) && ids.has(e.target_id))
      .map((e) => ({
        id: String(e.id),
        source: String(e.source_id),
        target: String(e.target_id),
        label: e.original_type || relationLabels[e.relation] || e.relation,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: e.status === "confirmed" ? "#587e52" : "#b49b63",
        },
        style: {
          stroke: e.status === "confirmed" ? "#698c61" : "#bda879",
          strokeWidth: 1.6,
          strokeDasharray:
            e.status === "confirmed" && e.actuality === "existing"
              ? undefined
              : "6 5",
        },
        labelStyle: { fontSize: 10, fill: "#6b785c" },
        labelBgStyle: { fill: "#fcfdf7", fillOpacity: 0.97 },
        labelBgPadding: [8, 5],
        labelBgBorderRadius: 4,
        interactionWidth: 24,
        ariaLabel: `Inspect connection ${e.source_name} to ${e.target_name}`,
      }));
    return { nodes, edges, limited: list.length < data.nodes.length };
  }, [data]);
  return (
    <>
      <div
        className="anatomy-canvas"
        role="region"
        aria-label="Interactive business dependency map"
      >
        <ReactFlow
          key={String(data.center_id) + ":" + nodes.length + ":" + edges.length}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => onCenter(Number(n.id))}
          onEdgeClick={(_, e) => onEdge(e.id)}
          nodesFocusable={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
          minZoom={0.2}
          maxZoom={1.7}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="#cdd7c1" gap={24} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="map-legend">
        <span>
          <i className="solid-line" />
          Confirmed existing connection
        </span>
        <span>
          <i className="dashed-line" />
          Inference, hypothesis or potential
        </span>
        <span>Arrow = stated direction. Click a node to explore.</span>
      </div>
      {limited && (
        <p className="notice subtle">
          The canvas displays 40 nodes. Use the searchable centre selector and
          connection list to explore the remaining records.
        </p>
      )}
    </>
  );
}
