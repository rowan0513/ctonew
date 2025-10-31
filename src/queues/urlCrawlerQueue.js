const { Queue } = require('bullmq');
const { getConnection } = require('./documentQueue');

let queueInstance;

const getUrlCrawlerQueue = () => {
  if (queueInstance) {
    return queueInstance;
  }

  queueInstance = new Queue('url-crawler', {
    connection: getConnection(),
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true
    }
  });

  return queueInstance;
};

const enqueueUrlCrawl = async ({ workspaceId, documentId, url }) => {
  const queue = getUrlCrawlerQueue();
  const jobId = `${documentId}:${Date.now()}`;
  await queue.add(
    'crawl-url',
    {
      workspaceId,
      documentId,
      url
    },
    {
      jobId
    }
  );

  return jobId;
};

const closeUrlCrawlerQueue = async () => {
  if (!queueInstance) {
    return;
  }

  await queueInstance.close();
  queueInstance = null;
};

module.exports = {
  enqueueUrlCrawl,
  getUrlCrawlerQueue,
  closeUrlCrawlerQueue
};
