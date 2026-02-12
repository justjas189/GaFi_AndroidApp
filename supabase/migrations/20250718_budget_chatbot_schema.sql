-- Budget Chatbot Database Schema
-- This migration creates tables for comprehensive budget management via chatbot

-- 1. Budgets table - stores user budget configurations
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_budget DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  budget_period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, weekly, yearly
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, budget_period)
);

-- 2. Budget categories table - defines spending categories with limits
CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_name VARCHAR(50) NOT NULL,
  allocated_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  spent_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(budget_id, category_name)
);

-- 3. Enhanced transactions table for chatbot integration
CREATE TABLE IF NOT EXISTS chatbot_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_via VARCHAR(20) NOT NULL DEFAULT 'chatbot', -- chatbot, manual, import
  natural_language_input TEXT, -- stores original user input
  confidence_score DECIMAL(3, 2), -- AI parsing confidence (0.00-1.00)
  needs_review BOOLEAN DEFAULT FALSE, -- flag for unclear transactions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Chatbot interaction logs for learning and debugging
CREATE TABLE IF NOT EXISTS chatbot_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,
  intent VARCHAR(50), -- expense_log, budget_update, query, etc.
  extracted_data JSONB, -- parsed data from user input
  chatbot_response TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Budget alerts and notifications
CREATE TABLE IF NOT EXISTS budget_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL, -- overspend, threshold, goal_reached
  category VARCHAR(50),
  threshold_percentage INTEGER DEFAULT 80, -- alert at 80% of budget
  amount DECIMAL(12, 2),
  message TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_budget_id ON budget_categories(budget_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_transactions_user_id ON chatbot_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_transactions_date ON chatbot_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_chatbot_transactions_category ON chatbot_transactions(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_user_id ON chatbot_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_user_id ON budget_alerts(user_id);

-- Row Level Security (RLS) Policies
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budgets
CREATE POLICY "Users can view their own budgets" ON budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" ON budgets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for budget_categories
CREATE POLICY "Users can view their budget categories" ON budget_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM budgets 
      WHERE budgets.id = budget_categories.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their budget categories" ON budget_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM budgets 
      WHERE budgets.id = budget_categories.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );

-- RLS Policies for chatbot_transactions
CREATE POLICY "Users can view their own transactions" ON chatbot_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON chatbot_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" ON chatbot_transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" ON chatbot_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for chatbot_interactions
CREATE POLICY "Users can view their own interactions" ON chatbot_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions" ON chatbot_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for budget_alerts
CREATE POLICY "Users can manage their own alerts" ON budget_alerts
  FOR ALL USING (auth.uid() = user_id);

-- Functions for automatic updates

-- Function to update spent amounts in budget categories
CREATE OR REPLACE FUNCTION update_category_spent_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Update spent amount for the category
  UPDATE budget_categories 
  SET 
    spent_amount = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM chatbot_transactions 
      WHERE user_id = NEW.user_id 
      AND category = NEW.category
      AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
    ),
    updated_at = NOW()
  WHERE budget_id = NEW.budget_id 
  AND category_name = NEW.category;
  
  -- Create budget category if it doesn't exist
  INSERT INTO budget_categories (budget_id, category_name, allocated_amount, spent_amount)
  SELECT NEW.budget_id, NEW.category, 0, NEW.amount
  WHERE NOT EXISTS (
    SELECT 1 FROM budget_categories 
    WHERE budget_id = NEW.budget_id 
    AND category_name = NEW.category
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update spent amounts
CREATE TRIGGER trigger_update_category_spent
  AFTER INSERT OR UPDATE OR DELETE ON chatbot_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_category_spent_amount();

-- Function to check for budget alerts
CREATE OR REPLACE FUNCTION check_budget_alerts()
RETURNS TRIGGER AS $$
DECLARE
  category_limit DECIMAL(12, 2);
  total_spent DECIMAL(12, 2);
  alert_threshold DECIMAL(12, 2);
BEGIN
  -- Get category spending limit and current spent amount
  SELECT 
    bc.allocated_amount,
    bc.spent_amount
  INTO category_limit, total_spent
  FROM budget_categories bc
  WHERE bc.budget_id = NEW.budget_id 
  AND bc.category_name = NEW.category;
  
  -- Check if spending exceeds 80% of category budget
  IF category_limit > 0 AND total_spent > (category_limit * 0.8) THEN
    INSERT INTO budget_alerts (
      user_id, 
      budget_id, 
      alert_type, 
      category, 
      amount, 
      message,
      triggered_at
    ) VALUES (
      NEW.user_id,
      NEW.budget_id,
      CASE 
        WHEN total_spent > category_limit THEN 'overspend'
        ELSE 'threshold'
      END,
      NEW.category,
      total_spent,
      CASE 
        WHEN total_spent > category_limit THEN 
          'You have exceeded your ' || NEW.category || ' budget by ₱' || (total_spent - category_limit)
        ELSE 
          'You have spent 80% of your ' || NEW.category || ' budget (₱' || total_spent || ' of ₱' || category_limit || ')'
      END,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for budget alerts
CREATE TRIGGER trigger_budget_alerts
  AFTER INSERT OR UPDATE ON chatbot_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_budget_alerts();

-- Insert default categories for new budgets
CREATE OR REPLACE FUNCTION create_default_budget_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_categories (budget_id, category_name, allocated_amount) VALUES
    (NEW.id, 'food', COALESCE(NEW.monthly, 0) * 0.30),
    (NEW.id, 'transportation', COALESCE(NEW.monthly, 0) * 0.15),
    (NEW.id, 'entertainment', COALESCE(NEW.monthly, 0) * 0.10),
    (NEW.id, 'shopping', COALESCE(NEW.monthly, 0) * 0.20),
    (NEW.id, 'utilities', COALESCE(NEW.monthly, 0) * 0.15),
    (NEW.id, 'others', COALESCE(NEW.monthly, 0) * 0.10);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default categories
CREATE TRIGGER trigger_default_categories
  AFTER INSERT ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_categories();

-- Sample data for testing (optional)
-- INSERT INTO budgets (user_id, total_budget) VALUES 
--   (auth.uid(), 10000.00);
