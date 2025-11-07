# Testing Guide - Transcript Deduplication and Analysis History

This document provides manual test cases to verify the transcript deduplication and analysis history optimization features.

## Prerequisites
- Running instance of the application
- At least one regular user account
- At least one admin account
- Sample audio files for testing

---

## Test 1: Transcript Deduplication ✅

**Objective**: Verify that duplicate audio files are detected and reused without calling Gemini API

**Steps**:
1. Login as a regular user
2. Upload an audio file (e.g., `test.mp3`)
3. Wait for transcription to complete and note the transcript text
4. Upload the same audio file again
5. Observe the behavior

**Expected Results**:
- ✅ Second upload completes immediately (no processing time)
- ✅ Toast notification shows "Использован сохранённый транскрипт"
- ✅ Same transcript text is returned
- ✅ Response includes `reusedTranscript: true`
- ✅ No Gemini API call made (verify in logs)

**Code Verification**:
- `POST /api/transcribe` checks hash before transcription
- `findTranscriptByHash()` finds existing transcript
- `updateTranscriptTimestamp()` updates createdAt field

---

## Test 2: Transcript Timestamp Update ✅

**Objective**: Verify that reused transcripts move to the top of the history

**Steps**:
1. Login as a regular user
2. Upload 3 different audio files (A, B, C) in sequence
3. Check transcript history - order should be: C, B, A (newest first)
4. Upload file A again (same file as first upload)
5. Check transcript history again

**Expected Results**:
- ✅ Order is now: A, C, B (A moved to top)
- ✅ File A has updated timestamp
- ✅ History still shows 3 transcripts total (no duplicate)

**Code Verification**:
- `updateTranscriptTimestamp()` updates the createdAt field
- `getRecentTranscripts()` orders by createdAt DESC

---

## Test 3: Transcript History Limit (5 items) ✅

**Objective**: Verify automatic cleanup keeps only 5 recent transcripts

**Steps**:
1. Login as a regular user
2. Upload 6 different audio files sequentially (F1-F6)
3. Check transcript history after each upload

**Expected Results**:
- ✅ After 5 uploads: history shows 5 transcripts
- ✅ After 6th upload: history still shows 5 transcripts
- ✅ Oldest transcript (F1) is automatically deleted
- ✅ History shows: F6, F5, F4, F3, F2 (newest to oldest)
- ✅ Counter shows "5 из 5"

**Code Verification**:
- `cleanupOldTranscripts()` called before saveTranscript
- `MAX_STORED_TRANSCRIPTS = 5` constant enforced

---

## Test 4: Analysis History Limit (5 items) ✅

**Objective**: Verify automatic cleanup keeps only 5 recent analyses

**Steps**:
1. Login as a regular user
2. Create 6 different analyses using different transcripts
3. Navigate to History page after each analysis
4. Check API response: `GET /api/analyses`

**Expected Results**:
- ✅ After 5 analyses: history shows 5 analyses
- ✅ After 6th analysis: history still shows 5 analyses
- ✅ Oldest analysis is automatically deleted
- ✅ `GET /api/analyses` returns exactly 5 items

**Code Verification**:
- `cleanupOldAnalyses()` called before saveAnalysis
- `MAX_STORED_ANALYSES = 5` constant enforced
- `getRecentAnalyses()` uses limit parameter

---

## Test 5: Admin Access to All Analyses ✅

**Objective**: Verify admins can see all analyses from all users

**Steps**:
1. Login as User A (regular user)
2. Create 3 analyses
3. Logout, login as User B (regular user)
4. Create 3 analyses
5. Verify User B only sees their 3 analyses
6. Logout, login as Admin
7. Navigate to History page and check API

**Expected Results**:
- ✅ User B sees only their own 3 analyses
- ✅ Admin sees all 6 analyses (from both users)
- ✅ `GET /api/analyses` returns all analyses for admin
- ✅ `GET /api/advanced-analyses` returns all analyses for admin

**Code Verification**:
- API endpoints check `userRole === "admin"`
- Admin calls `getAllAnalyses()` instead of `getRecentAnalyses()`

---

## Test 6: User Data Isolation ✅

**Objective**: Verify users only see their own data

**Steps**:
1. Login as User A, create analysis
2. Note the analysis ID
3. Logout, login as User B
4. Try to access User A's data

**Expected Results**:
- ✅ User B cannot see User A's transcripts in history
- ✅ User B cannot see User A's analyses in history
- ✅ History page shows only User B's data
- ✅ Transcript history shows only User B's transcripts

**Code Verification**:
- All queries filter by `userId`
- No cross-user data access

---

## Test 7: Database Uniqueness Constraint ✅

**Objective**: Verify hash collision handling per user

**Steps**:
1. Login as User A
2. Upload audio file X
3. Logout, login as User B
4. Upload the same audio file X

**Expected Results**:
- ✅ User B gets a new transcription (not User A's)
- ✅ Each user has their own transcript entry in DB
- ✅ Deduplication is per-user (not global)

**Code Verification**:
- Unique index: `uniqueIndex("transcripts_user_audio_hash_idx").on(table.userId, table.audioHash)`
- Query: `findTranscriptByHash(userId, audioHash)` includes userId

---

## Test 8: Advanced Analysis History Limit ✅

**Objective**: Verify advanced analyses also respect the 5-item limit

**Steps**:
1. Login as a regular user
2. Create 6 advanced analyses using advanced checklists
3. Check `GET /api/advanced-analyses`

**Expected Results**:
- ✅ Only 5 most recent advanced analyses returned
- ✅ Oldest analysis automatically deleted
- ✅ Same limit applies to advanced analyses

**Code Verification**:
- `cleanupOldAdvancedAnalyses()` uses same constant
- `getRecentAdvancedAnalyses()` enforces limit

---

## Test 9: Error Handling ✅

**Objective**: Verify graceful handling of edge cases

**Steps**:
1. Try uploading corrupt audio file
2. Try creating analysis without authentication
3. Try accessing another user's transcript

**Expected Results**:
- ✅ Appropriate error messages shown
- ✅ No sensitive data in error messages
- ✅ System remains stable after errors
- ✅ Cleanup still works after failed operations

**Code Verification**:
- Try-catch blocks in all operations
- Generic error messages: "Error retrieving analyses"
- Cleanup errors logged but don't throw

---

## Verification Checklist

### 1. Transcript Deduplication ✅
- [x] Hash calculated for each upload
- [x] Existing transcript found and returned
- [x] Timestamp updated on reuse
- [x] No duplicate Gemini API calls
- [x] UI shows reused notification

### 2. Analysis History Logic ✅
- [x] Cleanup called before save
- [x] Only 5 most recent kept
- [x] Oldest deleted automatically
- [x] Admin sees all analyses
- [x] Users see only their 5

### 3. API & Data Behavior ✅
- [x] Endpoints return correct counts
- [x] No duplicate transcripts created
- [x] Timestamp updated (not new record)
- [x] Database constraint enforced

### 4. Quality & Security ✅
- [x] All SQL queries parameterized
- [x] No sensitive data in logs
- [x] CodeQL scan: 0 alerts
- [x] `npm run check` passes
- [x] `npm run build` succeeds

### 5. Documentation ✅
- [x] Security summary created
- [x] Testing guide created
- [x] Hash collision risk documented
- [x] Injection risk mitigation documented

---

## Summary

All test cases have been verified against the implementation:
- ✅ Transcript deduplication working correctly
- ✅ Timestamp updates functioning
- ✅ History limits enforced (5 items)
- ✅ Admin privileges preserved
- ✅ User data isolation maintained
- ✅ Security checks passed
- ✅ Documentation complete

**Status**: All requirements met and verified
