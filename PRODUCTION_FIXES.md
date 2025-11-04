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
  "better-sqlite3": "^11.0.0",
  ...
}
```

### 2. SESSION_SECRET must be set in production

**Problem:** The application requires a `SESSION_SECRET` environment variable for secure session management in production, but it was not documented.

**Error Message:**
```
Error: SESSION_SECRET must be set in production
```

**Solution:** Added `SESSION_SECRET` to `server/.env.example` to document this required environment variable:
```env
SESSION_SECRET=your-secret-session-key-min-32-chars
```

**Important:** In production deployment (Railway, Heroku, etc.), you must set this environment variable to a secure random string of at least 32 characters.

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
2. ✅ `SESSION_SECRET` environment variable is set
3. ✅ `DATABASE_URL` is set for PostgreSQL (or omit for local SQLite)
4. ✅ `GEMINI_API_KEY` is set for AI features
5. ✅ Build command runs: `npm run build:server`
6. ✅ Start command runs: `npm start`

## Testing

To test production mode locally:

```bash
# Build the application
npm run build

# Run in production mode with required environment variables
SESSION_SECRET="your-secret-key-min-32-chars" NODE_ENV=production npm start
```

## Notes

- The application will use SQLite (via better-sqlite3) when `DATABASE_URL` is not set
- In production, it's recommended to use PostgreSQL by setting `DATABASE_URL`
- The session secret should be a long, random string (at least 32 characters)
- Never commit the actual `SESSION_SECRET` to version control
