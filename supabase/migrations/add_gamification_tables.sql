-- MoneyTrack Gamification Tables
-- Add support for savings goals, user interactions, chat history, and leaderboard features

-- =========================================
-- STEP 1: Create Savings Goals Table
-- =========================================

CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  deadline DATE,
  is_achieved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  achieved_at TIMESTAMP WITH TIME ZONE
);

-- =========================================
-- STEP 2: Create User Interactions Table (for gamification tracking)
-- =========================================

CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL, -- 'expense_added', 'goal_created', 'budget_set', etc.
  xp_earned INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- STEP 3: Create Chat History Table
-- =========================================

CREATE TABLE IF NOT EXISTS chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_bot BOOLEAN DEFAULT FALSE,
  intent VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- STEP 4: Create User Levels Table
-- =========================================

CREATE TABLE IF NOT EXISTS user_levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_level INTEGER DEFAULT 1,
  total_xp INTEGER DEFAULT 0,
  level_name VARCHAR(50) DEFAULT 'Beginner',
  achievements_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =========================================
-- STEP 5: Create Achievement Definitions Table
-- =========================================

CREATE TABLE IF NOT EXISTS achievement_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(50),
  xp_reward INTEGER DEFAULT 0,
  condition_type VARCHAR(50) NOT NULL, -- 'expense_count', 'savings_amount', 'budget_adherence', etc.
  condition_value INTEGER,
  condition_data JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- STEP 6: Create User Achievements Table
-- =========================================

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress_data JSONB,
  UNIQUE(user_id, achievement_id)
);

-- =========================================
-- STEP 7: Create Savings Transactions Table
-- =========================================

CREATE TABLE IF NOT EXISTS savings_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  savings_goal_id UUID REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'deposit', -- 'deposit', 'withdrawal'
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- STEP 8: Create indexes for performance
-- =========================================

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_deadline ON savings_goals(deadline);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON user_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);
CREATE INDEX IF NOT EXISTS idx_user_levels_user_id ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_total_xp ON user_levels(total_xp);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_user_id ON savings_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_goal_id ON savings_transactions(savings_goal_id);

-- =========================================
-- STEP 9: Enable Row Level Security (RLS)
-- =========================================

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;

-- =========================================
-- STEP 10: Create RLS Policies
-- =========================================

-- Savings Goals policies
CREATE POLICY "Users can view own savings goals" ON savings_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings goals" ON savings_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals" ON savings_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals" ON savings_goals
  FOR DELETE USING (auth.uid() = user_id);

-- User Interactions policies
CREATE POLICY "Users can view own interactions" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions" ON user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chat History policies
CREATE POLICY "Users can view own chat history" ON chat_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat history" ON chat_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chat history" ON chat_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chat history" ON chat_history
  FOR DELETE USING (auth.uid() = user_id);

-- User Levels policies
CREATE POLICY "Users can view own level data" ON user_levels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own level data" ON user_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own level data" ON user_levels
  FOR UPDATE USING (auth.uid() = user_id);

-- Achievement Definitions policies (public read, admin manage)
CREATE POLICY "Anyone can view achievement definitions" ON achievement_definitions
  FOR SELECT USING (true);

-- User Achievements policies
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Savings Transactions policies
CREATE POLICY "Users can view own savings transactions" ON savings_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings transactions" ON savings_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings transactions" ON savings_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings transactions" ON savings_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- =========================================
-- STEP 11: Create utility functions
-- =========================================

-- Function to update savings goal current amount
CREATE OR REPLACE FUNCTION update_savings_goal_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the current amount in savings_goals based on transactions
  UPDATE savings_goals 
  SET 
    current_amount = (
      SELECT COALESCE(SUM(
        CASE 
          WHEN transaction_type = 'deposit' THEN amount
          WHEN transaction_type = 'withdrawal' THEN -amount
          ELSE 0
        END
      ), 0)
      FROM savings_transactions 
      WHERE savings_goal_id = NEW.savings_goal_id
    ),
    updated_at = NOW(),
    is_achieved = CASE 
      WHEN current_amount >= target_amount AND achieved_at IS NULL THEN TRUE
      ELSE is_achieved
    END,
    achieved_at = CASE 
      WHEN current_amount >= target_amount AND achieved_at IS NULL THEN NOW()
      ELSE achieved_at
    END
  WHERE id = NEW.savings_goal_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to award XP and update user level
CREATE OR REPLACE FUNCTION award_xp_and_update_level()
RETURNS TRIGGER AS $$
DECLARE
  user_level_record RECORD;
  new_level INTEGER;
  level_names TEXT[] := ARRAY['Beginner', 'Saver', 'Budgeter', 'Investor', 'Expert', 'Master'];
BEGIN
  -- Get current user level data or create if not exists
  SELECT * INTO user_level_record 
  FROM user_levels 
  WHERE user_id = NEW.user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_levels (user_id, current_level, total_xp, level_name)
    VALUES (NEW.user_id, 1, NEW.xp_earned, 'Beginner');
  ELSE
    -- Update total XP
    UPDATE user_levels 
    SET 
      total_xp = total_xp + NEW.xp_earned,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    -- Calculate new level (every 100 XP = 1 level)
    SELECT 
      LEAST(GREATEST(1, (total_xp + NEW.xp_earned) / 100 + 1), 6) INTO new_level
    FROM user_levels 
    WHERE user_id = NEW.user_id;
    
    -- Update level if changed
    IF new_level > user_level_record.current_level THEN
      UPDATE user_levels 
      SET 
        current_level = new_level,
        level_name = level_names[new_level],
        updated_at = NOW()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- STEP 12: Create triggers
-- =========================================

-- Trigger for updating savings goal amounts
CREATE TRIGGER trigger_update_savings_goal_amount
  AFTER INSERT OR UPDATE OR DELETE ON savings_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_savings_goal_amount();

-- Trigger for awarding XP and updating levels
CREATE TRIGGER trigger_award_xp
  AFTER INSERT ON user_interactions
  FOR EACH ROW
  WHEN (NEW.xp_earned > 0)
  EXECUTE FUNCTION award_xp_and_update_level();

-- Triggers for updated_at columns
CREATE TRIGGER update_savings_goals_updated_at
  BEFORE UPDATE ON savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_levels_updated_at
  BEFORE UPDATE ON user_levels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- STEP 13: Insert default achievement definitions
-- =========================================

INSERT INTO achievement_definitions (name, description, icon, xp_reward, condition_type, condition_value) VALUES
('First Expense', 'Added your first expense', 'dollar-sign', 10, 'expense_count', 1),
('Expense Tracker', 'Added 10 expenses', 'chart-line', 25, 'expense_count', 10),
('Budget Master', 'Created your first budget', 'clipboard-list', 20, 'budget_count', 1),
('Savings Starter', 'Created your first savings goal', 'piggy-bank', 15, 'savings_goal_count', 1),
('Goal Achiever', 'Achieved your first savings goal', 'trophy', 50, 'achieved_goals', 1),
('Weekly Tracker', 'Added expenses for 7 consecutive days', 'calendar-check', 30, 'consecutive_days', 7),
('Monthly Budget', 'Stayed within budget for a full month', 'award', 100, 'budget_adherence', 30),
('Penny Saver', 'Saved ₱1,000 total', 'coins', 20, 'total_savings', 1000),
('Big Saver', 'Saved ₱10,000 total', 'money-bill-wave', 75, 'total_savings', 10000)
ON CONFLICT (name) DO NOTHING;

-- =========================================
-- STEP 14: Grant permissions
-- =========================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =========================================
-- SUCCESS! Gamification tables added!
-- =========================================

-- The following tables have been created:
-- ✅ savings_goals - For user savings targets
-- ✅ user_interactions - For tracking XP-earning activities  
-- ✅ chat_history - For chatbot conversation history
-- ✅ user_levels - For user progression and levels
-- ✅ achievement_definitions - For available achievements
-- ✅ user_achievements - For earned achievements per user
-- ✅ savings_transactions - For savings deposits/withdrawals

-- The following features are now available:
-- ✅ XP system with automatic level progression
-- ✅ Achievement system with default achievements
-- ✅ Savings goals with progress tracking
-- ✅ Chat history preservation
-- ✅ Leaderboard capabilities via user_levels table
