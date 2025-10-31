import { Pool } from "pg";
import { registerTypeParser, toSql } from "pgvector/node";

import type { ChunkRecord, ChunkStatus, NewChunkRecord } from "../types/chunk.js";

export interface ChunkRepository {
  createOrUpdateChunk(record: NewChunkRecord): Promise<void>;
  markChunkProcessing(chunkId: string): Promise<void>;
  markChunkRetrying(chunkId: string, delayMs: number): Promise<void>;
  markChunkVectorized(chunkId: string, vector: number[]): Promise<void>;
  markChunkFailed(chunkId: string, error: string): Promise<void>;
  getChunk(chunkId: string): Promise<ChunkRecord | null>;
}

const UPDATE_SENSOR_COLUMNS = [
  "text",
  "token_count",
  "token_start",
  "token_end",
  "job_id",
  "source_type",
  "url",
  "filename",
  "title",
  "language",
  "checksum",
  "status",
];

export class PgChunkRepository implements ChunkRepository {
  constructor(private readonly pool: Pool) {
    registerTypeParser(pool);
  }

  async createOrUpdateChunk(record: ChunkRecord): Promise<void> {
    const query = `
      INSERT INTO document_chunks (
        chunk_id,
        document_id,
        chunk_index,
        text,
        token_count,
        token_start,
        token_end,
        job_id,
        source_type,
        url,
        filename,
        title,
        language,
        checksum,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      ON CONFLICT (chunk_id) DO UPDATE SET
        ${UPDATE_SENSOR_COLUMNS.map((column, idx) => `${column} = $${idx + 16}`).join(",\n        ")},
        updated_at = NOW()
    `;

    const values = [
      record.chunkId,
      record.documentId,
      record.chunkIndex,
      record.text,
      record.tokenCount,
      record.tokenRange.start,
      record.tokenRange.end,
      record.metadata.jobId,
      record.metadata.sourceType,
      record.metadata.url ?? null,
      record.metadata.filename ?? null,
      record.metadata.title ?? null,
      record.metadata.language,
      record.metadata.checksum,
      record.status,
      record.text,
      record.tokenCount,
      record.tokenRange.start,
      record.tokenRange.end,
      record.metadata.jobId,
      record.metadata.sourceType,
      record.metadata.url ?? null,
      record.metadata.filename ?? null,
      record.metadata.title ?? null,
      record.metadata.language,
      record.metadata.checksum,
      record.status,
    ];

    await this.pool.query(query, values);
  }

  async markChunkProcessing(chunkId: string): Promise<void> {
    await this.updateStatus(chunkId, "processing");
  }

  async markChunkRetrying(chunkId: string, _delayMs: number): Promise<void> {
    await this.pool.query(
      `
        UPDATE document_chunks
        SET status = $2,
            updated_at = NOW(),
            error = NULL
        WHERE chunk_id = $1
      `,
      [chunkId, "retrying"]
    );
  }

  async markChunkVectorized(chunkId: string, vector: number[]): Promise<void> {
    await this.pool.query(
      `
        UPDATE document_chunks
        SET status = 'vectorized',
            updated_at = NOW(),
            error = NULL,
            vector = $2
        WHERE chunk_id = $1
      `,
      [chunkId, toSql(vector)]
    );
  }

  async markChunkFailed(chunkId: string, error: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE document_chunks
        SET status = 'failed',
            updated_at = NOW(),
            error = $2
        WHERE chunk_id = $1
      `,
      [chunkId, error]
    );
  }

  async getChunk(chunkId: string): Promise<ChunkRecord | null> {
    const result = await this.pool.query(
      `
        SELECT
          chunk_id,
          document_id,
          chunk_index,
          text,
          token_count,
          token_start,
          token_end,
          job_id,
          source_type,
          url,
          filename,
          title,
          language,
          checksum,
          status,
          vector,
          error,
          created_at,
          updated_at
        FROM document_chunks
        WHERE chunk_id = $1
      `,
      [chunkId]
    );

    if (!result.rowCount) {
      return null;
    }

    const row = result.rows[0];

    return {
      chunkId: row.chunk_id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      text: row.text,
      tokenCount: row.token_count,
      tokenRange: {
        start: row.token_start,
        end: row.token_end,
      },
      metadata: {
        sourceType: row.source_type,
        url: row.url,
        filename: row.filename,
        title: row.title,
        language: row.language,
        checksum: row.checksum,
        jobId: row.job_id,
      },
      status: row.status as ChunkStatus,
      vector: row.vector ?? null,
      error: row.error ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async updateStatus(chunkId: string, status: ChunkStatus): Promise<void> {
    await this.pool.query(
      `
        UPDATE document_chunks
        SET status = $2,
            updated_at = NOW(),
            error = NULL
        WHERE chunk_id = $1
      `,
      [chunkId, status]
    );
  }
}
