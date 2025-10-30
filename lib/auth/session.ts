import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { env, isProduction } from "@/env.mjs";

import { getConfiguredAdminEmail } from "./admin";

export const SESSION_COOKIE_NAME = "ezchat_admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export type AdminSession = {
  email: string;
  issuedAt: number;
  expiresAt: number;
};

const SESSION_VERSION = "v1";

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string): Buffer {
  return createHmac("sha256", `${env.SESSION_SECRET}:${SESSION_VERSION}`)
    .update(payload)
    .digest();
}

function createToken(session: AdminSession): string {
  const payload = JSON.stringify(session);
  const encoded = base64UrlEncode(payload);
  const signature = signPayload(encoded).toString("base64url");
  return `${encoded}.${signature}`;
}

function parseToken(token: string): AdminSession | null {
  const [encodedPayload, encodedSignature] = token.split(".");

  if (!encodedPayload || !encodedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedSignature = Buffer.from(encodedSignature, "base64url");

  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }

  try {
    if (!timingSafeEqual(providedSignature, expectedSignature)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const decoded = base64UrlDecode(encodedPayload);
    const parsed = JSON.parse(decoded) as AdminSession;

    if (!parsed || typeof parsed.email !== "string") {
      return null;
    }

    if (typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") {
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      return null;
    }

    const normalizedEmail = getConfiguredAdminEmail();

    if (parsed.email !== normalizedEmail) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

function buildSession(email: string): AdminSession {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_MAX_AGE * 1000;

  return {
    email,
    issuedAt,
    expiresAt,
  };
}

export function createSessionToken(email: string): { token: string; session: AdminSession } {
  const normalizedEmail = getConfiguredAdminEmail();

  if (normalizedEmail !== email.trim().toLowerCase()) {
    throw new UnauthorizedError("Invalid admin session request");
  }

  const session = buildSession(normalizedEmail);
  return {
    token: createToken(session),
    session,
  };
}

export function getSessionFromCookieValue(value?: string | null): AdminSession | null {
  if (!value) {
    return null;
  }

  return parseToken(value);
}

export function getSessionFromRequest(request: NextRequest): AdminSession | null {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return getSessionFromCookieValue(cookieValue);
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function requireAdminRequest(request: NextRequest): AdminSession {
  const session = getSessionFromRequest(request);

  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
}

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionFromCookieValue(token);
}

export function applySessionCookie(response: NextResponse, email: string): NextResponse {
  const { token } = createSessionToken(email);

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...getCookieOptions(),
  });

  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 0,
  });

  return response;
}
