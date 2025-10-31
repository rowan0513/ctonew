import type {
  ChunkMetadata,
  DocumentSourceMetadata,
  TokenRange,
} from "../types/chunk.js";

export interface DocumentChunkJobData {
  documentId: string;
  text: string;
  jobId?: string;
  source: DocumentSourceMetadata;
}

export interface EmbeddingJobData {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenRange: TokenRange;
  tokenCount: number;
  metadata: ChunkMetadata;
}
