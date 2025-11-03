const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { eq, and } = require('drizzle-orm');
const schema = require('../../src/schema');

let pool = null;
let db = null;

function getDb() {
  if (db) {
    return db;
  }

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('POSTGRES_URL or DATABASE_URL environment variable is required');
  }

  pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });

  return db;
}

async function getDocument(documentId, workspaceId) {
  const database = getDb();

  const result = await database
    .select()
    .from(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.workspaceId, workspaceId)))
    .limit(1);

  return result[0] ?? null;
}

async function getDocumentsForWorkspace(workspaceId) {
  const database = getDb();

  const result = await database
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.workspaceId, workspaceId));

  return result;
}

async function storeDocumentChunk(data) {
  const database = getDb();

  const vectorString = `[${data.vector.join(',')}]`;

  await database
    .insert(schema.documentChunks)
    .values({
      workspaceId: data.workspaceId,
      documentId: data.documentId,
      chunkIndex: data.chunkIndex,
      content: data.content,
      tokenCount: data.tokenCount,
      embeddingModel: data.embeddingModel,
      vector: vectorString,
      metadata: data.metadata || {}
    })
    .onConflictDoUpdate({
      target: [schema.documentChunks.documentId, schema.documentChunks.chunkIndex],
      set: {
        content: data.content,
        tokenCount: data.tokenCount,
        embeddingModel: data.embeddingModel,
        vector: vectorString,
        metadata: data.metadata || {}
      }
    });
}

async function deleteDocumentChunks(documentId, workspaceId) {
  const database = getDb();

  await database
    .delete(schema.documentChunks)
    .where(
      and(
        eq(schema.documentChunks.documentId, documentId),
        eq(schema.documentChunks.workspaceId, workspaceId)
      )
    );
}

async function getDocumentChunks(documentId, workspaceId) {
  const database = getDb();

  const result = await database
    .select()
    .from(schema.documentChunks)
    .where(
      and(
        eq(schema.documentChunks.documentId, documentId),
        eq(schema.documentChunks.workspaceId, workspaceId)
      )
    );

  return result;
}

function closeDb() {
  if (pool) {
    pool.end();
    pool = null;
    db = null;
  }
}

module.exports = {
  getDocument,
  getDocumentsForWorkspace,
  storeDocumentChunk,
  deleteDocumentChunks,
  getDocumentChunks,
  closeDb
};
