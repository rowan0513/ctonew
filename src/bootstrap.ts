import IORedis from "ioredis";
import { Queue } from "bullmq";
import { Pool } from "pg";

import { getEnv } from "./config/env.js";
import { CHUNK_EMBEDDING_QUEUE, DOCUMENT_CHUNKING_QUEUE } from "./queues/names.js";
import type { EmbeddingJobData, DocumentChunkJobData } from "./queues/jobTypes.js";
import { PgChunkRepository } from "./repositories/chunkRepository.js";
import { OpenAIEmbeddingClient } from "./services/openAIEmbeddingClient.js";
import type { Logger } from "./utils/logger.js";
import { ConsoleLogger } from "./utils/logger.js";
import { TrainingPipeline } from "./pipeline/trainingPipeline.js";
import { ChunkWorker } from "./workers/chunkWorker.js";
import { EmbeddingWorker } from "./workers/embeddingWorker.js";

export interface BootstrapOptions {
  redisUrl?: string;
  databaseUrl?: string;
  logger?: Logger;
}

export interface EmbeddingPipelineHandles {
  trainingPipeline: TrainingPipeline;
  chunkWorker: ChunkWorker;
  embeddingWorker: EmbeddingWorker;
  embeddingQueue: Queue<EmbeddingJobData>;
  chunkQueue: Queue<DocumentChunkJobData>;
  redis: IORedis;
  pool: Pool;
}

export async function bootstrapEmbeddingPipeline(
  options: BootstrapOptions = {}
): Promise<EmbeddingPipelineHandles> {
  const env = getEnv();
  const logger = options.logger ?? new ConsoleLogger();

  const redis = new IORedis(options.redisUrl ?? env.REDIS_URL ?? "redis://127.0.0.1:6379");
  const pool = new Pool({ connectionString: options.databaseUrl ?? env.DATABASE_URL });

  const chunkRepository = new PgChunkRepository(pool);
  const embeddingProvider = new OpenAIEmbeddingClient({ logger });

  const chunkQueue = new Queue<DocumentChunkJobData>(DOCUMENT_CHUNKING_QUEUE, {
    connection: redis,
  });
  const embeddingQueue = new Queue<EmbeddingJobData>(CHUNK_EMBEDDING_QUEUE, {
    connection: redis,
  });

  const chunkWorker = new ChunkWorker({
    queueName: DOCUMENT_CHUNKING_QUEUE,
    chunkRepository,
    embeddingQueue,
    connection: redis,
    logger,
  });

  const embeddingWorker = new EmbeddingWorker({
    queueName: CHUNK_EMBEDDING_QUEUE,
    embeddingProvider,
    chunkRepository,
    connection: redis,
    logger,
  });

  const trainingPipeline = new TrainingPipeline({
    queue: chunkQueue,
    logger,
  });

  return {
    trainingPipeline,
    chunkWorker,
    embeddingWorker,
    embeddingQueue,
    chunkQueue,
    redis,
    pool,
  };
}

export async function shutdownEmbeddingPipeline(handles: EmbeddingPipelineHandles): Promise<void> {
  await handles.trainingPipeline.close();
  await handles.chunkWorker.close();
  await handles.embeddingWorker.close();
  await handles.chunkQueue.close();
  await handles.embeddingQueue.close();
  await handles.redis.quit();
  await handles.pool.end();
}
