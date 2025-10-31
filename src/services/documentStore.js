const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/client');

const FILE_SOURCE_TYPE = 'file_upload';
const URL_SOURCE_TYPE = 'url';

const DOCUMENT_STATUSES = {
  PENDING_UPLOAD: 'pending_upload',
  QUEUED: 'queued',
  PARSED: 'parsed',
  FAILED: 'failed',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
  CRAWL_PENDING: 'crawl_pending',
  CRAWL_PROCESSING: 'crawl_processing',
  CRAWL_SKIPPED: 'crawl_skipped',
  INDEXED: 'indexed'
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
    sourceType: row.source_type || FILE_SOURCE_TYPE,
    expectedMimeType: row.expected_mime_type,
    canonicalUrl: row.canonical_url || undefined,
    urlHash: row.url_hash || undefined,
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

  const metadata = {
    source_type: FILE_SOURCE_TYPE,
    ...(description ? { description } : {})
  };

  db.prepare(
    `INSERT INTO documents (
      id,
      workspace_id,
      file_name,
      description,
      source_type,
      expected_mime_type,
      s3_bucket,
      s3_key,
      status,
      metadata,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    documentId,
    workspaceId,
    fileName,
    description || null,
    FILE_SOURCE_TYPE,
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

const ensureMetadata = (metadata = {}, fallbackSourceType = URL_SOURCE_TYPE) => {
  if (!metadata.source_type) {
    return {
      ...metadata,
      source_type: fallbackSourceType
    };
  }

  return metadata;
};

const updateDocument = (documentId, workspaceId, updates) => {
  const db = getDb();
  const document = getDocument(documentId, workspaceId);
  if (!document) {
    return null;
  }

  const nextMetadata = {
    ...document.metadata,
    ...(updates.metadata
      ? ensureMetadata(updates.metadata, updates.sourceType || document.sourceType || FILE_SOURCE_TYPE)
      : {})
  };

  const nextIssues = Array.isArray(updates.issues) ? updates.issues : document.issues;
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE documents SET
      source_type = COALESCE(?, source_type),
      mime_type = COALESCE(?, mime_type),
      size_bytes = COALESCE(?, size_bytes),
      hash = COALESCE(?, hash),
      status = ?,
      canonical_url = COALESCE(?, canonical_url),
      url_hash = COALESCE(?, url_hash),
      metadata = ?,
      normalized_text = COALESCE(?, normalized_text),
      issues = ?,
      updated_at = ?
      WHERE id = ? AND workspace_id = ?`
  ).run(
    updates.sourceType || document.sourceType || FILE_SOURCE_TYPE,
    updates.mimeType || null,
    typeof updates.sizeBytes === 'number' ? updates.sizeBytes : null,
    updates.hash || null,
    updates.status || document.status,
    updates.canonicalUrl || document.canonicalUrl || null,
    updates.urlHash || document.urlHash || null,
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
    sourceType: FILE_SOURCE_TYPE,
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

const markDocumentRejected = (documentId, workspaceId, reason, metadata) => {
  return updateDocument(documentId, workspaceId, {
    issues: reason ? [reason] : [],
    metadata,
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

const markDocumentFailed = (documentId, workspaceId, errorMessage, metadata) => {
  return updateDocument(documentId, workspaceId, {
    issues: errorMessage ? [errorMessage] : [],
    metadata,
    status: DOCUMENT_STATUSES.FAILED
  });
};

const listDocumentsForWorkspace = (workspaceId) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM documents WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
  return rows.map(rowToDocument);
};

const findDocumentByUrlHash = (workspaceId, urlHash) => {
  if (!urlHash) {
    return null;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT * FROM documents WHERE workspace_id = ? AND url_hash = ? LIMIT 1')
    .get(workspaceId, urlHash);
  return rowToDocument(row);
};

const findDocumentByHash = (workspaceId, hash) => {
  if (!hash) {
    return null;
  }

  const db = getDb();
  const row = db
    .prepare('SELECT * FROM documents WHERE workspace_id = ? AND hash = ? LIMIT 1')
    .get(workspaceId, hash);
  return rowToDocument(row);
};

const deriveFileNameFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? 'index' : parsed.pathname.replace(/\/+$/g, '').replace(/\//g, '_');
    const base = `${parsed.hostname}_${path || 'index'}`;
    return base.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 200) || 'page';
  } catch (error) {
    return 'page';
  }
};

const createCrawlDocument = ({ workspaceId, url, canonicalUrl, urlHash }) => {
  const db = getDb();
  const now = new Date().toISOString();
  const documentId = uuidv4();
  const canonical = canonicalUrl || url;
  const fileName = deriveFileNameFromUrl(canonical);
  const metadata = ensureMetadata({
    source_type: URL_SOURCE_TYPE,
    url,
    canonicalUrl: canonical,
    title: null,
    language: null,
    crawl: {
      status: DOCUMENT_STATUSES.CRAWL_PENDING,
      queuedAt: now,
      lastCrawledAt: null
    }
  });

  db.prepare(
    `INSERT INTO documents (
      id,
      workspace_id,
      file_name,
      description,
      source_type,
      expected_mime_type,
      canonical_url,
      url_hash,
      mime_type,
      size_bytes,
      hash,
      s3_bucket,
      s3_key,
      status,
      metadata,
      normalized_text,
      issues,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    documentId,
    workspaceId,
    fileName,
    null,
    URL_SOURCE_TYPE,
    'text/html',
    canonical,
    urlHash || null,
    null,
    0,
    null,
    'crawler',
    `crawler/${workspaceId}/${documentId}`,
    DOCUMENT_STATUSES.CRAWL_PENDING,
    JSON.stringify(metadata),
    null,
    null,
    now,
    now
  );

  return getDocument(documentId, workspaceId);
};

const ensureCrawlDocument = ({ workspaceId, url, canonicalUrl, urlHash }) => {
  const canonical = canonicalUrl || url;
  const existing = urlHash ? findDocumentByUrlHash(workspaceId, urlHash) : null;
  const now = new Date().toISOString();

  if (existing) {
    const crawlMetadata = {
      ...(existing.metadata.crawl || {}),
      status: DOCUMENT_STATUSES.CRAWL_PENDING,
      queuedAt: now
    };

    const updated = updateDocument(existing.id, workspaceId, {
      sourceType: URL_SOURCE_TYPE,
      metadata: {
        source_type: URL_SOURCE_TYPE,
        url,
        canonicalUrl: canonical,
        crawl: crawlMetadata
      },
      status: DOCUMENT_STATUSES.CRAWL_PENDING,
      canonicalUrl: canonical,
      urlHash
    });

    return { document: updated, created: false };
  }

  const createdDocument = createCrawlDocument({ workspaceId, url, canonicalUrl: canonical, urlHash });
  return { document: createdDocument, created: true };
};

const markDocumentCrawlProcessing = (documentId, workspaceId) => {
  const now = new Date().toISOString();
  return updateDocument(documentId, workspaceId, {
    sourceType: URL_SOURCE_TYPE,
    metadata: {
      crawl: {
        status: DOCUMENT_STATUSES.CRAWL_PROCESSING,
        startedAt: now
      }
    },
    status: DOCUMENT_STATUSES.CRAWL_PROCESSING
  });
};

const markDocumentIndexed = (documentId, workspaceId, { normalizedText, metadata, hash, canonicalUrl, urlHash, mimeType, sizeBytes }) => {
  const now = new Date().toISOString();
  return updateDocument(documentId, workspaceId, {
    sourceType: URL_SOURCE_TYPE,
    normalizedText,
    metadata: {
      ...(metadata || {}),
      crawl: {
        status: DOCUMENT_STATUSES.INDEXED,
        indexedAt: now,
        lastCrawledAt: now
      }
    },
    hash,
    mimeType: mimeType || 'text/html',
    sizeBytes: typeof sizeBytes === 'number' ? sizeBytes : undefined,
    canonicalUrl,
    urlHash,
    status: DOCUMENT_STATUSES.INDEXED,
    issues: []
  });
};

const markDocumentCrawlSkipped = (documentId, workspaceId, reason, metadata) => {
  const now = new Date().toISOString();
  return updateDocument(documentId, workspaceId, {
    sourceType: URL_SOURCE_TYPE,
    metadata: {
      ...(metadata || {}),
      crawl: {
        status: DOCUMENT_STATUSES.CRAWL_SKIPPED,
        skippedAt: now,
        reason
      }
    },
    status: DOCUMENT_STATUSES.CRAWL_SKIPPED,
    issues: reason ? [reason] : []
  });
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
  markDocumentRejected,
  findDocumentByUrlHash,
  findDocumentByHash,
  ensureCrawlDocument,
  markDocumentCrawlProcessing,
  markDocumentIndexed,
  markDocumentCrawlSkipped
};
