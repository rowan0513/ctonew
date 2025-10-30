# cto.new Chat Widget

An embeddable React chat widget that customers can drop into their applications. The widget ships as a tree-shakeable package and an embeddable bundle with minimal setup.

## Getting started

Install dependencies in the repository root and run the build/test commands via the existing npm scripts:

```bash
npm install
npm run build
npm run test
```

### Usage as a React component

```tsx
import { ChatWidget } from '@ctonew/widget';

export const Page = () => (
  <ChatWidget
    config={{
      workspaceId: 'workspace-id',
      apiUrl: 'https://runtime.dev.cto.new',
      logoUrl: 'https://example.com/logo.png',
      welcomeMessage: 'Hi there 👋',
      theme: {
        primaryColor: '#6366F1'
      }
    }}
  />
);
```

### Embeddable bundle snippet

The build outputs an embeddable bundle at `dist/embed.js`. Host the file and drop the snippet below into any site:

```html
<div id="cto-widget"></div>
<script
  src="https://yourcdn.example.com/embed.js"
  data-workspace-id="workspace-id"
  data-api-url="https://runtime.dev.cto.new"
  data-logo-url="https://example.com/logo.png"
  data-title="cto.new concierge"
  data-welcome-message="Ask us anything!"
  data-primary-color="#6366F1"
></script>
```

This will automatically mount the chat widget and expose a helper on `window.CTOWidget.create(...)` for programmatic control.

## Demo application

A Vite-powered demo lives under `apps/demo`. Run `npm run dev` from the repository root to start it locally and experiment with branding, runtime environments, and feedback hooks using mock workspace data.
