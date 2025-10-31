import { randomUUID } from "node:crypto";

import { maskSensitiveData } from "./pii";
import type {
  ChatAnalyticsSnapshot,
  ChatHistoryMessage,
  ConversationMessage,
  ConversationMessageSource,
  ConversationRecord,
  LoggedChatInteraction,
} from "./types";
import type { WorkspaceLanguage } from "@/lib/workspaces/schema";

const MAX_CONVERSATIONS = 500;
const MAX_MESSAGES = 5_000;

type ChatAnalyticsStore = {
  conversations: ConversationRecord[];
  messages: ConversationMessage[];
};

const globalChatAnalytics = globalThis as typeof globalThis & {
  __ezchatChatAnalyticsStore?: ChatAnalyticsStore;
};

function getChatAnalyticsStore(): ChatAnalyticsStore {
  if (!globalChatAnalytics.__ezchatChatAnalyticsStore) {
    globalChatAnalytics.__ezchatChatAnalyticsStore = {
      conversations: [],
      messages: [],
    } satisfies ChatAnalyticsStore;
  }

  return globalChatAnalytics.__ezchatChatAnalyticsStore;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function applyMessageLimit(store: ChatAnalyticsStore) {
  while (store.messages.length > MAX_MESSAGES) {
    const removed = store.messages.shift();

    if (!removed) {
      continue;
    }

    const conversation = store.conversations.find((item) => item.id === removed.conversationId);

    if (conversation && conversation.messageCount > 0) {
      conversation.messageCount -= 1;
    }
  }
}

function applyConversationLimit(store: ChatAnalyticsStore) {
  while (store.conversations.length > MAX_CONVERSATIONS) {
    const removed = store.conversations.pop();

    if (!removed) {
      continue;
    }

    store.messages = store.messages.filter((message) => message.conversationId !== removed.id);
  }
}

function appendMessage(params: {
  store: ChatAnalyticsStore;
  conversation: ConversationRecord;
  sequence: number;
  role: ConversationMessage["role"];
  content: string;
  source: ConversationMessageSource;
  maskPII: boolean;
  bucket: ConversationMessage[];
}) {
  const createdAt = new Date().toISOString();
  const maskedContent = params.maskPII ? maskSensitiveData(params.content) : params.content;

  const message: ConversationMessage = {
    id: randomUUID(),
    conversationId: params.conversation.id,
    role: params.role,
    content: params.content,
    maskedContent,
    createdAt,
    sequence: params.sequence,
    source: params.source,
  };

  params.store.messages.push(message);
  params.conversation.messageCount += 1;
  params.conversation.updatedAt = createdAt;
  params.bucket.push(message);
}

export type LogChatInteractionInput = {
  workspaceId: string;
  language: WorkspaceLanguage;
  history: ChatHistoryMessage[];
  question: string;
  answer: string;
  confidence: number;
  handover: boolean;
  model?: string;
  maskPII?: boolean;
};

export function logChatInteraction({
  workspaceId,
  language,
  history,
  question,
  answer,
  confidence,
  handover,
  model,
  maskPII = true,
}: LogChatInteractionInput): LoggedChatInteraction {
  const store = getChatAnalyticsStore();
  const timestamp = new Date().toISOString();

  const conversation: ConversationRecord = {
    id: randomUUID(),
    workspaceId,
    language,
    startedAt: timestamp,
    updatedAt: timestamp,
    messageCount: 0,
    confidence,
    handover,
    model,
  };

  store.conversations.unshift(conversation);
  applyConversationLimit(store);

  const messages: ConversationMessage[] = [];
  let sequence = 0;

  const normalizedHistory = history.filter((message) => message.content.trim().length > 0);

  for (const item of normalizedHistory) {
    sequence += 1;
    appendMessage({
      store,
      conversation,
      sequence,
      role: item.role,
      content: item.content,
      source: "history",
      maskPII,
      bucket: messages,
    });
  }

  sequence += 1;
  appendMessage({
    store,
    conversation,
    sequence,
    role: "user",
    content: question,
    source: "question",
    maskPII,
    bucket: messages,
  });

  sequence += 1;
  appendMessage({
    store,
    conversation,
    sequence,
    role: "assistant",
    content: answer,
    source: "answer",
    maskPII,
    bucket: messages,
  });

  applyMessageLimit(store);

  return {
    conversation: clone(conversation),
    messages: clone(messages),
  };
}

export function getChatAnalytics(): ChatAnalyticsSnapshot {
  const store = getChatAnalyticsStore();

  return {
    conversations: clone(store.conversations),
    messages: clone(store.messages),
  };
}

export function resetChatAnalyticsStore(): void {
  if (!globalChatAnalytics.__ezchatChatAnalyticsStore) {
    return;
  }

  globalChatAnalytics.__ezchatChatAnalyticsStore.conversations = [];
  globalChatAnalytics.__ezchatChatAnalyticsStore.messages = [];
}
