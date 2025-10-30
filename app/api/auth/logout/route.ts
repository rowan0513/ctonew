import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit-log";
import { destroySession, getSession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/http";

export async function POST(request: Request) {
  const requestCookies = cookies();
  const response = NextResponse.json({ ok: true });

  const session = await getSession({
    requestCookies,
    responseCookies: response.cookies,
    refresh: false,
  });

  await destroySession({
    requestCookies,
    responseCookies: response.cookies,
  });

  if (session) {
    try {
      await recordAuditLog({
        adminEmail: session.email,
        action: "auth.logout",
        ipAddress: getClientIp(request),
      });
    } catch (error) {
      console.error("Failed to record logout audit log entry", error);
    }
  }

  return response;
}
