import { createChatWidget } from './mount';
import type { WidgetConfig } from './types';

declare global {
  interface Window {
    CTOWidget?: {
      create: (config: WidgetConfig, target?: string | HTMLElement) => ReturnType<typeof createChatWidget>;
    };
    __CTO_WIDGET_CONFIG__?: WidgetConfig;
    __CTO_WIDGET_SNIPPET_TARGET__?: string | HTMLElement;
  }
}

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  return value === 'true' || value === '1' || value === '';
};

const parseDatasetConfig = (dataset: DOMStringMap): Partial<WidgetConfig> => {
  const theme = {
    primaryColor: dataset.primaryColor,
    secondaryColor: dataset.secondaryColor,
    backgroundColor: dataset.backgroundColor,
    textColor: dataset.textColor,
    bubbleColor: dataset.bubbleColor
  };

  const filteredTheme = Object.fromEntries(
    Object.entries(theme).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
  );

  return {
    workspaceId: dataset.workspaceId ?? '',
    apiUrl: dataset.apiUrl,
    logoUrl: dataset.logoUrl,
    title: dataset.title,
    welcomeMessage: dataset.welcomeMessage,
    placeholder: dataset.placeholder,
    token: dataset.token,
    theme: Object.keys(filteredTheme).length ? (filteredTheme as WidgetConfig['theme']) : undefined,
    startOpen: parseBoolean(dataset.open)
  };
};

const bootstrapFromScript = (): WidgetConfig | null => {
  if (typeof document === 'undefined') {
    return null;
  }

  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) {
    return null;
  }

  const parsed = parseDatasetConfig(script.dataset ?? {});
  if (!parsed.workspaceId) {
    return null;
  }

  return parsed as WidgetConfig;
};

const determineConfig = (): { config: WidgetConfig | null; target?: string | HTMLElement } => {
  if (typeof window === 'undefined') {
    return { config: null };
  }

  if (window.__CTO_WIDGET_CONFIG__) {
    return {
      config: window.__CTO_WIDGET_CONFIG__,
      target: window.__CTO_WIDGET_SNIPPET_TARGET__
    };
  }

  const scriptConfig = bootstrapFromScript();
  if (scriptConfig) {
    return {
      config: scriptConfig,
      target: undefined
    };
  }

  return { config: null };
};

const registerGlobal = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.CTOWidget = {
    create: (config: WidgetConfig, target?: string | HTMLElement) => createChatWidget(config, target)
  };
};

const init = () => {
  const { config, target } = determineConfig();
  registerGlobal();
  if (!config) {
    return;
  }
  createChatWidget(config, target);
};

init();

export { createChatWidget } from './mount';
export type { WidgetConfig } from './types';
