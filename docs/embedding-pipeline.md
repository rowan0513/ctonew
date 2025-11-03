# Document Embedding Pipeline

## Overview

The document embedding pipeline automatically chunks documents and creates OpenAI embeddings for RAG (Retrieval Augmented Generation) retrieval.

## Components

### 1. Chunking Utility (`src/utils/textChunker.js`)

Splits text into segments using tiktoken with gpt-3.5-turbo encoding.

**Features:**
- Configurable chunk size: 500-1000 tokens (default)
- Overlap: 150 tokens (default)
- Uses tiktoken for accurate token counting

**Usage:**
```javascript
const { chunkText } = require('./src/utils/textChunker');

const chunks = chunkText(documentText, {
  minTokens: 500,
  maxTokens: 1000,
  overlapTokens: 150,
  model: 'gpt-3.5-turbo'
});
```

### 2. Language Detection (`src/utils/languageDetector.js`)

Detects whether a chunk is in Dutch (NL) or English (EN).

**Features:**
- Pattern matching for Dutch/English common words
- Dutch digraph detection (ij, aa, ee, etc.)
- Dutch-specific word patterns

**Usage:**
```javascript
const { detectLanguage } = require('./src/utils/languageDetector');

const language = detectLanguage(chunkText); // 'en' or 'nl'
```

### 3. OpenAI Embeddings Service (`src/services/openaiEmbeddings.js`)

Calls OpenAI embeddings API to generate vector embeddings.

**Features:**
- Uses text-embedding-3-large model (3072 dimensions)
- Batch processing support
- Error handling with retry logic

**Configuration:**
Requires `OPENAI_API_KEY` environment variable.

### 4. BullMQ Queue (`src/queues/embeddingQueue.js`)

Manages job queuing for document embedding.

**Features:**
- Exponential backoff on rate limits (5 attempts)
- Job deduplication by document ID
- Bulk job enqueueing for workspace training

**Queue Name:** `document-embedding`

### 5. Embedding Worker (`src/workers/embeddingWorker.js`)

Processes embedding jobs from the queue.

**Process:**
1. Fetch document from Postgres
2. Extract document content (from metadata.content or summary)
3. Chunk the text
4. Detect language for each chunk
5. Generate embeddings in batches (10 chunks per batch)
6. Store chunks with vectors in `document_chunks` table
7. Handle rate limits with automatic retry

**Features:**
- Concurrency: 2 workers
- Rate limiting: 10 requests per 60 seconds
- Automatic retry on OpenAI rate limits
- Comprehensive logging

### 6. Training API Endpoint

**Endpoint:** `POST /api/admin/workspaces/:id/train`

Triggers embedding jobs for all published documents in a workspace.

**Response:**
```json
{
  "success": true,
  "message": "Training jobs queued successfully",
  "workspaceId": "uuid",
  "documentCount": 5
}
```

## Database Schema

### document_chunks Table

```typescript
{
  id: uuid,
  workspaceId: uuid,
  documentId: uuid,
  chunkIndex: integer,
  content: text,
  tokenCount: integer,
  embeddingModel: text,
  vector: vector(3072),  // pgvector
  metadata: jsonb,       // { source_type, url, filename, title, language, checksum }
  createdAt: timestamp
}
```

## Environment Variables

Required environment variables:

```bash
OPENAI_API_KEY=sk-...           # OpenAI API key
POSTGRES_URL=postgresql://...   # Postgres connection string with pgvector
REDIS_URL=redis://localhost:6379 # Redis for BullMQ
```

## Usage

### Starting the Worker

The embedding worker starts automatically with the application:

```bash
npm run server:start
```

To disable background workers:
```bash
DISABLE_BACKGROUND_WORKERS=true npm run server:start
```

### Triggering Training

Make a POST request to train a workspace:

```bash
curl -X POST http://localhost:3000/api/admin/workspaces/{workspaceId}/train \
  -H "Content-Type: application/json"
```

### Monitoring Jobs

Check job status via the admin endpoints:

```bash
# Get job queue summary
GET /admin/jobs/summary

# Get metrics
GET /admin/jobs/metrics
```

## Error Handling

The pipeline includes comprehensive error handling:

1. **Rate Limits**: Automatic exponential backoff (2s, 4s, 8s, 16s, 32s)
2. **Missing Documents**: Gracefully skip and log
3. **Empty Content**: Skip with warning
4. **API Errors**: Retry with backoff, log failures
5. **Database Errors**: Transaction rollback, detailed logging

## Testing

Run the chunking tests:

```bash
npm test tests/chunking.test.js
```

## Architecture Notes

- **Hybrid Database**: SQLite for document metadata (Express backend), Postgres with pgvector for embeddings (Next.js app)
- **Module System**: CommonJS for workers/services, ESM for Next.js routes
- **Job Deduplication**: Uses `jobId: embed-${workspaceId}-${documentId}` to prevent duplicate jobs

## Performance

- **Chunking**: ~1000 tokens per chunk with 150 token overlap
- **Embedding Batch Size**: 10 chunks per API call
- **Worker Concurrency**: 2 concurrent jobs
- **Rate Limit**: 10 requests per minute to OpenAI

## Acceptance Criteria

✅ Chunking produces 500-1000 token segments with 150 overlap  
✅ Language detection correctly identifies NL/EN chunks  
✅ Worker successfully calls OpenAI API and stores vector embeddings  
✅ Failed jobs retry with backoff and log errors  
✅ Training endpoint queues jobs for all workspace documents  
✅ OpenAI API key from env (no hardcoded secrets)  
✅ Metadata stored: source_type, url, filename, title, language, checksum
