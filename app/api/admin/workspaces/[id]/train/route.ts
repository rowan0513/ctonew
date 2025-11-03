import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { UnauthorizedError, requireAdminRequest } from "@/lib/auth/session";

const { getDocumentsForWorkspace } = require("@/src/services/postgresDocuments");
const { enqueueWorkspaceTraining } = require("@/src/queues/embeddingQueue");

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    requireAdminRequest(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return unauthorizedResponse();
    }
    throw error;
  }

  const workspaceId = context.params.id;

  try {
    const documents = await getDocumentsForWorkspace(workspaceId);

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        {
          error: "No documents found",
          message: "This workspace has no documents to train on",
        },
        { status: 404 },
      );
    }

    const publishedDocuments = documents.filter((doc: any) => doc.isPublished);

    if (publishedDocuments.length === 0) {
      return NextResponse.json(
        {
          error: "No published documents",
          message: "This workspace has no published documents to train on",
        },
        { status: 404 },
      );
    }

    const documentIds = publishedDocuments.map((doc: any) => doc.id);

    await enqueueWorkspaceTraining({
      workspaceId,
      documentIds,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Training jobs queued successfully",
        workspaceId,
        documentCount: documentIds.length,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("[Training API] Error queuing training jobs:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Failed to queue training jobs",
      },
      { status: 500 },
    );
  }
}
