# Authentication Fallback Implementation

## Problem
When PostgreSQL database is unavailable (e.g., ECONNREFUSED), the authentication service would fail with a 500 internal server error on login attempts. While the app falls back to in-memory storage for some data, authentication still attempted to connect to the database.

## Solution
Modified the authentication service (`server/services/auth.ts`) to support in-memory user storage when the database is unavailable.

### Changes Made

1. **Added In-Memory User Storage**
   - Created `inMemoryUsers` array with predefined test users:
     - `admin` / `admin123` (role: admin)
     - `manager1` / `manager123` (role: user)
     - `manager2` / `manager123` (role: user)

2. **Modified `authenticateUser` Function**
   - Checks `storageUsesDatabase` flag first
   - If database is unavailable, uses in-memory users directly
   - If database is available, attempts database authentication
   - Falls back to in-memory users if database query fails (try-catch)
   - Returns 200 success instead of 500 error on login

3. **Modified `getUserById` Function**
   - Same fallback logic as `authenticateUser`
   - Checks in-memory users when database is unavailable

4. **Modified `createUser` Function**
   - Throws error in in-memory mode (user creation not supported)
   - Only works when database is available

## Testing

### Test Scenarios
✅ Login with invalid PostgreSQL URL (ECONNREFUSED)
✅ Login with admin user (admin/admin123)
✅ Login with manager1 user (manager1/manager123)
✅ Login with manager2 user (manager2/manager123)
✅ Invalid password rejection
✅ Non-existent user rejection
✅ SQLite fallback when users table doesn't exist

### Test Results
All tests passed successfully. The authentication service:
- Gracefully handles database connection failures
- Falls back to in-memory users without errors
- Returns proper 200 responses on successful login
- Returns proper 401 responses on invalid credentials
- Logs appropriate messages for debugging

## Usage

When the database is unavailable, users can login with the predefined test credentials:
- **Admin**: username: `admin`, password: `admin123`
- **Manager 1**: username: `manager1`, password: `manager123`
- **Manager 2**: username: `manager2`, password: `manager123`

## Security Notes

⚠️ **Note**: The in-memory users use SHA-256 for password hashing, which is suitable for development/testing but should be replaced with bcrypt, scrypt, or argon2 for production use.

⚠️ **Note**: The predefined test users should be changed or disabled in production environments.

## Implementation Details

The fallback mechanism works in two ways:

1. **Proactive Check**: When `storageUsesDatabase` is `false`, the authentication service immediately uses in-memory users without attempting database connection.

2. **Reactive Fallback**: When database connection fails during authentication (e.g., ECONNREFUSED, table not found), the service catches the error and falls back to in-memory users.

This dual approach ensures reliable fallback regardless of when or how the database becomes unavailable.
