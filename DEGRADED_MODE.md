# Degraded Mode Operation

## Overview

The application implements graceful degradation when the PostgreSQL database is unavailable. Instead of crashing or returning 500 errors, the system automatically falls back to in-memory storage for all data operations.

## How It Works

### Storage Layer Fallback

The storage layer (`server/storage.ts`) implements a dual-mode architecture:

1. **Database Mode** (normal operation):
   - Uses PostgreSQL (or SQLite for local development)
   - Data persists across server restarts
   - Full ACID guarantees

2. **In-Memory Mode** (degraded operation):
   - Uses JavaScript Map objects for data storage
   - Data stored only in RAM
   - Data lost on server restart
   - No database connection required

### Automatic Fallback Triggers

The system enters degraded mode when:
- PostgreSQL database URL is invalid or unreachable
- Database connection fails during initialization
- Database queries fail during runtime (auth fallback)
- SQLite file is inaccessible (local development only)

### Session Store Fallback

The session management also implements graceful degradation:

1. **Production with Database** (preferred):
   - Uses `connect-pg-simple` for PostgreSQL session storage
   - Sessions persist across server restarts
   - Supports horizontal scaling

2. **Degraded Mode** (fallback):
   - Uses MemoryStore (express-session default)
   - Sessions stored in RAM only
   - Sessions lost on server restart
   - Works in single-instance deployments

## Features in Degraded Mode

### ✅ Working Features

All critical API endpoints work normally in degraded mode:

- **Authentication**
  - Login with predefined in-memory users:
    - `admin` / `admin123` (role: admin)
    - `manager1` / `manager123` (role: user)
    - `manager2` / `manager123` (role: user)
  - Session management
  - Role-based access control

- **Managers API** (`/api/managers`)
  - List all managers
  - Get manager by ID
  - Create new manager
  - Update manager
  - Delete manager
  - Seeded with 8 default managers

- **Checklists API** (`/api/checklists`)
  - List all checklists
  - Get checklist by ID
  - Create new checklist
  - Update checklist
  - Delete checklist
  - Seeded with 2 default checklists

- **Advanced Checklists API** (`/api/advanced-checklists`)
  - List all advanced checklists
  - Get advanced checklist by ID
  - Create new advanced checklist
  - Update advanced checklist
  - Delete advanced checklist
  - Seeded with 2 default advanced checklists

- **Analyses API** (`/api/analyses`, `/api/advanced-analyses`)
  - Save analysis reports
  - List all analyses (with user filtering)
  - Get analysis by ID
  - Delete analysis
  - Generate reports (Markdown, PDF)

### ⚠️ Limitations

- **Data Persistence**: All data is lost on server restart
- **Horizontal Scaling**: Cannot share data across multiple server instances
- **User Management**: Cannot create new users (limited to predefined in-memory users)
- **Sessions**: Sessions lost on server restart in degraded mode

## Monitoring Degraded Mode

### Health Check

Check the `/health` endpoint to see current storage mode:

```bash
curl http://localhost:3000/health
```

**Normal Mode Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123.45,
  "storage": "database",
  "degraded": false
}
```

**Degraded Mode Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123.45,
  "storage": "in-memory",
  "degraded": true
}
```

### Server Logs

When entering degraded mode, the server logs clear warnings:

```
[storage] Database connection failed. Operating in DEGRADED MODE with in-memory storage.
[storage] Error: <error details>
[storage] Data will not persist across restarts. Consider fixing database connection.
⚠️  DEGRADED MODE: Database unavailable (<error message>)
⚠️  Using in-memory storage - data will not persist across restarts
⚠️  All critical API endpoints will work but changes are temporary
```

When operating normally:
```
[storage] Database connection successful. Using PostgreSQL/SQLite storage.
✓ Database connection successful - using persistent storage
```

## Production Considerations

### When to Use Degraded Mode

Degraded mode is designed for:
- **Temporary database outages**: Keep the service running during brief database maintenance
- **Emergency fallback**: Maintain critical functionality during database failures
- **Development/testing**: Test application behavior without database

### When NOT to Use Degraded Mode

Degraded mode should NOT be used for:
- **Long-term production operation**: Data will be lost on restart
- **Multi-instance deployments**: Each instance has separate in-memory storage
- **Data that must persist**: Use a working database connection

### Best Practices

1. **Monitor the health endpoint** to detect degraded mode
2. **Set up alerts** when `degraded: true` appears in health checks
3. **Fix database connection** as soon as possible
4. **Restart the server** after fixing database to exit degraded mode
5. **Re-seed data** if operating in degraded mode for extended periods

## Known Issues

### SQLite Schema Compatibility with Drizzle ORM

When using local SQLite database (development mode without `DATABASE_URL`), there are schema compatibility issues between the SQLite table creation SQL and the Drizzle ORM operations:

- **Root Cause**: The application uses a PostgreSQL schema definition (in `shared/schema.ts`) with Drizzle ORM. This schema includes PostgreSQL-specific features like `defaultNow()` which generates `now()` SQL function calls.
- **Issue**: While the SQLite tables are created manually with `CURRENT_TIMESTAMP` (which is SQLite-compatible), when Drizzle ORM tries to insert data using the PostgreSQL schema objects, it generates SQL with `now()` function which SQLite doesn't support.
- **Symptom**: Database seeding fails with "no such function: now" error
- **Impact**: 
  - SQLite database tables are created successfully
  - Initial data seeding fails
  - System automatically continues in degraded mode with in-memory storage
  - Application remains functional with in-memory data
- **Scope**: Only affects local development with SQLite; does not affect production PostgreSQL deployments
- **Workaround**: Application gracefully handles this by:
  1. Catching seeding errors
  2. Logging warnings
  3. Continuing with in-memory storage
  4. All features work normally with in-memory data
- **Proper Fix** (future work): 
  - Option 1: Create SQLite-specific schema definitions
  - Option 2: Use raw SQL for SQLite insert operations
  - Option 3: Disable SQLite mode entirely and use PostgreSQL or in-memory only

This issue is separate from the PostgreSQL unavailability handling implemented in this PR. The degraded mode system works correctly for its intended purpose: gracefully handling PostgreSQL connection failures in production.

## Testing Degraded Mode

### Simulate Database Unavailability

```bash
# Method 1: Use invalid database URL
DATABASE_URL="postgresql://invalid:invalid@localhost:9999/invalid" npm run dev:server

# Method 2: Make database file inaccessible (SQLite only)
chmod 000 local.db
npm run dev:server
chmod 644 local.db  # Cleanup after testing
```

### Verify Degraded Mode Operation

1. Check health endpoint shows `degraded: true`
2. Test authentication with in-memory users
3. Test CRUD operations on managers, checklists, analyses
4. Verify all endpoints return 200/201/204 (not 500)
5. Restart server and verify data is lost (as expected)

## Recovery

To exit degraded mode:

1. Fix the database connection issue
2. Restart the server
3. Verify health endpoint shows `degraded: false`
4. Data will be seeded automatically on startup

## Implementation Details

- **Storage initialization**: `server/storage.ts` - `initializeStorage()`
- **Session store creation**: `server/index.ts` - `createSessionStore()`
- **Authentication fallback**: `server/services/auth.ts` - `authenticateUser()`
- **Health endpoint**: `server/index.ts` - `app.get('/health')`
