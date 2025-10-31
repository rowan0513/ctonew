import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { UnauthorizedError, requireAdminRequest } from "@/lib/auth/session";
import {
  WorkspaceNotFoundError,
  archiveWorkspace,
  getWorkspaceById,
  updateWorkspace,
} from "@/lib/workspaces/store";
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

function notFoundResponse(id: string) {
  return NextResponse.json({ error: `Workspace ${id} was not found` }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  context: { params: { workspaceId: string } },
) {
  try {
    requireAdminRequest(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    throw error;
  }

  const workspace = getWorkspaceById(context.params.workspaceId);

  if (!workspace) {
    return notFoundResponse(context.params.workspaceId);
  }

  return NextResponse.json({ workspace });
}

export async function PUT(
  request: NextRequest,
  context: { params: { workspaceId: string } },
) {
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

  try {
    const workspace = updateWorkspace(context.params.workspaceId, parsed.data, sessionEmail ?? "system");
    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return notFoundResponse(context.params.workspaceId);
    }
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { workspaceId: string } },
) {
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

  try {
    const workspace = archiveWorkspace(context.params.workspaceId, sessionEmail ?? "system");
    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return notFoundResponse(context.params.workspaceId);
    }
    throw error;
  }
}
