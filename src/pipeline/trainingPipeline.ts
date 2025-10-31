import { Queue, type QueueOptions } from "bullmq";

import { DOCUMENT_CHUNKING_QUEUE } from "../queues/names.js";
import type { DocumentChunkJobData } from "../queues/jobTypes.js";
import { ConsoleLogger } from "../utils/logger.js";
import type { Logger } from "../utils/logger.js";

export interface TrainingPipelineOptions {
  connection?: QueueOptions["connection"];
  queue?: Queue<DocumentChunkJobData>;
  logger?: Logger;
  chunkQueueName?: string;
}

export class TrainingPipeline {
  private readonly chunkQueue: Queue<DocumentChunkJobData>;
  private readonly logger: Logger;
  private readonly ownsQueue: boolean;

  constructor(private readonly options: TrainingPipelineOptions) {
    this.logger = options.logger ?? new ConsoleLogger();

    if (options.queue) {
      this.chunkQueue = options.queue;
      this.ownsQueue = false;
    } else {
      if (!options.connection) {
        throw new Error("A BullMQ connection is required when no queue instance is provided");
      }

      this.chunkQueue = new Queue<DocumentChunkJobData>(
        options.chunkQueueName ?? DOCUMENT_CHUNKING_QUEUE,
        {
          connection: options.connection,
        }
      );
      this.ownsQueue = true;
    }
  }

  async enqueueDocumentJob(data: DocumentChunkJobData): Promise<string> {
    const job = await this.chunkQueue.add(
      "chunk-document",
      data,
      {
        removeOnComplete: true,
        removeOnFail: false,
        jobId: data.jobId,
      }
    );

    this.logger.info("Document training job enqueued", {
      jobId: job.id,
      documentId: data.documentId,
    });

    return String(job.id);
  }

  getChunkQueue(): Queue<DocumentChunkJobData> {
    return this.chunkQueue;
  }

  async close(): Promise<void> {
    if (this.ownsQueue) {
      await this.chunkQueue.close();
    }
  }
}
