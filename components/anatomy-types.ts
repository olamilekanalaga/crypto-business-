import type { Evidence, Status } from "./types";
export type AnatomyKind =
  "organisation" | "product" | "need" | "capability" | "actor" | "resource";
export type AnatomyNode = {
  id: number;
  entity_id: number | null;
  kind: AnatomyKind;
  name: string;
  description: string;
  created_at: string;
};
export type AnatomyEdge = {
  id: number | string;
  source_id: number;
  target_id: number;
  relation: string;
  original_type?: string;
  readonly: boolean;
  essentiality: "essential" | "optional" | "unknown";
  actuality: "existing" | "potential";
  lens: string;
  status: Status;
  explanation: string;
  source_value: string;
  target_value: string;
  money: "yes" | "no" | "unknown";
  evidence_id: number | null;
  observed_at: string;
  evidence_gaps: string;
  provenance: string;
  supersedes_id: number | null;
  active: number;
  source_name: string;
  target_name: string;
  source_kind: string;
  target_kind: string;
  source_entity_id: number | null;
  target_entity_id: number | null;
  evidence_title?: string | null;
  evidence_url?: string | null;
  original_text?: string | null;
  interpretation?: string | null;
  evidence_verification?: Status | null;
  evidence?: Evidence[];
  created_at: string;
  history?: {
    action: string;
    reason?: string;
    observed_at?: string;
    created_at?: string;
  }[];
};
export type AnatomyData = {
  center_id: number | null;
  catalog: AnatomyNode[];
  nodes: AnatomyNode[];
  edges: AnatomyEdge[];
  history: AnatomyEdge[];
  limits: {
    max_nodes: number;
    max_edges: number;
    catalog_limit: number;
    history_limit?: number;
    history_total?: number;
    history_truncated?: boolean;
    nodes_total: number;
    edges_total: number;
    catalog_total: number;
    nodes_truncated: boolean;
    edges_truncated: boolean;
    catalog_truncated: boolean;
  };
  filters: Record<string, string>;
};
export const relationLabels: Record<string, string> = {
  needs_to_operate: "Needs to operate",
  needs_to_grow: "Needs to grow",
  pays_for: "Pays for",
  provides_to: "Provides to",
  partners_with: "Partners with",
  could_benefit_from: "Could benefit from",
  competes_with: "Competes with",
  documented_relationship: "Documented relationship",
};
export const anatomyLenses = [
  {
    id: "oxygen",
    name: "Oxygen",
    equivalent: "Distribution & access",
    description:
      "How does the business reach customers? Explore sales channels, integrations, ecosystems and underused routes to market.",
  },
  {
    id: "blood",
    name: "Blood",
    equivalent: "Capital & value circulation",
    description:
      "Where do revenue, funding or liquidity enter? Who supplies capital, and what does the business give in return?",
  },
  {
    id: "brain",
    name: "Brain",
    equivalent: "Information & coordination",
    description:
      "What knowledge, developer skills, documentation and decisions keep the business working?",
  },
  {
    id: "legs",
    name: "Legs",
    equivalent: "Delivery & execution",
    description:
      "What infrastructure and operations let the business deliver its product? Which dependencies are essential?",
  },
  {
    id: "food",
    name: "Food",
    equivalent: "Recurring inputs",
    description:
      "What does it repeatedly consume: hosting, data, services or specialised work? Which inputs are expensive or difficult to obtain?",
  },
];
