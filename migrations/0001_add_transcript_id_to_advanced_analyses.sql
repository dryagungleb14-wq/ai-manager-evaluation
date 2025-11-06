-- Migration: Add transcript_id column to advanced_analyses table
-- Date: 2025-11-06
-- Purpose: Fix schema mismatch after PR #94 merge

-- Add transcript_id column to advanced_analyses if it doesn't exist
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
    ELSE
        RAISE NOTICE 'Column transcript_id already exists in advanced_analyses table';
    END IF;
END $$;
