-- Fix Missing Foreign Key Relationship
-- This adds the missing foreign key constraint between user_levels and profiles

-- First, ensure user_levels table exists and has proper structure
CREATE TABLE IF NOT EXISTS user_levels (
  user_id UUID NOT NULL,
  current_level INTEGER DEFAULT 1,
  total_saved DECIMAL(10,2) DEFAULT 0,
  goals_completed INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  last_save_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_levels_user_id_fkey' 
    AND table_name = 'user_levels'
  ) THEN
    ALTER TABLE user_levels 
    ADD CONSTRAINT user_levels_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add primary key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_levels_pkey' 
    AND table_name = 'user_levels'
  ) THEN
    ALTER TABLE user_levels ADD CONSTRAINT user_levels_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

-- Enable RLS (Row Level Security)
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own level data" ON user_levels;
CREATE POLICY "Users can view their own level data" ON user_levels
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own level data" ON user_levels;
CREATE POLICY "Users can update their own level data" ON user_levels
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own level data" ON user_levels;
CREATE POLICY "Users can insert their own level data" ON user_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow public read access for leaderboard functionality
DROP POLICY IF EXISTS "Public read access for leaderboard" ON user_levels;
CREATE POLICY "Public read access for leaderboard" ON user_levels
  FOR SELECT USING (true);

-- Create function to automatically create user_level record when user signs up
CREATE OR REPLACE FUNCTION create_user_level()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_levels (user_id, current_level, total_saved, goals_completed, streak_days)
  VALUES (NEW.id, 1, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user_level record
DROP TRIGGER IF EXISTS create_user_level_trigger ON auth.users;
CREATE TRIGGER create_user_level_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_level();

-- Ensure current users have user_level records
INSERT INTO user_levels (user_id, current_level, total_saved, goals_completed, streak_days)
SELECT id, 1, 0, 0, 0 
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM user_levels)
ON CONFLICT (user_id) DO NOTHING;
