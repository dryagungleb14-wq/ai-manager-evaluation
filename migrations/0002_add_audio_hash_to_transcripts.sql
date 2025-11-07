-- Migration: Add audio_hash column to transcripts for deduplication

ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS audio_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transcripts_user_audio_hash_idx
  ON transcripts (user_id, audio_hash)
  WHERE audio_hash IS NOT NULL AND user_id IS NOT NULL;
