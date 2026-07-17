export interface LevelOverride {
  value: number;
  source: "ai" | "owner_override";
  previous_ai_value?: number;
}

export interface ActiveNode {
  id: string;
  label: string;
  summary: string;
  node_state: string; // "active" | "archived"
  visibility_status: string; // "public" | "isolated_passphrase"
  access_key_hash: string | null;
  accessKeyHash: string | null;
  isIsolated: boolean;
  level?: number | LevelOverride; // 1 = Parent, 2 = Child, 3 = Grandchild
  priority?: number; // 1 = Low, ...
  weight?: number; // Legacy backward-compatibility
  notes?: string;
  doppelgangerId?: string;
  ownerId?: string;
  doppelganger?: string;
  doppelgangerHandle?: string;
  tags?: string;
  answerState?: "active" | "context" | "none";
}

export interface Note {
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
  notes: Note[];
  edges: Edge[];
  owner?: {
    name: string;
    title: string;
    email: string;
    photoUrl: string;
  };
}

export interface ProposalCard {
  type: "ADD_NODE" | "UPDATE_NODE" | "ARCHIVE_NODE" | "ADD_NOTE" | "SECURE_GATE_TRIGGERED";
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

export interface GraphModel {
  nodes: ActiveNode[];
  edges: Edge[];
}

export interface AnswerGraph extends GraphModel {
  activeNodeIds: string[];
  contextNodeIds: string[];
}

export function stripLabelNumbering(label: string): string {
  if (!label) return "";
  return label.replace(/^\d+(\.\d+)*\s+/g, "").trim();
}

export function formatNodeLabel(label: string): string {
  if (!label) return "";
  return label.replace(/^\d+(\.\d+)*\s+/g, "");
}

export function classifyNodeLevel(label: string, summary: string): number {
  const cleanLabel = (label || "").toLowerCase();
  const cleanSummary = (summary || "").toLowerCase();

  // Strip prefixes from candidate strings before classification
  const l = cleanLabel.replace(/^\s*\d+(\.\d+)*[-\s]*/, "").trim();
  const s = cleanSummary;

  // Level 1 indicators: full product, program, initiative, or container keywords
  const level1Keywords = [
    "redesign", "prototype", "branding", "update", "initiative", "merger",
    "program", "platform", "system", "framework", "stealth project", "campaign",
    "application", "product", "infrastructure", "upgrade", "facelift"
  ];

  // Level 2 indicators: phases, teams, domains, workstreams
  const level2Keywords = [
    "phase", "timeline", "resourcing", "procurement", "planning", "ops",
    "operations", "exercises", "security", "integration", "runner",
    "gateway", "hub", "roadmaps", "milestones", "schedule", "sprints"
  ];

  // Level 3 indicators: atomic outputs, decisions, single-purpose notes/deliverables
  const level3Keywords = [
    "findings", "summary", "approval", "purchase order", "note", "deliverable",
    "meeting", "log", "metrics", "report", "result", "artifact", "output",
    "analytics", "cache", "stitching", "viewport", "simulation", "findings",
    "contract", "tokens", "detail", "checklist", "specification", "spec"
  ];

  // AI Decision Rules matching
  // 1. Identify if node is a container -> Level 1
  for (const kw of level1Keywords) {
    if (l.includes(kw) || s.includes(kw)) {
      return 1;
    }
  }

  // 2. Else if functional subsystem -> Level 2
  for (const kw of level2Keywords) {
    if (l.includes(kw) || s.includes(kw)) {
      return 2;
    }
  }

  // 3. Else -> Level 3 (if matches level 3 keywords)
  for (const kw of level3Keywords) {
    if (l.includes(kw) || s.includes(kw)) {
      return 3;
    }
  }

  // 4. If uncertain -> default to Level 2
  return 2;
}

