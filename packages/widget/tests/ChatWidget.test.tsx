import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatWidget } from '../src/components/ChatWidget';
import type { WidgetConfig } from '../src/types';

const API_URL = 'https://api.cto.new/runtime';

const baseConfig: WidgetConfig = {
  workspaceId: 'workspace-123',
  apiUrl: API_URL,
  welcomeMessage: 'Welcome aboard!'
};

const createFetchStub = () => {
  return vi.fn(async (input: RequestInfo, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

    if (url.includes('/conversation')) {
      return new Response(
        JSON.stringify({
          messages: [
            {
              id: 'assistant-initial',
              role: 'assistant',
              content: 'Initial message',
              createdAt: '2023-01-01T00:00:00.000Z'
            }
          ]
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (url.includes('/messages') && method === 'POST') {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      return new Response(
        JSON.stringify({
          message: {
            id: 'assistant-response',
            role: 'assistant',
            content: `Echo: ${body.message}`,
            createdAt: '2023-01-01T00:00:02.000Z'
          }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (url.includes('/feedback') && method === 'POST') {
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 404 });
  });
};

let fetchStub: ReturnType<typeof createFetchStub>;

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
});

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: () => 'user-generated-id',
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = i;
      }
      return array;
    }
  });
  fetchStub = createFetchStub();
  vi.stubGlobal('fetch', fetchStub);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterAll(() => {
  vi.useRealTimers();
});

describe('ChatWidget', () => {
  it('renders a bubble and toggles the panel', async () => {
    render(<ChatWidget config={baseConfig} />);

    const toggle = await screen.findByTestId('chat-widget-toggle');
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveClass('is-visible'));

    fireEvent.click(screen.getByLabelText('Close chat'));
    await waitFor(() => expect(screen.getByRole('dialog')).not.toHaveClass('is-visible'));
  });

  it('sends messages via the runtime API', async () => {
    const onMessageSent = vi.fn();
    const config: WidgetConfig = {
      ...baseConfig,
      hooks: {
        onMessageSent
      }
    };

    render(<ChatWidget config={config} />);

    fireEvent.click(await screen.findByTestId('chat-widget-toggle'));

    const input = await screen.findByTestId('chat-widget-input');
    fireEvent.change(input, { target: { value: 'Hello there' } });

    const sendButton = screen.getByTestId('chat-widget-send');
    fireEvent.click(sendButton);

    await waitFor(() =>
      expect(fetchStub).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({ method: 'POST' })
      )
    );

    await waitFor(() => expect(onMessageSent).toHaveBeenCalledTimes(1));
    expect(onMessageSent.mock.calls[0][0]).toMatchObject({ content: 'Hello there', role: 'user' });

    await waitFor(() => expect(screen.getByText('Echo: Hello there')).toBeInTheDocument());
  });

  it('captures feedback interactions', async () => {
    const onFeedback = vi.fn();
    const config: WidgetConfig = {
      ...baseConfig,
      hooks: {
        onFeedback
      }
    };

    render(<ChatWidget config={config} />);

    fireEvent.click(await screen.findByTestId('chat-widget-toggle'));

    const input = await screen.findByTestId('chat-widget-input');
    fireEvent.change(input, { target: { value: 'Feedback test' } });
    fireEvent.click(screen.getByTestId('chat-widget-send'));

    await waitFor(() => screen.getByText('Echo: Feedback test'));

    const thumbsUp = screen.getAllByLabelText('Thumbs up')[0];
    fireEvent.click(thumbsUp);

    await waitFor(() => expect(onFeedback).toHaveBeenCalledTimes(1));
    expect(onFeedback).toHaveBeenCalledWith({ messageId: 'assistant-response', rating: 'up' });
    expect(thumbsUp).toBeDisabled();
  });

  it('matches the open widget snapshot', async () => {
    render(<ChatWidget config={{ ...baseConfig, startOpen: true }} />);

    const toggle = await screen.findByTestId('chat-widget-toggle');
    await screen.findByText('Initial message');

    expect(toggle).toMatchInlineSnapshot(`
      <button
        aria-expanded="true"
        aria-label="Close chat widget"
        class="chat-widget__toggle is-open"
        data-testid="chat-widget-toggle"
        type="button"
      >
        <span
          class="chat-widget__toggle-icon"
        >
          💬
        </span>
      </button>
    `);
  });
});
