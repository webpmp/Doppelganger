import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { AIProvider, AIConfig, STANDARD_GEMINI_MODELS, getDeterministicMockEmbedding } from "./aiProvider.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing json and urlencoded data
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Helper to perform legacy generateContent calls with fallback (kept for extreme safety)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for simple stop words filter in sweep
const stopWords = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when", 
  "at", "by", "for", "from", "in", "into", "of", "on", "to", "with", 
  "is", "was", "are", "were", "been", "be", "have", "has", "had", 
  "do", "does", "did", "this", "that", "these", "those", "i", "you", 
  "he", "she", "it", "we", "they", "my", "your", "his", "her", "their"
]);

// Helper to get project prefix (like node-1 or node-2) from a node id
function getProjectPrefix(nodeId: string): string {
  const match = String(nodeId).match(/^(node-\d+)/);
  return match ? match[1] : String(nodeId);
}

// Semantic keyword sweep function with project-aware boosting
function performKeywordSweep(notes: any[], query: string, activeNodes: any[] = [], topK = 5): any[] {
  if (!notes || notes.length === 0) return [];
  const queryWords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  if (queryWords.length === 0) {
    return notes.slice(0, topK);
  }

  const projectBoosts = new Map<string, number>();
  const nodeBoosts = new Map<string, number>();

  activeNodes.forEach(node => {
    const nodeId = node.id;
    const labelLower = (node.label || "").toLowerCase();
    const summaryLower = (node.summary || "").toLowerCase();
    
    let matchCount = 0;
    queryWords.forEach(word => {
      if (labelLower.includes(word)) {
        matchCount += 3;
      }
      if (summaryLower.includes(word)) {
        matchCount += 1;
      }
    });

    if (matchCount > 0) {
      nodeBoosts.set(nodeId, (nodeBoosts.get(nodeId) || 0) + matchCount * 15);
      const prefix = getProjectPrefix(nodeId);
      projectBoosts.set(prefix, (projectBoosts.get(prefix) || 0) + matchCount * 10);
    }
  });

  const scoredNotes = notes.map(mem => {
    const contentLower = mem.content.toLowerCase();
    let score = 0;

    queryWords.forEach(word => {
      if (contentLower.includes(word)) {
        score += 2;
        const regex = new RegExp(`\\b${word}\\b`, "i");
        if (regex.test(contentLower)) {
          score += 2;
        }
      }
    });

    const nBoost = nodeBoosts.get(mem.node_id) || 0;
    score += nBoost;

    const prefix = getProjectPrefix(mem.node_id);
    const pBoost = projectBoosts.get(prefix) || 0;
    score += pBoost;

    return { mem, score };
  });

  scoredNotes.sort((a, b) => b.score - a.score);
  return scoredNotes.slice(0, topK).map(item => item.mem);
}

// Cosine similarity for real vector comparison
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper to resolve the active AIConfig
function getRequestAIConfig(reqBody: any): AIConfig {
  const { aiConfig } = reqBody;
  if (aiConfig && aiConfig.provider) {
    return aiConfig;
  }
  // Fallback default Gemini setting
  return {
    provider: "gemini",
    geminiConfig: {
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-3.5-flash"
    },
    embeddingProvider: "gemini",
    embeddingConfig: {
      model: "gemini-embedding-2-preview"
    }
  };
}

// ENDPOINT A: Test Provider Connection
app.post("/api/ai-provider/test-connection", async (req, res) => {
  try {
    const config = getRequestAIConfig(req.body);
    const provider = new AIProvider(config);
    let activeModel = provider.getActiveModelName();
    if (config.provider === "lm-studio" && activeModel === "Currently Loaded Model") {
      activeModel = await provider.fetchActiveLMStudioModel();
    }
    const activeEmbed = provider.getActiveEmbeddingModelName();

    console.log(`[System Settings] Testing connection for ${config.provider} (Chat: ${activeModel}, Embed: ${activeEmbed})`);

    // Verify chat model can do basic generation complete
    const testText = await provider.generateResponse("Please respond with exactly: CONNECTION_OK", {
      systemInstruction: "You are a connectivity probe verification node. Always return only the word CONNECTION_OK."
    });

    const isChatOk = testText && testText.toUpperCase().includes("CONNECTION_OK");

    // Verify embedding model can generate vectors without crashing
    const testEmbed = await provider.generateEmbedding("Probe neural alignment validation");
    const isEmbedOk = testEmbed && Array.isArray(testEmbed) && testEmbed.length > 0;

    if (isChatOk && isEmbedOk) {
      const providerLabel = config.provider === "gemini" ? "Gemini" : config.provider === "lm-studio" ? "LM Studio" : "Custom Provider";
      return res.json({
        success: true,
        message: `Successfully connected to ${providerLabel}.\nActive Providers verified: ${activeModel}\nEmbeddings: ${activeEmbed}`
      });
    } else {
      return res.json({
        success: false,
        message: `Connection failed.\nChat: ${isChatOk ? "Connected" : "Failed to connect"} (${testText})\nEmbeddings: ${isEmbedOk ? "Connected" : "Failed to connect"}`
      });
    }
  } catch (err: any) {
    console.error("[System Settings] Test Connection failed:", err);
    return res.status(500).json({
      success: false,
      message: `Failed to assemble provider connection: ${err.message || err}`
    });
  }
});

// ENDPOINT B: Fetch models dynamically
app.post("/api/ai-provider/models", async (req, res) => {
  try {
    const { provider, endpoint, apiKey } = req.body;
    console.log(`[System Settings] Dynamically loading models for ${provider}`);

    if (provider === "gemini") {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (key) {
        try {
          const client = new GoogleGenAI({ apiKey: key });
          const modelList = await client.models.list();
          const listModels = modelList as any;
          const modelsArray = Array.isArray(listModels) ? listModels : (listModels.models || []);
          const names = modelsArray.map((m: any) => m.name.replace("models/", ""));
          const filtered = names.filter((n: string) => !n.includes("deprecated") && (n.includes("gemini") || n.includes("embed")));
          if (filtered.length > 0) {
            return res.json({ models: Array.from(new Set([...filtered, ...STANDARD_GEMINI_MODELS])) });
          }
        } catch (err) {
          console.warn("[System Settings] Could not fetch live Google Models list, using comprehensive local fallback.", err);
        }
      }
      return res.json({ models: STANDARD_GEMINI_MODELS });
    } else {
      // LM Studio or Custom OpenAI Compatible endpoint
      let url = endpoint || "http://localhost:1234";
      if (url.endsWith("/")) {
        url = url.slice(0, -1);
      }

      // If localhost, prompt matching frontend fetch to bypass isolated cloud networking bounds
      if (url.includes("localhost") || url.includes("127.0.0.1")) {
        return res.json({ models: [], isLocalhost: true });
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${url}/v1/models`, { headers });
      if (!response.ok) {
        throw new Error(`Models query returned HTTP ${response.status}`);
      }
      const data = await response.json();
      const models = (data?.data || []).map((m: any) => m.id);
      return res.json({ models });
    }
  } catch (err: any) {
    console.error("[System Settings] Dynamic model lookup failed:", err.message || err);
    return res.status(500).json({ error: err.message || "Failed to locate endpoint models list." });
  }
});

// ENDPOINT C: Capabilities Check
app.post("/api/ai-provider/capabilities", async (req, res) => {
  try {
    const config = getRequestAIConfig(req.body);
    const provider = new AIProvider(config);
    return res.json(provider.getCapabilities());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ROUTE 1: Ingest owner journal entry and generate proposed compaction mutations
app.post("/api/compaction", async (req, res) => {
  try {
    const { state, journalEntry } = req.body;
    const config = getRequestAIConfig(req.body);
    const aiProvider = new AIProvider(config);

    if (!journalEntry || typeof journalEntry !== "string") {
      return res.status(400).json({ error: "journalEntry content is required." });
    }

    const graphState = typeof state === "object" ? state : JSON.parse(state || "{}");
    const activeNodes = graphState.activeNodes || [];
    const notes = graphState.notes || graphState.memories || [];
    const edges = graphState.edges || [];

    const promptMessage = `
You are the stream compaction engine for Doppelgänger (an AI native knowledge replication platform).
The owner is submitting a new daily work journal entry. Your task is to extract concepts, generate a proposed state, and provide reasonable change notes.

Current State of Knowledge Graph:
${JSON.stringify({ activeNodes, notes, edges }, null, 2)}

Owner's New Journal Entry:
"${journalEntry}"

Strict Compaction Constraints:
1. MAX 9 active nodes: You must keep total active nodes in the graph at <= 9. If the addition of new nodes exceeds 9, find older/less relevant active nodes and toggle their "node_state" to "archived". Also make sure they have a lower weight or archive flag.
2. Sensitivity Check: Under certain conditions, if the narrative implies a highly sensitive team project, toggle its "visibility_status" to "isolated_passphrase" and set first class fields: "isIsolated": true, "access_key_hash": "[generate visual pass phrase token here, like STEALTH-OMEGA, NEBULA, or COBALT-PROJECT]", "accessKeyHash": "[same string]".
Wait, generate a clear human-readable placeholder passcode string for the token (e.g. STEALTH-COBALT, CIPHER, SECRET-9) so that a visitor must supply this keyword to unlock the node.
3. Node weights should be scaled from 0.5 to 3.0 based on activity/frequency of mentions.
4. Extract new granular notes from the text and associate them with correct nodes. Set their "source_origin" to something like "Journal_Entry" or sequential naming.
5. Identify relation edges connecting these concepts. IMPORTANT HIERARCHICAL PATH CONSTRAINT: Nodes should strictly connect in a hierarchical sequence (1 > 2 > 3). There must never be a level 3 node (e.g., 1.11, 2.11, weight 1.0) connected directly to a level 1 node (e.g., 1.0, 2.0, weight 3.0). Level 3 nodes must only connect to Level 2 nodes (e.g., 1.1, 2.1, weight 2.0), and Level 2 nodes connect to Level 1 nodes. Direct connections between Level 3 and Level 1 are strictly forbidden.

Respond with valid JSON mapping the schema exactly.
`;

    let parsedCompaction: any;
    try {
      console.log(`[Doppelgänger Compaction] Processing narrative through active provider: ${config.provider}`);
      const schema = {
        type: Type.OBJECT,
        description: "Proposed mutations to the knowledge graph state",
        properties: {
          reasoning: {
            type: Type.STRING,
            description: "AI reasoning detailing how the journal was evaluated, the 9-node display limit handled, any sensitivity triggered, and overall changes."
          },
          cards: {
            type: Type.ARRAY,
            description: "List of Proposed Modification cards showing individual adjustments for user preview.",
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "Mutation type: 'ADD_NODE' | 'UPDATE_NODE' | 'ARCHIVE_NODE' | 'ADD_NOTE' | 'SECURE_GATE_TRIGGERED'" },
                title: { type: Type.STRING, description: "Compact card title (e.g., 'Extract Node: Quantum Ledger')" },
                description: { type: Type.STRING, description: "Human friendly description of the change and justification." }
              },
              required: ["type", "title", "description"]
            }
          },
          proposedState: {
            type: Type.OBJECT,
            description: "The complete proposed updated state object containing activeNodes, notes, and edges.",
            properties: {
              activeNodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    node_state: { type: Type.STRING, description: "'active' or 'archived'. Max 9 active nodes in the array." },
                    visibility_status: { type: Type.STRING, description: "'public' or 'isolated_passphrase'" },
                    access_key_hash: { type: Type.STRING, nullable: true },
                    accessKeyHash: { type: Type.STRING, nullable: true },
                    isIsolated: { type: Type.BOOLEAN },
                    weight: { type: Type.NUMBER }
                  },
                  required: ["id", "label", "summary", "node_state", "visibility_status", "weight", "isIsolated"]
                }
              },
              notes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    node_id: { type: Type.STRING },
                    content: { type: Type.STRING },
                    source_origin: { type: Type.STRING }
                  },
                  required: ["node_id", "content", "source_origin"]
                }
              },
              edges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    source: { type: Type.STRING },
                    target: { type: Type.STRING },
                    relation: { type: Type.STRING }
                  },
                  required: ["source", "target"]
                }
              }
            },
            required: ["activeNodes", "notes", "edges"]
          }
        },
        required: ["reasoning", "cards", "proposedState"]
      };

      const resultText = await aiProvider.generateResponse(promptMessage, {
        systemInstruction: "You are the taxonomy model builder double. Structure the compaction mutations correctly in requested format.",
        responseSchema: schema
      });

      parsedCompaction = JSON.parse(resultText.trim());
    } catch (apiError: any) {
      console.warn("Compaction active provider failed, running local compaction fallback:", apiError.message || apiError);
      
      const entryText = journalEntry;
      const lowerEntry = entryText.toLowerCase();

      // Fallback Engine Logic
      let nextActiveNodes = JSON.parse(JSON.stringify(activeNodes));
      let nextNotes = JSON.parse(JSON.stringify(notes));
      let nextEdges = JSON.parse(JSON.stringify(edges));

      const fallbackCards: any[] = [];
      let reasoning = "⚠️ [Notice: AI provider fallback active] Processed entry algorithmically.";

      let matchedNode: any = null;
      let highestCount = 0;
      for (const node of nextActiveNodes) {
        if (node.node_state === "active") {
          const lLower = node.label.toLowerCase();
          const occurrence = lowerEntry.split(lLower).length - 1;
          if (occurrence > highestCount) {
            highestCount = occurrence;
            matchedNode = node;
          }
        }
      }

      if (matchedNode && highestCount > 0) {
        matchedNode.weight = Math.min(3.0, (matchedNode.weight || 1.0) + 0.5);
        nextNotes.push({
          node_id: matchedNode.id,
          content: entryText,
          source_origin: "Journal_Entry"
        });
        fallbackCards.push({
          type: "ADD_NOTE",
          title: `Enriched node: ${matchedNode.label}`,
          description: `Extracted work log for ${matchedNode.label} and logged narrative to persistent records.`
        });
      } else {
        let extractedLabel = "System Sync";
        const matches = entryText.match(/\b[A-Z][a-zA-Z0-9]{2,15}(?:\s+[A-Z][a-zA-Z0-9]{1,15})*\b/g);
        if (matches && matches.length > 0) {
          const validCandidates = matches.filter(m => !["I", "The", "And", "Friday", "Monday", "Today", "Yesterday", "June", "July", "August"].includes(m));
          if (validCandidates.length > 0) extractedLabel = validCandidates[0];
        }

        const isSensitive = lowerEntry.includes("sensitive") || lowerEntry.includes("stealth") || lowerEntry.includes("private") || lowerEntry.includes("secret") || lowerEntry.includes("confidential");
        const passphrases = ["STEALTH-COBALT", "NEBULA-ZERO", "PROJECT-9", "CIPHER-OMEGA", "KRYPTON-KEY"];
        const pass = passphrases[Math.floor(Math.random() * passphrases.length)];

        const newId = `node-${Date.now()}`;
        const newNode = {
          id: newId,
          label: extractedLabel,
          summary: `Automatic logs captured for workflow: ${extractedLabel}`,
          node_state: "active",
          visibility_status: isSensitive ? "isolated_passphrase" : "public",
          access_key_hash: isSensitive ? pass : null,
          accessKeyHash: isSensitive ? pass : null,
          isIsolated: isSensitive,
          weight: 1.0
        };

        nextActiveNodes.push(newNode);
        nextNotes.push({
          node_id: newId,
          content: entryText,
          source_origin: "Journal_Entry"
        });

        fallbackCards.push({
          type: "ADD_NODE",
          title: `Ingest concept: ${extractedLabel}`,
          description: `Extracted ${extractedLabel} as a new workflow node with weight 1.0.`
        });

        if (isSensitive) {
          fallbackCards.push({
            type: "SECURE_GATE_TRIGGERED",
            title: `Secure Passphrase Generated`,
            description: `Sensitivity trigger detected. Isolated node with passcode key "${pass}".`
          });
          reasoning += ` Isolated node passcode "${pass}".`;
        }

        const subParent = nextActiveNodes.find((n: any) => n.node_state === "active" && n.weight === 2.0) || 
                          nextActiveNodes.find((n: any) => n.node_state === "active" && n.weight === 3.0);
        if (subParent) {
          nextEdges.push({
            source: subParent.id,
            target: newId,
            relation: "pertains_to"
          });
        }
      }

      // Enforce 9 active nodes constraint
      const activeNodesCount = nextActiveNodes.filter((n: any) => n.node_state === "active").length;
      if (activeNodesCount > 9) {
        const excess = activeNodesCount - 9;
        let candidates = nextActiveNodes.filter((n: any) => n.node_state === "active" && n.weight !== 3.0);
        candidates.sort((a: any, b: any) => (a.weight || 1) - (b.weight || 1));

        for (let idx = 0; idx < Math.min(excess, candidates.length); idx++) {
          const targetToArchive = candidates[idx];
          const actualNode = nextActiveNodes.find((n: any) => n.id === targetToArchive.id);
          if (actualNode) {
            actualNode.node_state = "archived";
            fallbackCards.push({
              type: "ARCHIVE_NODE",
              title: `Archive node: ${actualNode.label}`,
              description: `Enforced structural scale limits. Selected lower weight concept for archival.`
            });
          }
        }
      }

      parsedCompaction = {
        reasoning,
        cards: fallbackCards,
        proposedState: {
          activeNodes: nextActiveNodes,
          notes: nextNotes,
          edges: nextEdges
        }
      };
    }

    // HIGH INDEPENDENT RETRIEVAL ACCELERATION: Pre-compute vector embeddings for newly added memories
    const nextNotesList = parsedCompaction.proposedState?.notes || [];
    console.log(`[Neural Integration] Background indexing of ${nextNotesList.length} memory text segments.`);
    for (const note of nextNotesList) {
      if (!note.embedding) {
        try {
          note.embedding = await aiProvider.generateEmbedding(note.content);
        } catch (embedErr: any) {
          console.warn("[Neural Integration] Could not pre-compute memory embedding:", embedErr.message);
        }
      }
    }

    res.json(parsedCompaction);
  } catch (error: any) {
    console.error("Compaction API error:", error);
    res.status(500).json({ error: error.message || "An error occurred during compaction processing" });
  }
});

// ROUTE 2: Grounded retrieval search and chat answering (with Real Hybrid Vector retrieves)
app.post("/api/visitor-query", async (req, res) => {
  try {
    const { state, query, unlockedTokens, history } = req.body;
    const config = getRequestAIConfig(req.body);
    const aiProvider = new AIProvider(config);

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required." });
    }

    // Dedicated Topic Title Generator layer
    let topicTitle = "";
    try {
      const titlePrompt = `Feature: Discussion Topic Title Normalization

All AI-generated DISCUSSION TOPIC titles must be rewritten into clean, human-readable phrases.

⸻

Input

The system receives a raw user question, for example:

* “What is @jordan.lee working on?”
* “Show me what Chris Adkins is doing”
* “Tasks for Mobile App Redesign”
* “Who owns design sprints planning?”

⸻

Required Output Behavior

The DISCUSSION TOPIC must be:

* Grammatically correct
* Human-readable
* Properly spaced (e.g., “Jordan Lee”, not “JORDANLEE”)
* Natural language phrasing
* Concise (3–8 words preferred)
* Not a direct copy of the user query
* Not uppercase transformation of input
* Not syntactically broken fragments

⸻

Normalization Rules

1. Name formatting

Convert handles to proper names:

* @jordan.lee → Jordan Lee
* @chris.adkins → Chris Adkins

⸻

2. Rewrite intent, not syntax

Do not echo the question.

Instead, convert intent into a title.

Examples:

Input:
“What is @jordan.lee working on?”

Output:

* Jordan Lee’s Current Work
* Jordan Lee’s Active Tasks
* Jordan Lee’s Workload

⸻

Input:
“Show me Mobile App Redesign updates”

Output:

* Mobile App Redesign Updates
* Mobile App Redesign Progress
* Current Status of Mobile App Redesign

⸻

Input:
“Who owns design sprints planning?”

Output:

* Ownership of Design Sprints Planning
* Design Sprints Planning Ownership
* Design Sprints Planning Contributors

⸻

Formatting Rules

* Use Title Case OR natural sentence-style title casing
* Never output ALL CAPS
* Never output raw queries
* Never output unprocessed tokens or usernames

⸻

Disallowed Outputs

❌ IS JORDANLEE WORKING
❌ WHAT IS @JORDAN.LEE WORKING ON
❌ JORDANLEE WORKING
❌ WHATJORDANLEEWORKINGON

⸻

Output Requirement

Return ONLY the cleaned topic title.

No explanations.

No metadata.

No duplication of the input query.

⸻

Success Criteria

* Titles read like human discussion headers
* Names are properly spaced and formatted
* Output is always grammatically correct
* Output is never a transformed raw query

⸻

User Input Query to Normalize:
"${query}"`;

      const titleResponse = await aiProvider.generateResponse(titlePrompt, {
        systemInstruction: "You are a Topic Title Normalizer. Return ONLY the cleaned discussion topic title phrase. No explanations, no markdown lists, no wrapping quotes, and no metadata.",
      });
      topicTitle = titleResponse.trim().replace(/^["'\*•\s]+|["'\*•\s]+$/g, "");
    } catch (titleErr) {
      console.warn("Failed to generate normalized topic title:", titleErr);
    }

    const graphState = typeof state === "object" ? state : JSON.parse(state || "{}");
    const activeNodes = graphState.activeNodes || [];
    const notes = graphState.notes || graphState.memories || [];
    const edges = graphState.edges || [];
    
    const tokens = Array.isArray(unlockedTokens) ? unlockedTokens.map(t => String(t).toUpperCase().trim()) : [];

    const accessibleNodes = activeNodes.filter((node: any) => {
      const isIsolated = node.isIsolated === true || node.visibility_status === "isolated_passphrase";
      if (!isIsolated) return true;
      const keyHash = (node.access_key_hash || node.accessKeyHash || "").toUpperCase().trim();
      return tokens.includes(keyHash);
    });

    const qLower = query.toLowerCase();
    
    // Parse target handles (@) and tags (#)
    const targetHandles: string[] = [];
    const handleMatches = query.match(/@[a-zA-Z0-9_\.]+/g) || [];
    handleMatches.forEach((m: string) => {
      const h = m.toLowerCase();
      if (h.includes("chris")) {
        targetHandles.push("@chris.adkins");
      } else if (h.includes("jordan")) {
        targetHandles.push("@jordan.lee");
      } else if (h.includes("alex")) {
        targetHandles.push("@alex.morgan");
      } else {
        targetHandles.push(h);
      }
    });

    if (targetHandles.length === 0) {
      if (qLower.includes("jordan")) {
        targetHandles.push("@jordan.lee");
      }
      if (qLower.includes("chris")) {
        targetHandles.push("@chris.adkins");
      }
      if (qLower.includes("alex")) {
        targetHandles.push("@alex.morgan");
      }
    }

    const tagMatches = query.match(/#[a-zA-Z0-9_\-]+/g) || [];
    const targetTags = tagMatches.map((m: string) => m.slice(1).toLowerCase().trim());

    let filteredAccessibleNodes = accessibleNodes;
    if (targetHandles.length > 0) {
      filteredAccessibleNodes = accessibleNodes.filter((n: any) => 
        n.doppelgangerHandle && targetHandles.includes(n.doppelgangerHandle.toLowerCase())
      );
    }

    // Match project-specific queries to restrict to project nodes (Level 1, 2, 3 nodes belonging to that project)
    let targetProjectNodes: string[] | null = null;
    if (qLower.includes("mobile") || qLower.includes("redesign")) {
      targetProjectNodes = ["node-1.0", "node-1.2", "node-1.3", "shared-alex-sync"];
    } else if (qLower.includes("kinetic") || qLower.includes("type") || qLower.includes("motion")) {
      targetProjectNodes = ["node-2.0", "node-2.1"];
    } else if (qLower.includes("design sprint") || qLower.includes("sprints planning") || qLower.includes("sprint planning")) {
      targetProjectNodes = ["node-3.0", "node-j10", "node-j11"];
    } else if (qLower.includes("branding")) {
      targetProjectNodes = ["node-4.0", "node-j20"];
    } else if (qLower.includes("platform developer") || qLower.includes("developer experience") || qLower.includes("cached layers")) {
      targetProjectNodes = ["node-a10", "node-a11", "node-a12"];
    } else if (qLower.includes("graphql") || qLower.includes("stitching") || qLower.includes("federated")) {
      targetProjectNodes = ["node-a20", "node-a21"];
    } else if (qLower.includes("aegis")) {
      targetProjectNodes = ["node-j30"];
    } else if (qLower.includes("cobalt")) {
      targetProjectNodes = ["node-a30"];
    }

    if (targetProjectNodes) {
      filteredAccessibleNodes = filteredAccessibleNodes.filter((node: any) =>
        targetProjectNodes!.includes(node.id)
      );
    }

    const postProcessResponse = (q: string, parsedObj: any) => {
      if (!parsedObj) return parsedObj;
      if (parsedObj.referenced_nodes) {
        const allowedNodeIds = new Set(filteredAccessibleNodes.map((n: any) => n.id));
        parsedObj.referenced_nodes = parsedObj.referenced_nodes.filter((id: string) => allowedNodeIds.has(id));
        const ql = q.toLowerCase();
        if ((ql.includes("mobile") || ql.includes("redesign")) && allowedNodeIds.has("shared-alex-sync")) {
          if (!parsedObj.referenced_nodes.includes("shared-alex-sync")) {
            parsedObj.referenced_nodes.push("shared-alex-sync");
          }
        }
      }
      if (parsedObj.response_text) {
        // Enforce Node Level Language Rules
        parsedObj.response_text = parsedObj.response_text
          .replace(/\bparent project\b/gi, 'Top-level Project')
          .replace(/\bchild project\b/gi, 'Workstream')
          .replace(/\bgrandchild project\b/gi, 'Task')
          .replace(/\bparent projects\b/gi, 'Top-level Projects')
          .replace(/\bchild projects\b/gi, 'Workstreams')
          .replace(/\bgrandchild projects\b/gi, 'Tasks')
          .replace(/\bparent\b/gi, 'Top-level Project')
          .replace(/\bchild\b/gi, 'Workstream')
          .replace(/\bgrandchild\b/gi, 'Task')
          .replace(/\bchildren\b/gi, 'Workstreams')
          .replace(/\bgrandchildren\b/gi, 'Tasks')
          .replace(/\bLevel 1\b/gi, 'Top-level Project')
          .replace(/\bLevel 2\b/gi, 'Workstream')
          .replace(/\bLevel 3\b/gi, 'Task');

        filteredAccessibleNodes.forEach((node: any) => {
          const nodeId = node.id;
          const nodeLabel = node.label;
          const escapedId = nodeId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedId}\\b`, 'gi');
          parsedObj.response_text = parsedObj.response_text.replace(regex, `"${nodeLabel}"`);
        });
      }
      return parsedObj;
    };

    const accessibleNodeIds = new Set(filteredAccessibleNodes.map((n: any) => n.id));

    // Filter notes belonging only to accessible active nodes
    const baseNotes = notes.filter((mem: any) => {
      return accessibleNodeIds.has(mem.node_id);
    });

    // Extract inline notes and summaries from the accessible activeNodes themselves
    const nodeInlineNotes = filteredAccessibleNodes
      .map((n: any) => {
        const parts = [];
        if (n.summary && typeof n.summary === "string" && n.summary.trim().length > 0) {
          parts.push(n.summary.trim());
        }
        if (n.notes && typeof n.notes === "string" && n.notes.trim().length > 0) {
          parts.push(n.notes.trim());
        }
        if (parts.length === 0) return null;
        return {
          node_id: n.id,
          content: parts.join("\n"),
          source_origin: "Node_Definition"
        };
      })
      .filter(Boolean);

    // Merge baseNotes and nodeInlineNotes, avoiding duplicate content for the same node_id
    const accessibleNotes = [...baseNotes];
    nodeInlineNotes.forEach((inlineNote: any) => {
      const exists = accessibleNotes.some(
        (m: any) => m.node_id === inlineNote.node_id && m.content.toLowerCase().trim() === inlineNote.content.toLowerCase().trim()
      );
      if (!exists) {
        accessibleNotes.push(inlineNote);
      }
    });

    // Semantic Vector Query retrieval helper execution
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await aiProvider.generateEmbedding(query);
    } catch (e: any) {
      console.warn("[Neural Retrieval] Failed query embedding mapping:", e.message);
    }

    // Lazy load node content embeddings for memories dynamically if missing
    for (const note of accessibleNotes) {
      if (!note.embedding) {
        try {
          note.embedding = await aiProvider.generateEmbedding(note.content);
        } catch (embedErr: any) {
          console.warn("[Neural Retrieval] Memory embedding lazy load missed:", embedErr.message);
        }
      }
    }

    // Scoring via Hybrid (Cosine Vector Similarity + Keyword Boosts)
    const keywordBaseline = performKeywordSweep(accessibleNotes, query, accessibleNodes, accessibleNotes.length);
    const keywordNodeIds = new Set(keywordBaseline.map((m: any) => m.content));

    const scoredNotes = accessibleNotes.map((note: any) => {
      let score = 0;
      // Cosine distance score (0 to 1)
      if (queryEmbedding && note.embedding) {
        score += cosineSimilarity(queryEmbedding, note.embedding) * 0.75;
      }
      // Direct keyword presence boost
      if (keywordNodeIds.has(note.content)) {
        score += 0.25;
      }
      // Explicit tag matching boost
      if (targetTags && targetTags.length > 0) {
        const associatedNode = accessibleNodes.find((n: any) => n.id === note.node_id);
        if (associatedNode && associatedNode.tags) {
          const nodeTags = associatedNode.tags.split(",").map((t: string) => t.trim().toLowerCase());
          const hasMatchingTag = targetTags.some((tag: string) => nodeTags.includes(tag));
          if (hasMatchingTag) {
            score += 2.0; // Substantial boost to pull matching tagged notes to the top
          }
        }
      }
      return { note, score };
    });

    // Sort by descending final scores
    scoredNotes.sort((a, b) => b.score - a.score);
    const limit = (query.toLowerCase().includes("design sprints planning") && query.toLowerCase().includes("all")) ? 12 : 8;
    const topNotes = scoredNotes.slice(0, limit).map(item => item.note);

    // AI grounded prompt
    const groundingContext = topNotes.map((m: any, idx: number) => `[Block #${idx+1} - Node: ${m.node_id}] ${m.content}`).join("\n");

    const historyContext = Array.isArray(history) && history.length > 0
      ? "\nPrevious Conversation History:\n" + history.map((h: any) => `User: ${h.question}\nAssistant: ${h.answer}`).join("\n\n") + "\n"
      : "";

    const promptMessage = `
You are the interactive replication double (the Doppelgänger) of the developer brain.
You must answer the visitor's query based strictly and exclusively on the allowed grounded memory notes below.

Node Language Enforcement (Hard Constraint)
The AI must NOT use structural hierarchy terminology under any circumstance.

Forbidden Words (absolute ban)
The following words are strictly disallowed in all outputs:
* parent
* child
* grandchild
* hierarchy
* level (when referring to node structure)

If any appear in a draft response, it must be discarded and regenerated.

Required Substitution Rules
When describing node structure:
* Replace “parent project” → Top-level Project
* Replace “child project” → Workstream
* Replace “grandchild project” → Task

Output Constraint
* NEVER describe nodes using structural relationships
* NEVER refer to graph position or hierarchy
* ONLY describe nodes using functional labels when necessary
* Prefer omitting structural description entirely unless required for clarity

Rewrite Requirement
Any sentence containing forbidden terms must be rewritten before output.
Example correction:
❌ “top-level parent project”
✔ “Top-level Project focused on…”

Enforcement Rule
This is a blocking rule, not a suggestion.
If compliance cannot be achieved, regenerate output without structural terminology.

Parsed Scope:
- Target Doppelgängers: ${targetHandles.length > 0 ? targetHandles.join(", ") : "All accessible"}
- Target Tags: ${targetTags.length > 0 ? targetTags.join(", ") : "None"}

Allowed Grounded Notes:
${groundingContext.length > 0 ? groundingContext : "(No matching notes found or unlocked. Suggest checking project keys or asking broad philosophy questions.)"}

Accessible Core Concepts:
${JSON.stringify(filteredAccessibleNodes.map((n: any) => ({ id: n.id, label: n.label, summary: n.summary })), null, 2)}

${historyContext}
Visitor Query:
"${query}"

Instructions:
1. Synthesize a grounded, helpful, objective, and clear response to the visitor's query based on the allowed memory notes. Do NOT include phrases like "From my perspective...", "From Jordan Lee's perspective: ...", "From Chris Adkins's perspective: ...", or any other first-person or third-person prefix headers. The user interface already displays the list of doppelgängers whose notes were used to generate this answer, so do not repeat that attribution inside the text of your answer.
2. Write a normal, cohesive, natural, easy-to-read response (cohesive paragraphs). Do NOT use bullet points, list items, prefix headers (e.g., "Here is what I have reconstructed..."), or tag block labels (e.g., do NOT start sections with "⚡ **[From node-xyz]**" or similar prefixes). Simply integrate the knowledge smoothly into natural, objective paragraphs.
3. Do NOT include follow-up offers or transition queries at the end (e.g., do NOT include "If you have additional specific questions about this topic, please let me know..." or "Feel free to ask more..."). The interface already has form inputs and affordance for follow-up questions.
4. Refer only to information explicit in the allowed memories. Do not invent details.
5. Identify which active node IDs from the allowed context were referenced in generating the answer.
6. STRICT CONTEXT CLEANSING: Only reference node IDs if they are directly relevant to the specific project being queried. If the query is specifically about one project (e.g., "Kinetic Type Prototype" or "node-2" prefix), do NOT include unrelated project node IDs (e.g., "Mobile App Redesign" or "node-1" prefix nodes) in the "referenced_nodes" array, even if they share some generic word like "timeline", "study", or "procurement". Doing so will cause other projects to visually bleed into this query's session.
7. Determine "routing_trigger": a boolean triggering true if the query matches a topic owned by another user's brain entirely (e.g. if the visitor asks for something completely outside of these concepts or projects, or mentions names of external entities/libraries we don't know about).

Respond with valid JSON mapping the schema:
{
  "response_text": "Grounding contextual text answer...",
  "referenced_nodes": ["node-id-1", "node-id-2"],
  "routing_trigger": false
}
`;

    // Supporting both streaming and full JSON payload depending on client intent
    const streamMode = req.headers["accept"] === "text/event-stream" || req.body.stream === true;

    if (streamMode) {
      let parsed: any;
      try {
        console.log(`[Doppelgänger Retrieval] Streaming response via active provider: ${config.provider}`);
        const textResponse = await aiProvider.generateResponse(promptMessage, {
          systemInstruction: "You are the synthesized human replication double brain. Answer query objectively in requested JSON schema. Node Language Enforcement (Hard Constraint): You must NOT use structural hierarchy terminology under any circumstance. Forbidden Words (absolute ban): parent, child, grandchild, hierarchy, level (when referring to node structure). Required Substitution Rules: parent project -> Top-level Project, child project -> Workstream, grandchild project -> Task.",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              response_text: { type: Type.STRING },
              referenced_nodes: { type: Type.ARRAY, items: { type: Type.STRING } },
              routing_trigger: { type: Type.BOOLEAN }
            },
            required: ["response_text", "referenced_nodes", "routing_trigger"]
          }
        });

        parsed = JSON.parse(textResponse.trim());
      } catch (apiError: any) {
        console.warn("Visitor query stream API failed, fallback to local answer:", apiError.message || apiError);
        
        const qLower = query.toLowerCase();
        const refNodesSet = new Set<string>();
        topNotes.forEach((m: any) => refNodesSet.add(m.node_id));
        
        accessibleNodes.forEach((n: any) => {
          if (qLower.includes(n.label.toLowerCase())) {
            refNodesSet.add(n.id);
          }
        });

        const referenced_nodes = Array.from(refNodesSet);
        let response_text = "";
        
        if (topNotes.length > 0) {
          response_text = "⚠️ [Offline Mode: Showing matching journal records]\n\n" + topNotes.map((m: any) => m.content).join("\n\n");
        } else {
          response_text = `I searched my active records for "${query}", but I couldn't locate any matching memories. If this project is isolated, please supply the corresponding access passcode to unlock further neural components.`;
        }

        const matchedLabel = accessibleNodes.some((n: any) => qLower.includes(n.label.toLowerCase()));
        const routing_trigger = !matchedLabel && topNotes.length === 0 && query.trim().split(" ").length > 2;

        parsed = {
          response_text,
          referenced_nodes,
          routing_trigger
        };
      }

      parsed = postProcessResponse(query, parsed);

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send metadata immediately
      res.write(`data: ${JSON.stringify({ 
        referenced_nodes: parsed.referenced_nodes || [], 
        routing_trigger: parsed.routing_trigger || false,
        topic_title: topicTitle
      })}\n\n`);

      // Stream response_text words
      const words = (parsed.response_text || "").split(" ");
      let currentIdx = 0;
      
      const interval = setInterval(() => {
        if (currentIdx < words.length) {
          const chunk = words.slice(currentIdx, currentIdx + 3).join(" ") + " ";
          res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
          currentIdx += 3;
        } else {
          clearInterval(interval);
          res.write("event: end\ndata: [DONE]\n\n");
          res.end();
        }
      }, 50);

    } else {
      let parsed: any;
      try {
        console.log(`[Doppelgänger Retrieval] Fetching full response via active provider: ${config.provider}`);
        const textResponse = await aiProvider.generateResponse(promptMessage, {
          systemInstruction: "You are the synthesized human replication double brain. Answer query objectively in requested JSON schema. Node Language Enforcement (Hard Constraint): You must NOT use structural hierarchy terminology under any circumstance. Forbidden Words (absolute ban): parent, child, grandchild, hierarchy, level (when referring to node structure). Required Substitution Rules: parent project -> Top-level Project, child project -> Workstream, grandchild project -> Task.",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              response_text: { type: Type.STRING },
              referenced_nodes: { type: Type.ARRAY, items: { type: Type.STRING } },
              routing_trigger: { type: Type.BOOLEAN }
            },
            required: ["response_text", "referenced_nodes", "routing_trigger"]
          }
        });

        parsed = JSON.parse(textResponse.trim());
      } catch (apiError: any) {
        console.warn("Visitor query full API execution failed, fallback directly:", apiError.message || apiError);
        
        const qLower = query.toLowerCase();
        const refNodesSet = new Set<string>();
        topNotes.forEach((m: any) => refNodesSet.add(m.node_id));
        
        accessibleNodes.forEach((n: any) => {
          if (qLower.includes(n.label.toLowerCase())) {
            refNodesSet.add(n.id);
          }
        });

        const referenced_nodes = Array.from(refNodesSet);
        let response_text = "";
        
        if (topNotes.length > 0) {
          response_text = "⚠️ [Offline Mode: Showing matching journal records]\n\n" + topNotes.map((m: any) => m.content).join("\n\n");
        } else {
          response_text = `I searched my active records for "${query}", but I couldn't locate any matching memories. If this project is isolated, please supply the corresponding access passcode to unlock further neural components.`;
        }

        const matchedLabel = accessibleNodes.some((n: any) => qLower.includes(n.label.toLowerCase()));
        const routing_trigger = !matchedLabel && topNotes.length === 0;

        parsed = {
          response_text,
          referenced_nodes,
          routing_trigger
        };
      }

      parsed = postProcessResponse(query, parsed);
      parsed.topic_title = topicTitle;

      res.json(parsed);
    }
  } catch (error: any) {
    console.error("Query API error:", error);
    res.status(500).json({ error: error.message || "An error occurred during query processing" });
  }
});

// Configure Vite or Static server
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite dev server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets from /dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Doppelgänger Engine] Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
