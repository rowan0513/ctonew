import { createRoot, Root } from 'react-dom/client';
import { ChatWidget, ChatWidgetHandle } from './components/ChatWidget';
import type { WidgetConfig } from './types';

export interface EmbeddedWidgetHandle {
  open: () => void;
  close: () => void;
  toggle: () => void;
  focus: () => void;
  isOpen: () => boolean;
  destroy: () => void;
  container: HTMLElement;
}

const resolveContainer = (target?: string | HTMLElement): { element: HTMLElement; created: boolean } => {
  if (typeof document === 'undefined') {
    throw new Error('Chat widget can only be mounted in a browser environment.');
  }

  if (target instanceof HTMLElement) {
    return { element: target, created: false };
  }

  if (typeof target === 'string') {
    const element = document.querySelector(target);
    if (element instanceof HTMLElement) {
      return { element, created: false };
    }
  }

  const element = document.createElement('div');
  element.className = 'chat-widget-root';
  document.body.appendChild(element);
  return { element, created: true };
};

export const createChatWidget = (
  config: WidgetConfig,
  target?: string | HTMLElement
): EmbeddedWidgetHandle => {
  const { element: container, created } = resolveContainer(target);
  const root: Root = createRoot(container);
  let widgetHandle: ChatWidgetHandle | null = null;

  root.render(
    <ChatWidget
      ref={(instance) => {
        widgetHandle = instance;
      }}
      config={config}
    />
  );

  const ensureHandle = () => {
    if (!widgetHandle) {
      throw new Error('The chat widget has not finished mounting yet.');
    }
    return widgetHandle;
  };

  const destroy = () => {
    root.unmount();
    if (created) {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    } else {
      container.innerHTML = '';
    }
    widgetHandle = null;
  };

  return {
    open: () => ensureHandle().open(),
    close: () => ensureHandle().close(),
    toggle: () => ensureHandle().toggle(),
    focus: () => ensureHandle().focusInput(),
    isOpen: () => ensureHandle().isOpen(),
    destroy,
    container
  };
};
