import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getConfiguredAdminEmail, verifyAdminCredentials } from "@/lib/auth/admin";
import { applySessionCookie } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string({ required_error: "Email is required" }).email("Enter a valid email address"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
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

  const isValid = await verifyAdminCredentials(email, password);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const configuredEmail = getConfiguredAdminEmail();
  const response = NextResponse.json({
    ok: true,
    session: {
      email: configuredEmail,
    },
  });

  applySessionCookie(response, configuredEmail);

  return response;
}
