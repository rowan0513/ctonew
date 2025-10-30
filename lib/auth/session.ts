import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { env } from "@/env.mjs";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { getRedis } from "@/lib/redis";

const SESSION_KEY_PREFIX = "session:";

type CookieStore = {
  get?: (name: string) => { name: string; value: string } | undefined;
  set?: (
    name:
      | string
      | {
          name: string;
          value: string;
          httpOnly?: boolean;
          sameSite?: "strict" | "lax" | "none";
          secure?: boolean;
          path?: string;
          maxAge?: number;
        },
    value?: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "strict" | "lax" | "none";
      secure?: boolean;
      path?: string;
      maxAge?: number;
    },
  ) => void;
  delete?: (name: string) => void;
};

export type AdminSession = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

function getSessionKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}

function signSessionId(sessionId: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(sessionId).digest("hex");
}

function encodeSessionCookie(sessionId: string): string {
  const signature = signSessionId(sessionId);
  return `${sessionId}.${signature}`;
}

function decodeSessionCookie(raw?: string | null): string | null {
  if (!raw) {
    return null;
  }

  const parts = raw.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [sessionId, signature] = parts;
  if (!sessionId || !signature) {
    return null;
  }

  const expected = signSessionId(sessionId);
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return sessionId;
}

function writeSessionCookie(store: CookieStore | undefined, sessionId: string) {
  if (!store || typeof store.set !== "function") {
    return;
  }

  store.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionCookie(sessionId),
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

function clearSessionCookie(store: CookieStore | undefined) {
  if (!store || typeof store.delete !== "function") {
    return;
  }

  store.delete(SESSION_COOKIE_NAME);
}

async function persistSession(session: AdminSession) {
  const redis = getRedis();
  await redis.set(
    getSessionKey(session.id),
    JSON.stringify(session),
    "EX",
    SESSION_TTL_SECONDS,
  );
}

async function fetchSession(sessionId: string): Promise<AdminSession | null> {
  const redis = getRedis();
  const data = await redis.get(getSessionKey(sessionId));

  if (!data) {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as AdminSession;
    return parsed;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.error("Failed to parse session payload", error);
    }
    await redis.del(getSessionKey(sessionId));
    return null;
  }
}

async function refreshSession(session: AdminSession): Promise<AdminSession> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const refreshed: AdminSession = {
    ...session,
    expiresAt: expiresAt.toISOString(),
  };

  await persistSession(refreshed);
  return refreshed;
}

type SessionOptions = {
  requestCookies?: CookieStore;
  responseCookies?: CookieStore;
  refresh?: boolean;
};

export async function createSession(
  email: string,
  options: { responseCookies?: CookieStore } = {},
): Promise<AdminSession> {
  const sessionId = randomBytes(32).toString("hex");
  const now = new Date();

  const session: AdminSession = {
    id: sessionId,
    email,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString(),
  };

  await persistSession(session);

  const responseStore = options.responseCookies ?? (cookies() as CookieStore);
  writeSessionCookie(responseStore, sessionId);

  return session;
}

export async function getSession(options: SessionOptions = {}): Promise<AdminSession | null> {
  const requestStore = options.requestCookies ?? (cookies() as CookieStore);
  const responseStore = options.responseCookies ?? options.requestCookies ?? requestStore;

  const cookieValue = requestStore.get?.(SESSION_COOKIE_NAME)?.value;
  const sessionId = decodeSessionCookie(cookieValue ?? null);

  if (!sessionId) {
    return null;
  }

  const session = await fetchSession(sessionId);

  if (!session) {
    clearSessionCookie(responseStore);
    return null;
  }

  if (Date.parse(session.expiresAt) <= Date.now()) {
    const redis = getRedis();
    await redis.del(getSessionKey(sessionId));
    clearSessionCookie(responseStore);
    return null;
  }

  const shouldRefresh = options.refresh ?? true;

  if (shouldRefresh) {
    const refreshed = await refreshSession(session);
    writeSessionCookie(responseStore, refreshed.id);
    return refreshed;
  }

  return session;
}

export async function destroySession(options: SessionOptions = {}): Promise<void> {
  const requestStore = options.requestCookies ?? (cookies() as CookieStore);
  const responseStore = options.responseCookies ?? options.requestCookies ?? requestStore;

  const cookieValue = requestStore.get?.(SESSION_COOKIE_NAME)?.value;
  const sessionId = decodeSessionCookie(cookieValue ?? null);

  if (!sessionId) {
    clearSessionCookie(responseStore);
    return;
  }

  const redis = getRedis();
  await redis.del(getSessionKey(sessionId));
  clearSessionCookie(responseStore);
}

export async function requireSession(options?: SessionOptions): Promise<AdminSession> {
  const session = await getSession(options);

  if (!session) {
    throw new Error("Session not found");
  }

  return session;
}
