import type { Citation } from "@/lib/retrieval/types";
import type { WorkspaceLanguage } from "@/lib/workspaces/schema";

export type ChatMessageRole = "user" | "assistant";

export type ChatHistoryMessage = {
  role: ChatMessageRole;
  content: string;
};

export type ChatRequestPayload = {
  workspaceId: string;
  question: string;
  history?: ChatHistoryMessage[];
  language?: WorkspaceLanguage;
};

export type ChatResponseBody = {
  answer: string;
  citations: Citation[];
  confidence: number;
  handover: boolean;
  language: WorkspaceLanguage;
  model?: string;
};

export type ChatModelUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
};

export type ConversationRecord = {
  id: string;
  workspaceId: string;
  language: WorkspaceLanguage;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  confidence: number;
  handover: boolean;
  model?: string;
};

export type ConversationMessageSource = "history" | "question" | "answer";

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: ChatMessageRole;
  content: string;
  maskedContent: string;
  createdAt: string;
  sequence: number;
  source: ConversationMessageSource;
};

export type ChatAnalyticsSnapshot = {
  conversations: ConversationRecord[];
  messages: ConversationMessage[];
};

export type LoggedChatInteraction = {
  conversation: ConversationRecord;
  messages: ConversationMessage[];
};
