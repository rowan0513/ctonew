import { describe, expect, it } from "vitest";

import {
  MAX_TOKENS_PER_CHUNK,
  MIN_TOKENS_PER_CHUNK,
  TOKEN_OVERLAP,
  TextChunker,
} from "../chunker/textChunker.js";

const BASE_SOURCE = {
  sourceType: "upload",
  filename: "sample.txt",
  url: null,
  title: "Sample",
};

describe("TextChunker", () => {
  it("splits text into overlapping chunks within the allowed token range", () => {
    const chunker = new TextChunker();
    const baseSentence = "This is a sample sentence that ensures a healthy number of tokens. ";
    const text = baseSentence.repeat(1600);

    const result = chunker.chunkDocument({
      documentId: "doc-123",
      text,
      jobId: "job-abc",
      source: BASE_SOURCE,
    });

    expect(result.chunks.length).toBeGreaterThan(1);

    result.chunks.forEach((chunk, index) => {
      if (index < result.chunks.length - 1) {
        expect(chunk.tokenCount).toBeGreaterThanOrEqual(MIN_TOKENS_PER_CHUNK);
      }

      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS_PER_CHUNK);

      expect(chunk.metadata.jobId).toBe("job-abc");
      expect(chunk.metadata.language).toBe("en");

      if (index > 0) {
        const previousChunk = result.chunks[index - 1];
        expect(chunk.tokenRange.start).toBe(previousChunk.tokenRange.end - TOKEN_OVERLAP);
      }
    });

    const lastChunk = result.chunks.at(-1);
    expect(lastChunk?.tokenCount).toBeGreaterThanOrEqual(MIN_TOKENS_PER_CHUNK);
  });

  it("detects Dutch language and propagates to metadata", () => {
    const chunker = new TextChunker();
    const dutchSentence = "Dit is een voorbeeldzin die aangeeft dat de taal Nederlands is. ";
    const text = dutchSentence.repeat(600);

    const result = chunker.chunkDocument({
      documentId: "doc-nl",
      text,
      jobId: "job-nl",
      source: {
        sourceType: "upload",
        filename: "dutch.txt",
        url: null,
        title: "Voorbeeld",
      },
    });

    expect(result.language).toBe("nl");
    expect(result.chunks.length).toBeGreaterThan(0);
    result.chunks.forEach((chunk) => {
      expect(chunk.metadata.language).toBe("nl");
    });
  });
});
