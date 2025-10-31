const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const { getLogger } = require('../observability/logger');
const { generateChatResponse } = require('./chat');

class JobQueue extends EventEmitter {
  constructor({ concurrency = 1 } = {}) {
    super();
    this.concurrency = concurrency;
    this.handlers = new Map();
    this.queue = [];
    this.jobs = new Map();
    this.activeCount = 0;
    this.metrics = {
      queued: 0,
      active: 0,
      completed: 0,
      failed: 0,
      retries: 0
    };
  }

  registerHandler(name, handler, options = {}) {
    this.handlers.set(name, {
      handler,
      maxAttempts: options.maxAttempts ?? 3
    });
    return this;
  }

  enqueue(name, payload, options = {}) {
    const config = this.handlers.get(name) || {};
    const handler = options.handler || config.handler;

    if (typeof handler !== 'function') {
      throw new Error(`No handler registered for job type "${name}"`);
    }

    const job = {
      id: randomUUID(),
      name,
      payload,
      status: 'queued',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      maxAttempts: options.maxAttempts ?? config.maxAttempts ?? 3,
      handler,
      result: null,
      error: null
    };

    job.finished = new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });

    this.jobs.set(job.id, job);
    this.queue.push(job.id);
    this.metrics.queued += 1;
    this.emit('queued', job);
    setImmediate(() => this.#process());
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  retryJob(jobId) {
    const job = this.jobs.get(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found.`);
    }

    if (job.status !== 'failed') {
      throw new Error('Only failed jobs can be retried.');
    }

    job.status = 'queued';
    job.error = null;
    job.updatedAt = new Date().toISOString();
    job.maxAttempts += 1;

    this.metrics.failed = Math.max(this.metrics.failed - 1, 0);
    this.metrics.queued += 1;
    this.metrics.retries += 1;

    this.queue.push(job.id);
    this.emit('retry', job);
    setImmediate(() => this.#process());

    return job;
  }

  getSummary() {
    const serializeJob = (job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      result: job.result,
      error: job.error ? { message: job.error.message || job.error } : null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });

    const jobs = Array.from(this.jobs.values());

    return {
      metrics: { ...this.metrics },
      jobs: {
        queued: jobs.filter((job) => job.status === 'queued').map(serializeJob),
        active: jobs.filter((job) => job.status === 'active').map(serializeJob),
        completed: jobs.filter((job) => job.status === 'completed').map(serializeJob),
        failed: jobs.filter((job) => job.status === 'failed').map(serializeJob)
      }
    };
  }

  renderMetrics() {
    return [
      '# HELP job_queue_queued Number of jobs currently waiting to be processed',
      '# TYPE job_queue_queued gauge',
      `job_queue_queued ${this.metrics.queued}`,
      '# HELP job_queue_active Number of jobs currently being processed',
      '# TYPE job_queue_active gauge',
      `job_queue_active ${this.metrics.active}`,
      '# HELP job_queue_completed_total Total number of jobs completed successfully',
      '# TYPE job_queue_completed_total counter',
      `job_queue_completed_total ${this.metrics.completed}`,
      '# HELP job_queue_failed_total Total number of jobs that failed permanently',
      '# TYPE job_queue_failed_total counter',
      `job_queue_failed_total ${this.metrics.failed}`,
      '# HELP job_queue_retries_total Total number of job retries',
      '# TYPE job_queue_retries_total counter',
      `job_queue_retries_total ${this.metrics.retries}`
    ].join('\n');
  }

  async #process() {
    if (this.activeCount >= this.concurrency) {
      return;
    }

    const jobId = this.queue.shift();

    if (!jobId) {
      return;
    }

    const job = this.jobs.get(jobId);

    if (!job) {
      setImmediate(() => this.#process());
      return;
    }

    this.metrics.queued = Math.max(this.metrics.queued - 1, 0);
    this.activeCount += 1;
    this.metrics.active += 1;

    job.status = 'active';
    job.attempts += 1;
    job.startedAt = new Date().toISOString();
    job.updatedAt = job.startedAt;

    const jobLogger = getLogger({ jobId: job.id, jobName: job.name, attempts: job.attempts });
    jobLogger.debug({ event: 'job.started' }, 'Job picked up for processing.');
    this.emit('active', job);

    try {
      const result = await job.handler(job.payload, job);
      job.result = result;
      job.completedAt = new Date().toISOString();
      job.updatedAt = job.completedAt;
      job.status = 'completed';
      this.metrics.completed += 1;
      job.resolve(result);
      jobLogger.info({ event: 'job.completed', durationMs: Date.parse(job.completedAt) - Date.parse(job.startedAt) }, 'Job completed successfully.');
      this.emit('completed', job);
    } catch (error) {
      job.error = error;
      job.updatedAt = new Date().toISOString();

      if (job.attempts < job.maxAttempts) {
        job.status = 'queued';
        this.queue.push(job.id);
        this.metrics.queued += 1;
        this.metrics.retries += 1;
        jobLogger.warn({ event: 'job.retrying', attempts: job.attempts, error: error.message }, 'Job failed, retrying.');
        this.emit('retry', job, error);
      } else {
        job.status = 'failed';
        job.failedAt = new Date().toISOString();
        this.metrics.failed += 1;
        job.reject(error);
        jobLogger.error({ event: 'job.failed', error: error.message }, 'Job failed');
        this.emit('failed', job, error);
      }
    } finally {
      this.metrics.active = Math.max(this.metrics.active - 1, 0);
      this.activeCount = Math.max(this.activeCount - 1, 0);
      setImmediate(() => this.#process());
    }
  }
}

const jobQueue = new JobQueue({ concurrency: Number(process.env.JOB_QUEUE_CONCURRENCY || 2) });

jobQueue.registerHandler('chat-response', async (payload) => {
  return generateChatResponse(payload);
});

module.exports = {
  JobQueue,
  jobQueue
};
