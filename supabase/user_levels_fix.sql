-- ==========================================
-- USER_LEVELS TABLE FIX
-- Fix the table mismatch issue where app reads from user_levels 
-- but add_savings_progress function updates leaderboards table
-- ==========================================

-- ==========================================
-- PART 1: Create the user_levels table
-- ==========================================

-- Create user_levels table that the app expects to read from
CREATE TABLE IF NOT EXISTS user_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    current_level INTEGER NOT NULL DEFAULT 1,
    total_saved DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    goals_completed INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_save_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_levels_user_id ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_level ON user_levels(current_level);
CREATE INDEX IF NOT EXISTS idx_user_levels_total_saved ON user_levels(total_saved);

-- Set up RLS for user_levels
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own levels"
    ON user_levels FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own levels"
    ON user_levels FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own levels"
    ON user_levels FOR UPDATE
    USING (auth.uid() = user_id);

-- Allow the add_savings_progress function to manage user levels
CREATE POLICY "Service can manage user levels"
    ON user_levels FOR ALL
    USING (auth.role() = 'service_role');

-- ==========================================
-- PART 2: Update the add_savings_progress function
-- ==========================================

-- Replace the existing function to update user_levels instead of leaderboards
CREATE OR REPLACE FUNCTION add_savings_progress(
    p_user_id UUID,
    p_amount DECIMAL(15,2),
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_active_goal RECORD;
    v_new_amount DECIMAL(15,2);
    v_goal_completed BOOLEAN := false;
    v_transaction_id UUID;
    v_level_config RECORD;
    v_goal_id UUID;
    v_current_user_level RECORD;
    v_new_level INTEGER;
    v_new_streak INTEGER;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Find active goal
    SELECT * INTO v_active_goal
    FROM gamified_savings_goals
    WHERE user_id = p_user_id AND is_active = true AND is_completed = false
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no active goal found, create one automatically
    IF v_active_goal.id IS NULL THEN
        -- Get level 1 configuration
        SELECT * INTO v_level_config
        FROM savings_level_configs
        WHERE level = 1
        LIMIT 1;
        
        -- If no level configs exist, create default level 1
        IF v_level_config.level IS NULL THEN
            INSERT INTO savings_level_configs (level, title, description, target_amount, max_days, icon, color)
            VALUES (1, 'Starter Saver', 'Your first savings challenge! Start small and build the habit.', 500.00, 30, 'leaf-outline', '#4CAF50')
            RETURNING * INTO v_level_config;
        END IF;
        
        -- Create a new goal for level 1
        INSERT INTO gamified_savings_goals (
            user_id,
            goal_name,
            target_amount,
            current_amount,
            level,
            start_date,
            end_date,
            is_active,
            is_completed
        ) VALUES (
            p_user_id,
            v_level_config.title,
            v_level_config.target_amount,
            0.00,
            v_level_config.level,
            NOW(),
            NOW() + INTERVAL '1 day' * v_level_config.max_days,
            true,
            false
        ) RETURNING * INTO v_active_goal;
    END IF;

    v_goal_id := v_active_goal.id;

    -- Verify the goal exists before proceeding
    IF NOT EXISTS (SELECT 1 FROM gamified_savings_goals WHERE id = v_goal_id) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Goal validation failed - goal does not exist: ' || v_goal_id
        );
    END IF;

    -- Calculate new amount
    v_new_amount := v_active_goal.current_amount + p_amount;
    v_goal_completed := v_new_amount >= v_active_goal.target_amount;

    -- Update the gamified goal
    UPDATE gamified_savings_goals
    SET 
        current_amount = v_new_amount,
        is_completed = v_goal_completed,
        completed_at = CASE WHEN v_goal_completed THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = v_goal_id;

    -- Create transaction record with verified goal_id
    IF v_goal_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cannot create transaction: no valid goal_id available'
        );
    END IF;

    INSERT INTO savings_transactions (
        user_id,
        goal_id,
        amount,
        transaction_type,
        notes,
        transaction_date
    ) VALUES (
        p_user_id,
        v_goal_id,
        p_amount,
        'deposit',
        p_notes,
        NOW()
    ) RETURNING id INTO v_transaction_id;

    -- ==========================================
    -- PART 3: Update user_levels table (this is the key fix)
    -- ==========================================
    
    -- Get current user level data
    SELECT * INTO v_current_user_level
    FROM user_levels
    WHERE user_id = p_user_id;
    
    -- Calculate new level based on total saved
    v_new_level := v_active_goal.level;
    IF v_goal_completed THEN
        -- If goal completed, try to advance to next level
        SELECT level INTO v_new_level
        FROM savings_level_configs
        WHERE target_amount <= (COALESCE(v_current_user_level.total_saved, 0) + p_amount)
        ORDER BY level DESC
        LIMIT 1;
        
        -- If no level found, keep current level
        IF v_new_level IS NULL THEN
            v_new_level := COALESCE(v_current_user_level.current_level, 1);
        END IF;
    ELSE
        -- If goal not completed, keep current level
        v_new_level := COALESCE(v_current_user_level.current_level, 1);
    END IF;
    
    -- Calculate streak
    IF v_current_user_level.last_save_date IS NULL THEN
        -- First save
        v_new_streak := 1;
    ELSIF v_current_user_level.last_save_date = v_today THEN
        -- Same day, keep current streak
        v_new_streak := COALESCE(v_current_user_level.streak_days, 1);
    ELSIF v_current_user_level.last_save_date = v_today - INTERVAL '1 day' THEN
        -- Consecutive day
        v_new_streak := COALESCE(v_current_user_level.streak_days, 0) + 1;
    ELSE
        -- Streak broken
        v_new_streak := 1;
    END IF;

    -- Update or insert user_levels record
    INSERT INTO user_levels (
        user_id,
        current_level,
        total_saved,
        goals_completed,
        streak_days,
        last_save_date,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        v_new_level,
        COALESCE(v_current_user_level.total_saved, 0) + p_amount,
        COALESCE(v_current_user_level.goals_completed, 0) + (CASE WHEN v_goal_completed THEN 1 ELSE 0 END),
        v_new_streak,
        v_today,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        current_level = v_new_level,
        total_saved = user_levels.total_saved + p_amount,
        goals_completed = user_levels.goals_completed + (CASE WHEN v_goal_completed THEN 1 ELSE 0 END),
        streak_days = v_new_streak,
        last_save_date = v_today,
        updated_at = NOW();

    RETURN json_build_object(
        'success', true,
        'level_completed', v_goal_completed,
        'completed_level', CASE WHEN v_goal_completed THEN v_active_goal.level ELSE NULL END,
        'transaction_id', v_transaction_id,
        'current_amount', v_new_amount,
        'target_amount', v_active_goal.target_amount,
        'goal_id', v_goal_id,
        'new_user_level', v_new_level,
        'total_saved', COALESCE(v_current_user_level.total_saved, 0) + p_amount,
        'streak_days', v_new_streak
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Failed to add savings progress: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_savings_progress(UUID, DECIMAL, TEXT) TO authenticated;

-- ==========================================
-- PART 4: Create LeaderboardService implementation
-- ==========================================

-- Note: The LeaderboardService.js implementation will be created separately
-- This function provides data for the leaderboard functionality

CREATE OR REPLACE FUNCTION get_user_level_info(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_user_level RECORD;
    v_user_rank INTEGER;
BEGIN
    -- Get user's level information
    SELECT * INTO v_user_level
    FROM user_levels
    WHERE user_id = p_user_id;
    
    -- Calculate user's rank
    SELECT COUNT(*) + 1 INTO v_user_rank
    FROM user_levels
    WHERE total_saved > COALESCE(v_user_level.total_saved, 0);
    
    RETURN json_build_object(
        'current_level', COALESCE(v_user_level.current_level, 1),
        'total_saved', COALESCE(v_user_level.total_saved, 0),
        'goals_completed', COALESCE(v_user_level.goals_completed, 0),
        'streak_days', COALESCE(v_user_level.streak_days, 0),
        'last_save_date', v_user_level.last_save_date,
        'rank', v_user_rank
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_level_info(UUID) TO authenticated;

-- ==========================================
-- PART 5: Migration for existing users
-- ==========================================

-- Migrate existing leaderboard data to user_levels if any exists
INSERT INTO user_levels (user_id, current_level, total_saved, goals_completed, streak_days, created_at, updated_at)
SELECT 
    user_id,
    COALESCE(highest_level, 1) as current_level,
    COALESCE(total_saved, 0) as total_saved,
    COALESCE(goals_completed, 0) as goals_completed,
    0 as streak_days, -- Reset streak for migrated data
    COALESCE(created_at, NOW()) as created_at,
    NOW() as updated_at
FROM leaderboards
WHERE user_id NOT IN (SELECT user_id FROM user_levels)
ON CONFLICT (user_id) DO NOTHING;

-- ==========================================
-- Verification
-- ==========================================

-- Verify the user_levels table structure
SELECT 'user_levels table verification:' as status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_levels'
ORDER BY ordinal_position;

-- Show any existing user_levels data
SELECT 'user_levels data count:' as info, COUNT(*) as count FROM user_levels;
