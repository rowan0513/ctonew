import { createHash } from "node:crypto";
import { encoding_for_model } from "tiktoken";

import { detectLanguage } from "../language/detectLanguage.js";
import type {
  ChunkRecord,
  ChunkMetadata,
  DocumentSourceMetadata,
  TokenRange,
  DocumentLanguage,
} from "../types/chunk.js";

export const MIN_TOKENS_PER_CHUNK = 500;
export const MAX_TOKENS_PER_CHUNK = 1000;
export const TOKEN_OVERLAP = 150;
const DEFAULT_MODEL = "text-embedding-3-large";

export interface ChunkerInput {
  documentId: string;
  text: string;
  jobId: string;
  source: DocumentSourceMetadata;
}

export interface ChunkerResult {
  language: DocumentLanguage;
  chunks: Array<Pick<
    ChunkRecord,
    | "chunkId"
    | "chunkIndex"
    | "documentId"
    | "text"
    | "tokenCount"
    | "tokenRange"
    | "metadata"
    | "status"
  >>;
}

export class TextChunker {
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
  }

  public chunkDocument(input: ChunkerInput): ChunkerResult {
    const { text, documentId, source, jobId } = input;

    const language = detectLanguage(text);
    const encoder = encoding_for_model(this.model);

    try {
      const tokenArray = Array.from(encoder.encode(text));

      if (!tokenArray.length) {
        return {
          language,
          chunks: [],
        };
      }

      const chunks: ChunkerResult["chunks"] = [];
      let start = 0;
      let chunkIndex = 0;

      while (start < tokenArray.length) {
        let end = Math.min(start + MAX_TOKENS_PER_CHUNK, tokenArray.length);

        if (end < tokenArray.length) {
          const remaining = tokenArray.length - end;

          if (remaining < MIN_TOKENS_PER_CHUNK) {
            const shortfall = MIN_TOKENS_PER_CHUNK - remaining;
            end = Math.min(
              tokenArray.length,
              Math.max(start + MIN_TOKENS_PER_CHUNK, end - shortfall)
            );
          }
        }

        const slice = tokenArray.slice(start, end);

        if (!slice.length) {
          break;
        }

        const chunkText = encoder.decode(slice);
        const tokenRange: TokenRange = { start, end };
        const tokenCount = slice.length;

        const checksum = createHash("sha256").update(chunkText).digest("hex");

        const metadata: ChunkMetadata = {
          ...source,
          language,
          checksum,
          jobId,
        };

        const chunkId = `${documentId}::chunk::${chunkIndex}`;

        const chunk: ChunkerResult["chunks"][number] = {
          chunkId,
          chunkIndex,
          documentId,
          text: chunkText,
          tokenCount,
          tokenRange,
          metadata,
          status: "queued",
        };

        chunks.push(chunk);

        if (end === tokenArray.length) {
          break;
        }

        start = Math.max(0, end - TOKEN_OVERLAP);
        chunkIndex += 1;
      }

      return {
        language,
        chunks,
      };
    } finally {
      encoder.free();
    }
  }
}
