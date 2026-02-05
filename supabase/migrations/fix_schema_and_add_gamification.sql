-- Quick fixes for budget table schema issues
-- This aligns the existing schema with what the app expects

-- Add amount and spent_amount columns to budgets table for backward compatibility
ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS amount DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS spent_amount DECIMAL(12, 2) DEFAULT 0;

-- Update existing budget records to populate the new columns
UPDATE budgets 
SET amount = total_budget, 
    spent_amount = 0 
WHERE amount IS NULL;

-- Now let's run the full gamification schema
-- =========================================
-- GAMIFICATION TABLES (from add_gamification_tables.sql)
-- =========================================

-- Create Savings Goals Table
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

-- Create User Interactions Table (for gamification tracking)
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,
  xp_earned INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_bot BOOLEAN DEFAULT FALSE,
  intent VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create User Levels Table
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

-- Create Achievement Definitions Table
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

-- Create User Achievements Table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress_data JSONB,
  UNIQUE(user_id, achievement_id)
);

-- Create Savings Transactions Table
CREATE TABLE IF NOT EXISTS savings_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  savings_goal_id UUID REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'deposit',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_user_id ON user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_transactions_user_id ON savings_transactions(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
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

-- User Levels policies
CREATE POLICY "Users can view own level data" ON user_levels
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own level data" ON user_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own level data" ON user_levels
  FOR UPDATE USING (auth.uid() = user_id);

-- Achievement Definitions policies
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

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Insert default achievement definitions
INSERT INTO achievement_definitions (name, description, icon, xp_reward, condition_type, condition_value) VALUES
('First Expense', 'Added your first expense', 'dollar-sign', 10, 'expense_count', 1),
('Expense Tracker', 'Added 10 expenses', 'chart-line', 25, 'expense_count', 10),
('Budget Master', 'Created your first budget', 'clipboard-list', 20, 'budget_count', 1),
('Savings Starter', 'Created your first savings goal', 'piggy-bank', 15, 'savings_goal_count', 1),
('Goal Achiever', 'Achieved your first savings goal', 'trophy', 50, 'achieved_goals', 1)
ON CONFLICT (name) DO NOTHING;
