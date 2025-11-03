import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { verifyAdminCredentials } from "@/lib/auth/admin";
import { applySessionCookie } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string({ required_error: "Email is required" }).email("Enter a valid email address"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return "unknown";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (!attempt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (now > attempt.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (attempt.count >= MAX_ATTEMPTS) {
    return false;
  }

  attempt.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return NextResponse.json({
      error: "Invalid login request",
      details: errors,
    }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const result = await verifyAdminCredentials(email, password);

  if (!result.valid || !result.email) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    session: {
      email: result.email,
    },
  });

  applySessionCookie(response, result.email);

  return response;
}
