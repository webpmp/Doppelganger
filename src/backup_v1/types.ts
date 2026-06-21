export interface ActiveNode {
  id: string;
  label: string;
  summary: string;
  node_state: string; // "active" | "archived"
  visibility_status: string; // "public" | "isolated_passphrase"
  access_key_hash: string | null;
  accessKeyHash: string | null;
  isIsolated: boolean;
  weight: number;
  doppelgangerId?: string;
  ownerId?: string;
}

export interface Memory {
  node_id: string;
  content: string;
  source_origin: string;
}

export interface Edge {
  source: string;
  target: string;
  relation?: string;
}

export interface StateBlueprint {
  activeNodes: ActiveNode[];
  memories: Memory[];
  edges: Edge[];
  owner?: {
    name: string;
    title: string;
    email: string;
    photoUrl: string;
  };
}

export interface ProposalCard {
  type: "ADD_NODE" | "UPDATE_NODE" | "ARCHIVE_NODE" | "ADD_MEMORY" | "SECURE_GATE_TRIGGERED";
  title: string;
  description: string;
}

export interface CompactionResponse {
  reasoning: string;
  cards: ProposalCard[];
  proposedState: StateBlueprint;
}

export interface ChatMessage {
  id: string;
  sender: "visitor" | "doug"; // visitor or double
  text: string;
  referencedNodes?: string[];
  routingTrigger?: boolean;
  timestamp: string;
}
