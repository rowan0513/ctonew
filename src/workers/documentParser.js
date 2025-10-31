const { Worker } = require('bullmq');
const { getDocument, markDocumentFailed, markDocumentParsed } = require('../services/documentStore');
const { getConnection } = require('../queues/documentQueue');
const { getObjectBuffer } = require('../services/storageService');
const { parseDocumentBuffer } = require('../services/documentParser');

let workerInstance;

const startDocumentParserWorker = () => {
  if (workerInstance) {
    return workerInstance;
  }

  workerInstance = new Worker(
    'document-processing',
    async (job) => {
      const { documentId, workspaceId } = job.data;
      const document = getDocument(documentId, workspaceId);

      if (!document) {
        return;
      }

      try {
        const { buffer } = await getObjectBuffer(document.s3Key);
        const parseResult = await parseDocumentBuffer({
          buffer,
          mimeType: document.mimeType || document.expectedMimeType
        });

        await markDocumentParsed(documentId, workspaceId, {
          normalizedText: parseResult.text,
          metadata: {
            parsed: parseResult.metadata
          }
        });
      } catch (error) {
        await markDocumentFailed(documentId, workspaceId, error.message);
        throw error;
      }
    },
    {
      connection: getConnection()
    }
  );

  workerInstance.on('failed', (job, error) => {
    if (!job?.data) {
      return;
    }

    const { documentId, workspaceId } = job.data;
    markDocumentFailed(documentId, workspaceId, error.message);
  });

  return workerInstance;
};

const stopDocumentParserWorker = async () => {
  if (!workerInstance) {
    return;
  }

  await workerInstance.close();
  workerInstance = null;
};

module.exports = {
  startDocumentParserWorker,
  stopDocumentParserWorker
};
