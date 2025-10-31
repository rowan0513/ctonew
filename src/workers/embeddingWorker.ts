import { Worker, type Job, type QueueOptions, type WorkerOptions } from "bullmq";

import type { EmbeddingJobData } from "../queues/jobTypes.js";
import type { ChunkRepository } from "../repositories/chunkRepository.js";
import type { EmbeddingProvider } from "../services/openAIEmbeddingClient.js";
import type { Logger } from "../utils/logger.js";
import { ConsoleLogger } from "../utils/logger.js";

export interface EmbeddingWorkerOptions {
  queueName: string;
  embeddingProvider: EmbeddingProvider;
  chunkRepository: ChunkRepository;
  connection: QueueOptions["connection"];
  workerOptions?: WorkerOptions;
  logger?: Logger;
  autorun?: boolean;
  baseRetryDelayMs?: number;
}

const DEFAULT_BASE_RETRY_DELAY_MS = 5_000;

export class EmbeddingWorker {
  private readonly worker?: Worker<EmbeddingJobData>;
  private readonly logger: Logger;
  private readonly baseRetryDelayMs: number;

  constructor(private readonly options: EmbeddingWorkerOptions) {
    this.logger = options.logger ?? new ConsoleLogger();
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS;

    if (options.autorun ?? true) {
      this.worker = new Worker<EmbeddingJobData>(
        options.queueName,
        (job) => this.handle(job),
        {
          connection: options.connection,
          ...(options.workerOptions ?? {}),
        }
      );

      this.worker.on("failed", (job, err) => {
        this.logger.error("Embedding job failed", {
          jobId: job?.id,
          chunkId: job?.data.chunkId,
          error: err?.message,
        });
      });

      this.worker.on("completed", (job) => {
        this.logger.info("Embedding job completed", {
          jobId: job.id,
          chunkId: job.data.chunkId,
          vectorLength: job.returnvalue?.vectorLength,
        });
      });
    }
  }

  async handle(job: Job<EmbeddingJobData>): Promise<{ vectorLength: number }> {
    const { chunkId, text } = job.data;

    await this.options.chunkRepository.markChunkProcessing(chunkId);
    await job.updateProgress(10);

    try {
      const embedding = await this.options.embeddingProvider.embed({ text });

      await job.updateProgress(80);
      await this.options.chunkRepository.markChunkVectorized(chunkId, embedding);

      this.logger.info("Stored embedding vector", {
        chunkId,
        vectorLength: embedding.length,
        jobId: job.id,
      });

      await job.updateProgress(100);

      return { vectorLength: embedding.length };
    } catch (error) {
      if (isTransientError(error)) {
        const delay = calculateDelay(this.baseRetryDelayMs, job.attemptsMade);
        await this.options.chunkRepository.markChunkRetrying(chunkId, delay);

        this.logger.warn("Transient error while generating embedding; will retry", {
          chunkId,
          jobId: job.id,
          attemptsMade: job.attemptsMade,
          delay,
          error,
        });

        throw error;
      }

      const message = serializeError(error);
      await this.options.chunkRepository.markChunkFailed(chunkId, message);

      this.logger.error("Failed to store embedding vector", {
        chunkId,
        jobId: job.id,
        error: message,
      });

      throw error;
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}

function calculateDelay(baseDelay: number, attemptsMade: number): number {
  return Math.min(60_000, baseDelay * 2 ** Math.max(attemptsMade, 0));
}

function isTransientError(error: unknown): boolean {
  const status = extractStatusCode(error);

  if (status && (status === 429 || status >= 500)) {
    return true;
  }

  const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
  if (code && (code === "ETIMEDOUT" || code === "ECONNRESET")) {
    return true;
  }

  const message = typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message) : undefined;
  if (message && message.toLowerCase().includes("rate limit")) {
    return true;
  }

  return false;
}

function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const possible = error as {
    status?: number;
    response?: { status?: number };
    cause?: { status?: number };
  };

  return possible.status ?? possible.response?.status ?? possible.cause?.status;
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}
