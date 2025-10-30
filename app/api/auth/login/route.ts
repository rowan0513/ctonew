import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAuditLog } from "@/lib/audit-log";
import { verifyAdminCredentials } from "@/lib/auth/admin";
import { createSession } from "@/lib/auth/session";
import {
  buildLoginAttemptIdentifier,
  hasExceededLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts,
} from "@/lib/auth/rate-limit";
import { getClientIp } from "@/lib/http";

const loginSchema = z.object({
  email: z.string().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

function formatValidationErrors(error: z.ZodError) {
  const fieldErrors = error.flatten().fieldErrors;
  return Object.entries(fieldErrors)
    .map(([field, messages]) => `${field}: ${(messages ?? []).join(", ")}`)
    .join("; ");
}

export async function POST(request: Request) {
  let parsedBody: unknown;

  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = loginSchema.safeParse(parsedBody);

  if (!result.success) {
    return NextResponse.json({ error: formatValidationErrors(result.error) }, { status: 400 });
  }

  const email = result.data.email.trim().toLowerCase();
  const password = result.data.password;
  const ipAddress = getClientIp(request);
  const identifier = buildLoginAttemptIdentifier(email, ipAddress);

  const attempts = await incrementLoginAttempts(identifier);

  if (hasExceededLoginAttempts(attempts)) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  const isValid = await verifyAdminCredentials(email, password);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await resetLoginAttempts(identifier);

  const response = NextResponse.json({ ok: true, admin: { email } });
  await createSession(email, { responseCookies: response.cookies });

  try {
    await recordAuditLog({
      adminEmail: email,
      action: "auth.login",
      ipAddress,
    });
  } catch (error) {
    console.error("Failed to record login audit log entry", error);
  }

  return response;
}
