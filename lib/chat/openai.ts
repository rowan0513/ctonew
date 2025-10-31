import { env } from "@/env";
import type { PromptPayload } from "@/lib/retrieval/types";
import type { ChatHistoryMessage, ChatModelUsage } from "./types";

const PRIMARY_MODEL = "gpt-4.1-mini";
const FALLBACK_MODEL = "gpt-4o-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_HISTORY_MESSAGES = 12;

type OpenAIResponse = {
  output?: Array<{
    content: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  output_text?: string[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
  };
};

type ModelCallResult = {
  answer: string;
  usage: ChatModelUsage | undefined;
};

export class OpenAIRequestError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "OpenAIRequestError";
    this.status = status;
    this.details = details;
  }
}

function buildSystemContent(prompt: PromptPayload): string {
  return [
    prompt.system,
    `Maintain a ${prompt.tone} tone that reflects the workspace branding.`,
  ].join(" ");
}

function buildUserContent(prompt: PromptPayload): string {
  const references = prompt.citations
    .map((citation) => `${citation.id}: ${citation.title}`)
    .join("\n");

  return [
    prompt.instructions,
    references ? `Available citations:\n${references}` : null,
    "Respond with a concise, factual answer and cite snippets like [C1].",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normaliseHistory(history: ChatHistoryMessage[]): ChatHistoryMessage[] {
  return history
    .filter((message) => message.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

function extractAnswer(payload: OpenAIResponse): string {
  if (Array.isArray(payload.output_text) && payload.output_text.length > 0) {
    return payload.output_text.join("\n").trim();
  }

  if (Array.isArray(payload.output) && payload.output.length > 0) {
    const chunks = payload.output
      .flatMap((segment) => segment.content)
      .filter((content) => content?.text)
      .map((content) => content.text?.trim())
      .filter(Boolean);

    if (chunks.length > 0) {
      return chunks.join("\n").trim();
    }
  }

  return "";
}

async function callModel({
  model,
  prompt,
  history,
  signal,
}: {
  model: string;
  prompt: PromptPayload;
  history: ChatHistoryMessage[];
  signal?: AbortSignal;
}): Promise<ModelCallResult> {
  const payload = {
    model,
    input: [
      {
        role: "system",
        content: buildSystemContent(prompt),
      },
      ...normaliseHistory(history).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: "user",
        content: buildUserContent(prompt),
      },
    ],
    temperature: 0.2,
    max_output_tokens: 600,
    stream: false,
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    let details: unknown;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new OpenAIRequestError(response.status, "OpenAI response returned an error", details);
  }

  const data = (await response.json()) as OpenAIResponse;
  const answer = extractAnswer(data);

  const usage: ChatModelUsage | undefined = data.usage
    ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.total_tokens,
        reasoningTokens: data.usage.reasoning_tokens,
      }
    : undefined;

  return {
    answer,
    usage,
  };
}

export type GenerateChatResponseInput = {
  prompt: PromptPayload;
  history: ChatHistoryMessage[];
  signal?: AbortSignal;
};

export type GenerateChatResponseResult = {
  answer: string;
  model: string;
  usage?: ChatModelUsage;
  fallbackUsed: boolean;
};

export async function generateChatResponse({
  prompt,
  history,
  signal,
}: GenerateChatResponseInput): Promise<GenerateChatResponseResult> {
  try {
    const primary = await callModel({ model: PRIMARY_MODEL, prompt, history, signal });

    return {
      answer: primary.answer,
      model: PRIMARY_MODEL,
      usage: primary.usage,
      fallbackUsed: false,
    };
  } catch (error) {
    const shouldFallback = !(error instanceof OpenAIRequestError && error.status >= 400 && error.status < 500);

    if (!shouldFallback) {
      throw error;
    }
  }

  const fallback = await callModel({ model: FALLBACK_MODEL, prompt, history, signal });

  return {
    answer: fallback.answer,
    model: FALLBACK_MODEL,
    usage: fallback.usage,
    fallbackUsed: true,
  };
}
