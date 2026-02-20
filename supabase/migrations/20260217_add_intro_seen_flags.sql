-- Add intro_seen flags to user_levels
-- Purpose: Track whether the user has seen the pre-level introduction for each story level
-- This prevents the intro modal from showing every time a level is opened.
-- Date: 2026-02-17

ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS intro_seen_level_1 BOOLEAN DEFAULT FALSE;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS intro_seen_level_2 BOOLEAN DEFAULT FALSE;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS intro_seen_level_3 BOOLEAN DEFAULT FALSE;
