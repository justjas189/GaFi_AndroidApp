-- MoneyTrack Story & Custom Mode Schema Updates
-- Date: 2025-07-XX
-- Purpose: Add tables for Story Mode, Custom Mode, Transport tracking, and Game features

-- =====================================================
-- PHASE 1: CREATE/UPDATE CORE TABLES
-- =====================================================

-- 1.1 Create User Levels Table (Game Progress & XP)
CREATE TABLE IF NOT EXISTS user_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- XP & Level System
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  level_name VARCHAR(50) DEFAULT 'Beginner',
  
  -- Story Mode Progress (3 Levels)
  story_level_1_completed BOOLEAN DEFAULT FALSE,
  story_level_2_completed BOOLEAN DEFAULT FALSE,
  story_level_3_completed BOOLEAN DEFAULT FALSE,
  story_level_1_stars INTEGER DEFAULT 0 CHECK (story_level_1_stars BETWEEN 0 AND 3),
  story_level_2_stars INTEGER DEFAULT 0 CHECK (story_level_2_stars BETWEEN 0 AND 3),
  story_level_3_stars INTEGER DEFAULT 0 CHECK (story_level_3_stars BETWEEN 0 AND 3),
  total_story_stars INTEGER DEFAULT 0,
  
  -- Custom Mode Stats
  custom_mode_completions INTEGER DEFAULT 0,
  custom_mode_passed INTEGER DEFAULT 0,
  
  -- Game Stats
  total_expenses_recorded INTEGER DEFAULT 0,
  total_maps_traveled INTEGER DEFAULT 0,
  total_goals_achieved INTEGER DEFAULT 0,
  achievements_earned INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index for user_levels
CREATE INDEX IF NOT EXISTS idx_user_levels_user ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_xp ON user_levels(total_xp);
CREATE INDEX IF NOT EXISTS idx_user_levels_level ON user_levels(current_level);

-- Enable RLS on user_levels
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_levels
DROP POLICY IF EXISTS "Users can view own level data" ON user_levels;
CREATE POLICY "Users can view own level data" ON user_levels
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own level data" ON user_levels;
CREATE POLICY "Users can insert own level data" ON user_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own level data" ON user_levels;
CREATE POLICY "Users can update own level data" ON user_levels
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow viewing other users for leaderboard (public read for rankings)
DROP POLICY IF EXISTS "Users can view leaderboard data" ON user_levels;
CREATE POLICY "Users can view leaderboard data" ON user_levels
  FOR SELECT USING (true);

-- 1.2 Add character selection to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_character VARCHAR(20) DEFAULT 'girl';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS character_customizations JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN DEFAULT FALSE;

-- 1.3 Add game context to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS location VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recorded_from VARCHAR(20) DEFAULT 'manual';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS game_session_id UUID;

-- =====================================================
-- PHASE 2: CREATE NEW TABLES
-- =====================================================

-- 2.1 Story Mode Sessions - Track weekly story challenges
CREATE TABLE IF NOT EXISTS story_mode_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Level Info
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  level_type VARCHAR(20) NOT NULL CHECK (level_type IN ('budgeting', 'goals', 'saving')),
  level_name VARCHAR(50) NOT NULL,
  
  -- Budget tracking
  weekly_budget DECIMAL(12, 2) NOT NULL,
  weekly_spending DECIMAL(12, 2) DEFAULT 0,
  
  -- Level 1 (Budgeting) - 50/30/20 tracking
  needs_budget DECIMAL(12, 2),
  needs_spent DECIMAL(12, 2) DEFAULT 0,
  wants_budget DECIMAL(12, 2),
  wants_spent DECIMAL(12, 2) DEFAULT 0,
  savings_budget DECIMAL(12, 2),
  savings_amount DECIMAL(12, 2) DEFAULT 0,
  
  -- Level 2 (Goals) - Goals tracking
  goals_data JSONB, -- [{id, name, target, allocated}]
  total_allocated DECIMAL(12, 2) DEFAULT 0,
  
  -- Level 3 (Saving) - Savings percentage
  savings_goal_percent DECIMAL(5, 2),
  actual_savings_percent DECIMAL(5, 2),
  
  -- Category spending breakdown
  category_spending JSONB DEFAULT '{}',
  
  -- Session timeline
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Status & Results
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned')),
  passed BOOLEAN,
  stars_earned INTEGER DEFAULT 0 CHECK (stars_earned BETWEEN 0 AND 3),
  results_data JSONB,
  xp_earned INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Custom Mode Sessions - Track user-defined challenges
CREATE TABLE IF NOT EXISTS custom_mode_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Mode type matches story levels
  mode_type VARCHAR(20) NOT NULL CHECK (mode_type IN ('budgeting', 'goals', 'saving')),
  
  -- Custom rules (user-defined thresholds)
  custom_rules JSONB NOT NULL, -- {needs: 50, wants: 30, savings: 20} or custom values
  
  -- Budget tracking
  weekly_budget DECIMAL(12, 2) NOT NULL,
  weekly_spending DECIMAL(12, 2) DEFAULT 0,
  
  -- Spending breakdown
  needs_spent DECIMAL(12, 2) DEFAULT 0,
  wants_spent DECIMAL(12, 2) DEFAULT 0,
  savings_amount DECIMAL(12, 2) DEFAULT 0,
  category_spending JSONB DEFAULT '{}',
  
  -- For goals mode
  custom_goals JSONB, -- [{name, target}]
  goals_progress JSONB, -- [{name, allocated}]
  
  -- For saving mode
  custom_savings_target DECIMAL(5, 2),
  
  -- Session timeline
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Status & Results
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'abandoned')),
  passed BOOLEAN,
  results_data JSONB,
  xp_earned INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 Transport Expenses - Track travel costs
CREATE TABLE IF NOT EXISTS transport_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  session_id UUID, -- Links to story/custom session if applicable
  
  -- Transport details
  transport_mode VARCHAR(20) NOT NULL CHECK (transport_mode IN ('commute', 'car', 'walk')),
  origin_map VARCHAR(20) NOT NULL,
  destination_map VARCHAR(20) NOT NULL,
  
  -- Costs
  fare_amount DECIMAL(12, 2), -- For commute (jeepney, tricycle, etc.)
  fuel_amount DECIMAL(12, 2), -- For car
  
  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.4 Character Customizations - Store unlocked characters
CREATE TABLE IF NOT EXISTS character_customizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Selected character
  selected_character VARCHAR(20) DEFAULT 'girl' CHECK (selected_character IN ('girl', 'jasper')),
  
  -- Unlocked items
  unlocked_characters TEXT[] DEFAULT ARRAY['girl', 'jasper'],
  unlocked_outfits TEXT[] DEFAULT ARRAY[]::TEXT[],
  unlocked_accessories TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Equipped items
  equipped_outfit VARCHAR(50),
  equipped_accessories TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Customization data (future use)
  customization_data JSONB DEFAULT '{}',
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2.5 Game Activity Log - Track all game activities
CREATE TABLE IF NOT EXISTS game_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID, -- Reference to story/custom session
  
  -- Activity details
  activity_type VARCHAR(50) NOT NULL,
  -- Types: 'expense_recorded', 'map_travel', 'goal_allocation', 'closet_visit', 
  --        'level_start', 'level_complete', 'tutorial_step', 'achievement_earned'
  
  -- Location context
  map_id VARCHAR(20),
  location_id VARCHAR(50),
  
  -- Activity data
  details JSONB,
  amount DECIMAL(12, 2), -- If applicable
  xp_earned INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.6 Tutorial Progress - Track tutorial completion
CREATE TABLE IF NOT EXISTS tutorial_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  tutorial_completed BOOLEAN DEFAULT FALSE,
  current_step INTEGER DEFAULT 0,
  steps_completed TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =====================================================
-- PHASE 3: CREATE INDEXES
-- =====================================================

-- Story Mode Sessions indexes
CREATE INDEX IF NOT EXISTS idx_story_sessions_user ON story_mode_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_story_sessions_level ON story_mode_sessions(level);
CREATE INDEX IF NOT EXISTS idx_story_sessions_status ON story_mode_sessions(status);
CREATE INDEX IF NOT EXISTS idx_story_sessions_dates ON story_mode_sessions(start_date, end_date);

-- Custom Mode Sessions indexes
CREATE INDEX IF NOT EXISTS idx_custom_sessions_user ON custom_mode_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_sessions_type ON custom_mode_sessions(mode_type);
CREATE INDEX IF NOT EXISTS idx_custom_sessions_status ON custom_mode_sessions(status);

-- Transport Expenses indexes
CREATE INDEX IF NOT EXISTS idx_transport_user ON transport_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_transport_mode ON transport_expenses(transport_mode);
CREATE INDEX IF NOT EXISTS idx_transport_session ON transport_expenses(session_id);

-- Character Customizations indexes
CREATE INDEX IF NOT EXISTS idx_character_user ON character_customizations(user_id);

-- Game Activity Log indexes
CREATE INDEX IF NOT EXISTS idx_activity_user ON game_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON game_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_session ON game_activity_log(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON game_activity_log(created_at);

-- Tutorial Progress indexes
CREATE INDEX IF NOT EXISTS idx_tutorial_user ON tutorial_progress(user_id);

-- Expenses new column indexes
CREATE INDEX IF NOT EXISTS idx_expenses_location ON expenses(location);
CREATE INDEX IF NOT EXISTS idx_expenses_recorded_from ON expenses(recorded_from);
CREATE INDEX IF NOT EXISTS idx_expenses_session ON expenses(game_session_id);

-- =====================================================
-- PHASE 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE story_mode_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_mode_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorial_progress ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PHASE 5: CREATE RLS POLICIES
-- =====================================================

-- Story Mode Sessions policies
CREATE POLICY "Users can view own story sessions" ON story_mode_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own story sessions" ON story_mode_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own story sessions" ON story_mode_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own story sessions" ON story_mode_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Custom Mode Sessions policies
CREATE POLICY "Users can view own custom sessions" ON custom_mode_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own custom sessions" ON custom_mode_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom sessions" ON custom_mode_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom sessions" ON custom_mode_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Transport Expenses policies
CREATE POLICY "Users can view own transport expenses" ON transport_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transport expenses" ON transport_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transport expenses" ON transport_expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transport expenses" ON transport_expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Character Customizations policies
CREATE POLICY "Users can view own character customizations" ON character_customizations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own character customizations" ON character_customizations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own character customizations" ON character_customizations
  FOR UPDATE USING (auth.uid() = user_id);

-- Game Activity Log policies
CREATE POLICY "Users can view own activity log" ON game_activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity log" ON game_activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tutorial Progress policies
CREATE POLICY "Users can view own tutorial progress" ON tutorial_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tutorial progress" ON tutorial_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tutorial progress" ON tutorial_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- PHASE 6: CREATE UTILITY FUNCTIONS
-- =====================================================

-- Function to update story session spending
CREATE OR REPLACE FUNCTION update_story_session_spending()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the session's spending totals when an expense is added
  IF NEW.game_session_id IS NOT NULL THEN
    UPDATE story_mode_sessions
    SET 
      weekly_spending = weekly_spending + NEW.amount,
      category_spending = COALESCE(category_spending, '{}'::jsonb) || 
        jsonb_build_object(NEW.category, 
          COALESCE((category_spending->NEW.category)::numeric, 0) + NEW.amount),
      updated_at = NOW()
    WHERE id = NEW.game_session_id;
    
    -- Also update custom sessions
    UPDATE custom_mode_sessions
    SET 
      weekly_spending = weekly_spending + NEW.amount,
      category_spending = COALESCE(category_spending, '{}'::jsonb) || 
        jsonb_build_object(NEW.category, 
          COALESCE((category_spending->NEW.category)::numeric, 0) + NEW.amount),
      updated_at = NOW()
    WHERE id = NEW.game_session_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update user_levels with story completion
CREATE OR REPLACE FUNCTION update_story_level_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.passed = TRUE THEN
    -- Update the user's level completion status
    UPDATE user_levels
    SET 
      story_level_1_completed = CASE WHEN NEW.level = 1 THEN TRUE ELSE story_level_1_completed END,
      story_level_2_completed = CASE WHEN NEW.level = 2 THEN TRUE ELSE story_level_2_completed END,
      story_level_3_completed = CASE WHEN NEW.level = 3 THEN TRUE ELSE story_level_3_completed END,
      story_level_1_stars = CASE WHEN NEW.level = 1 AND NEW.stars_earned > story_level_1_stars THEN NEW.stars_earned ELSE story_level_1_stars END,
      story_level_2_stars = CASE WHEN NEW.level = 2 AND NEW.stars_earned > story_level_2_stars THEN NEW.stars_earned ELSE story_level_2_stars END,
      story_level_3_stars = CASE WHEN NEW.level = 3 AND NEW.stars_earned > story_level_3_stars THEN NEW.stars_earned ELSE story_level_3_stars END,
      total_story_stars = story_level_1_stars + story_level_2_stars + story_level_3_stars,
      total_xp = total_xp + NEW.xp_earned,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    -- Create user_levels record if it doesn't exist
    INSERT INTO user_levels (user_id, current_level, total_xp)
    VALUES (NEW.user_id, 1, NEW.xp_earned)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update custom mode completions
CREATE OR REPLACE FUNCTION update_custom_mode_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.passed = TRUE THEN
    UPDATE user_levels
    SET 
      custom_mode_completions = custom_mode_completions + 1,
      total_xp = total_xp + NEW.xp_earned,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    INSERT INTO user_levels (user_id, current_level, total_xp, custom_mode_completions)
    VALUES (NEW.user_id, 1, NEW.xp_earned, 1)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 7: CREATE TRIGGERS
-- =====================================================

-- Trigger for expense -> session spending updates
DROP TRIGGER IF EXISTS trigger_update_session_spending ON expenses;
CREATE TRIGGER trigger_update_session_spending
  AFTER INSERT ON expenses
  FOR EACH ROW
  WHEN (NEW.game_session_id IS NOT NULL)
  EXECUTE FUNCTION update_story_session_spending();

-- Trigger for story mode completion
DROP TRIGGER IF EXISTS trigger_story_level_complete ON story_mode_sessions;
CREATE TRIGGER trigger_story_level_complete
  AFTER UPDATE ON story_mode_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status = 'in_progress')
  EXECUTE FUNCTION update_story_level_completion();

-- Trigger for custom mode completion
DROP TRIGGER IF EXISTS trigger_custom_mode_complete ON custom_mode_sessions;
CREATE TRIGGER trigger_custom_mode_complete
  AFTER UPDATE ON custom_mode_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status = 'in_progress')
  EXECUTE FUNCTION update_custom_mode_completion();

-- Updated_at triggers
CREATE TRIGGER update_story_sessions_updated_at
  BEFORE UPDATE ON story_mode_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_sessions_updated_at
  BEFORE UPDATE ON custom_mode_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tutorial_progress_updated_at
  BEFORE UPDATE ON tutorial_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PHASE 8: CREATE ACHIEVEMENT_DEFINITIONS TABLE (if not exists)
-- =====================================================

-- Create Achievement Definitions Table (in case it doesn't exist)
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(50),
  xp_reward INTEGER DEFAULT 0,
  condition_type VARCHAR(50) NOT NULL,
  condition_value INTEGER,
  condition_data JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on achievement_definitions
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view achievement definitions (public read)
DROP POLICY IF EXISTS "Anyone can view achievement definitions" ON achievement_definitions;
CREATE POLICY "Anyone can view achievement definitions" ON achievement_definitions
  FOR SELECT USING (true);

-- Create index for achievement lookups
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_type ON achievement_definitions(condition_type);
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_active ON achievement_definitions(is_active);

-- =====================================================
-- PHASE 9: ADD NEW ACHIEVEMENT DEFINITIONS
-- =====================================================

INSERT INTO achievement_definitions (name, description, icon, xp_reward, condition_type, condition_value, condition_data) VALUES
  ('Budget Basics Graduate', 'Completed Story Mode Level 1', 'school', 100, 'story_level_complete', 1, '{"level": 1}'::jsonb),
  ('Goal Getter', 'Completed Story Mode Level 2', 'target', 150, 'story_level_complete', 2, '{"level": 2}'::jsonb),
  ('Super Saver Champion', 'Completed Story Mode Level 3', 'crown', 200, 'story_level_complete', 3, '{"level": 3}'::jsonb),
  ('Story Master', 'Completed all 3 Story Mode levels', 'star', 500, 'all_story_levels', 3, NULL),
  ('Custom Creator', 'Completed 5 Custom Mode challenges', 'settings', 100, 'custom_mode_count', 5, NULL),
  ('Road Warrior', 'Recorded 20 transport expenses', 'car', 50, 'transport_expense_count', 20, NULL),
  ('Campus Explorer', 'Visited all map locations', 'map', 30, 'locations_visited', 9, NULL),
  ('Budget Master 50/30/20', 'Perfectly followed the 50/30/20 rule for a week', 'chart-pie', 75, 'perfect_budget', 1, '{"needs": 50, "wants": 30, "savings": 20}'::jsonb),
  ('Three Star General', 'Earned 3 stars on any Story level', 'stars', 100, 'three_stars', 1, NULL),
  ('Nine Star Legend', 'Earned 3 stars on all Story levels', 'trophy', 300, 'nine_stars', 9, NULL)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SUCCESS! Schema updated for Story & Custom Mode
-- =====================================================

-- Summary of changes:
-- ✅ Added story level progress columns to user_levels
-- ✅ Added character selection columns to profiles
-- ✅ Added game context columns to expenses
-- ✅ Created story_mode_sessions table
-- ✅ Created custom_mode_sessions table
-- ✅ Created transport_expenses table
-- ✅ Created character_customizations table
-- ✅ Created game_activity_log table
-- ✅ Created tutorial_progress table
-- ✅ Added new achievement definitions for Story/Custom modes
-- ✅ Created triggers for automatic progress tracking

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
