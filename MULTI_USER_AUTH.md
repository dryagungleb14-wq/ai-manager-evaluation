# Multi-User Authentication Setup

This document describes the multi-user authentication system that has been implemented.

## Overview

The system now supports multiple users with role-based access control:
- **Admin role**: Can view all analyses from all users
- **User role**: Can only view their own analyses

## Database Schema Changes

### New `users` table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,  -- SHA-256 hashed
  role TEXT NOT NULL DEFAULT 'user',  -- 'admin' or 'user'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Updated `analyses` table
- Added `user_id` column (foreign key to users.id)

### Updated `advanced_analyses` table
- Added `user_id` column (foreign key to users.id)

## Default Users (Created on First Run)

The system automatically seeds three users:

1. **Admin Account**
   - Username: `admin`
   - Password: `admin123`
   - Role: admin
   - Can view all analyses

2. **Manager 1**
   - Username: `manager1`
   - Password: `manager123`
   - Role: user
   - Can only view their own analyses

3. **Manager 2**
   - Username: `manager2`
   - Password: `manager123`
   - Role: user
   - Can only view their own analyses

## Authentication Flow

1. Users must log in to access the application
2. Session is stored in secure HTTP-only cookies
3. Session expires after 7 days of inactivity
4. All API endpoints check authentication via session middleware

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout and destroy session
- `GET /api/auth/me` - Get current user info

### Data Isolation
- `GET /api/analyses` - Returns all analyses for admin, only user's own for regular users
- `GET /api/advanced-analyses` - Returns all analyses for admin, only user's own for regular users
- `POST /api/analyze` - Automatically associates analysis with logged-in user
- `POST /api/advanced-checklists/analyze` - Automatically associates analysis with logged-in user

## Features Implemented

### Backend
- ✅ Session management with express-session
- ✅ SHA-256 password hashing (simple MVP, use bcrypt in production)
- ✅ User authentication service
- ✅ Role-based data filtering
- ✅ User context logging for debugging
- ✅ Retry logic with exponential backoff for Gemini API (already present)
- ✅ 60-second timeout for API calls (already present)

### Frontend
- ✅ Login page with username/password fields
- ✅ Protected routes requiring authentication
- ✅ User info dropdown with role indicator
- ✅ Logout functionality
- ✅ Auto-redirect to login if not authenticated
- ✅ Session persistence across page refreshes

## Testing Instructions

### Test User Isolation
1. Login as `manager1` / `manager123`
2. Create some analyses
3. Logout
4. Login as `manager2` / `manager123`
5. Verify you cannot see manager1's analyses
6. Create some analyses
7. Logout
8. Login as `admin` / `admin123`
9. Verify you can see analyses from both managers

### Test Concurrent Usage
1. Open two browser windows (or use incognito)
2. Login as manager1 in window 1
3. Login as manager2 in window 2
4. Create analyses in both windows simultaneously
5. Verify data isolation works correctly

## Logging

The application logs the following for debugging:
- User login/logout events with username and role
- Analysis creation with user ID and checklist name
- Failed login attempts with username

Example log output:
```
[auth] User logged in: manager1 (role: user, id: 2)
[analysis] User manager1 (id: 2) starting analysis with checklist: Продажи B2B — базовый
[analysis] Analysis completed for user manager1, saved with ID: 42
[auth] User logged out: manager1
```

## Deployment Notes

### Database Migration
After deploying, run the database migration:
```bash
npm run db:push
```

This will:
1. Create the `users` table
2. Add `user_id` columns to `analyses` and `advanced_analyses` tables
3. Seed default users

### Environment Variables
Ensure these are set:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption (random string)
- `GEMINI_API_KEY` - API key for Gemini

### Security Notes
- Session cookies are HTTP-only and secure in production
- Passwords are hashed with SHA-256 (MVP - use bcrypt for production)
- No JWT tokens needed for this MVP
- CORS is configured to allow only trusted origins

## Future Enhancements

Potential improvements for production:
1. Use bcrypt or argon2 for password hashing
2. Add password reset functionality
3. Add user management UI for admin
4. Add rate limiting for login attempts
5. Add 2FA support
6. Add JWT tokens for API authentication
7. Add audit log for admin actions
