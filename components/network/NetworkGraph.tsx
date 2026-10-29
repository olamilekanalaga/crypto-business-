"use client";
import { Background, Controls, ReactFlow, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Business, Relationship } from "@/lib/network/model";
export default function NetworkGraph({
  businesses,
  relationships,
  focus,
  onFocus,
  onRelationship,
}: {
  businesses: Business[];
  relationships: Relationship[];
  focus: string;
  onFocus: (id: string) => void;
  onRelationship: (id: string) => void;
}) {
  const links = relationships.slice(0, 16),
    ids = new Set([focus, ...links.flatMap((r) => [r.a, r.b])]);
  const others = businesses.filter((b) => ids.has(b.id) && b.id !== focus);
  const nodes = businesses
    .filter((b) => ids.has(b.id))
    .map((b) => {
      const index = others.findIndex((o) => o.id === b.id),
        angle = (index / Math.max(others.length, 1)) * Math.PI * 2;
      return {
        id: b.id,
        data: { label: b.name },
        position:
          b.id === focus
            ? { x: 350, y: 250 }
            : {
                x: 350 + 310 * Math.cos(angle),
                y: 250 + 210 * Math.sin(angle),
              },
        style: {
          background: b.id === focus ? "#153b30" : "#111c24",
          color: "#eafaf4",
          border: `1px solid ${b.id === focus ? "#7fe0bb" : "#526170"}`,
          borderRadius: 12,
          width: 170,
          padding: 16,
        },
        ariaLabel: `Explore ${b.name}`,
      };
    });
  const edges = links.map((r) => ({
    id: r.id,
    source: r.a,
    target: r.b,
    label: r.status === "confirmed" ? "Documented" : "Hypothesis",
    style: {
      stroke: r.status === "confirmed" ? "#7fe0bb" : "#d9b979",
      strokeDasharray: r.status === "confirmed" ? undefined : "6 5",
      strokeWidth: 2,
    },
    labelStyle: { fill: "#eafaf4", fontSize: 12 },
    labelBgStyle: { fill: "#111c24" },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: r.status === "confirmed" ? "#7fe0bb" : "#d9b979",
    },
    ariaLabel: `Why ${r.type.replaceAll("_", " ")}?`,
  }));
  return (
    <ReactFlow
      key={focus + links.map((r) => r.id).join()}
      nodes={nodes}
      edges={edges}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      nodesDraggable={false}
      nodesConnectable={false}
      onNodeClick={(_, n) => onFocus(n.id)}
      onEdgeClick={(_, e) => onRelationship(e.id)}
      minZoom={0.2}
      maxZoom={2}
      colorMode="dark"
    >
      <Background color="#263a3b" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
