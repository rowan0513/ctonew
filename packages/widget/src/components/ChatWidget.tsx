import {
  CSSProperties,
  FormEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import { useChatController } from '../hooks/useChatController';
import type { ChatMessage, FeedbackPayload, WidgetConfig } from '../types';
import '../styles.css';

type FeedbackState = Partial<Record<string, 'up' | 'down'>>;

const getInitialFeedbackState = (messages: ChatMessage[]): FeedbackState => {
  return messages.reduce<FeedbackState>((acc, message) => {
    if (message.role === 'assistant') {
      acc[message.id] = undefined;
    }
    return acc;
  }, {});
};

export interface ChatWidgetProps {
  config: WidgetConfig;
}

export interface ChatWidgetHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: () => boolean;
  focusInput: () => void;
}

export const ChatWidget = forwardRef<ChatWidgetHandle, ChatWidgetProps>(({ config }, ref) => {
  const [isOpen, setIsOpen] = useState(Boolean(config.startOpen));
  const [inputValue, setInputValue] = useState('');
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(() =>
    getInitialFeedbackState(config.initialMessages ?? [])
  );
  const {
    messages,
    isLoading,
    isSending,
    isHandover,
    error,
    sendMessage,
    sendFeedback,
    resetError
  } = useChatController(config);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wasOpenRef = useRef(isOpen);

  useImperativeHandle(
    ref,
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((value) => !value),
      isOpen: () => isOpen,
      focusInput: () => inputRef.current?.focus()
    }),
    [isOpen]
  );

  useEffect(() => {
    if (isOpen) {
      config.hooks?.onOpen?.();
      const timeout = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 70);
      wasOpenRef.current = true;
      return () => window.clearTimeout(timeout);
    }
    if (wasOpenRef.current) {
      config.hooks?.onClose?.();
    }
    wasOpenRef.current = false;
    return undefined;
  }, [config.hooks, isOpen]);

  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    setFeedbackState((prev) => {
      const next: FeedbackState = { ...prev };
      messages
        .filter((message) => message.role === 'assistant')
        .forEach((message) => {
          if (!(message.id in next)) {
            next[message.id] = undefined;
          }
        });
      return next;
    });
  }, [messages]);

  const themeVariables = useMemo<CSSProperties>(
    () => ({
      '--chat-widget-primary': config.theme?.primaryColor ?? '#2563eb',
      '--chat-widget-secondary': config.theme?.secondaryColor ?? '#1d4ed8',
      '--chat-widget-background': config.theme?.backgroundColor ?? '#ffffff',
      '--chat-widget-text': config.theme?.textColor ?? '#0f172a',
      '--chat-widget-bubble': config.theme?.bubbleColor ?? '#2563eb'
    }),
    [config.theme]
  );

  const submitMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }
    setInputValue('');
    await sendMessage(trimmed);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitMessage();
  };

  const handleFeedback = async (message: ChatMessage, rating: 'up' | 'down') => {
    const payload: FeedbackPayload = {
      messageId: message.id,
      rating
    };
    await sendFeedback(payload);
    setFeedbackState((prev) => ({
      ...prev,
      [message.id]: rating
    }));
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const rating = feedbackState[message.id];
    return (
      <div
        key={message.id}
        className={`chat-widget__message chat-widget__message--${message.role}`}
        data-testid={`message-${message.role}`}
      >
        <div className="chat-widget__bubble" data-role={message.role}>
          {message.content}
        </div>
        {message.role === 'assistant' && (
          <div className="chat-widget__feedback">
            <button
              type="button"
              className={`chat-widget__feedback-btn${rating === 'up' ? ' is-active' : ''}`}
              aria-label="Thumbs up"
              onClick={() => handleFeedback(message, 'up')}
              disabled={Boolean(rating)}
            >
              👍
            </button>
            <button
              type="button"
              className={`chat-widget__feedback-btn${rating === 'down' ? ' is-active' : ''}`}
              aria-label="Thumbs down"
              onClick={() => handleFeedback(message, 'down')}
              disabled={Boolean(rating)}
            >
              👎
            </button>
          </div>
        )}
        {isUser && <div className="chat-widget__timestamp">You</div>}
      </div>
    );
  };

  return (
    <div className="chat-widget" style={themeVariables}>
      <button
        type="button"
        className={`chat-widget__toggle${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close chat widget' : 'Open chat widget'}
        data-testid="chat-widget-toggle"
      >
        {config.logoUrl ? (
          <img src={config.logoUrl} alt="Widget logo" className="chat-widget__toggle-logo" />
        ) : (
          <span className="chat-widget__toggle-icon">💬</span>
        )}
      </button>

      <div className={`chat-widget__panel${isOpen ? ' is-visible' : ''}`} role="dialog" aria-modal="false">
        <header className="chat-widget__header">
          {config.logoUrl && <img src={config.logoUrl} alt="Widget logo" className="chat-widget__header-logo" />}
          <div className="chat-widget__header-copy">
            <h2>{config.title ?? 'Need a hand?'}</h2>
            <p>{config.welcomeMessage ?? 'We are here to help. Ask us anything!'}</p>
          </div>
          <button
            type="button"
            className="chat-widget__close"
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            ×
          </button>
        </header>

        {error && (
          <div className="chat-widget__error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={resetError} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        <div className="chat-widget__body">
          {isLoading ? (
            <div className="chat-widget__placeholder" data-testid="chat-widget-loading">
              Loading conversation…
            </div>
          ) : (
            <div ref={listRef} className="chat-widget__messages">
              {messages.length === 0 && (
                <div className="chat-widget__placeholder">Say hello to get things started.</div>
              )}
              {messages.map(renderMessage)}
              {isSending && (
                <div className="chat-widget__message chat-widget__message--assistant" data-testid="chat-widget-sending">
                  <div className="chat-widget__bubble" data-role="assistant">
                    Typing…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="chat-widget__footer">
          {isHandover ? (
            <div className="chat-widget__handover">
              A human teammate is taking over. Sit tight!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="chat-widget__form">
              <textarea
                ref={inputRef}
                value={inputValue}
                placeholder={config.placeholder ?? 'Write your message…'}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void submitMessage();
                  }
                }}
                rows={2}
                className="chat-widget__input"
                disabled={isSending}
                data-testid="chat-widget-input"
              />
              <button
                type="submit"
                className="chat-widget__send"
                disabled={isSending || !inputValue.trim()}
                data-testid="chat-widget-send"
              >
                Send
              </button>
            </form>
          )}
        </footer>
      </div>
    </div>
  );
});

ChatWidget.displayName = 'ChatWidget';

export default ChatWidget;
