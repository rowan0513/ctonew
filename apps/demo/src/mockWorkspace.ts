import type { WidgetConfig } from '@ctonew/widget';

const LOGO_DATA_URL = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'><defs><linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:%236366f1;stop-opacity:1' /><stop offset='100%' style='stop-color:%23638bff;stop-opacity:1' /></linearGradient></defs><rect width='128' height='128' rx='32' fill='url(%23grad)'/><path d='M36 64c0-15.464 12.536-28 28-28s28 12.536 28 28-12.536 28-28 28S36 79.464 36 64zm28-18a18 18 0 1 0 0 36 18 18 0 0 0 0-36zm0 10.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z' fill='white'/></svg>`;

export const demoConfig: WidgetConfig = {
  workspaceId: 'demo-workspace',
  title: 'cto.new concierge',
  welcomeMessage: 'Ask anything about your workspace. We reply in seconds!',
  logoUrl: LOGO_DATA_URL,
  placeholder: 'Ask how to integrate the chat widget…',
  theme: {
    primaryColor: '#6366F1',
    secondaryColor: '#7C3AED',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    bubbleColor: '#6366F1'
  },
  initialMessages: [
    {
      id: 'assistant-demo-1',
      role: 'assistant',
      content: '👋 Welcome to the cto.new widget playground. Start a conversation using the panel below.',
      createdAt: '2023-01-01T00:00:00.000Z'
    }
  ],
  startOpen: true
};

export const demoWorkspaceDetails = {
  name: 'cto.new Demo Workspace',
  description:
    'This page showcases the embeddable chat widget. Try sending a message or tweaking the theme in the controls below to see live updates.',
  apiUrl: import.meta.env.VITE_WIDGET_API_URL ?? undefined
};
