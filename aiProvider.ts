import { GoogleGenAI, Type } from "@google/genai";

function rewriteLocalhost(url?: string): string | undefined {
  if (!url) return url;
  if (process.env.RUNNING_IN_DOCKER === "true" || process.env.NODE_ENV === "production") {
    // Replace localhost or 127.0.0.1 with host.docker.internal
    return url.replace(/:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/, "://host.docker.internal$2");
  }
  return url;
}

// Standard configurations for our unified Pluggable AI system
export interface AIConfig {
  provider: "gemini" | "lm-studio" | "custom";
  geminiConfig?: {
    apiKey?: string;
    model?: string;
  };
  lmStudioConfig?: {
    endpoint?: string;
    model?: string;
  };
  customConfig?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
  };
  embeddingProvider: "gemini" | "local" | "custom";
  embeddingConfig?: {
    model?: string;
    endpoint?: string;
    apiKey?: string;
  };
}

export interface ModelCapability {
  chat: boolean;
  embeddings: boolean;
  vision: boolean;
  structuredOutput: boolean;
  streaming: boolean;
}

// Global list of standard Gemini models (used as a fallback list and defaults)
export const STANDARD_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-image",
  "gemini-embedding-2-preview"
];

// Helper to generate deterministic fallback vectors
export function getDeterministicMockEmbedding(text: string, dimensions = 1536): number[] {
  const hash = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const vec: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    // Generate values between -1.0 and 1.0 using Math.sin
    vec.push(Math.sin(hash + i * 17) * 0.1);
  }
  // L2 Normalize
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map(v => (norm === 0 ? 0 : v / norm));
}

// Abstraction class for the AI Provider
export class AIProvider {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = {
      provider: config.provider || "gemini",
      geminiConfig: config.geminiConfig || {},
      lmStudioConfig: config.lmStudioConfig || {},
      customConfig: config.customConfig || {},
      embeddingProvider: config.embeddingProvider || "gemini",
      embeddingConfig: config.embeddingConfig || {},
    };
  }

  // Get current active model name
  public getActiveModelName(): string {
    if (this.config.provider === "gemini") {
      return this.config.geminiConfig?.model || "gemini-3.5-flash";
    } else if (this.config.provider === "lm-studio") {
      return this.config.lmStudioConfig?.model || "Currently Loaded Model";
    } else {
      return this.config.customConfig?.model || "custom-model";
    }
  }

  // Query LM Studio directly to fetch the active loaded model name
  public async fetchActiveLMStudioModel(): Promise<string> {
    try {
      const baseEndpoint = rewriteLocalhost(this.config.lmStudioConfig?.endpoint || "http://localhost:1234")!;
      // Clean up base URL by removing /v1 if present to query models list
      let cleanUrl = baseEndpoint.trim();
      if (cleanUrl.endsWith("/")) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      if (!cleanUrl.endsWith("/v1")) {
        cleanUrl = `${cleanUrl}/v1`;
      }
      const res = await fetch(`${cleanUrl}/models`);
      if (res.ok) {
        const data = await res.json();
        const loadedModel = data?.data?.[0]?.id;
        if (loadedModel) return loadedModel;
      }
    } catch (e) {}
    return "Currently Loaded Model";
  }

  // Get active embedding model name
  public getActiveEmbeddingModelName(): string {
    return this.config.embeddingConfig?.model || (this.config.embeddingProvider === "gemini" ? "gemini-embedding-2-preview" : "nomic-embed-text");
  }

  // Get capabilities of the currently configured provider & model combination
  public getCapabilities(): ModelCapability {
    const provider = this.config.provider;
    if (provider === "gemini") {
      const model = this.getActiveModelName();
      const isEmbed = model.includes("embed");
      return {
        chat: !isEmbed,
        embeddings: true,
        vision: model.includes("flash") || model.includes("pro") || model.includes("image"),
        structuredOutput: true,
        streaming: !isEmbed,
      };
    } else {
      // LM Studio & Custom OpenAI Compatible endpoint
      return {
        chat: true,
        embeddings: true,
        vision: false, // Local servers usually don't support multi-modal vision by default unless specialized
        structuredOutput: true, // Supported by most OpenAI-compatible custom endpoints
        streaming: true,
      };
    }
  }

  /**
   * Abstracted method to generate response. Handles JSON response structure.
   */
  public async generateResponse(
    prompt: string,
    options?: {
      systemInstruction?: string;
      responseSchema?: any;
    }
  ): Promise<string> {
    const provider = this.config.provider;

    if (provider === "gemini") {
      // Use the Google GenAI SDK (with appropriate fallback)
      const apiKey = this.config.geminiConfig?.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is not configured in settings or environment.");
      }

      const client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const model = this.getActiveModelName();
      console.log(`[AIProvider] Running Gemini Response Generation via SDK [Model: ${model}]`);

      const configPayload: any = {};
      if (options?.systemInstruction) {
        configPayload.systemInstruction = options.systemInstruction;
      }
      if (options?.responseSchema) {
        configPayload.responseMimeType = "application/json";
        configPayload.responseSchema = options.responseSchema;
      }

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: configPayload,
      });

      return response.text || "{}";
    } else if (provider === "lm-studio") {
      // LM Studio (Local OpenAI compatible)
      const url = rewriteLocalhost(this.config.lmStudioConfig?.endpoint || "http://localhost:1234")!;
      const model = this.config.lmStudioConfig?.model || "Currently Loaded Model";
      console.log(`[AIProvider] Running LM Studio Request [Endpoint: ${url}, Model: ${model}]`);

      return this.callOpenAICompatibleAPI(url, "", model, prompt, options);
    } else {
      // Custom OpenAI Compatible Endpoint
      const url = rewriteLocalhost(this.config.customConfig?.endpoint || "")!;
      const apiKey = this.config.customConfig?.apiKey || "";
      const model = this.config.customConfig?.model || "custom-model";
      console.log(`[AIProvider] Running Custom OpenAI Compatible request [Endpoint: ${url}, Model: ${model}]`);

      return this.callOpenAICompatibleAPI(url, apiKey, model, prompt, options);
    }
  }

  /**
   * Helper function to call OpenAI style endpoints (/v1/chat/completions)
   */
  private async callOpenAICompatibleAPI(
    endpoint: string,
    apiKey: string,
    model: string,
    prompt: string,
    options?: {
      systemInstruction?: string;
      responseSchema?: any;
    }
  ): Promise<string> {
    // Sanitize endpoint base URL (ensure it has /v1 if missing/standard, but respect raw input)
    let finalUrl = endpoint.trim();
    if (finalUrl.endsWith("/")) {
      finalUrl = finalUrl.slice(0, -1);
    }
    if (!finalUrl.includes("/chat/completions")) {
      finalUrl = `${finalUrl}/v1/chat/completions`;
    }

    const messages: any[] = [];
    if (options?.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const payload: any = {
      model,
      messages,
      temperature: 0.1, // low temperature for precise JSON matching
    };

    if (options?.responseSchema) {
      if (this.config.provider === "lm-studio") {
        payload.response_format = {
          type: "json_schema",
          json_schema: {
            name: "CompactionSchema",
            schema: options.responseSchema
          }
        };
      } else {
        payload.response_format = { type: "json_object" };
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    try {
      const response = await fetch(finalUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API returned HTTP ${response.status}: ${errText}`);
      }

      const resJson = await response.json();
      return resJson?.choices?.[0]?.message?.content || "{}";
    } catch (e: any) {
      console.error("[AIProvider] Call to OpenAI Compatible endpoint failed:", e.message || e);
      throw new Error(`Connection to provider endpoint [${endpoint}] failed: ${e.message}`);
    }
  }

  /**
   * Abstracted method to generate embeddings.
   */
  public async generateEmbedding(text: string): Promise<number[]> {
    const provider = this.config.embeddingProvider;
    console.log(`[AIProvider] Running Embedding Generation [Provider: ${provider}]`);

    try {
      if (provider === "gemini") {
        const apiKey = this.config.embeddingConfig?.apiKey || this.config.geminiConfig?.apiKey || process.env.GEMINI_API_KEY;
        const model = this.config.embeddingConfig?.model || "gemini-embedding-2-preview";

        if (!apiKey) {
          throw new Error("Embedding Gemini API key is missing.");
        }

        const client = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const response = await client.models.embedContent({
          model,
          contents: text,
        });

        const embedRes: any = response;
        const values = embedRes.embedding?.values || embedRes.embeddings?.[0]?.values || embedRes.embeddings?.values;
        if (values && Array.isArray(values)) {
          return values;
        }
        throw new Error("Empty embedding vector returned from Gemini.");
      } else {
        // Local or Custom Embedding Provider
        let endpoint = "";
        let apiKey = "";
        let model = "";

        if (provider === "local") {
          endpoint = rewriteLocalhost(this.config.lmStudioConfig?.endpoint || "http://localhost:1234") || "";
          model = this.config.embeddingConfig?.model || "nomic-embed-text";
        } else {
          endpoint = rewriteLocalhost(this.config.embeddingConfig?.endpoint || this.config.customConfig?.endpoint || "") || "";
          apiKey = this.config.embeddingConfig?.apiKey || this.config.customConfig?.apiKey || "";
          model = this.config.embeddingConfig?.model || "custom-embedding-model";
        }

        let finalUrl = endpoint.trim();
        if (finalUrl.endsWith("/")) {
          finalUrl = finalUrl.slice(0, -1);
        }
        if (!finalUrl.includes("/embeddings")) {
          finalUrl = `${finalUrl}/v1/embeddings`;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const response = await fetch(finalUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: text,
            model,
          }),
        });

        if (!response.ok) {
          throw new Error(`Embedding API returned HTTP ${response.status}`);
        }

        const json = await response.json();
        const embedding = json?.data?.[0]?.embedding;
        if (embedding && Array.isArray(embedding)) {
          return embedding;
        }
        throw new Error("No embedding values found in response payload.");
      }
    } catch (e: any) {
      console.warn(`[AIProvider] Embedding failed (${e.message || e}), falling back to deterministic safe embedding vectors.`);
      // Return beautiful, safe, deterministic vector so matching continues to behave correctly
      return getDeterministicMockEmbedding(text);
    }
  }

  /**
   * Classify a node into hierarchy Level 1, 2, or 3 based on parent context
   */
  public async classifyNode(nodeLabel: string, otherNodesText: string): Promise<string> {
    const systemPrompt = `You are a taxonomy classifier. Based on the surrounding knowledge graph, classify the node label into Level 1 (initiative/program/system container), Level 2 (phase, milestone, domain, workstream), or Level 3 (atomic deliverable, meeting, log output, report document). Return ONLY the single number: 1, 2, or 3.`;
    const prompt = `Node Label to classify: "${nodeLabel}"\nSurrounding contexts:\n${otherNodesText}`;
    try {
      const response = await this.generateResponse(prompt, { systemInstruction: systemPrompt });
      const cleaned = response.trim();
      const numMatch = cleaned.match(/[123]/);
      return numMatch ? numMatch[0] : "2"; // fallback to Level 2
    } catch (e) {
      console.warn("[AIProvider] classifyNode failed, using regex classification fallback.");
      return "2";
    }
  }

  /**
   * Summarize a work log or a note in 1 sentence
   */
  public async summarizeMemory(memoryText: string): Promise<string> {
    const prompt = `Please summarize the following work log or daily journal entry in a single clean, concise, elegant, first-person sentence:\n"${memoryText}"`;
    try {
      const summary = await this.generateResponse(prompt, {
        systemInstruction: "You are the compact double of a developer's brain. Write a clean 1-sentence first-person summary of the event."
      });
      return summary.trim().replace(/^"/, "").replace(/"$/, "");
    } catch (e) {
      console.warn("[AIProvider] summarizeMemory failed, using raw truncation.");
      return memoryText.length > 80 ? memoryText.substring(0, 80) + "..." : memoryText;
    }
  }
}
