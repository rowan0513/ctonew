import { describe, expect, it, vi } from "vitest";

import type { EmbeddingJobData } from "../queues/jobTypes.js";
import type { ChunkRepository } from "../repositories/chunkRepository.js";
import type { EmbeddingProvider } from "../services/openAIEmbeddingClient.js";
import type { ChunkRecord, NewChunkRecord } from "../types/chunk.js";
import { EmbeddingWorker } from "../workers/embeddingWorker.js";

class InMemoryChunkRepository implements ChunkRepository {
  private readonly store = new Map<string, ChunkRecord>();

  constructor(initial: NewChunkRecord[]) {
    for (const record of initial) {
      void this.createOrUpdateChunk(record);
    }
  }

  async createOrUpdateChunk(record: NewChunkRecord): Promise<void> {
    const now = new Date();
    const existing = this.store.get(record.chunkId);

    this.store.set(record.chunkId, {
      ...record,
      vector: record.vector ?? existing?.vector ?? null,
      error: record.error ?? existing?.error ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async markChunkProcessing(chunkId: string): Promise<void> {
    this.update(chunkId, { status: "processing", error: null });
  }

  async markChunkRetrying(chunkId: string, _delayMs: number): Promise<void> {
    this.update(chunkId, { status: "retrying" });
  }

  async markChunkVectorized(chunkId: string, vector: number[]): Promise<void> {
    this.update(chunkId, { status: "vectorized", vector, error: null });
  }

  async markChunkFailed(chunkId: string, error: string): Promise<void> {
    this.update(chunkId, { status: "failed", error });
  }

  async getChunk(chunkId: string): Promise<ChunkRecord | null> {
    return this.store.get(chunkId) ?? null;
  }

  private update(
    chunkId: string,
    patch: Partial<Pick<ChunkRecord, "status" | "vector" | "error">>
  ): void {
    const existing = this.store.get(chunkId);

    if (!existing) {
      throw new Error(`Chunk ${chunkId} not found`);
    }

    this.store.set(chunkId, {
      ...existing,
      ...patch,
      updatedAt: new Date(),
    });
  }
}

class SilentLogger {
  info(): void {}
  warn(): void {}
  error(): void {}
}

class FakeProvider implements EmbeddingProvider {
  constructor(private readonly behaviour: () => number[] | never) {}

  async embed(): Promise<number[]> {
    const result = this.behaviour();
    return result;
  }
}

function createJob(
  data: EmbeddingJobData,
  attemptsMade = 0
): import("bullmq").Job<EmbeddingJobData> {
  const updateProgress = vi.fn(async () => {});

  return {
    id: `job-${Math.random().toString(36).slice(2)}`,
    name: "embed-chunk",
    data,
    attemptsMade,
    updateProgress,
    opts: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
    },
  } as unknown as import("bullmq").Job<EmbeddingJobData>;
}

function createBaseChunk(): NewChunkRecord {
  return {
    chunkId: "doc::chunk::0",
    documentId: "doc",
    chunkIndex: 0,
    text: "This is a chunk",
    tokenCount: 600,
    tokenRange: { start: 0, end: 600 },
    metadata: {
      sourceType: "upload",
      filename: "file.txt",
      url: null,
      title: "title",
      language: "en",
      checksum: "checksum",
      jobId: "job-1",
    },
    status: "queued",
    vector: null,
    error: null,
  } satisfies NewChunkRecord;
}

describe("EmbeddingWorker", () => {
  it("stores vectors on successful embedding", async () => {
    const baseChunk = createBaseChunk();
    const repository = new InMemoryChunkRepository([baseChunk]);
    const provider = new FakeProvider(() => [0.1, 0.2, 0.3]);
    const worker = new EmbeddingWorker({
      queueName: "test-queue",
      connection: {} as any,
      autorun: false,
      embeddingProvider: provider,
      chunkRepository: repository,
      logger: new SilentLogger(),
    });

    const job = createJob({
      chunkId: baseChunk.chunkId,
      documentId: baseChunk.documentId,
      chunkIndex: baseChunk.chunkIndex,
      text: baseChunk.text,
      tokenRange: baseChunk.tokenRange,
      tokenCount: baseChunk.tokenCount,
      metadata: baseChunk.metadata,
    });

    const result = await worker.handle(job);

    expect(result.vectorLength).toBe(3);

    const stored = await repository.getChunk(baseChunk.chunkId);
    expect(stored?.status).toBe("vectorized");
    expect(stored?.vector).toEqual([0.1, 0.2, 0.3]);
    expect(stored?.error).toBeNull();
  });

  it("marks chunk as retrying when OpenAI rate limits", async () => {
    const baseChunk = createBaseChunk();
    const repository = new InMemoryChunkRepository([baseChunk]);
    const provider = new FakeProvider(() => {
      const error = new Error("Rate limit");
      (error as any).response = { status: 429 };
      throw error;
    });

    const worker = new EmbeddingWorker({
      queueName: "test-queue",
      connection: {} as any,
      autorun: false,
      embeddingProvider: provider,
      chunkRepository: repository,
      logger: new SilentLogger(),
    });

    const job = createJob(
      {
        chunkId: baseChunk.chunkId,
        documentId: baseChunk.documentId,
        chunkIndex: baseChunk.chunkIndex,
        text: baseChunk.text,
        tokenRange: baseChunk.tokenRange,
        tokenCount: baseChunk.tokenCount,
        metadata: baseChunk.metadata,
      },
      1
    );

    await expect(worker.handle(job)).rejects.toThrow(/Rate limit/);

    const stored = await repository.getChunk(baseChunk.chunkId);
    expect(stored?.status).toBe("retrying");
    expect(stored?.vector).toBeNull();
  });

  it("marks chunk as failed on permanent errors", async () => {
    const baseChunk = createBaseChunk();
    const repository = new InMemoryChunkRepository([baseChunk]);
    const provider = new FakeProvider(() => {
      throw new Error("Embedding failed");
    });

    const worker = new EmbeddingWorker({
      queueName: "test-queue",
      connection: {} as any,
      autorun: false,
      embeddingProvider: provider,
      chunkRepository: repository,
      logger: new SilentLogger(),
    });

    const job = createJob({
      chunkId: baseChunk.chunkId,
      documentId: baseChunk.documentId,
      chunkIndex: baseChunk.chunkIndex,
      text: baseChunk.text,
      tokenRange: baseChunk.tokenRange,
      tokenCount: baseChunk.tokenCount,
      metadata: baseChunk.metadata,
    });

    await expect(worker.handle(job)).rejects.toThrow(/Embedding failed/);

    const stored = await repository.getChunk(baseChunk.chunkId);
    expect(stored?.status).toBe("failed");
    expect(stored?.error).toBe("Embedding failed");
  });
});
