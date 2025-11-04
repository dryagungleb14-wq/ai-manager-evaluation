# Production Environment Fixes

This document describes the fixes applied to resolve production deployment errors.

## Issues Fixed

### 1. ERR_MODULE_NOT_FOUND for better-sqlite3

**Problem:** The `better-sqlite3` module was only listed in `server/package.json` but not in the root `package.json`. Since the production build bundles the server code and runs from the root directory, Node.js could not find the module.

**Error Message:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'better-sqlite3' imported from /app/dist/server.js
```

**Solution:** Added `better-sqlite3` to the dependencies in the root `package.json`:
```json
"dependencies": {
  ...
  "better-sqlite3": "^11.10.0",
  ...
}
```

### 2. SESSION_SECRET must be set in production

**Problem:** The application requires a `SESSION_SECRET` environment variable for secure session management in production, but it was not documented or configured.

**Error Message:**
```
Error: SESSION_SECRET must be set in production
```

**Solution:** 
1. Added `SESSION_SECRET` to `server/.env.example` with comprehensive documentation
2. Added `SESSION_SECRET` to `ci.env.example` for CI/CD environments
3. Updated `README_BACKEND_DEPLOY.md` to clearly document this as a required variable
4. Updated main `README.md` to include SESSION_SECRET in environment setup

**How to generate a secure SESSION_SECRET:**
```bash
openssl rand -hex 32
```

**Example output:**
```
2f4adba7c050a28ae7cb8060902d7ee2f1f90ff45a164edae1ae07d65ca8b771
```

**Important:** 
- In production deployment (Railway, Heroku, etc.), you **must** set this environment variable to a secure random string of at least 32 characters.
- The application will crash on startup if SESSION_SECRET is not set in production mode.
- Generate a unique value for each environment (development, staging, production).
- Never commit the actual SESSION_SECRET to version control or share it publicly.

### 3. npm config production warning

**Warning Message:**
```
npm warn config production Use --omit=dev instead.
```

**Status:** Already resolved. The `nixpacks.toml` configuration already uses the modern `--omit=dev` flag:
```toml
[phases.install]
cmds = [
  "npm config set registry https://registry.npmjs.org/",
  "npm install --omit=dev --include=optional --no-audit --no-fund"
]
```

## Deployment Checklist

When deploying to production, ensure:

1. ✅ `better-sqlite3` is installed (now in root package.json)
2. ✅ `SESSION_SECRET` environment variable is set to a cryptographically secure random key (generate with `openssl rand -hex 32`)
3. ✅ `DATABASE_URL` is set for PostgreSQL (or omit for local SQLite)
4. ✅ `GEMINI_API_KEY` is set for AI features
5. ✅ `FRONTEND_ORIGIN` is set to allow CORS from your frontend
6. ✅ Build command runs: `npm run build:server`
7. ✅ Start command runs: `npm start`

### Railway Specific Setup

In Railway dashboard:
1. Go to your service → **Variables** tab
2. Add the following environment variables:
   - `SESSION_SECRET` = (generate with `openssl rand -hex 32`)
   - `DATABASE_URL` = (automatically set by Neon plugin)
   - `GEMINI_API_KEY` = (your Google AI Studio key)
   - `FRONTEND_ORIGIN` = (your Vercel deployment URL)
3. Save and redeploy

## Testing

To test production mode locally:

```bash
# Build the application
npm run build:server

# Generate a secure session secret
SESSION_SECRET=$(openssl rand -hex 32)

# Run in production mode with required environment variables
SESSION_SECRET="$SESSION_SECRET" NODE_ENV=production npm start
```

Or manually set it:

```bash
# Build the application
npm run build:server

# Run in production mode with required environment variables
SESSION_SECRET="your-secret-key-generated-with-openssl" NODE_ENV=production npm start
```

## Notes

- The application will use SQLite (via better-sqlite3) when `DATABASE_URL` is not set
- In production, it's recommended to use PostgreSQL by setting `DATABASE_URL`
- The session secret should be a long, random string (at least 32 characters)
- Never commit the actual `SESSION_SECRET` to version control
