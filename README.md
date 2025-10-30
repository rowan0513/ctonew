# EzChat Admin Platform

Bootstrap Next.js 14 admin workspace for the EzChat team. The stack ships with typed environment validation, Tailwind theming tokens, testing utilities, and automated quality gates so new features can be delivered with confidence.

## Stack

- **Next.js 14 (App Router)** with TypeScript and strict mode enabled
- **Tailwind CSS 3** configured with shared design tokens for rapid UI iteration
- **ESLint & Prettier** tuned for Next.js, Tailwind, and testing best practices
- **Vitest + React Testing Library** for fast, typed component and hook tests
- **Typed environment loader** using Zod (`env.mjs`) with per-environment safety defaults
- **Husky + lint-staged** to run lint, typecheck, and tests on every commit

## Getting started

1. **Install dependencies** (uses [pnpm](https://pnpm.io)):
   ```bash
   corepack enable pnpm
   pnpm install
   ```
2. **Set up your environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Update `.env.local` with real credentials before running the application. Missing required variables will prevent the app from starting and log helpful validation errors.
3. **Install Git hooks**:
   ```bash
   pnpm prepare
   ```

### Development

```bash
pnpm dev
```

Starts the Next.js development server and validates your environment variables on boot.

### Quality checks

| Command           | Description                                                                            |
| ----------------- | -------------------------------------------------------------------------------------- |
| `pnpm lint`       | Runs ESLint with Next.js, Tailwind, Testing Library, and Prettier compatibility rules. |
| `pnpm typecheck`  | Executes `tsc --noEmit` for full project type coverage.                                |
| `pnpm test`       | Executes Vitest in run mode with jsdom, coverage, and RTL setup.                       |
| `pnpm format`     | Formats the entire codebase using Prettier and the Tailwind class sorter.              |
| `pnpm test:watch` | Runs Vitest in watch mode for interactive workflows.                                   |

Husky’s pre-commit hook runs `pnpm lint-staged`, followed by `pnpm typecheck` and `pnpm test` to keep commits clean.

## Embedding the EzChat widget

The admin app ships with an embed snippet tool for each workspace. Open `/workspaces/ws_northwind_support/embed` to review the configuration process:

1. **Publish the workspace** when your configuration is ready. Snippets remain read-only until the workspace is published.
2. **Choose a snippet type** – the script loader attaches the widget globally, while the iframe variant keeps it sandboxed for portals or dashboards.
3. **Optionally supply theme overrides** (for example primary color, background color, or border radius) before copying a snippet.
4. **Copy the snippet** using the built-in clipboard buttons. Successful copies trigger a confirmation toast; attempts while unpublished surface a guard message instead.

The embed page includes an onboarding checklist and links back to this README so operations teams have step-by-step guidance when rolling the widget out to new surfaces.

## Project structure

```
app/                 # App Router routes and layouts
components/          # Reusable UI components
lib/                 # Shared utilities (e.g., className helpers)
env.mjs              # Zod-powered environment validation
postcss.config.mjs   # Tailwind + PostCSS configuration
tailwind.config.ts   # Tailwind theme tokens and design primitives
vitest.config.ts     # Vitest + RTL configuration
```

## Environment validation

`env.mjs` parses server and client variables using Zod. The validation runs as soon as the Next.js config loads. For test runs, safe default values are injected automatically via `vitest.setup.ts` so suites can run in isolation. Any invalid or missing variables produce readable error messages before your application boots.

## Deployment

The project ships with the default Vercel configuration (`next.config.mjs`) and can be deployed immediately once the required secrets are available.
