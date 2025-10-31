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

const getDocumentQueue = () => {
  if (queueInstance) {
    return queueInstance;
  }

  queueInstance = new Queue('document-processing', {
    connection: getConnection(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true
    }
  });

  return queueInstance;
};

const enqueueDocumentParsing = async ({ documentId, workspaceId }) => {
  const queue = getDocumentQueue();
  await queue.add('parse-document', { documentId, workspaceId });
};

const closeDocumentQueue = async () => {
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
  closeDocumentQueue,
  enqueueDocumentParsing,
  getConnection,
  getDocumentQueue
};
