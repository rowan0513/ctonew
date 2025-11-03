import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { documents, documentChunks } from "@/src/schema";

export interface DocumentMetadata {
  source_type?: string;
  url?: string;
  filename?: string;
  title?: string;
  language?: string;
  checksum?: string;
}

export async function getDocument(documentId: string, workspaceId: string) {
  const db = getDb();

  const result = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.workspaceId, workspaceId)))
    .limit(1);

  return result[0] ?? null;
}

export async function getDocumentsForWorkspace(workspaceId: string) {
  const db = getDb();

  const result = await db
    .select()
    .from(documents)
    .where(eq(documents.workspaceId, workspaceId));

  return result;
}

export async function storeDocumentChunk(data: {
  workspaceId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingModel: string;
  vector: number[];
  metadata?: DocumentMetadata;
}) {
  const db = getDb();

  const vectorString = `[${data.vector.join(",")}]`;

  await db
    .insert(documentChunks)
    .values({
      workspaceId: data.workspaceId,
      documentId: data.documentId,
      chunkIndex: data.chunkIndex,
      content: data.content,
      tokenCount: data.tokenCount,
      embeddingModel: data.embeddingModel,
      vector: vectorString as any,
      metadata: data.metadata || {},
    })
    .onConflictDoUpdate({
      target: [documentChunks.documentId, documentChunks.chunkIndex],
      set: {
        content: data.content,
        tokenCount: data.tokenCount,
        embeddingModel: data.embeddingModel,
        vector: vectorString as any,
        metadata: data.metadata || {},
      },
    });
}

export async function deleteDocumentChunks(documentId: string, workspaceId: string) {
  const db = getDb();

  await db
    .delete(documentChunks)
    .where(and(eq(documentChunks.documentId, documentId), eq(documentChunks.workspaceId, workspaceId)));
}

export async function getDocumentChunks(documentId: string, workspaceId: string) {
  const db = getDb();

  const result = await db
    .select()
    .from(documentChunks)
    .where(and(eq(documentChunks.documentId, documentId), eq(documentChunks.workspaceId, workspaceId)));

  return result;
}
