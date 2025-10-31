import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { UnauthorizedError, requireAdminRequest } from "@/lib/auth/session";
import { createWorkspace, listWorkspaces } from "@/lib/workspaces/store";
import { workspaceInputSchema } from "@/lib/workspaces/schema";

function formatValidationErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }

  return errors;
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  try {
    requireAdminRequest(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    throw error;
  }

  const workspaces = listWorkspaces();

  return NextResponse.json({ workspaces });
}

export async function POST(request: NextRequest) {
  let sessionEmail: string | null = null;

  try {
    const session = requireAdminRequest(request);
    sessionEmail = session.email;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    throw error;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = workspaceInputSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Workspace validation failed",
        details: formatValidationErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const workspace = createWorkspace(parsed.data, sessionEmail ?? "system");

  return NextResponse.json({ workspace }, { status: 201 });
}
