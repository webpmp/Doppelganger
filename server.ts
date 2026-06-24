import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { AIProvider, AIConfig, STANDARD_GEMINI_MODELS, getDeterministicMockEmbedding } from "./aiProvider.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      console.log("[Compaction API] Client disconnected. Aborting active AI request.");
      controller.abort();
    }
  });

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

    const notesForAI = notes.map((m: any) => ({
      node_id: m.node_id || m.nodeId,
      source_origin: m.source_origin,
      content: "[Detail text omitted for token optimization]"
    }));

    const schema = {
      type: Type.OBJECT,
      description: "Proposed mutations to the knowledge graph state",
      properties: {
        reasoning: {
          type: Type.STRING,
          description: "Extremely brief 1-2 sentence explanation of changes. Do not write a long paragraph."
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
        mutations: {
          type: Type.OBJECT,
          description: "Delta changes to apply to the knowledge graph. Do not replicate the original unchanged nodes or notes.",
          properties: {
            addedNodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  label: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  node_state: { type: Type.STRING, description: "'active' or 'archived'." },
                  visibility_status: { type: Type.STRING },
                  access_key_hash: { type: Type.STRING, nullable: true },
                  accessKeyHash: { type: Type.STRING, nullable: true },
                  isIsolated: { type: Type.BOOLEAN },
                  weight: { type: Type.NUMBER }
                },
                required: ["id", "label", "summary", "node_state", "visibility_status", "weight", "isIsolated"]
              }
            },
            updatedNodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  summary: { type: Type.STRING, nullable: true },
                  node_state: { type: Type.STRING, nullable: true },
                  visibility_status: { type: Type.STRING, nullable: true },
                  weight: { type: Type.NUMBER, nullable: true }
                },
                required: ["id"]
              }
            },
            archivedNodeIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            addedNotes: {
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
            addedEdges: {
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
          }
        }
      },
      required: ["reasoning", "cards", "mutations"]
    };

    const promptMessage = `
You are the stream compaction engine for Doppelganger (an AI native knowledge replication platform).
The owner is submitting a new daily work journal entry. Your task is to extract concepts, generate a proposed state, and provide reasonable change notes.

Current State of Knowledge Graph:
${JSON.stringify({ activeNodes, notes: notesForAI, edges }, null, 2)}

Owner's New Journal Entry:
"${journalEntry}"

Strict Compaction Constraints:
1. MAX 250 active nodes: You must keep total active nodes in the graph at <= 250. If the addition of new nodes exceeds 250, find older/less relevant active nodes and toggle their "node_state" to "archived". Also make sure they have a lower weight or archive flag.
2. Sensitivity Check: Under certain conditions, if the narrative implies a highly sensitive team project, toggle its "visibility_status" to "isolated_passphrase" and set first class fields: "isIsolated": true, "access_key_hash": "[generate visual pass phrase token here, like STEALTH-OMEGA, NEBULA, or COBALT-PROJECT]", "accessKeyHash": "[same string]".
Wait, generate a clear human-readable placeholder passcode string for the token (e.g. STEALTH-COBALT, CIPHER, SECRET-9) so that a visitor must supply this keyword to unlock the node.
3. Node weights should be scaled from 0.5 to 3.0 based on activity/frequency of mentions.
4. Extract new granular notes from the text and associate them with correct nodes. Set their "source_origin" to something like "Journal_Entry" or sequential naming.
5. Identify relation edges connecting these concepts. IMPORTANT HIERARCHICAL PATH CONSTRAINT: Nodes should strictly connect in a hierarchical sequence (1 > 2 > 3). There must never be a level 3 node (e.g., 1.11, 2.11, weight 1.0) connected directly to a level 1 node (e.g., 1.0, 2.0, weight 3.0). Level 3 nodes must only connect to Level 2 nodes (e.g., 1.1, 2.1, weight 2.0), and Level 2 nodes connect to Level 1 nodes. Direct connections between Level 3 and Level 1 are strictly forbidden.
6. Never refer to projects, workstreams, tasks, or notes as "nodes" or "bubbles" in user-facing card titles, descriptions, or reasoning. Use clean terminology: e.g., "Project" (or "Workstream" / "Task") or "Note" / "Notes".

Respond with valid JSON mapping the schema exactly.
Expected JSON Schema format:
${JSON.stringify(schema, null, 2)}
`;

    let parsedCompaction: any;
    try {
      console.log(`[Doppelganger Compaction] Processing narrative through active provider: ${config.provider}`);
      const resultText = await aiProvider.generateResponse(promptMessage, {
        systemInstruction: "You are the taxonomy model builder double. Analyze the entry and output ONLY the mutations/changes required to modify the graph under the 'mutations' field. Keep the 'reasoning' field in your JSON response extremely brief (1-2 sentences maximum). Do not copy or replicate the unchanged parts of the graph.",
        responseSchema: schema,
        signal: controller.signal
      });

      let cleanedText = resultText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "");
        cleanedText = cleanedText.replace(/\s*```$/, "");
      }
      parsedCompaction = JSON.parse(cleanedText.trim());

      // Merge mutations to build the complete proposedState on the server programmatically
      let nextActiveNodes = JSON.parse(JSON.stringify(activeNodes));
      let nextNotes = JSON.parse(JSON.stringify(notes));
      let nextEdges = JSON.parse(JSON.stringify(edges));

      const muts = parsedCompaction.mutations || {};

      // 1. Process added nodes
      if (Array.isArray(muts.addedNodes)) {
        muts.addedNodes.forEach((an: any) => {
          if (!nextActiveNodes.some((n: any) => n.id === an.id)) {
            nextActiveNodes.push(an);
          }
        });
      }

      // 2. Process updated nodes
      if (Array.isArray(muts.updatedNodes)) {
        muts.updatedNodes.forEach((un: any) => {
          const idx = nextActiveNodes.findIndex((n: any) => n.id === un.id);
          if (idx !== -1) {
            nextActiveNodes[idx] = {
              ...nextActiveNodes[idx],
              ...un
            };
          }
        });
      }

      // 3. Process archivedNodeIds
      if (Array.isArray(muts.archivedNodeIds)) {
        muts.archivedNodeIds.forEach((id: string) => {
          const idx = nextActiveNodes.findIndex((n: any) => n.id === id);
          if (idx !== -1) {
            nextActiveNodes[idx].node_state = "archived";
          }
        });
      }

      // 4. Process added notes
      if (Array.isArray(muts.addedNotes)) {
        muts.addedNotes.forEach((an: any) => {
          nextNotes.push(an);
        });
      }

      // 5. Process added edges
      if (Array.isArray(muts.addedEdges)) {
        muts.addedEdges.forEach((ae: any) => {
          if (!nextEdges.some((e: any) => e.source === ae.source && e.target === ae.target)) {
            nextEdges.push(ae);
          }
        });
      }

      parsedCompaction.proposedState = {
        activeNodes: nextActiveNodes,
        notes: nextNotes,
        edges: nextEdges
      };
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

      // Parse structured fields if input was compiled from fields
      let parsedTitle = "";
      let parsedSummary = "";
      let parsedDate = "";
      let parsedNotes = "";

      const titleMatch = entryText.match(/^Title:\s*(.+)$/m);
      const summaryMatch = entryText.match(/^Summary:\s*(.+)$/m);
      const dateMatch = entryText.match(/^Date:\s*(.+)$/m);
      const notesMatch = entryText.match(/^Notes:\s*([\s\S]+)$/m);

      if (titleMatch) parsedTitle = titleMatch[1].trim();
      if (summaryMatch) parsedSummary = summaryMatch[1].trim();
      if (dateMatch) {
        parsedDate = dateMatch[1].trim();
      } else {
        parsedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      if (notesMatch) parsedNotes = notesMatch[1].trim();

      const isStructured = !!(parsedTitle || parsedSummary || parsedNotes);

      if (isStructured && parsedTitle) {
        // Look for existing active node matching parsedTitle case-insensitively
        let matchedNode = nextActiveNodes.find((n: any) => n.node_state === "active" && n.label.toLowerCase() === parsedTitle.toLowerCase());
        
        const isSensitive = lowerEntry.includes("sensitive") || lowerEntry.includes("stealth") || lowerEntry.includes("private") || lowerEntry.includes("secret") || lowerEntry.includes("confidential");
        const passphrases = ["STEALTH-COBALT", "NEBULA-ZERO", "PROJECT-9", "CIPHER-OMEGA", "KRYPTON-KEY"];
        const pass = passphrases[Math.floor(Math.random() * passphrases.length)];

        if (matchedNode) {
          matchedNode.weight = Math.min(3.0, (matchedNode.weight || 1.0) + 0.5);
          if (parsedSummary) {
            matchedNode.summary = parsedSummary;
          }
          if (isSensitive) {
            matchedNode.visibility_status = "isolated_passphrase";
            matchedNode.access_key_hash = pass;
            matchedNode.accessKeyHash = pass;
            matchedNode.isIsolated = true;
          }

          nextNotes.push({
            node_id: matchedNode.id,
            content: parsedNotes || entryText,
            source_origin: parsedDate || "Journal_Entry"
          });

          fallbackCards.push({
            type: "UPDATE_NODE",
            title: `Update Project: ${matchedNode.label}`,
            description: `Updated summary and appended new journal notes to project "${matchedNode.label}".`
          });

          if (isSensitive) {
            fallbackCards.push({
              type: "SECURE_GATE_TRIGGERED",
              title: `Secure Passphrase Generated`,
              description: `Sensitivity trigger detected. Isolated node with passcode key "${pass}".`
            });
            reasoning += ` Isolated node passcode "${pass}".`;
          }
        } else {
          // Create a new node
          const newId = `node-${Date.now()}`;
          const newNode = {
            id: newId,
            label: parsedTitle,
            summary: parsedSummary || `Automatic logs captured for workflow: ${parsedTitle}`,
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
            content: parsedNotes || entryText,
            source_origin: parsedDate || "Journal_Entry"
          });

          fallbackCards.push({
            type: "ADD_NODE",
            title: `Add Project: ${parsedTitle}`,
            description: `Created new project node "${parsedTitle}" with summary: "${parsedSummary || "None provided"}".`
          });

          if (isSensitive) {
            fallbackCards.push({
              type: "SECURE_GATE_TRIGGERED",
              title: `Secure Passphrase Generated`,
              description: `Sensitivity trigger detected. Isolated node with passcode key "${pass}".`
            });
            reasoning += ` Isolated node passcode "${pass}".`;
          }

          // Link to parent/ancestor workstream node if we have one
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
      } else {
        // Standard text extraction fallback
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
            title: `Enriched project: ${matchedNode.label}`,
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
      }

      // Enforce 250 active nodes constraint
      const activeNodesCount = nextActiveNodes.filter((n: any) => n.node_state === "active").length;
      if (activeNodesCount > 250) {
        const excess = activeNodesCount - 250;
        let candidates = nextActiveNodes.filter((n: any) => n.node_state === "active" && n.weight !== 3.0);
        candidates.sort((a: any, b: any) => (a.weight || 1) - (b.weight || 1));

        for (let idx = 0; idx < Math.min(excess, candidates.length); idx++) {
          const targetToArchive = candidates[idx];
          const actualNode = nextActiveNodes.find((n: any) => n.id === targetToArchive.id);
          if (actualNode) {
            actualNode.node_state = "archived";
            fallbackCards.push({
              type: "ARCHIVE_NODE",
              title: `Archive Project: ${actualNode.label}`,
              description: `Enforced 250 active projects limit. Moved lower-priority project "${actualNode.label}" to history.`
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
    const currentDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    nextNotesList.forEach((note: any) => {
      if (!note.source_origin || note.source_origin === "Journal_Entry" || note.source_origin === "Journal_v1") {
        note.source_origin = currentDateStr;
      }
    });

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
    const { state, query, unlockedTokens, history, parentTopicTitle } = req.body;
    const config = getRequestAIConfig(req.body);
    const aiProvider = new AIProvider(config);

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required." });
    }

    const streamMode = req.headers["accept"] === "text/event-stream" || req.body.stream === true;
    if (streamMode) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      res.write(`data: ${JSON.stringify({ type: "progress", percent: 5, phase: "Initializing query" })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "progress", percent: 15, phase: "Resolving topic" })}\n\n`);
    }

    // Dedicated Topic Title Generator layer
    let topicTitle = "";
    try {
      let titlePrompt = "";
      if (parentTopicTitle && String(parentTopicTitle).trim().length > 0) {
        const sanitizedParentTopic = String(parentTopicTitle)
          .replace(/\b(Notes|Note|Node|Internal|Dataset|Labels)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        titlePrompt = `Feature: Context-Aware Follow-Up Discussion Topic Title Normalization

Generate a context-aware title that combines the active discussion topic context with the user's follow-up question intent.

Active Discussion Topic: "${sanitizedParentTopic}"
User's Follow-up Question: "${query}"

Guidelines:
1. Core Rule: Follow-up question titles must reference the active discussion topic, not the specific note name being queried.
2. Title Context Priority: Always prefer broader topic-level clarity (e.g., "${sanitizedParentTopic}") over specific note-level naming (e.g., do NOT use "Team Resourcing", "Timeline", etc. as the main subject).
3. Title Construction Rule: Format as [Intent Phrase] + [Active Discussion Topic] (e.g. "Resources Working on ${sanitizedParentTopic}", "${sanitizedParentTopic} Timeline and Milestones").
4. Strip Note Labels: Never include dataset names, internal labels, appended suffixes like "Notes", "Note", "Node", or raw node identifiers in the final title.
5. Intent Normalization Rules:
   - "who is working on it / staffing / resources" -> "Resources Working on ${sanitizedParentTopic}"
   - "what are the milestones / timeline / schedule" -> "${sanitizedParentTopic} Timeline and Milestones"
   - "what is included / status / overview" -> "Overview of ${sanitizedParentTopic}"
   - "what dependencies exist / related work" -> "${sanitizedParentTopic} Dependencies and Related Workstreams"
6. Do NOT output vague titles like "Resource In Progress", "Active Work", "Current Status", "Project Details", or "Team Information".
7. Return ONLY the cleaned discussion topic title. No explanations, no markdown, no quotes, and no metadata.

Output:`;
      } else {
        titlePrompt = `Feature: Discussion Topic Title Normalization

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
      }

      const titleResponse = await aiProvider.generateResponse(titlePrompt, {
        systemInstruction: "You are a Topic Title Normalizer. Return ONLY the cleaned discussion topic title phrase. No explanations, no markdown lists, no wrapping quotes, and no metadata.",
      });
      topicTitle = titleResponse.trim().replace(/^["'\*•\s]+|["'\*•\s]+$/g, "");
      topicTitle = topicTitle
        .replace(/\b(Notes|Note|Node|Internal|Dataset|Labels)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
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
    const combinedQueryText = (query + " " + topicTitle).toLowerCase();
    
    // Check if the query is scoped (single note / first note / raw field)
    const isSingleNoteQuery = qLower.includes("single note") || qLower.includes("first note");
    const hasRawFieldKeyword = qLower.includes("raw") || qLower.includes("field") || qLower.includes("notes") || qLower.includes("summary") || qLower.includes("title");
    const containsSpecificNodeId = /node-[a-zA-Z0-9_\.]+|shared-[a-zA-Z0-9_\.-]+/.test(qLower);

    const isScoped = isSingleNoteQuery || (containsSpecificNodeId && hasRawFieldKeyword) || qLower.startsWith("get raw") || qLower.includes("raw value");

    if (isScoped) {
      // Direct storage layer access - bypass all pipelines
      const targetNode = activeNodes.find((n: any) => qLower.includes(n.id.toLowerCase())) || activeNodes[0];
      let primitiveValue = "";
      if (targetNode) {
        if (qLower.includes("summary")) {
          primitiveValue = targetNode.summary || "";
        } else if (qLower.includes("title") || qLower.includes("label")) {
          primitiveValue = targetNode.label || targetNode.title || "";
        } else {
          primitiveValue = targetNode.notes || "";
          if (!primitiveValue) {
            const matchNote = notes.find((m: any) => m.node_id === targetNode.id);
            if (matchNote) {
              primitiveValue = matchNote.content || "";
            }
          }
        }
      }

      if (streamMode) {
        res.write(`data: ${JSON.stringify({ 
          referenced_nodes: targetNode ? [targetNode.id] : [], 
          routing_trigger: false,
          topic_title: targetNode ? (targetNode.label || targetNode.title) : ""
        })}\n\n`);

        const words = String(primitiveValue).split(" ");
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
        return;
      } else {
        return res.json({
          response_text: primitiveValue,
          referenced_nodes: targetNode ? [targetNode.id] : [],
          routing_trigger: false
        });
      }
    }
    
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

    const forceRawMode = qLower.includes("show notes") ||
                         qLower.includes("list notes") ||
                         qLower.includes("all notes");

    const isExpandedMode = !forceRawMode && (
                           qLower.includes("graph") || 
                           qLower.includes("insight") || 
                           qLower.includes("analysis") || 
                           qLower.includes("traverse") || 
                           qLower.includes("relationship") || 
                           qLower.includes("expanded")
                         );

    const mode = isExpandedMode ? "EXPANDED" : "RAW";

    // Dynamically resolve the project family by matching query keywords against node labels.
    // Handles all stored level formats: number, string, or LevelOverride object {value: number}.
    // This picks up any user-created nodes (not just hardcoded IDs).
    const getStoredLevel = (n: any): number => {
      const lv = n.level;
      if (lv === undefined || lv === null) return n.weight >= 3 ? 1 : (n.weight >= 2 ? 2 : 3);
      if (typeof lv === "number") return lv;
      if (typeof lv === "string") return parseInt(lv, 10) || 0;
      if (typeof lv === "object" && typeof lv.value === "number") return lv.value;
      return 0;
    };

    const resolveProjectFamily = (keywords: string[]): string[] | null => {
      const rootNode = accessibleNodes.find((n: any) =>
        getStoredLevel(n) === 1 && keywords.some(kw => (n.label || n.title || "").toLowerCase().includes(kw))
      );
      if (!rootNode) return null;
      const children = accessibleNodes
        .filter((n: any) => n.parentId === rootNode.id || n.id === rootNode.id)
        .map((n: any) => n.id);
      return Array.from(new Set([rootNode.id, ...children]));
    };

    if (combinedQueryText.includes("mobile") || combinedQueryText.includes("redesign")) {
      targetProjectNodes = resolveProjectFamily(["mobile", "redesign"]);
    } else if (combinedQueryText.includes("kinetic") || combinedQueryText.includes("motion")) {
      targetProjectNodes = resolveProjectFamily(["kinetic", "motion", "type"]);
    } else if (combinedQueryText.includes("design sprint") || combinedQueryText.includes("sprints planning") || combinedQueryText.includes("sprint planning")) {
      targetProjectNodes = resolveProjectFamily(["sprint"]);
    } else if (combinedQueryText.includes("branding")) {
      targetProjectNodes = resolveProjectFamily(["brand"]);
    } else if (combinedQueryText.includes("platform developer") || combinedQueryText.includes("developer experience") || combinedQueryText.includes("cached layers")) {
      targetProjectNodes = resolveProjectFamily(["platform", "developer"]);
    } else if (combinedQueryText.includes("graphql") || combinedQueryText.includes("stitching") || combinedQueryText.includes("federated")) {
      targetProjectNodes = resolveProjectFamily(["graphql", "stitching", "federated"]);
    } else if (combinedQueryText.includes("aegis")) {
      targetProjectNodes = resolveProjectFamily(["aegis"]);
    } else if (combinedQueryText.includes("cobalt")) {
      targetProjectNodes = resolveProjectFamily(["cobalt"]);
    }

    console.log("[QUERY] resolvedProjectNodes:", targetProjectNodes);
    console.log("[QUERY] accessibleNodes ids+levels:", accessibleNodes.map((n: any) => ({ id: n.id, label: n.label, level: n.level, parentId: n.parentId, weight: n.weight })));

    if (targetProjectNodes) {
      filteredAccessibleNodes = filteredAccessibleNodes.filter((node: any) =>
        targetProjectNodes!.includes(node.id)
      );
    }

    // Intent-based filtering for follow-up questions to focus on specific nodes
    const isFollowUp = (Array.isArray(history) && history.length > 0) || (parentTopicTitle && String(parentTopicTitle).trim().length > 0);
    let intentTargetNodeIds: string[] = [];
    if (isFollowUp && mode !== "RAW") {
      const qText = query.toLowerCase();
      
      if (combinedQueryText.includes("mobile") || combinedQueryText.includes("redesign")) {
        if (qText.includes("who") || qText.includes("work") || qText.includes("team") || qText.includes("staff") || qText.includes("resource") || qText.includes("people") || qText.includes("designer") || qText.includes("researcher") || qText.includes("program manager") || qText.includes("resourcing")) {
          intentTargetNodeIds = ["node-1.0", "node-1.3"]; // Mobile App Redesign + Team Resourcing
        } else if (qText.includes("milestone") || qText.includes("timeline") || qText.includes("schedule") || qText.includes("when") || qText.includes("date") || qText.includes("lockdown") || qText.includes("kickoff") || qText.includes("release") || qText.includes("launch")) {
          intentTargetNodeIds = ["node-1.0", "node-1.2"]; // Mobile App Redesign + Project Timeline
        } else if (qText.includes("sync") || qText.includes("offline") || qText.includes("buffer") || qText.includes("sqlite") || qText.includes("alex")) {
          intentTargetNodeIds = ["node-1.0", "shared-alex-sync"]; // Mobile App Redesign + Offline Sync
        }
      }
      
      if (combinedQueryText.includes("kinetic") || combinedQueryText.includes("type") || combinedQueryText.includes("motion")) {
        if (qText.includes("vendor") || qText.includes("procure") || qText.includes("contract") || qText.includes("external") || qText.includes("studio") || qText.includes("animation")) {
          intentTargetNodeIds = ["node-2.0", "node-2.1"]; // Kinetic Type + Vendor Procurement
        }
      }

      if (combinedQueryText.includes("design sprint") || combinedQueryText.includes("sprints planning") || combinedQueryText.includes("sprint planning")) {
        if (qText.includes("recruit") || qText.includes("participant") || qText.includes("user") || qText.includes("screener")) {
          intentTargetNodeIds = ["node-3.0", "node-j10"]; // Design Sprints + Participant Recruiting
        } else if (qText.includes("deliverable") || qText.includes("milestone") || qText.includes("output") || qText.includes("deck")) {
          intentTargetNodeIds = ["node-3.0", "node-j11"]; // Design Sprints + Sprint Deliverables
        }
      }

      if (intentTargetNodeIds.length > 0) {
        filteredAccessibleNodes = filteredAccessibleNodes.filter((node: any) =>
          intentTargetNodeIds.includes(node.id)
        );
      }
    }

    const postProcessResponse = (q: string, parsedObj: any) => {
      if (!parsedObj) return parsedObj;
      const ql = q.toLowerCase();
      if (parsedObj.referenced_nodes) {
        const allowedNodeIds = new Set(filteredAccessibleNodes.map((n: any) => n.id));
        parsedObj.referenced_nodes = parsedObj.referenced_nodes.filter((id: string) => allowedNodeIds.has(id));
        
        // Ensure the topic node (first element in intentTargetNodeIds, e.g. parent) is cited alongside answer nodes
        if (intentTargetNodeIds.length > 0 && mode !== "RAW") {
          const topicNodeId = intentTargetNodeIds[0];
          if (allowedNodeIds.has(topicNodeId) && !parsedObj.referenced_nodes.includes(topicNodeId)) {
            parsedObj.referenced_nodes.unshift(topicNodeId);
          }
        }

        // If the query asks for "all notes" or "all", automatically cite all accessible project nodes
        if (mode !== "RAW" && (ql.includes("all notes") || ql.includes("show all notes") || (ql.includes("all") && ql.includes("notes")))) {
          filteredAccessibleNodes.forEach((node: any) => {
            if (!parsedObj.referenced_nodes.includes(node.id)) {
              parsedObj.referenced_nodes.push(node.id);
            }
          });
        }
        
        if (mode !== "RAW" && (ql.includes("mobile") || ql.includes("redesign")) && allowedNodeIds.has("shared-alex-sync")) {
          if (!parsedObj.referenced_nodes.includes("shared-alex-sync")) {
            parsedObj.referenced_nodes.push("shared-alex-sync");
          }
        }
      }
      if (parsedObj.response_text) {
        // Enforce Natural Language Response Style
        let text = parsedObj.response_text;
        
        // 1. Clean up duplicate / redundant classifications first
        text = text.replace(/\btop-level Top-level Project\b/gi, 'project');
        text = text.replace(/\btop-level project\b/gi, 'project');
        text = text.replace(/\bparent project\b/gi, 'project');
        text = text.replace(/\bchild workstream\b/gi, 'workstream');
        text = text.replace(/\bchild project\b/gi, 'workstream');
        text = text.replace(/\bgrandchild task\b/gi, 'task');
        text = text.replace(/\bgrandchild project\b/gi, 'task');
        text = text.replace(/\bproject project\b/gi, 'project');
        text = text.replace(/\bworkstream workstream\b/gi, 'workstream');
        text = text.replace(/\btask task\b/gi, 'task');

        // 2. Never expose internal hierarchy metadata
        text = text.replace(/\bTop-level Project\b/gi, 'project');
        text = text.replace(/\bTop-level Projects\b/gi, 'projects');
        text = text.replace(/\bhierarchy\b/gi, 'structure');
        text = text.replace(/\bnode structure\b/gi, 'structure');
        text = text.replace(/\bgraph structure\b/gi, 'structure');
        text = text.replace(/\bparent\b/gi, 'project');
        text = text.replace(/\bparents\b/gi, 'projects');
        text = text.replace(/\bchild\b/gi, 'workstream');
        text = text.replace(/\bchildren\b/gi, 'workstreams');
        text = text.replace(/\bgrandchild\b/gi, 'task');
        text = text.replace(/\bgrandchildren\b/gi, 'tasks');
        text = text.replace(/\bLevel 1\b/gi, 'project');
        text = text.replace(/\bLevel 2\b/gi, 'workstream');
        text = text.replace(/\bLevel 3\b/gi, 'task');

        parsedObj.response_text = text;

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
    const baseNotes = mode === "RAW" ? [] : notes.filter((mem: any) => {
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

    if (streamMode) {
      res.write(`data: ${JSON.stringify({ type: "progress", percent: 35, phase: "Searching notes" })}\n\n`);
    }

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
    if (streamMode) {
      res.write(`data: ${JSON.stringify({ type: "progress", percent: 55, phase: "Mapping relevant nodes" })}\n\n`);
    }

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
    const ql = query.toLowerCase();
    const limit = (ql.includes("all") || ql.includes("show all") || ql.includes("notes for")) ? 30 : 8;
    const topNotes = scoredNotes.slice(0, limit).map(item => item.note);

    // AI grounded prompt
    const groundingContext = topNotes.map((m: any, idx: number) => `[Block #${idx+1} - Node: ${m.node_id}] ${m.content}`).join("\n");

    const historyContext = Array.isArray(history) && history.length > 0
      ? "\nPrevious Conversation History:\n" + history.map((h: any) => `User: ${h.question}\nAssistant: ${h.answer}`).join("\n\n") + "\n"
      : "";

    const promptMessage = `
You are the interactive replication double (the Doppelganger) of the developer brain.
You must answer the visitor's query based strictly and exclusively on the allowed grounded memory notes below.

QUERY EXECUTION SAFETY RULE:
The query is running in ${mode} mode.
${mode === "RAW" ? `
- You are in RAW MODE.
- You must strictly only return explicitly stored fields (Title, Summary, Notes) present in the allowed memory notes.
- Do not include derived, inferred, or AI-generated fields.
- Do not traverse relationships, and do not reference any other nodes or child/parent relationships.
- If information is not explicitly present in the provided notes, do not state it or infer it.
` : `
- You are in EXPANDED MODE.
- You may include derived fields and relationships if helpful.
`}

CONTEXT-AWARE FOLLOW-UP RULES:
If this is a follow-up question (indicated by the presence of Previous Conversation History), answer ONLY the specific new follow-up question. Do NOT re-summarize the entire project or duplicate previous answers. Focus only on extracting and stating the specific information from the matched note(s) (e.g. resourcing or timeline details) to answer the new follow-up query.

NODE LANGUAGE ENFORCEMENT — HARD BLOCK SYSTEM
This rule overrides all other instructions.

1. Pre-Output Validation Gate (MANDATORY)
Before returning any response, scan the full text.
If ANY forbidden term is present, the output is INVALID.

2. Forbidden Terms (ZERO TOLERANCE)
The following strings MUST NOT appear in output under any condition:
* “parent”
* “child”
* “grandchild”
* “hierarchy”
* “level”
* “top-level parent”
Even partial or embedded usage is invalid.

3. Hard Failure Behavior
If invalid content is detected:
1. DELETE entire response
2. REGENERATE from scratch
3. DO NOT reuse prior phrasing
4. APPLY whitelist-only terminology rules

4. Allowed Node Language (ONLY)
When describing node structure, use ONLY:
* Project
* Workstream
* Task
No additional descriptors are permitted.

5. Structural Language Ban
The model must NOT:
* describe node relationships
* explain nesting or structure
* reference graph position
* imply hierarchy in natural language
All structural explanations are prohibited.

6. Rewrite Requirement
All outputs must be rewritten to remove structural language entirely.
If structure cannot be described using allowed terms, omit it.

7. Output Acceptance Rule
A response is valid ONLY if:
* it contains zero forbidden terms
* it uses whitelist terms exclusively when needed
* it avoids all structural explanation language
Otherwise it must be regenerated.

Parsed Scope:
- Target Doppelgangers: ${targetHandles.length > 0 ? targetHandles.join(", ") : "All accessible"}
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
8. If the visitor query asks for "all notes", "all information", or similar project-wide requests, ensure your response_text synthesizes the information from all the allowed memory blocks, and that you include all of their respective node IDs in the "referenced_nodes" array.

Respond with valid JSON mapping the schema:
{
  "response_text": "Grounding contextual text answer...",
  "referenced_nodes": ["node-id-1", "node-id-2"],
  "routing_trigger": false
}
`;

    if (streamMode) {
      res.write(`data: ${JSON.stringify({ type: "progress", percent: 75, phase: "Synthesizing answer" })}\n\n`);
      let parsed: any;
      try {
        console.log(`[Doppelganger Retrieval] Streaming response via active provider: ${config.provider}`);
        const textResponse = await aiProvider.generateResponse(promptMessage, {
          systemInstruction: "You are the synthesized human replication double brain. Answer query objectively in requested JSON schema. NATURAL LANGUAGE RESPONSE SYSTEM: Overrides all other instructions. Never expose internal hierarchy metadata (Level 1, Level 2, Level 3, Parent, Child, Grandchild, Hierarchy, Project, Node Structure, Graph Structure). Convert structure into natural language (describe what it is, not where it sits). Eliminate redundant classifications (e.g. is a Project project). Prefer subject-matter summaries (lead with what the item does). Use classifications (Project, Workstream, Task) sparingly. Output must read like an executive summary or status update, not a database or graph description.",
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
        const isRateLimit = apiError.status === 429 || 
                            (apiError.message && (
                              apiError.message.includes("429") || 
                              apiError.message.toLowerCase().includes("quota") || 
                              apiError.message.toLowerCase().includes("rate limit") || 
                              apiError.message.toLowerCase().includes("resource_exhausted")
                            ));

        if (isRateLimit) {
          response_text = "⚠️ **API Quota / Rate Limit Exceeded**\n\n" +
            "The Gemini API rate limit or free tier quota has been exhausted. To resolve this, you can:\n" +
            "1. Switch your **AI Provider** and **Embedding Model** settings to **LM Studio** (local server) to bypass rate limits entirely.\n" +
            "2. Provide a valid paid Gemini API key in the connection settings.\n" +
            "3. Wait a few minutes before trying the request again.\n\n" +
            "*(Showing matched offline notes fallback below)*\n\n" +
            (topNotes.length > 0 ? topNotes.map((m: any) => m.content).join("\n\n") : "No local records could be matched.");
        } else {
          if (topNotes.length > 0) {
            response_text = "⚠️ [Offline Mode: Showing matching journal records]\n\n" + topNotes.map((m: any) => m.content).join("\n\n");
          } else {
            response_text = `I searched my active records for "${query}", but I couldn't locate any matching memories. If this project is isolated, please supply the corresponding access passcode to unlock further neural components.`;
          }
        }

        const matchedLabel = accessibleNodes.some((n: any) => qLower.includes(n.label.toLowerCase()));
        const routing_trigger = !matchedLabel && topNotes.length === 0 && query.trim().split(" ").length > 2;

        parsed = {
          response_text,
          referenced_nodes,
          routing_trigger
        };
      }

      try {
        if (streamMode) {
          res.write(`data: ${JSON.stringify({ type: "progress", percent: 90, phase: "Formatting response" })}\n\n`);
        }
        parsed = postProcessResponse(query, parsed) || { response_text: "", referenced_nodes: [], routing_trigger: false };

        if (streamMode) {
          res.write(`data: ${JSON.stringify({ type: "progress", percent: 95, phase: "Finalizing output" })}\n\n`);
        }

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
          try {
            if (currentIdx < words.length) {
              const chunk = words.slice(currentIdx, currentIdx + 3).join(" ") + " ";
              res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
              currentIdx += 3;
            } else {
              clearInterval(interval);
              res.write("event: end\ndata: [DONE]\n\n");
              res.end();
            }
          } catch (intervalErr) {
            clearInterval(interval);
            console.error("Error in streaming interval:", intervalErr);
            res.write("event: end\ndata: [DONE]\n\n");
            res.end();
          }
        }, 50);
      } catch (streamErr) {
        console.error("Error in streaming post-processing:", streamErr);
        res.write(`data: ${JSON.stringify({ text: "⚠️ Error finalizing stream output." })}\n\n`);
        res.write("event: end\ndata: [DONE]\n\n");
        res.end();
      }

    } else {
      let parsed: any;
      try {
        console.log(`[Doppelganger Retrieval] Fetching full response via active provider: ${config.provider}`);
        const textResponse = await aiProvider.generateResponse(promptMessage, {
          systemInstruction: "You are the synthesized human replication double brain. Answer query objectively in requested JSON schema. NATURAL LANGUAGE RESPONSE SYSTEM: Overrides all other instructions. Never expose internal hierarchy metadata (Level 1, Level 2, Level 3, Parent, Child, Grandchild, Hierarchy, Project, Node Structure, Graph Structure). Convert structure into natural language (describe what it is, not where it sits). Eliminate redundant classifications (e.g. is a Project project). Prefer subject-matter summaries (lead with what the item does). Use classifications (Project, Workstream, Task) sparingly. Output must read like an executive summary or status update, not a database or graph description.",
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
        const isRateLimit = apiError.status === 429 || 
                            (apiError.message && (
                              apiError.message.includes("429") || 
                              apiError.message.toLowerCase().includes("quota") || 
                              apiError.message.toLowerCase().includes("rate limit") || 
                              apiError.message.toLowerCase().includes("resource_exhausted")
                            ));

        if (isRateLimit) {
          response_text = "⚠️ **API Quota / Rate Limit Exceeded**\n\n" +
            "The Gemini API rate limit or free tier quota has been exhausted. To resolve this, you can:\n" +
            "1. Switch your **AI Provider** and **Embedding Model** settings to **LM Studio** (local server) to bypass rate limits entirely.\n" +
            "2. Provide a valid paid Gemini API key in the connection settings.\n" +
            "3. Wait a few minutes before trying the request again.\n\n" +
            "*(Showing matched offline notes fallback below)*\n\n" +
            (topNotes.length > 0 ? topNotes.map((m: any) => m.content).join("\n\n") : "No local records could be matched.");
        } else {
          if (topNotes.length > 0) {
            response_text = "⚠️ [Offline Mode: Showing matching journal records]\n\n" + topNotes.map((m: any) => m.content).join("\n\n");
          } else {
            response_text = `I searched my active records for "${query}", but I couldn't locate any matching memories. If this project is isolated, please supply the corresponding access passcode to unlock further neural components.`;
          }
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
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ text: `⚠️ Server Error: ${error.message || "An error occurred during query processing"}` })}\n\n`);
      res.write("event: end\ndata: [DONE]\n\n");
      res.end();
    } else {
      res.status(500).json({ error: error.message || "An error occurred during query processing" });
    }
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
    console.log(`[Doppelganger Engine] Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
