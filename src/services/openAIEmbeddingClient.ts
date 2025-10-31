import OpenAI from "openai";

import { getEnv } from "../config/env.js";
import type { Logger } from "../utils/logger.js";
import { ConsoleLogger } from "../utils/logger.js";

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingProvider {
  embed(request: EmbeddingRequest): Promise<number[]>;
}

export interface OpenAIEmbeddingClientOptions {
  apiKey?: string;
  model?: string;
  logger?: Logger;
}

const DEFAULT_MODEL = "text-embedding-3-large";

export class OpenAIEmbeddingClient implements EmbeddingProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly logger: Logger;

  constructor(options: OpenAIEmbeddingClientOptions = {}) {
    const apiKey = options.apiKey ?? getEnv().OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY must be provided either via options or environment");
    }

    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
    this.logger = options.logger ?? new ConsoleLogger();
  }

  async embed(request: EmbeddingRequest): Promise<number[]> {
    const model = request.model ?? this.model;

    try {
      const response = await this.client.embeddings.create({
        model,
        input: request.text,
      });

      const embedding = response.data[0]?.embedding;

      if (!embedding) {
        throw new Error("OpenAI did not return an embedding vector");
      }

      return embedding;
    } catch (error) {
      this.logger.error("OpenAI embedding generation failed", {
        error,
      });
      throw error;
    }
  }
}
