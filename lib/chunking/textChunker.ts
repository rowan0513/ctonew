import { encoding_for_model } from "tiktoken";

export interface ChunkOptions {
  minTokens?: number;
  maxTokens?: number;
  overlapTokens?: number;
  model?: "gpt-3.5-turbo" | "gpt-4";
}

export interface TextChunk {
  text: string;
  tokenCount: number;
  startIndex: number;
  endIndex: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  minTokens: 500,
  maxTokens: 1000,
  overlapTokens: 150,
  model: "gpt-3.5-turbo",
};

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const encoding = encoding_for_model(opts.model);

  try {
    const tokens = encoding.encode(text);
    const chunks: TextChunk[] = [];
    let currentPosition = 0;

    while (currentPosition < tokens.length) {
      const chunkStart = currentPosition;
      let chunkEnd = Math.min(currentPosition + opts.maxTokens, tokens.length);

      const chunkTokens = tokens.slice(chunkStart, chunkEnd);
      const chunkText = new TextDecoder().decode(encoding.decode(chunkTokens));

      const actualTokenCount = chunkTokens.length;

      if (actualTokenCount < opts.minTokens && chunkEnd < tokens.length) {
        chunkEnd = Math.min(chunkStart + opts.minTokens, tokens.length);
      }

      const finalChunkTokens = tokens.slice(chunkStart, chunkEnd);
      const finalChunkText = new TextDecoder().decode(encoding.decode(finalChunkTokens));

      chunks.push({
        text: finalChunkText,
        tokenCount: finalChunkTokens.length,
        startIndex: chunkStart,
        endIndex: chunkEnd,
      });

      currentPosition = chunkEnd - opts.overlapTokens;

      if (currentPosition >= tokens.length) {
        break;
      }

      if (chunkEnd === tokens.length) {
        break;
      }
    }

    return chunks;
  } finally {
    encoding.free();
  }
}

export function countTokens(text: string, model: "gpt-3.5-turbo" | "gpt-4" = "gpt-3.5-turbo"): number {
  const encoding = encoding_for_model(model);
  try {
    const tokens = encoding.encode(text);
    return tokens.length;
  } finally {
    encoding.free();
  }
}
