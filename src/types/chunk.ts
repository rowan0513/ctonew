export type DocumentLanguage = "en" | "nl" | "unknown";

export interface DocumentSourceMetadata {
  sourceType: string;
  url?: string | null;
  filename?: string | null;
  title?: string | null;
}

export interface TokenRange {
  start: number;
  end: number;
}

export interface ChunkMetadata extends DocumentSourceMetadata {
  language: DocumentLanguage;
  checksum: string;
  jobId: string;
}

export type ChunkStatus =
  | "queued"
  | "processing"
  | "vectorized"
  | "failed"
  | "retrying";

export interface ChunkRecord {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenCount: number;
  tokenRange: TokenRange;
  metadata: ChunkMetadata;
  status: ChunkStatus;
  vector?: number[] | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewChunkRecord = Omit<ChunkRecord, "createdAt" | "updatedAt">;
