import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

export async function GET() {
  const requestCookies = cookies();

  const session = await getSession({
    requestCookies,
    refresh: false,
  });

  if (!session) {
    return NextResponse.json({ active: false }, { status: 401 });
  }

  const response = NextResponse.json(
    {
      active: true,
      admin: { email: session.email },
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
      },
    },
  );

  await getSession({
    requestCookies,
    responseCookies: response.cookies,
  });

  return response;
}
