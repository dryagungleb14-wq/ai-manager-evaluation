-- Migration: Update transcripts table structure
-- Date: 2025-11-07
-- Purpose: Add missing fields to match requirements

-- Add updated_at column if it doesn't exist
ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add filename column if it doesn't exist (keeping audio_file_name for backward compatibility)
ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS filename TEXT;

-- Update existing records: copy audio_file_name to filename where filename is null
UPDATE transcripts
  SET filename = audio_file_name
  WHERE filename IS NULL AND audio_file_name IS NOT NULL;

-- Create trigger to automatically update updated_at timestamp on row updates
CREATE OR REPLACE FUNCTION update_transcripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transcripts_updated_at_trigger ON transcripts;
CREATE TRIGGER transcripts_updated_at_trigger
  BEFORE UPDATE ON transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_transcripts_updated_at();
