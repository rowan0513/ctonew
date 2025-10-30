import "server-only";

import Redis from "ioredis";

import { env } from "@/env.mjs";

declare global {
  // eslint-disable-next-line no-var
  var __ezchatRedis: Redis | undefined;
}

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
  });

  client.on("error", (error) => {
    if (process.env.NODE_ENV !== "test") {
      console.error("Redis client error", error);
    }
  });

  return client;
}

export function getRedis(): Redis {
  if (!globalThis.__ezchatRedis) {
    globalThis.__ezchatRedis = createRedisClient();
  }

  return globalThis.__ezchatRedis;
}
