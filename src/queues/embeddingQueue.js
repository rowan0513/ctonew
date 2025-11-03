const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const RedisMock = require('ioredis-mock');
const { getEnv } = require('../config/env');

let queueInstance;
let connectionInstance;

const getConnection = () => {
  if (connectionInstance) {
    return connectionInstance;
  }

  const { REDIS_URL } = getEnv();
  if (REDIS_URL === 'mock' || REDIS_URL === 'memory') {
    connectionInstance = new RedisMock();
    return connectionInstance;
  }

  connectionInstance = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
  return connectionInstance;
};

const getEmbeddingQueue = () => {
  if (queueInstance) {
    return queueInstance;
  }

  queueInstance = new Queue('document-embedding', {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: {
        count: 100,
        age: 3600
      },
      removeOnFail: {
        count: 100,
        age: 86400
      }
    }
  });

  return queueInstance;
};

const enqueueDocumentEmbedding = async ({ documentId, workspaceId }) => {
  const queue = getEmbeddingQueue();
  await queue.add('embed-document', { documentId, workspaceId }, {
    jobId: `embed-${workspaceId}-${documentId}`
  });
};

const enqueueWorkspaceTraining = async ({ workspaceId, documentIds }) => {
  const queue = getEmbeddingQueue();
  const jobs = documentIds.map((documentId) => ({
    name: 'embed-document',
    data: { documentId, workspaceId },
    opts: {
      jobId: `embed-${workspaceId}-${documentId}`
    }
  }));

  await queue.addBulk(jobs);
};

const closeEmbeddingQueue = async () => {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }

  if (connectionInstance) {
    if (typeof connectionInstance.quit === 'function') {
      await connectionInstance.quit();
    } else if (typeof connectionInstance.disconnect === 'function') {
      connectionInstance.disconnect();
    }

    connectionInstance = null;
  }
};

module.exports = {
  closeEmbeddingQueue,
  enqueueDocumentEmbedding,
  enqueueWorkspaceTraining,
  getConnection,
  getEmbeddingQueue
};
