import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { UnauthorizedError, requireAdminRequest } from "@/lib/auth/session";
import { getWorkspaceAuditLog } from "@/lib/audit-log";
import { getWorkspaceById } from "@/lib/workspaces/store";

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function notFoundResponse(id: string) {
  return NextResponse.json({ error: `Workspace ${id} was not found` }, { status: 404 });
}

function parseLimit(url: URL): number {
  const value = url.searchParams.get("limit");

  if (!value) {
    return 25;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return 25;
  }

  return Math.min(parsed, 100);
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

  const limit = parseLimit(request.nextUrl);
  const entries = getWorkspaceAuditLog(context.params.workspaceId, limit);

  return NextResponse.json({ entries });
}
