-- Migration: Add savings-specific columns to user_levels
-- Date: 2025-07-26
-- Purpose: The JS services (GamifiedSavingsService, LeaderboardService) write to columns
--          (total_saved, goals_completed, streak_days, last_save_date) that don't exist
--          in the original schema. This migration adds them alongside the existing game columns.

-- Add savings-tracking columns to user_levels (non-destructive)
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS total_saved DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS goals_completed INTEGER DEFAULT 0;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS streak_days INTEGER DEFAULT 0;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS last_save_date DATE;

-- Create index for leaderboard sorting by total_saved
CREATE INDEX IF NOT EXISTS idx_user_levels_total_saved ON user_levels(total_saved);
