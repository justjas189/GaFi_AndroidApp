-- Migration: Add user_type column to profiles table
-- Created: 2025-11-11
-- Description: Adds user_type field to track whether user is a student or employee

-- Add user_type column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS user_type VARCHAR(20);

-- Add comment to describe the column
COMMENT ON COLUMN profiles.user_type IS 'User type: student or employee';

-- Create index for faster queries by user type
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);

-- Optional: Add check constraint to ensure only valid values
ALTER TABLE profiles 
ADD CONSTRAINT check_user_type 
CHECK (user_type IS NULL OR user_type IN ('student', 'employee'));
