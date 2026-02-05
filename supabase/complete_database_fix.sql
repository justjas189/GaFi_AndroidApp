-- COMPLETE DATABASE FIX - Apply this in Supabase Dashboard SQL Editor
-- This combines the transaction_type column fix AND the foreign key constraint fix

-- ==========================================
-- PART 1: Add missing columns to savings_transactions
-- ==========================================

-- Add missing transaction_type column if it doesn't exist
ALTER TABLE savings_transactions 
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) DEFAULT 'deposit' 
CHECK (transaction_type IN ('deposit', 'withdrawal'));

-- Add description column if it doesn't exist  
ALTER TABLE savings_transactions 
ADD COLUMN IF NOT EXISTS description TEXT;

-- ==========================================
-- PART 1.5: Fix savings_transactions table structure
-- ==========================================

-- Ensure the savings_transactions table has the correct structure
DO $$
BEGIN
    -- Check if the table exists and fix its structure
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'savings_transactions') THEN
        
        -- Remove NOT NULL constraint from goal_id if it exists
        BEGIN
            ALTER TABLE savings_transactions ALTER COLUMN goal_id DROP NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN
                -- Ignore if constraint doesn't exist
                NULL;
        END;
        
        -- Ensure goal_id column exists and is UUID type
        ALTER TABLE savings_transactions 
        ALTER COLUMN goal_id TYPE UUID USING goal_id::UUID;
        
    ELSE
        -- Create the table with correct structure if it doesn't exist
        CREATE TABLE savings_transactions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            goal_id UUID, -- Allow NULL values
            amount DECIMAL(15,2) NOT NULL,
            transaction_type VARCHAR(20) DEFAULT 'deposit' CHECK (transaction_type IN ('deposit', 'withdrawal')),
            description TEXT,
            notes TEXT,
            transaction_date TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_savings_transactions_user_id ON savings_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_savings_transactions_goal_id ON savings_transactions(goal_id);
        CREATE INDEX IF NOT EXISTS idx_savings_transactions_date ON savings_transactions(transaction_date);
    END IF;
END
$$;

-- ==========================================
-- PART 2: Clean up foreign key constraint issues
-- ==========================================

-- Check current state
SELECT 'Current savings_transactions count:' as info, COUNT(*) as count FROM savings_transactions
UNION ALL
SELECT 'Current gamified_savings_goals count:' as info, COUNT(*) as count FROM gamified_savings_goals;

-- First, drop the foreign key constraint if it exists
ALTER TABLE savings_transactions 
DROP CONSTRAINT IF EXISTS savings_transactions_goal_id_fkey;

-- Remove NOT NULL constraint from goal_id column to allow NULL values
ALTER TABLE savings_transactions 
ALTER COLUMN goal_id DROP NOT NULL;

-- Clean up orphaned data - set goal_id to NULL for orphaned transactions
UPDATE savings_transactions 
SET goal_id = NULL 
WHERE goal_id IS NOT NULL 
AND goal_id NOT IN (SELECT id FROM gamified_savings_goals WHERE id IS NOT NULL);

-- Delete any completely orphaned transactions that we can't fix
DELETE FROM savings_transactions 
WHERE goal_id IS NULL 
AND user_id NOT IN (SELECT id FROM auth.users WHERE id IS NOT NULL);

-- Recreate the constraint with proper handling (allowing NULL values)
ALTER TABLE savings_transactions 
ADD CONSTRAINT savings_transactions_goal_id_fkey 
FOREIGN KEY (goal_id) REFERENCES gamified_savings_goals(id) ON DELETE SET NULL;

-- ==========================================
-- PART 3: Ensure gamified_savings_goals table exists
-- ==========================================

DO $$
BEGIN
    -- Check if gamified_savings_goals table exists, if not create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables 
                   WHERE table_schema = 'public' 
                   AND table_name = 'gamified_savings_goals') THEN
        
        CREATE TABLE gamified_savings_goals (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            goal_name VARCHAR(255) NOT NULL,
            target_amount DECIMAL(15,2) NOT NULL,
            current_amount DECIMAL(15,2) DEFAULT 0.00,
            level INTEGER NOT NULL DEFAULT 1,
            start_date TIMESTAMPTZ DEFAULT NOW(),
            end_date TIMESTAMPTZ NOT NULL,
            is_active BOOLEAN DEFAULT true,
            is_completed BOOLEAN DEFAULT false,
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_gamified_savings_goals_user_id ON gamified_savings_goals(user_id);
        CREATE INDEX IF NOT EXISTS idx_gamified_savings_goals_active ON gamified_savings_goals(user_id, is_active, is_completed);
        
        -- Set up RLS
        ALTER TABLE gamified_savings_goals ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view their own gamified goals"
            ON gamified_savings_goals FOR SELECT
            USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert their own gamified goals"
            ON gamified_savings_goals FOR INSERT
            WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update their own gamified goals"
            ON gamified_savings_goals FOR UPDATE
            USING (auth.uid() = user_id);

        RAISE NOTICE 'Created gamified_savings_goals table';
    END IF;
END
$$;

-- ==========================================
-- PART 4: Create/Fix the initialize_level_configurations function
-- ==========================================

CREATE OR REPLACE FUNCTION initialize_level_configurations()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_count INTEGER;
BEGIN
    -- Check if level configurations already exist
    SELECT COUNT(*) INTO v_count FROM savings_level_configs;
    
    IF v_count = 0 THEN
        -- Insert default level configurations
        INSERT INTO savings_level_configs (level, title, description, target_amount, max_days, icon, color)
        VALUES 
            (1, 'Starter Saver', 'Your first savings challenge! Start small and build the habit.', 500.00, 30, 'leaf-outline', '#4CAF50'),
            (2, 'Smart Saver', 'Step up your savings game! You are building momentum.', 1000.00, 45, 'bulb-outline', '#2196F3'),
            (3, 'Super Saver', 'Serious savings ahead! You are becoming a pro at this.', 5000.00, 90, 'rocket-outline', '#FF9800'),
            (4, 'Savings Master', 'Master level savings! You have reached the pinnacle of savings discipline.', 10000.00, 120, 'trophy-outline', '#9C27B0')
        ON CONFLICT (level) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            target_amount = EXCLUDED.target_amount,
            max_days = EXCLUDED.max_days,
            icon = EXCLUDED.icon,
            color = EXCLUDED.color;
    END IF;
    
    -- Return the configurations
    SELECT json_agg(
        json_build_object(
            'level', level,
            'title', title,
            'description', description,
            'target_amount', target_amount,
            'max_days', max_days,
            'icon', icon,
            'color', color
        ) ORDER BY level
    ) INTO v_result
    FROM savings_level_configs;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Level configurations initialized successfully',
        'count', (SELECT COUNT(*) FROM savings_level_configs),
        'configs', v_result
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to initialize level configurations'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION initialize_level_configurations() TO authenticated;

-- ==========================================
-- PART 5: Create/Fix the add_savings_progress function
-- ==========================================

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
    -- Double-check that we have a valid goal_id before inserting
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

    -- Update leaderboard
    INSERT INTO leaderboards (
        user_id,
        username,
        total_saved,
        goals_completed,
        highest_level,
        last_activity
    ) VALUES (
        p_user_id,
        'User_' || substring(p_user_id::TEXT from 1 for 8),
        p_amount,
        CASE WHEN v_goal_completed THEN 1 ELSE 0 END,
        v_active_goal.level,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_saved = leaderboards.total_saved + p_amount,
        goals_completed = leaderboards.goals_completed + (CASE WHEN v_goal_completed THEN 1 ELSE 0 END),
        highest_level = GREATEST(leaderboards.highest_level, v_active_goal.level),
        last_activity = NOW(),
        updated_at = NOW();

    RETURN json_build_object(
        'success', true,
        'level_completed', v_goal_completed,
        'completed_level', CASE WHEN v_goal_completed THEN v_active_goal.level ELSE NULL END,
        'transaction_id', v_transaction_id,
        'current_amount', v_new_amount,
        'target_amount', v_active_goal.target_amount,
        'goal_id', v_goal_id
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
-- PART 6: Set up RLS policies
-- ==========================================

-- Update RLS policies for savings_level_configs if the table exists
DO $$
BEGIN
    -- Only run if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'savings_level_configs') THEN
        -- Drop and recreate policies
        DROP POLICY IF EXISTS "Level configs are readable by everyone" ON savings_level_configs;        
        CREATE POLICY "Level configs are readable by everyone"
            ON savings_level_configs FOR SELECT
            USING (true);

        -- Allow service role to manage level configs
        DROP POLICY IF EXISTS "Service role can manage level configs" ON savings_level_configs;
        CREATE POLICY "Service role can manage level configs"
            ON savings_level_configs FOR ALL
            USING (auth.role() = 'service_role');

        -- Enable RLS if not already enabled
        ALTER TABLE savings_level_configs ENABLE ROW LEVEL SECURITY;
    END IF;
END
$$;

-- ==========================================
-- PART 7: Initialize and verify everything
-- ==========================================

-- Initialize the level configurations
SELECT initialize_level_configurations();

-- Verify everything is working
SELECT 'Final verification:' as status;
SELECT 'Constraint check:' as info,
       conname as constraint_name,
       pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'savings_transactions_goal_id_fkey';

-- Show final counts
SELECT 'Tables count check:' as status;
SELECT 'savings_transactions:' as table_name, COUNT(*) as count FROM savings_transactions
UNION ALL
SELECT 'gamified_savings_goals:' as table_name, COUNT(*) as count FROM gamified_savings_goals
UNION ALL
SELECT 'savings_level_configs:' as table_name, COUNT(*) as count FROM savings_level_configs;