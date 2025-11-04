# SESSION_SECRET Setup Guide

## Overview

The `SESSION_SECRET` environment variable is **required** for running this application in production mode. Without it, the application will crash on startup with the error:

```
Error: SESSION_SECRET must be set in production
```

## Why is SESSION_SECRET needed?

`SESSION_SECRET` is a cryptographic key used to sign and encrypt user session cookies. It ensures that:
- Session data cannot be tampered with by malicious users
- Session cookies are securely encrypted
- User authentication remains secure

## How to generate SESSION_SECRET

Use OpenSSL to generate a cryptographically secure random key of at least 32 characters:

```bash
openssl rand -hex 32
```

Example output:
```
b30523c92d5413e17a6bf4e27540adcb28a4fd7c1368c7c4b665d883b492b743
```

## Setup Instructions

### Local Development

1. Copy the example environment file:
   ```bash
   cp server/.env.example server/.env
   ```

2. Generate a SESSION_SECRET:
   ```bash
   openssl rand -hex 32
   ```

3. Edit `server/.env` and replace the placeholder:
   ```env
   SESSION_SECRET=<paste-your-generated-key-here>
   ```

**Note:** The `server/.env` file is in `.gitignore` and will not be committed to version control.

### Production Deployment (Railway)

1. Go to your Railway project dashboard
2. Select your service
3. Navigate to the **Variables** tab
4. Click **New Variable**
5. Add:
   - **Name:** `SESSION_SECRET`
   - **Value:** (paste the output from `openssl rand -hex 32`)
6. Click **Add** and then **Deploy**

### Production Deployment (Other Platforms)

For Heroku, Vercel, or other cloud platforms:

1. Generate the secret:
   ```bash
   openssl rand -hex 32
   ```

2. Set the environment variable in your platform's dashboard or CLI:

   **Heroku:**
   ```bash
   heroku config:set SESSION_SECRET=<your-generated-secret>
   ```

   **Vercel (serverless functions):**
   ```bash
   vercel env add SESSION_SECRET
   ```

   **Docker:**
   ```bash
   docker run -e SESSION_SECRET=<your-generated-secret> ...
   ```

## Security Best Practices

✅ **DO:**
- Generate a unique SESSION_SECRET for each environment (development, staging, production)
- Use at least 32 characters (64 recommended)
- Store SESSION_SECRET securely in your deployment platform's secrets manager
- Rotate SESSION_SECRET periodically (note: this will invalidate all existing sessions)

❌ **DON'T:**
- Use weak or predictable values (like "my-secret-key")
- Commit SESSION_SECRET to version control
- Share SESSION_SECRET publicly or in documentation
- Reuse SESSION_SECRET across different applications

## Testing

To test that SESSION_SECRET is working correctly:

### Development Mode (SESSION_SECRET optional)
```bash
npm run dev:server
```

### Production Mode (SESSION_SECRET required)
```bash
# Build the server
npm run build:server

# Start with SESSION_SECRET
SESSION_SECRET=$(openssl rand -hex 32) NODE_ENV=production npm start
```

If SESSION_SECRET is not set in production, you'll see:
```
Error: SESSION_SECRET must be set in production
```

## Troubleshooting

### Error: "SESSION_SECRET must be set in production"

**Cause:** The SESSION_SECRET environment variable is not set or is empty in production mode.

**Solution:**
1. Verify the environment variable is set:
   ```bash
   echo $SESSION_SECRET
   ```
2. If empty, set it in your deployment platform's environment variables
3. Redeploy the application

### Sessions not persisting between deployments

**Cause:** SESSION_SECRET changes between deployments.

**Solution:**
- Ensure SESSION_SECRET is set as a persistent environment variable in your deployment platform
- Don't generate SESSION_SECRET dynamically on each deployment

### Multiple server instances with different secrets

**Cause:** Each server instance has a different SESSION_SECRET.

**Solution:**
- Use the same SESSION_SECRET across all instances of the same environment
- Store SESSION_SECRET in a centralized secrets manager
- Use your platform's environment variable feature (Railway, Heroku, etc.)

## Files Modified

This fix includes updates to the following files:
- `server/.env.example` - Added SESSION_SECRET with documentation
- `ci.env.example` - Added SESSION_SECRET for CI/CD
- `README.md` - Documented SESSION_SECRET in quick start
- `README_BACKEND_DEPLOY.md` - Added to required variables table
- `PRODUCTION_FIXES.md` - Comprehensive setup instructions
- `.gitignore` - Explicitly excludes server/.env

## References

- [Express Session Documentation](https://github.com/expressjs/session#secret)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OpenSSL Documentation](https://www.openssl.org/docs/)
