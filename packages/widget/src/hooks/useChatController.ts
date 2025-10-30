import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChatApiClient } from '../api';
import type { ChatMessage, FeedbackPayload, WidgetConfig } from '../types';

const createId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `msg-${Math.random().toString(36).slice(2, 11)}`);

const buildWelcomeMessage = (workspaceId: string, welcomeMessage?: string): ChatMessage | null => {
  if (!welcomeMessage) {
    return null;
  }
  return {
    id: `welcome-${workspaceId}`,
    role: 'assistant',
    content: welcomeMessage,
    createdAt: new Date().toISOString()
  };
};

export interface ChatControllerState {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  isHandover: boolean;
  sendMessage: (content: string) => Promise<void>;
  sendFeedback: (payload: FeedbackPayload) => Promise<void>;
  resetError: () => void;
}

export const useChatController = (config: WidgetConfig): ChatControllerState => {
  const apiClientRef = useRef(createChatApiClient(config));
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const welcome = buildWelcomeMessage(config.workspaceId, config.welcomeMessage);
    const initial = config.initialMessages ?? [];
    return welcome ? [welcome, ...initial] : initial;
  });
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isSending, setSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHandover, setHandover] = useState<boolean>(false);

  const headersKey = useMemo(() => JSON.stringify(config.headers ?? {}), [config.headers]);

  const hooksRef = useRef(config.hooks);
  hooksRef.current = config.hooks;

  const workspaceRef = useRef(config.workspaceId);

  useEffect(() => {
    apiClientRef.current = createChatApiClient(config);
  }, [config.apiUrl, config.workspaceId, config.conversationId, config.token, headersKey]);

  useEffect(() => {
    if (workspaceRef.current === config.workspaceId) {
      return;
    }
    workspaceRef.current = config.workspaceId;
    setMessages(() => {
      const welcome = buildWelcomeMessage(config.workspaceId, config.welcomeMessage);
      const initial = config.initialMessages ?? [];
      return welcome ? [welcome, ...initial] : initial;
    });
  }, [config.initialMessages, config.workspaceId, config.welcomeMessage]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await apiClientRef.current.loadConversation();
        if (cancelled) {
          return;
        }
        setMessages((prev) => {
          const welcome = buildWelcomeMessage(config.workspaceId, config.welcomeMessage);
          const unique = new Map<string, ChatMessage>();
          [...prev, ...result.messages].forEach((message) => {
            unique.set(message.id, message);
          });
          if (welcome) {
            unique.set(welcome.id, welcome);
          }
          const ordered = Array.from(unique.values()).sort(
            (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
          );
          if (welcome) {
            const index = ordered.findIndex((message) => message.id === welcome.id);
            if (index > 0) {
              const [welcomeMessage] = ordered.splice(index, 1);
              ordered.unshift(welcomeMessage);
            }
          }
          return ordered;
        });
        setHandover(Boolean(result.handover));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load conversation');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [config.workspaceId, config.welcomeMessage, config.apiUrl, config.conversationId, config.token, headersKey]);

  const resetError = useCallback(() => setError(null), []);

  const appendMessages = useCallback((newMessages: ChatMessage | ChatMessage[]) => {
    const toAppend = Array.isArray(newMessages) ? newMessages : [newMessages];
    setMessages((prev) => [...prev, ...toAppend]);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isHandover) {
      return;
    }
    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };

    appendMessages(userMessage);
    hooksRef.current?.onMessageSent?.(userMessage);
    setSending(true);
    setError(null);

    try {
      const response = await apiClientRef.current.sendMessage(content);
      appendMessages(response.assistantMessages ?? response.message);
      setHandover(Boolean(response.handover));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [appendMessages, isHandover]);

  const sendFeedback = useCallback(async (payload: FeedbackPayload) => {
    try {
      await apiClientRef.current.sendFeedback(payload);
      hooksRef.current?.onFeedback?.(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send feedback');
    }
  }, []);

  return useMemo(
    () => ({
      messages,
      isLoading,
      isSending,
      error,
      isHandover,
      sendMessage,
      sendFeedback,
      resetError
    }),
    [messages, isLoading, isSending, error, isHandover, sendMessage, sendFeedback, resetError]
  );
};
