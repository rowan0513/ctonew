import { StrictMode, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createChatWidget, type WidgetConfig } from '@ctonew/widget';
import { demoConfig, demoWorkspaceDetails } from './mockWorkspace';
import './main.css';

type ThemeForm = Required<NonNullable<WidgetConfig['theme']>>;

const defaultTheme: ThemeForm = {
  primaryColor: demoConfig.theme?.primaryColor ?? '#6366F1',
  secondaryColor: demoConfig.theme?.secondaryColor ?? '#7C3AED',
  backgroundColor: demoConfig.theme?.backgroundColor ?? '#ffffff',
  textColor: demoConfig.theme?.textColor ?? '#0f172a',
  bubbleColor: demoConfig.theme?.bubbleColor ?? '#6366F1'
};

const DemoApp = () => {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    const handle = createChatWidget(
      {
        ...demoConfig,
        apiUrl: demoWorkspaceDetails.apiUrl,
        theme,
        hooks: {
          onOpen: () => console.info('[widget] opened'),
          onClose: () => console.info('[widget] closed'),
          onMessageSent: (message) => console.info('[widget] message sent', message),
          onFeedback: (payload) => console.info('[widget] feedback received', payload)
        }
      },
      '#widget-anchor'
    );

    return () => handle.destroy();
  }, [theme]);

  return (
    <div className="demo">
      <header className="demo__hero">
        <h1>cto.new chat widget</h1>
        <p>{demoWorkspaceDetails.description}</p>
        <dl>
          <div>
            <dt>Workspace</dt>
            <dd>{demoWorkspaceDetails.name}</dd>
          </div>
          <div>
            <dt>Runtime API</dt>
            <dd>{demoWorkspaceDetails.apiUrl ?? 'Echo mode (no API URL configured)'}</dd>
          </div>
        </dl>
      </header>

      <section className="demo__controls">
        <h2>Theme controls</h2>
        <div className="demo__grid">
          {Object.entries(theme).map(([key, value]) => (
            <label key={key} className="demo__field">
              <span>{key.replace(/([A-Z])/g, ' $1')}</span>
              <input
                type="color"
                value={value}
                onChange={(event) =>
                  setTheme((prev) => ({
                    ...prev,
                    [key]: event.target.value
                  }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="demo__embed">
        <h2>Embed snippet</h2>
        <p>Copy the HTML below into your site to mount the widget.</p>
        <pre className="demo__code" aria-label="Embed code snippet">
          {`<script
  src="/packages/widget/dist/embed.js"
  data-workspace-id="${demoConfig.workspaceId}"
  data-logo-url="${demoConfig.logoUrl}"
  data-title="${demoConfig.title}"
  data-welcome-message="${demoConfig.welcomeMessage}"
  data-primary-color="${theme.primaryColor}"
  data-secondary-color="${theme.secondaryColor}"
  data-background-color="${theme.backgroundColor}"
  data-text-color="${theme.textColor}"
  data-bubble-color="${theme.bubbleColor}"
></script>`}
        </pre>
      </section>

      <div id="widget-anchor" aria-hidden="true" />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <DemoApp />
  </StrictMode>
);
