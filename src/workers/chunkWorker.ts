import { randomUUID } from "node:crypto";

import { Queue, Worker, type Job, type QueueOptions, type WorkerOptions } from "bullmq";

import { TextChunker } from "../chunker/textChunker.js";
import type { ChunkRepository } from "../repositories/chunkRepository.js";
import type { DocumentChunkJobData, EmbeddingJobData } from "../queues/jobTypes.js";
import type { Logger } from "../utils/logger.js";
import { ConsoleLogger } from "../utils/logger.js";
import type { NewChunkRecord } from "../types/chunk.js";

export interface ChunkWorkerOptions {
  queueName: string;
  chunkRepository: ChunkRepository;
  embeddingQueue: Queue<EmbeddingJobData>;
  connection: QueueOptions["connection"];
  workerOptions?: WorkerOptions;
  chunker?: TextChunker;
  logger?: Logger;
  autorun?: boolean;
  embeddingJobAttempts?: number;
  embeddingJobBackoffDelayMs?: number;
}

const DEFAULT_EMBEDDING_JOB_ATTEMPTS = 5;
const DEFAULT_BACKOFF_DELAY_MS = 5_000;

export class ChunkWorker {
  private readonly worker?: Worker<DocumentChunkJobData>;
  private readonly logger: Logger;
  private readonly chunker: TextChunker;
  private readonly embeddingJobAttempts: number;
  private readonly embeddingJobBackoffDelayMs: number;

  constructor(private readonly options: ChunkWorkerOptions) {
    this.logger = options.logger ?? new ConsoleLogger();
    this.chunker = options.chunker ?? new TextChunker();
    this.embeddingJobAttempts = options.embeddingJobAttempts ?? DEFAULT_EMBEDDING_JOB_ATTEMPTS;
    this.embeddingJobBackoffDelayMs = options.embeddingJobBackoffDelayMs ?? DEFAULT_BACKOFF_DELAY_MS;

    if (options.autorun ?? true) {
      this.worker = new Worker<DocumentChunkJobData>(
        options.queueName,
        (job) => this.handle(job),
        {
          connection: options.connection,
          ...(options.workerOptions ?? {}),
        }
      );

      this.worker.on("failed", (job, err) => {
        this.logger.error("Chunk job failed", {
          jobId: job?.id,
          documentId: job?.data.documentId,
          error: err?.message,
        });
      });

      this.worker.on("completed", (job) => {
        this.logger.info("Chunk job completed", {
          jobId: job.id,
          documentId: job.data.documentId,
          chunkCount: job.returnvalue?.chunkCount,
        });
      });
    }
  }

  async handle(job: Job<DocumentChunkJobData>): Promise<{ chunkCount: number }> {
    const jobId = job.data.jobId ?? String(job.id ?? randomUUID());

    this.logger.info("Processing document chunk job", {
      jobId,
      documentId: job.data.documentId,
    });

    const { chunks } = this.chunker.chunkDocument({
      documentId: job.data.documentId,
      text: job.data.text,
      jobId,
      source: job.data.source,
    });

    if (!chunks.length) {
      this.logger.warn("No chunks generated for document", {
        jobId,
        documentId: job.data.documentId,
      });

      return { chunkCount: 0 };
    }

    for (const chunk of chunks) {
      const record: NewChunkRecord = {
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        tokenRange: chunk.tokenRange,
        metadata: chunk.metadata,
        status: chunk.status,
        vector: null,
        error: null,
      };

      await this.options.chunkRepository.createOrUpdateChunk(record);

      await this.options.embeddingQueue.add(
        "embed-chunk",
        {
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          tokenRange: chunk.tokenRange,
          tokenCount: chunk.tokenCount,
          metadata: chunk.metadata,
        },
        {
          jobId: chunk.chunkId,
          attempts: this.embeddingJobAttempts,
          removeOnComplete: true,
          removeOnFail: false,
          backoff: {
            type: "exponential",
            delay: this.embeddingJobBackoffDelayMs,
          },
        }
      );
    }

    return { chunkCount: chunks.length };
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}
