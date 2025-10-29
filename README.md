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
