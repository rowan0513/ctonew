# Secure API Baseline

This project provides a minimal Express application hardened with baseline security controls, schema validation, and automated checks.

## Getting Started

```bash
npm install
npm start
```

Environment variables can be configured via `.env` (see `.env.example`).

## Key Features

- **Input validation** – All API requests are validated with Zod schemas.
- **Content sanitization** – HTML content is sanitized before storage/response.
- **Security headers** – Helmet enforces CSP, HSTS, frameguard, and modern browser protections.
- **HTTPS-only cookies** – Administrative responses set secure cookies.
- **File scanning** – Uploads are scanned for sensitive patterns and can trigger optional content moderation providers.
- **SSRF protection** – Remote crawling is constrained by allow-lists, request timeouts, and size limits.
- **Request limits** – Body parsers restrict incoming payload size.
- **Dependency auditing** – `npm run audit:ci` fails builds on high severity vulnerabilities (see `.github/workflows/dependency-audit.yml`).

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the HTTP server. |
| `npm test` | Run Jest test suite covering validators and security middleware. |
| `npm run audit:ci` | Run automated dependency audit (fails on high severity issues). |

## Security Notes

See [`docs/security-checklist.md`](docs/security-checklist.md) for the complete security controls checklist and secret rotation guidance.
# EzChat Admin Platform

[![CI](https://github.com/rowan0513/ctonew/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/rowan0513/ctonew/actions/workflows/ci.yml)

Bootstrap Next.js 14 admin workspace for the EzChat team. The stack ships with typed environment validation, Tailwind theming tokens, testing utilities, database seed tooling, and automated quality gates so new features can be delivered with confidence.

## Stack

- **Next.js 14 (App Router)** with TypeScript and strict mode enabled
- **Tailwind CSS 3** configured with shared design tokens for rapid UI iteration
- **ESLint & Prettier** tuned for Next.js, Tailwind, and testing best practices
- **Vitest + React Testing Library** for fast, typed component and hook tests
- **Typed environment loader** using Zod (`env.mjs`) with per-environment safety defaults
- **Husky + lint-staged** to run lint, typecheck, and tests on every commit
- **Seed tooling** powered by the Neon serverless driver to quickly hydrate a development database

## Quick start

1. **Install dependencies** (uses [pnpm](https://pnpm.io)):
   ```bash
   corepack enable pnpm
   pnpm install
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   pnpm check:env
   ```
   Update `.env.local` with real credentials before running the application. The `check:env` script keeps `.env.example` in sync with the Zod schema in `env.mjs` and will fail CI if keys ever drift.
3. **Install Git hooks**:
   ```bash
   pnpm prepare
   ```
4. **(Optional) Seed local data** – with a running Postgres instance and `POSTGRES_URL` configured:
   ```bash
   pnpm seed
   ```
   This creates a demo workspace, data sources, and conversation records so the UI has meaningful fixtures on first load.

### Development

```bash
pnpm dev
```

Starts the Next.js development server and validates your environment variables on boot.

### Database seed

The seed script (`pnpm seed`) uses `@neondatabase/serverless` to connect to the database defined by `POSTGRES_URL`. It will:

1. Ensure `workspaces`, `data_sources`, and `conversations` tables exist.
2. Upsert the `ezchat-demo` workspace with consistent metadata.
3. Synchronise three canonical data sources (Zendesk, Intercom, Salesforce) with connection details stored as JSONB.
4. Reset demo conversation data for the workspace so repeated runs remain deterministic.

The script runs inside a transaction and rolls back on failure. Provide valid credentials before executing to avoid partial state.

## Environment variables

| Variable | Description | Service |
| -------- | ----------- | ------- |
| `NODE_ENV` | Runtime mode (`development`, `test`, or `production`). | Next.js runtime |
| `NEXT_PUBLIC_APP_URL` | Public origin for the admin app (used in links and redirects). | Vercel / Hosting |
| `OPENAI_API_KEY` | API key for EzChat AI assistants. | OpenAI |
| `POSTGRES_URL` | Connection string for the primary workspace database. | Neon (Postgres) |
| `REDIS_URL` | Redis connection string for caching and realtime presence. | Upstash / Redis |
| `AWS_S3_ACCESS_KEY_ID` / `AWS_S3_SECRET_ACCESS_KEY` | Credentials for file storage. | AWS IAM |
| `AWS_S3_BUCKET` | Bucket used to archive conversation attachments and exports. | AWS S3 |
| `AWS_S3_REGION` | Region hosting the bucket. | AWS S3 |
| `INBOUND_WEBHOOK_SECRET` | Secret validating inbound partner webhooks. | EzChat integrations |
| `OUTBOUND_WEBHOOK_SECRET` | Secret used when EzChat calls downstream systems. | EzChat integrations |

Secrets should be stored in your Vercel project environment (Production/Preview/Development sets) and duplicated in GitHub Actions for branch builds when required. The repo ships with `.env.example` placeholders; update them and run `pnpm check:env` to ensure parity with the schema.

## Quality checks

| Command           | Description                                                                            |
| ----------------- | -------------------------------------------------------------------------------------- |
| `pnpm check:env`  | Verifies `.env.example` matches the Zod schema in `env.mjs`.                            |
| `pnpm lint`       | Runs ESLint with Next.js, Tailwind, Testing Library, and Prettier compatibility rules. |
| `pnpm typecheck`  | Executes `tsc --noEmit` for full project type coverage.                                |
| `pnpm test`       | Executes Vitest in run mode with jsdom, coverage, and RTL setup.                       |
| `pnpm format`     | Formats the entire codebase using Prettier and the Tailwind class sorter.              |
| `pnpm test:watch` | Runs Vitest in watch mode for interactive workflows.                                   |

Husky’s pre-commit hook runs `pnpm lint-staged`, followed by `pnpm typecheck` and `pnpm test` to keep commits clean.

## Project structure

```
app/                 # App Router routes and layouts
components/          # Reusable UI components
lib/                 # Shared utilities (e.g., className helpers)
env.mjs              # Zod-powered environment validation
scripts/             # Env parity checks and database seed tooling
.github/workflows/   # Continuous integration pipelines
postcss.config.mjs   # Tailwind + PostCSS configuration
tailwind.config.ts   # Tailwind theme tokens and design primitives
vitest.config.ts     # Vitest + RTL configuration
```

## CI/CD pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on pull requests and pushes to `main`:

1. Checks out the repository and installs pnpm 10 with Node.js 20.
2. Restores a cached pnpm store and reinstates the Next.js build cache (`.next/cache`).
3. Installs dependencies with a frozen lockfile and verifies `.env.example` via `pnpm check:env`.
4. Executes `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` using production-safe environment placeholders.

Passing status checks are required on pull requests, providing early signal for style, correctness, and build regressions.

## Deployment workflow

- **Vercel** – Deploy the Next.js Admin interface. Configure the environment variables above in the Vercel dashboard. Enable the GitHub integration so every merge to `main` triggers an automatic deployment.
- **Neon Postgres** – Provision a primary branch database for EzChat. Store the connection string in both Vercel and GitHub (`POSTGRES_URL`). Run `pnpm seed` or your migrations pipeline after provisioning to bootstrap demo data.
- **Redis (Upstash or AWS ElastiCache)** – Supply `REDIS_URL` for realtime presence, rate limiting, and caching layers.
- **AWS S3** – Create a bucket dedicated to EzChat exports and configure IAM credentials for the app. Provide the key, secret, bucket, and region via environment variables or secret stores.

With secrets configured, every push to `main` will publish through Vercel while the CI pipeline guarantees lint, test, type, and build checks pass before deployment.
