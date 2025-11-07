# Database Migration: Add transcript_id to advanced_analyses

## Overview
This migration adds the `transcript_id` column to the `advanced_analyses` table to support linking analyses with their source transcripts.

## Problem
After PR #94 was merged, the code was updated to insert `transcript_id` values into the `advanced_analyses` table, but existing production databases didn't have this column. This caused the error:
```
column "transcript_id" of relation "advanced_analyses" does not exist
```

## Solution
The migration is implemented in `server/db.ts` and runs automatically on server startup:

### For PostgreSQL (Production)
The migration checks if the `transcript_id` column exists and adds it if missing:
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'advanced_analyses'
        AND column_name = 'transcript_id'
    ) THEN
        ALTER TABLE advanced_analyses
        ADD COLUMN transcript_id INTEGER REFERENCES transcripts(id);
        
        RAISE NOTICE 'Column transcript_id added to advanced_analyses table';
    END IF;
END $$;
```

### For SQLite (Development)
The migration uses SQLite's PRAGMA to check for the column and adds it if missing:
```javascript
const tableInfo = sqlite.pragma("table_info(advanced_analyses)");
const hasTranscriptId = tableInfo.some((col) => col.name === 'transcript_id');

if (!hasTranscriptId) {
  sqlite.exec(`
    ALTER TABLE advanced_analyses ADD COLUMN transcript_id INTEGER REFERENCES transcripts(id);
  `);
}
```

## Migration Execution
The migration runs automatically during server startup:
1. Tables are created if they don't exist (with `transcript_id` included)
2. Migration logic checks for missing columns
3. Missing columns are added

This approach is:
- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Only adds missing columns, never removes data
- **Automatic**: No manual intervention required

## Verification
After deployment, verify the migration succeeded by checking the database schema:

### PostgreSQL
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'advanced_analyses';
```

### SQLite
```sql
PRAGMA table_info(advanced_analyses);
```

Both should show the `transcript_id` column of type INTEGER with a foreign key reference to `transcripts(id)`.

## Rollback
If needed, the column can be removed with:

### PostgreSQL
```sql
ALTER TABLE advanced_analyses DROP COLUMN transcript_id;
```

### SQLite
```sql
-- SQLite doesn't support DROP COLUMN directly, would need table recreation
-- This is not recommended as it would break the application
```

## Related Files
- `server/db.ts` - Contains the migration logic
- `shared/schema.ts` - Defines the schema with `transcript_id`
- `server/storage.ts` - Uses `transcript_id` in `saveAdvancedAnalysis()`
- `migrations/0001_add_transcript_id_to_advanced_analyses.sql` - Standalone migration SQL (for manual execution if needed)
