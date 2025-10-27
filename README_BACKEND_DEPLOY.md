# Backend deployment guide (Railway)

This document describes how to build and run the backend located in [`server/`](server/) on Railway and how to verify that the public environment is healthy.

## Project layout

## Deploy

- Railway использует `nixpacks.toml` с публичным npm mirror (`https://registry.npmmirror.com`).
- Локальная проверка сервера: `npm run build:server && npm start`.
- Фронтенд собирается отдельно: `npm run build`.

- **Root directory:** `server/`
- **Entry point:** `index.ts`
- **Build output:** `dist/index.js`

## Required environment variables

Create a `.env` file inside `server/` (Railway automatically injects variables at runtime). See [`server/.env.example`](server/.env.example) for a ready-to-copy template.

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port used by Express. Railway injects `PORT` automatically, default is `3000` for local runs. |
| `CORS_ORIGIN` | Comma-separated list of allowed origins. Use `*` to allow all or set to your deployed frontend URL (e.g. `https://<frontend-on-vercel>.vercel.app`). |
| `DATABASE_URL` | PostgreSQL connection string. Railway sets this automatically when the Neon plugin is attached. Without it the API falls back to an in-memory store that is not suitable for production. |
| `GEMINI_API_KEY` | API key from Google AI Studio used by the analyzer and transcription helpers. Required for smoke tests and production traffic. |

> ℹ️  To keep builds working without direct npm registry access, lightweight drop-in replacements of `cors` and `dotenv` live in [`server/vendor/`](server/vendor/). They expose the same public API that the standard packages provide, so no additional configuration is required when deploying to Railway.

## Railway deployment settings

Railway автоматически использует `nixpacks.toml`, поэтому переопределять команды не требуется. Фазы выполняют:

- **Install:** mirror-реестр + `npm ci --omit=dev --no-audit --no-fund`
- **Build:** `npm run build:server`
- **Start:** `npm start`

Убедитесь, что сервис привязан к корню репозитория, чтобы Nixpacks нашёл конфиг и собрал `dist/index.js`.

## Local verification before deploying

Run the following commands from the repository root to install dependencies, compile the backend, and start it locally:

```bash
npm --prefix server ci
npm --prefix server run build
npm --prefix server run start
```

The server listens on `http://localhost:3000` by default. Verify the health endpoint:

```bash
curl http://localhost:3000/healthz
```

Expected response:

```json
{"status":"ok"}
```

Use `npm --prefix server run dev` for a hot-reload development server powered by `tsx`.

> 💡  The local server runs against an in-memory datastore when `DATABASE_URL` is not defined. This is convenient for smoke tests, but the production deployment on Railway must expose a working PostgreSQL database via `DATABASE_URL` so that history and seed data persist between restarts.

## Automated production health verification

The repository provides a helper script that checks the status of the deployed Railway instance. Run it from the project root:

```bash
node scripts/verify-railway.mjs
```

The script attempts to detect the public Railway URL using the following strategy:

1. Use the `RAILWAY_PUBLIC_URL` environment variable if it is available (recommended for CI).
2. Probe `https://ai-manager-evaluation.up.railway.app/healthz`.
3. (Optional) Extend the script to parse deployment logs for `https://*.up.railway.app` if custom automation exposes them.

Results are written to [`reports/railway-health.json`](reports/railway-health.json). When the public URL cannot be determined automatically the report records the status as `"pending"` and explains how to provide the URL manually via `RAILWAY_PUBLIC_URL`.

## Troubleshooting

- **Process crashes on Railway:** Check that the build step finishes successfully, the compiled files are present in `dist/`, and that all required environment variables are defined.
- **Database connection errors:** Confirm that the `DATABASE_URL` value matches the PostgreSQL instance provisioned in Railway (e.g. the Neon integration) and that the database is reachable from the service.
- **CORS errors:** Confirm `CORS_ORIGIN` contains the correct domain(s). Separate multiple origins with commas.
- **Health check failures:** Review the generated report in `reports/railway-health.json` and inspect Railway logs for detailed error messages.
