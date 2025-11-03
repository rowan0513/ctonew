const { Worker } = require('bullmq');
const { getConnection } = require('../queues/embeddingQueue');

let workerInstance;

const processEmbeddingJob = async (job) => {
  const { documentId, workspaceId } = job.data;

  const logger = {
    info: (data, message) => {
      console.log(`[Embedding Worker] ${message}`, data);
    },
    error: (data, message) => {
      console.error(`[Embedding Worker ERROR] ${message}`, data);
    }
  };

  try {
    logger.info({ documentId, workspaceId, jobId: job.id }, 'Starting document embedding job');

    const { getDocument, storeDocumentChunk, deleteDocumentChunks } = require('../services/postgresDocuments');
    const { chunkText } = require('../utils/textChunker');
    const { detectLanguage } = require('../utils/languageDetector');
    const { createEmbeddingsBatch } = require('../services/openaiEmbeddings');

    const document = await getDocument(documentId, workspaceId);

    if (!document) {
      logger.error({ documentId, workspaceId }, 'Document not found');
      throw new Error(`Document ${documentId} not found in workspace ${workspaceId}`);
    }

    let documentText = '';
    
    if (document.summary) {
      documentText = `${document.title}\n\n${document.summary}`;
    } else {
      documentText = document.title;
    }

    if (document.metadata && typeof document.metadata === 'object') {
      if (document.metadata.content) {
        documentText = document.metadata.content;
      } else if (document.metadata.text) {
        documentText = document.metadata.text;
      } else if (document.metadata.normalizedText) {
        documentText = document.metadata.normalizedText;
      }
    }

    if (!documentText || documentText.trim().length === 0) {
      logger.error({ documentId, workspaceId }, 'Document has no content to embed');
      throw new Error(`Document ${documentId} has no content`);
    }

    logger.info({ documentId, workspaceId, contentLength: documentText.length }, 'Document content retrieved');

    const chunks = chunkText(documentText, {
      minTokens: 500,
      maxTokens: 1000,
      overlapTokens: 150,
      model: 'gpt-3.5-turbo'
    });

    logger.info({ documentId, workspaceId, chunkCount: chunks.length }, 'Document chunked');

    await deleteDocumentChunks(documentId, workspaceId);

    const BATCH_SIZE = 10;
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map(chunk => chunk.text);

      try {
        const embeddings = await createEmbeddingsBatch(batchTexts, 'text-embedding-3-large');

        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings[j];
          const language = detectLanguage(chunk.text);

          const metadata = {
            source_type: document.metadata?.source_type || 'document',
            url: document.metadata?.url,
            filename: document.metadata?.filename,
            title: document.title,
            language,
            checksum: document.contentHash
          };

          await storeDocumentChunk({
            workspaceId,
            documentId,
            chunkIndex: i + j,
            content: chunk.text,
            tokenCount: chunk.tokenCount,
            embeddingModel: embedding.model,
            vector: embedding.embedding,
            metadata
          });

          processedChunks++;
        }

        logger.info(
          { documentId, workspaceId, processedChunks, totalChunks: chunks.length },
          `Processed batch ${Math.floor(i / BATCH_SIZE) + 1}`
        );
      } catch (error) {
        if (error.status === 429) {
          logger.error({ documentId, workspaceId, error: error.message }, 'Rate limit hit, retrying...');
          throw error;
        }

        logger.error({ documentId, workspaceId, error: error.message, stack: error.stack }, 'Error processing batch');
        throw error;
      }
    }

    logger.info({ documentId, workspaceId, totalChunks: processedChunks }, 'Document embedding completed successfully');

    return {
      documentId,
      workspaceId,
      chunksProcessed: processedChunks
    };
  } catch (error) {
    logger.error(
      { documentId, workspaceId, error: error.message, stack: error.stack, jobId: job.id },
      'Document embedding job failed'
    );
    throw error;
  }
};

const startEmbeddingWorker = () => {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(
    'document-embedding',
    processEmbeddingJob,
    {
      connection: getConnection(),
      concurrency: 2,
      limiter: {
        max: 10,
        duration: 60000
      }
    }
  );

  workerInstance.on('completed', (job, result) => {
    console.log(`[Embedding Worker] Job ${job.id} completed:`, result);
  });

  workerInstance.on('failed', (job, error) => {
    console.error(`[Embedding Worker] Job ${job?.id} failed:`, error.message);
  });

  workerInstance.on('error', (error) => {
    console.error('[Embedding Worker] Worker error:', error);
  });

  return workerInstance;
};

const stopEmbeddingWorker = async () => {
  if (!workerInstance) {
    return;
  }

  await workerInstance.close();
  workerInstance = null;
};

module.exports = {
  startEmbeddingWorker,
  stopEmbeddingWorker
};
