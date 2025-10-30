import "server-only";

import { getRedis } from "@/lib/redis";
import {
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS,
} from "@/lib/auth/constants";

function getLoginAttemptKey(identifier: string): string {
  return `login:attempts:${identifier}`;
}

export async function incrementLoginAttempts(identifier: string): Promise<number> {
  const redis = getRedis();
  const key = getLoginAttemptKey(identifier);
  const attempts = await redis.incr(key);

  if (attempts === 1) {
    await redis.expire(key, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
  }

  return attempts;
}

export async function resetLoginAttempts(identifier: string): Promise<void> {
  const redis = getRedis();
  await redis.del(getLoginAttemptKey(identifier));
}

export function hasExceededLoginAttempts(attempts: number): boolean {
  return attempts > LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
}

export function buildLoginAttemptIdentifier(email: string, ipAddress: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedIp = ipAddress || "unknown";
  return `${normalizedEmail}:${normalizedIp}`;
}
