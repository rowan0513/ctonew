import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  EmptyQueryError,
  UnsupportedWorkspaceLanguageError,
  WorkspaceInactiveError,
  retrieveWorkspaceContext,
} from "@/lib/retrieval/service";
import type { RetrievedContext } from "@/lib/retrieval/types";
import { calculateConfidenceScore } from "@/lib/chat/confidence";
import { detectLanguage } from "@/lib/chat/language";
import { generateChatResponse } from "@/lib/chat/openai";
import { logChatInteraction } from "@/lib/chat/analytics";
import type { ChatHistoryMessage } from "@/lib/chat/types";
import { languageSchema } from "@/lib/workspaces/schema";
import { getWorkspaceById } from "@/lib/workspaces/store";

const historyMessageSchema = z.object({
  role: z.union([z.literal("user"), z.literal("assistant")]),
  content: z.string().min(1, "History messages must include content"),
});

const requestSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  question: z.string().min(1, "question is required"),
  history: z.array(historyMessageSchema).max(20, "History cannot exceed 20 messages").optional(),
  language: languageSchema.optional(),
});

type RequestPayload = z.infer<typeof requestSchema>;

function formatValidationErrors(error: z.ZodError) {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";

    if (!result[key]) {
      result[key] = issue.message;
    }
  }

  return result;
}

function extractApiKey(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (authorization) {
    const match = authorization.match(/Bearer\s+(.+)/i);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const headerKey = request.headers.get("x-api-key");

  return headerKey ? headerKey.trim() : null;
}

function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function notFoundResponse(id: string) {
  return NextResponse.json({ error: `Workspace ${id} was not found` }, { status: 404 });
}

function forbiddenResponse(reason: string) {
  return NextResponse.json({ error: reason }, { status: 403 });
}

function badRequest(error: string, details?: Record<string, unknown>) {
  return NextResponse.json({ error, details }, { status: 400 });
}

function unprocessable(details: Record<string, string>) {
  return NextResponse.json({ error: "Request validation failed", details }, { status: 422 });
}

function limitHistory(history: ChatHistoryMessage[] | undefined): ChatHistoryMessage[] {
  if (!history) {
    return [];
  }

  return history
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-20);
}

function collectUserText(question: string, history: ChatHistoryMessage[]): string {
  const historicalUserMessages = history.filter((message) => message.role === "user").map((message) => message.content);

  return [question, ...historicalUserMessages].join(" \n ");
}

function serializeCitations(contexts: RetrievedContext[]) {
  return contexts.map((context) => context.citation);
}

export async function POST(request: NextRequest) {
  let payload: RequestPayload;

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return unprocessable(formatValidationErrors(parsed.error));
    }

    payload = parsed.data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("Invalid JSON payload");
    }

    throw error;
  }

  const workspace = getWorkspaceById(payload.workspaceId);

  if (!workspace) {
    return notFoundResponse(payload.workspaceId);
  }

  if (workspace.status !== "active") {
    return forbiddenResponse("Workspace is not active");
  }

  const apiKey = extractApiKey(request);

  if (!apiKey || apiKey !== workspace.apiKey) {
    return unauthorizedResponse();
  }

  const history = limitHistory(payload.history);

  let language = payload.language;

  if (language && !workspace.languages.includes(language)) {
    return badRequest(`Workspace does not support language \"${language}\"`);
  }

  if (!language) {
    const detectionSource = collectUserText(payload.question, history);
    language = detectLanguage(detectionSource, workspace.languages);
  }

  let retrievalResult;

  try {
    retrievalResult = retrieveWorkspaceContext({
      workspaceId: workspace.id,
      query: payload.question,
      language,
    });
  } catch (error) {
    if (error instanceof WorkspaceInactiveError) {
      return forbiddenResponse("Workspace is not active");
    }

    if (error instanceof UnsupportedWorkspaceLanguageError) {
      return badRequest(`Workspace does not support language \"${language}\"`);
    }

    if (error instanceof EmptyQueryError) {
      return badRequest("question cannot be empty");
    }

    throw error;
  }

  let generated;

  try {
    generated = await generateChatResponse({
      prompt: retrievalResult.prompt,
      history,
    });
  } catch (error) {
    console.error("Failed to generate chat response", error);
    return NextResponse.json({ error: "Failed to generate chat response" }, { status: 502 });
  }

  const confidence = calculateConfidenceScore({
    contexts: retrievalResult.contexts,
    answer: generated.answer,
    usage: generated.usage,
    fallbackUsed: generated.fallbackUsed,
  });

  const handover = confidence < workspace.confidenceThreshold;
  const citations = serializeCitations(retrievalResult.contexts);

  try {
    logChatInteraction({
      workspaceId: workspace.id,
      language,
      history,
      question: payload.question,
      answer: generated.answer,
      confidence,
      handover,
      model: generated.model,
      maskPII: true,
    });
  } catch (error) {
    console.warn("Failed to log chat interaction", error);
  }

  return NextResponse.json(
    {
      answer: generated.answer,
      citations,
      confidence,
      handover,
      language,
      model: generated.model,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
