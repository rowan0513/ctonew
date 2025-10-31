const { getLogger } = require('../observability/logger');

class WorkspaceRateLimiter {
  constructor({ limit, windowMs } = {}) {
    this.limit = Number(limit ?? process.env.CHAT_RATE_LIMIT ?? 20);
    this.windowMs = Number(windowMs ?? process.env.CHAT_RATE_LIMIT_WINDOW_MS ?? 60_000);
    this.buckets = new Map();
  }

  #getLimit() {
    this.limit = Number(process.env.CHAT_RATE_LIMIT ?? this.limit ?? 20);
    return this.limit;
  }

  #getWindowMs() {
    this.windowMs = Number(process.env.CHAT_RATE_LIMIT_WINDOW_MS ?? this.windowMs ?? 60_000);
    return this.windowMs;
  }

  consume(workspaceId) {
    const limit = this.#getLimit();
    const windowMs = this.#getWindowMs();
    const now = Date.now();
    let bucket = this.buckets.get(workspaceId);

    if (!bucket || now >= bucket.reset) {
      const reset = now + windowMs;
      bucket = { count: 1, reset };
      this.buckets.set(workspaceId, bucket);
      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        reset
      };
    }

    if (bucket.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        reset: bucket.reset
      };
    }

    bucket.count += 1;

    return {
      allowed: true,
      remaining: Math.max(limit - bucket.count, 0),
      reset: bucket.reset
    };
  }

  reset(workspaceId) {
    if (workspaceId) {
      this.buckets.delete(workspaceId);
    } else {
      this.buckets.clear();
    }
  }

  getState(workspaceId) {
    return this.buckets.get(workspaceId);
  }
}

const workspaceRateLimiter = new WorkspaceRateLimiter();

const chatRateLimit = (req, res, next) => {
  const workspaceId = req.headers['x-workspace-id'] || 'anonymous';
  const { allowed, remaining, reset } = workspaceRateLimiter.consume(workspaceId);
  const limit = workspaceRateLimiter.limit;

  const resetSeconds = Math.max(Math.ceil((reset - Date.now()) / 1000), 0);

  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', allowed ? remaining : 0);
  res.setHeader('X-RateLimit-Reset', Math.ceil(reset / 1000));

  if (!allowed) {
    res.setHeader('Retry-After', resetSeconds);
    const logger = res.locals.logger || getLogger({ workspaceId });
    logger.warn(
      {
        event: 'rate_limit.exceeded',
        workspaceId,
        limit,
        resetSeconds
      },
      'Workspace exceeded chat rate limit.'
    );

    return res.status(429).json({
      error: 'RateLimitExceeded',
      message: 'Workspace has exceeded the allowed chat request rate. Please retry later.'
    });
  }

  res.locals.rateLimit = {
    limit,
    remaining,
    reset
  };

  return next();
};

module.exports = {
  WorkspaceRateLimiter,
  workspaceRateLimiter,
  chatRateLimit
};
