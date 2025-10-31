const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const dependencyChecks = {
  database: async () => {
    if (!process.env.DATABASE_URL) {
      return {
        status: 'unconfigured',
        message: 'DATABASE_URL environment variable is not set.'
      };
    }

    if (process.env.DATABASE_HEALTHCHECK_FAIL === 'true') {
      throw new Error('Database connectivity check failed.');
    }

    await sleep(15);

    return {
      status: 'ok'
    };
  },
  redis: async () => {
    if (!process.env.REDIS_URL) {
      return {
        status: 'unconfigured',
        message: 'REDIS_URL environment variable is not set.'
      };
    }

    if (process.env.REDIS_HEALTHCHECK_FAIL === 'true') {
      throw new Error('Redis connectivity check failed.');
    }

    await sleep(10);

    return {
      status: 'ok'
    };
  },
  openai: async () => {
    if (!process.env.OPENAI_API_KEY) {
      return {
        status: 'unconfigured',
        message: 'OPENAI_API_KEY environment variable is not set.'
      };
    }

    if (process.env.OPENAI_HEALTHCHECK_FAIL === 'true') {
      throw new Error('OpenAI API connectivity check failed.');
    }

    await sleep(20);

    return {
      status: 'ok'
    };
  }
};

const registerDependencyCheck = (name, checkFn) => {
  dependencyChecks[name] = checkFn;
};

const runDependencyCheck = async (name, checkFn) => {
  const startedAt = Date.now();

  try {
    const result = await checkFn();
    const latencyMs = Date.now() - startedAt;

    if (result.status && result.status !== 'ok') {
      return {
        status: result.status,
        latencyMs,
        message: result.message,
        checkedAt: new Date().toISOString()
      };
    }

    return {
      status: 'ok',
      latencyMs,
      checkedAt: new Date(startedAt + latencyMs).toISOString()
    };
  } catch (error) {
    return {
      status: 'unavailable',
      latencyMs: Date.now() - startedAt,
      message: error.message,
      checkedAt: new Date().toISOString()
    };
  }
};

const deriveOverallStatus = (dependencyStatuses) => {
  const values = Object.values(dependencyStatuses);
  const hasUnavailable = values.some((dep) => dep.status === 'unavailable');
  const hasOk = values.some((dep) => dep.status === 'ok');

  if (hasUnavailable && !hasOk) {
    return 'down';
  }

  if (hasUnavailable) {
    return 'degraded';
  }

  return 'ok';
};

const buildHealthReport = async () => {
  const entries = await Promise.all(
    Object.entries(dependencyChecks).map(async ([name, checkFn]) => {
      const result = await runDependencyCheck(name, checkFn);
      return [name, result];
    })
  );

  const dependencies = Object.fromEntries(entries);
  const status = deriveOverallStatus(dependencies);

  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    dependencies
  };
};

module.exports = {
  buildHealthReport,
  registerDependencyCheck
};
