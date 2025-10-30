import type {
  ChatMessage,
  ConversationResponse,
  FeedbackPayload,
  SendMessageResponse,
  WidgetConfig
} from './types';

export interface ChatApiClient {
  loadConversation: () => Promise<ConversationResponse>;
  sendMessage: (input: string) => Promise<SendMessageResponse>;
  sendFeedback: (payload: FeedbackPayload) => Promise<void>;
}

const defaultHeaders = (token?: string, headers?: Record<string, string>) => {
  const base: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    base.Authorization = `Bearer ${token}`;
  }
  return {
    ...base,
    ...headers
  };
};

const ensureMessage = (message: ChatMessage | undefined, fallback: string): ChatMessage => {
  if (message) {
    return message;
  }
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: fallback,
    createdAt: new Date().toISOString()
  };
};

const createEchoResponse = (input: string): SendMessageResponse => {
  const assistantMessage = ensureMessage(undefined, `Thanks for your message: ${input}`);
  return {
    message: assistantMessage,
    assistantMessages: [assistantMessage],
    handover: false
  };
};

export const createChatApiClient = (config: WidgetConfig): ChatApiClient => {
  const apiUrl = config.apiUrl ?? (typeof window !== 'undefined' ? (window as any).__CTO_WIDGET_API__ : undefined);

  if (!apiUrl) {
    const initialMessages = config.initialMessages ?? [];
    return {
      async loadConversation() {
        return {
          messages: initialMessages,
          handover: false
        };
      },
      async sendMessage(input: string) {
        return createEchoResponse(input);
      },
      async sendFeedback() {
        return;
      }
    };
  }

  const workspacePath = `${apiUrl.replace(/\/?$/, '')}/workspaces/${config.workspaceId}`;

  const buildFetchOptions = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: defaultHeaders(config.token, config.headers),
    body: body ? JSON.stringify(body) : undefined
  });

  return {
    async loadConversation() {
      const response = await fetch(`${workspacePath}/conversation${config.conversationId ? `/${config.conversationId}` : ''}`, {
        method: 'GET',
        headers: defaultHeaders(config.token, config.headers)
      });

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const data = (await response.json()) as ConversationResponse;
      return {
        messages: data.messages ?? [],
        handover: Boolean(data.handover)
      };
    },
    async sendMessage(input: string) {
      const response = await fetch(`${workspacePath}/messages`, buildFetchOptions('POST', {
        conversationId: config.conversationId,
        message: input
      }));

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = (await response.json()) as SendMessageResponse;
      const assistantMessage = ensureMessage(data.message, 'Our team will get back to you shortly.');
      const assistantMessages = data.assistantMessages ?? [assistantMessage];

      return {
        message: assistantMessage,
        assistantMessages,
        handover: Boolean(data.handover)
      };
    },
    async sendFeedback(payload: FeedbackPayload) {
      const response = await fetch(`${workspacePath}/feedback`, buildFetchOptions('POST', {
        conversationId: config.conversationId,
        ...payload
      }));

      if (!response.ok) {
        throw new Error('Failed to send feedback');
      }
    }
  };
};
