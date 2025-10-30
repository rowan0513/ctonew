# Security Checklist

This project implements the following baseline security safeguards. Each item aligns with OWASP best practices and the ticket acceptance criteria.

| Control | Status | Notes |
| --- | --- | --- |
| Input validation | ✅ | All `/api` routes use Zod schemas (`src/schemas`) enforced through middleware (`src/middleware/validation.js`). |
| HTML/Text sanitization | ✅ | User-supplied content is sanitized via `sanitize-html` (`src/utils/sanitize.js`). |
| File scanning pipeline | ✅ | Uploads are handled in-memory and scanned for sensitive patterns and oversize payloads, with optional moderation hooks (`src/services/fileScanner.js`). |
| Content moderation toggle | ✅ | Enable via `MODERATION_ENABLED=true` and `MODERATION_PROVIDER` env vars (see `.env.example`). |
| Security headers (CSP, HSTS, etc.) | ✅ | Helmet configured in `src/app.js` adds a restrictive CSP, HSTS, frameguard, referrer policy, and permissions policy. |
| HTTPS-only cookies | ✅ | Admin responses set `httpOnly`, `secure`, `sameSite=strict` cookies (`src/routes/admin.js`). |
| SSRF protection | ✅ | Remote crawling uses host allow-lists, protocol checks, response size limits, and timeouts (`src/utils/urlValidation.js`). |
| Request size limiting | ✅ | JSON, URL-encoded, and text parsers constrained via `REQUEST_SIZE_LIMIT` (default 1 MB). |
| Dependency auditing | ✅ | `npm run audit:ci` and CI workflow fail on high severity issues. |
| Privacy controls | ✅ | Configurable PII masking, forget-data workflow, and audit logging (see README and `/admin/privacy`). |
| Automated tests | ✅ | Jest tests cover validators, sanitation, security headers, file scanning, and privacy workflows (`tests/app.test.js`, `tests/privacy.test.js`). |
| Secret management | ✅ | Secrets are injected via environment variables; `.env` is ignored. Rotation steps documented below. |

## Secrets and Rotation Procedures

1. **Storage**: Secrets must only be supplied through environment variables or secret managers. Never commit secrets to source control. Use `.env.example` as a reference for required keys.
2. **Rotation**:
   - Generate a new secret (for example, a new API key).
   - Update the secret in the secret manager or deployment environment.
   - Redeploy the application so the new value is loaded at runtime.
   - Revoke the previous secret once the deployment is verified.
   - Document the rotation (date, reason, owner) in the operational runbook.
3. **Reviews**: Schedule periodic (at least quarterly) reviews of secret access and rotate long-lived secrets proactively.

## Operational Notes

- Configure allowed crawler hosts through `CRAWLER_ALLOWED_HOSTS` to minimise SSRF risk.
- Moderation providers can be toggled without code changes via environment variables (use `MODERATION_PROVIDER=openai` with `OPENAI_API_KEY` for OpenAI moderation, or `mock` for the built-in heuristics).
- Request and upload size limits can be tuned through `REQUEST_SIZE_LIMIT` and `UPLOAD_MAX_BYTES`.
- Run `npm run audit:ci` locally before merging to ensure dependency hygiene.
