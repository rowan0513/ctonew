import "server-only";

import { env } from "@/env.mjs";
import { insertAnalyticsEvent } from "@/lib/analytics/repository";
import { PreviewError } from "@/lib/preview/errors";
import { detectPreviewLanguage } from "@/lib/preview/language";
import {
  previewFeedbackSchema,
  previewRequestSchema,
  previewRuntimeResponseSchema,
} from "@/lib/preview/schema";
import type {
  PreviewHistoryMessage,
  PreviewLanguage,
  PreviewResult,
} from "@/lib/preview/types";
import { getWorkspacePreviewConfig } from "@/lib/workspaces/preview";

type ExecutePreviewArgs = {
  workspaceId: string;
  prompt: string;
  language?: PreviewLanguage;
  sessionId: string;
  history?: PreviewHistoryMessage[];
};

type PreviewFeedbackArgs = {
  workspaceId: string;
  sessionId: string;
  responseId: string;
  rating: "up" | "down";
};

function createRuntimeUrl(workspaceId: string): string {
  return `${env.RUNTIME_API_URL.replace(/\/$/, "")}/v1/workspaces/${workspaceId}/preview`;
}

export async function executeWorkspacePreview(args: ExecutePreviewArgs): Promise<PreviewResult> {
  const parsedInput = previewRequestSchema.safeParse({
    prompt: args.prompt,
    language: args.language,
    sessionId: args.sessionId,
    history: args.history ?? [],
  });

  if (!parsedInput.success) {
    const message = parsedInput.error.errors.map((issue) => issue.message).join(", ");
    throw new PreviewError(`Invalid preview request: ${message}`, "invalid_preview_request", 400);
  }

  const workspace = await getWorkspacePreviewConfig(args.workspaceId);

  if (!workspace) {
    throw new PreviewError("Workspace not found", "workspace_not_found", 404);
  }

  if (!workspace.isTrained) {
    throw new PreviewError(
      "Workspace is still training. Preview will be available once the latest model is ready.",
      "workspace_not_trained",
      409,
    );
  }

  const resolvedLanguage =
    parsedInput.data.language ?? detectPreviewLanguage(parsedInput.data.prompt);
  const systemPrompt = workspace.draftPrompts[resolvedLanguage];

  const runtimePayload = {
    sessionId: parsedInput.data.sessionId,
    workspaceId: workspace.id,
    prompt: parsedInput.data.prompt,
    language: resolvedLanguage,
    systemPrompt,
    history: parsedInput.data.history,
    draftPrompts: workspace.draftPrompts,
    publishedPrompts: workspace.publishedPrompts,
  };

  let runtimeResponse: Response;

  try {
    runtimeResponse = await fetch(createRuntimeUrl(workspace.id), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.RUNTIME_PREVIEW_TOKEN}`,
      },
      body: JSON.stringify(runtimePayload),
    });
  } catch (error) {
    throw new PreviewError(
      "Failed to reach the runtime preview service",
      "runtime_request_failed",
      502,
    );
  }

  if (!runtimeResponse.ok) {
    throw new PreviewError(
      `Runtime preview request failed with status ${runtimeResponse.status}`,
      "runtime_request_failed",
      502,
    );
  }

  let parsedRuntime;

  try {
    parsedRuntime = previewRuntimeResponseSchema.parse(await runtimeResponse.json());
  } catch (error) {
    throw new PreviewError("Runtime returned an invalid payload", "runtime_request_failed", 502);
  }

  const warnings: PreviewResult["warnings"] = [];

  if (!workspace.publishedAt) {
    warnings.push("workspace_not_published");
  }

  return {
    response: {
      responseId: parsedRuntime.responseId,
      answer: parsedRuntime.answer,
      language: parsedRuntime.language,
      citations: parsedRuntime.citations,
      confidence: parsedRuntime.confidence,
      sessionId: parsedInput.data.sessionId,
    },
    warnings,
  };
}

export async function recordPreviewFeedback(args: PreviewFeedbackArgs): Promise<void> {
  const parsed = previewFeedbackSchema.parse({
    sessionId: args.sessionId,
    responseId: args.responseId,
    rating: args.rating,
  });

  await insertAnalyticsEvent({
    workspaceId: args.workspaceId,
    conversationId: null,
    eventType: "preview_feedback",
    environment: "preview",
    feedback: parsed.rating,
    confidence: null,
    isFallback: false,
    metadata: {
      previewSessionId: parsed.sessionId,
      previewResponseId: parsed.responseId,
    },
  });
}
