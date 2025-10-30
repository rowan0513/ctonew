const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/client');

const DOCUMENT_STATUSES = {
  PENDING_UPLOAD: 'pending_upload',
  QUEUED: 'queued',
  PARSED: 'parsed',
  FAILED: 'failed',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review'
};

const parseJsonColumn = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const rowToDocument = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fileName: row.file_name,
    description: row.description || undefined,
    expectedMimeType: row.expected_mime_type,
    mimeType: row.mime_type || undefined,
    sizeBytes: row.size_bytes || 0,
    hash: row.hash || undefined,
    s3Bucket: row.s3_bucket,
    s3Key: row.s3_key,
    status: row.status,
    metadata: parseJsonColumn(row.metadata) || {},
    normalizedText: row.normalized_text || undefined,
    issues: parseJsonColumn(row.issues) || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const createPendingDocument = ({
  id,
  workspaceId,
  fileName,
  description,
  expectedMimeType,
  s3Bucket,
  s3Key
}) => {
  const db = getDb();
  const now = new Date().toISOString();
  const documentId = id || uuidv4();

  const metadata = description ? { description } : {};

  db.prepare(
    `INSERT INTO documents (
      id,
      workspace_id,
      file_name,
      description,
      expected_mime_type,
      s3_bucket,
      s3_key,
      status,
      metadata,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    documentId,
    workspaceId,
    fileName,
    description || null,
    expectedMimeType,
    s3Bucket,
    s3Key,
    DOCUMENT_STATUSES.PENDING_UPLOAD,
    Object.keys(metadata).length ? JSON.stringify(metadata) : null,
    now,
    now
  );

  return getDocument(documentId, workspaceId);
};

const getDocument = (documentId, workspaceId) => {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM documents WHERE id = ? AND workspace_id = ? LIMIT 1')
    .get(documentId, workspaceId);
  return rowToDocument(row);
};

const updateDocument = (documentId, workspaceId, updates) => {
  const db = getDb();
  const document = getDocument(documentId, workspaceId);
  if (!document) {
    return null;
  }

  const nextMetadata = {
    ...document.metadata,
    ...(updates.metadata || {})
  };

  const nextIssues = Array.isArray(updates.issues) ? updates.issues : document.issues;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE documents SET
      mime_type = COALESCE(?, mime_type),
      size_bytes = COALESCE(?, size_bytes),
      hash = COALESCE(?, hash),
      status = ?,
      metadata = ?,
      normalized_text = COALESCE(?, normalized_text),
      issues = ?,
      updated_at = ?
      WHERE id = ? AND workspace_id = ?`
  ).run(
    updates.mimeType || null,
    typeof updates.sizeBytes === 'number' ? updates.sizeBytes : null,
    updates.hash || null,
    updates.status || document.status,
    Object.keys(nextMetadata).length ? JSON.stringify(nextMetadata) : null,
    updates.normalizedText || null,
    nextIssues && nextIssues.length ? JSON.stringify(nextIssues) : null,
    now,
    documentId,
    workspaceId
  );

  return getDocument(documentId, workspaceId);
};

const markDocumentQueued = (documentId, workspaceId, { mimeType, sizeBytes, hash, issues, metadata, status }) => {
  return updateDocument(documentId, workspaceId, {
    mimeType,
    sizeBytes,
    hash,
    issues: issues || [],
    metadata,
    status: status || DOCUMENT_STATUSES.QUEUED
  });
};

const markDocumentNeedsReview = (documentId, workspaceId, { issues, metadata, reason }) => {
  return updateDocument(documentId, workspaceId, {
    issues: issues || (reason ? [reason] : []),
    metadata,
    status: DOCUMENT_STATUSES.NEEDS_REVIEW
  });
};

const markDocumentRejected = (documentId, workspaceId, reason) => {
  return updateDocument(documentId, workspaceId, {
    issues: reason ? [reason] : [],
    status: DOCUMENT_STATUSES.REJECTED
  });
};

const markDocumentParsed = (documentId, workspaceId, { normalizedText, metadata }) => {
  return updateDocument(documentId, workspaceId, {
    normalizedText,
    metadata,
    status: DOCUMENT_STATUSES.PARSED
  });
};

const markDocumentFailed = (documentId, workspaceId, errorMessage) => {
  return updateDocument(documentId, workspaceId, {
    issues: errorMessage ? [errorMessage] : [],
    status: DOCUMENT_STATUSES.FAILED
  });
};

const listDocumentsForWorkspace = (workspaceId) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM documents WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
  return rows.map(rowToDocument);
};

module.exports = {
  DOCUMENT_STATUSES,
  createPendingDocument,
  getDocument,
  listDocumentsForWorkspace,
  markDocumentFailed,
  markDocumentNeedsReview,
  markDocumentParsed,
  markDocumentQueued,
  markDocumentRejected
};
