export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface FeedbackPayload {
  messageId: string;
  rating: 'up' | 'down';
  comment?: string;
}

export interface WidgetEventHooks {
  onOpen?: () => void;
  onClose?: () => void;
  onMessageSent?: (message: ChatMessage) => void;
  onFeedback?: (payload: FeedbackPayload) => void;
}

export interface ChatTheme {
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  bubbleColor?: string;
}

export interface WidgetConfig {
  workspaceId: string;
  conversationId?: string;
  apiUrl?: string;
  token?: string;
  headers?: Record<string, string>;
  logoUrl?: string;
  title?: string;
  welcomeMessage?: string;
  placeholder?: string;
  theme?: ChatTheme;
  initialMessages?: ChatMessage[];
  hooks?: WidgetEventHooks;
  startOpen?: boolean;
}

export interface SendMessageResponse {
  message: ChatMessage;
  assistantMessages?: ChatMessage[];
  handover?: boolean;
}

export interface ConversationResponse {
  messages: ChatMessage[];
  handover?: boolean;
}
