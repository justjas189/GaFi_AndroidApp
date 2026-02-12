-- MoneyTrack Complete Database Schema
-- This is a clean, properly aligned schema for your MoneyTrack React Native app
-- Run this to completely replace your existing schema

-- =========================================
-- STEP 1: Clean up existing tables
-- =========================================

-- Disable RLS temporarily
SET session_replication_role = 'replica';

-- Drop existing tables and their dependencies
DROP TABLE IF EXISTS public.chatbot_interactions CASCADE;
DROP TABLE IF EXISTS public.budget_alerts CASCADE;
DROP TABLE IF EXISTS public.chatbot_transactions CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.budget_categories CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop functions and triggers
DROP FUNCTION IF EXISTS update_category_spent_amount() CASCADE;
DROP FUNCTION IF EXISTS check_budget_alerts() CASCADE;
DROP FUNCTION IF EXISTS create_default_budget_categories() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =========================================
-- STEP 2: Create new tables with proper structure
-- =========================================

-- User profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Main budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly DECIMAL(12, 2) NOT NULL DEFAULT 0,
  weekly DECIMAL(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  budget_period VARCHAR(20) NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, budget_period)
);

-- Budget categories with consistent naming
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

-- Expenses table - matches DataContext.js expectations
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  note TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chatbot interaction logs
CREATE TABLE IF NOT EXISTS chatbot_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_input TEXT NOT NULL,
  intent VARCHAR(50),
  extracted_data JSONB,
  chatbot_response TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget alerts
CREATE TABLE IF NOT EXISTS budget_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE,
  alert_type VARCHAR(30) NOT NULL,
  category VARCHAR(50),
  threshold_percentage INTEGER DEFAULT 80,
  amount DECIMAL(12, 2),
  message TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes table for user notes
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- STEP 3: Create indexes for performance
-- =========================================

CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(budget_period);
CREATE INDEX IF NOT EXISTS idx_budget_categories_budget_id ON budget_categories(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_category ON budget_categories(category_name);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_chatbot_interactions_user_id ON chatbot_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_user_id ON budget_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);

-- =========================================
-- STEP 4: Enable Row Level Security (RLS)
-- =========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- =========================================
-- STEP 5: Create RLS Policies
-- =========================================

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

DROP POLICY IF EXISTS "Users can view their budget categories" ON budget_categories;
DROP POLICY IF EXISTS "Users can manage their budget categories" ON budget_categories;

DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

DROP POLICY IF EXISTS "Users can view own interactions" ON chatbot_interactions;
DROP POLICY IF EXISTS "Users can insert own interactions" ON chatbot_interactions;

DROP POLICY IF EXISTS "Users can manage own alerts" ON budget_alerts;

DROP POLICY IF EXISTS "Users can view own notes" ON notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON notes;

-- Now create the policies
-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- Budgets policies
CREATE POLICY "Users can view own budgets" ON budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets" ON budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Budget categories policies
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

-- Expenses policies
CREATE POLICY "Users can view own expenses" ON expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Chatbot interactions policies
CREATE POLICY "Users can view own interactions" ON chatbot_interactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions" ON chatbot_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Budget alerts policies
CREATE POLICY "Users can manage own alerts" ON budget_alerts
  FOR ALL USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);

-- =========================================
-- STEP 6: Create utility functions
-- =========================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update category spent amounts
CREATE OR REPLACE FUNCTION update_category_spent_amount()
RETURNS TRIGGER AS $$
DECLARE
  user_budget_id UUID;
BEGIN
  -- Get the user's budget ID
  SELECT id INTO user_budget_id 
  FROM budgets 
  WHERE user_id = NEW.user_id 
  AND budget_period = 'monthly'
  LIMIT 1;

  -- Only proceed if user has a budget
  IF user_budget_id IS NOT NULL THEN
    -- Update spent amount for the category
    UPDATE budget_categories 
    SET 
      spent_amount = (
        SELECT COALESCE(SUM(amount), 0) 
        FROM expenses 
        WHERE user_id = NEW.user_id 
        AND category = NEW.category
        AND date >= DATE_TRUNC('month', CURRENT_DATE)
      ),
      updated_at = NOW()
    WHERE budget_id = user_budget_id 
    AND category_name = NEW.category;
    
    -- Create budget category if it doesn't exist
    INSERT INTO budget_categories (budget_id, category_name, allocated_amount, spent_amount)
    SELECT user_budget_id, NEW.category, 0, NEW.amount
    WHERE NOT EXISTS (
      SELECT 1 FROM budget_categories 
      WHERE budget_id = user_budget_id 
      AND category_name = NEW.category
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check for budget alerts
CREATE OR REPLACE FUNCTION check_budget_alerts()
RETURNS TRIGGER AS $$
DECLARE
  category_limit DECIMAL(12, 2);
  total_spent DECIMAL(12, 2);
  user_budget_id UUID;
BEGIN
  -- Get the user's budget ID
  SELECT id INTO user_budget_id 
  FROM budgets 
  WHERE user_id = NEW.user_id 
  AND budget_period = 'monthly'
  LIMIT 1;

  -- Only proceed if user has a budget
  IF user_budget_id IS NOT NULL THEN
    -- Get category spending limit and current spent amount
    SELECT 
      bc.allocated_amount,
      bc.spent_amount
    INTO category_limit, total_spent
    FROM budget_categories bc
    WHERE bc.budget_id = user_budget_id 
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
        user_budget_id,
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create default budget categories
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

-- =========================================
-- STEP 7: Create triggers
-- =========================================

-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_budgets_updated_at ON budgets;
DROP TRIGGER IF EXISTS update_budget_categories_updated_at ON budget_categories;
DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
DROP TRIGGER IF EXISTS trigger_update_category_spent ON expenses;
DROP TRIGGER IF EXISTS trigger_budget_alerts ON expenses;
DROP TRIGGER IF EXISTS trigger_default_categories ON budgets;
DROP TRIGGER IF EXISTS create_budget_categories_trigger ON budgets;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_categories_updated_at
  BEFORE UPDATE ON budget_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update spent amounts
CREATE TRIGGER trigger_update_category_spent
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_category_spent_amount();

-- Trigger for budget alerts
CREATE TRIGGER trigger_budget_alerts
  AFTER INSERT OR UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION check_budget_alerts();

-- Trigger to create default categories
CREATE TRIGGER trigger_default_categories
  AFTER INSERT ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_categories();

-- =========================================
-- STEP 8: Grant permissions
-- =========================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Reset session replication role
SET session_replication_role = 'origin';

-- =========================================
-- STEP 9: Insert comprehensive sample data
-- =========================================

-- Note: This section inserts sample data using placeholder user IDs
-- To use this data, you need to either:
-- 1. Replace the UUIDs below with actual user IDs from your auth.users table
-- 2. Create test users first, or 
-- 3. Skip this section and add data manually after creating real users

-- Get your actual user ID by running: SELECT id FROM auth.users LIMIT 1;
-- Then replace the UUIDs below with your real user ID

-- OPTION 1: Skip sample data insertion (recommended for production)
-- Comment out the entire sample data section below if you want to start with empty tables

-- OPTION 2: Use sample data (for testing only)
-- Uncomment the following sections if you want to insert sample data
-- Make sure to replace the user IDs with actual ones from your auth.users table

/*
-- Sample user profiles - ONLY INSERT IF USERS EXIST IN auth.users
-- First check if users exist, then insert profiles
DO $$
BEGIN
    -- Only insert profiles for users that actually exist in auth.users
    INSERT INTO profiles (id, full_name, email) 
    SELECT u.id, 
           CASE 
               WHEN u.id = 'd4852078-6a69-4be8-8358-129ac4616f47' THEN 'John Doe'
               WHEN u.id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' THEN 'Jane Smith'
               WHEN u.id = 'f9e8d7c6-b5a4-9384-7261-504938271645' THEN 'Mike Johnson'
               ELSE 'Test User'
           END as full_name,
           COALESCE(u.email, 'test@example.com') as email
    FROM auth.users u 
    WHERE u.id IN (
        'd4852078-6a69-4be8-8358-129ac4616f47',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 
        'f9e8d7c6-b5a4-9384-7261-504938271645'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
    
    -- If no specific test users exist, create data for any existing user
    IF NOT FOUND THEN
        INSERT INTO profiles (id, full_name, email)
        SELECT u.id, 'Test User', COALESCE(u.email, 'test@example.com')
        FROM auth.users u 
        LIMIT 1
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email;
    END IF;
END $$;

-- Sample budgets - only for existing users
INSERT INTO budgets (user_id, total_budget, currency, budget_period) 
SELECT p.id, 25000.00, 'PHP', 'monthly'
FROM profiles p
WHERE p.id IN (
    SELECT id FROM auth.users 
    WHERE id IN (
        'd4852078-6a69-4be8-8358-129ac4616f47',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'f9e8d7c6-b5a4-9384-7261-504938271645'
    )
)
UNION ALL
SELECT p.id, 30000.00, 'PHP', 'monthly'
FROM profiles p
WHERE p.id IN (SELECT id FROM auth.users)
LIMIT 1
ON CONFLICT (user_id, budget_period) DO UPDATE SET
    total_budget = EXCLUDED.total_budget,
    currency = EXCLUDED.currency;

-- Update budget categories with realistic allocations
DO $$
DECLARE
    budget_record RECORD;
BEGIN
    FOR budget_record IN SELECT id, total_budget FROM budgets LOOP
        UPDATE budget_categories SET
            allocated_amount = CASE category_name
                WHEN 'food' THEN budget_record.total_budget * 0.35
                WHEN 'transportation' THEN budget_record.total_budget * 0.20
                WHEN 'entertainment' THEN budget_record.total_budget * 0.15
                WHEN 'shopping' THEN budget_record.total_budget * 0.15
                WHEN 'utilities' THEN budget_record.total_budget * 0.10
                WHEN 'others' THEN budget_record.total_budget * 0.05
            END
        WHERE budget_id = budget_record.id;
    END LOOP;
END $$;

-- Sample expenses - only for existing users
INSERT INTO expenses (user_id, amount, category, note, date)
SELECT 
    u.id,
    450.00,
    'food',
    'Sample grocery expense',
    CURRENT_DATE
FROM auth.users u
LIMIT 3;

-- Sample notes - only for existing users
INSERT INTO notes (user_id, title, content)
SELECT 
    u.id,
    'Welcome to MoneyTrack!',
    'This is a sample note. You can edit or delete this and add your own financial notes and goals.'
FROM auth.users u
LIMIT 1;

-- Update spent amounts in budget_categories based on actual expenses
UPDATE budget_categories SET
    spent_amount = (
        SELECT COALESCE(SUM(e.amount), 0)
        FROM expenses e
        JOIN budgets b ON e.user_id = b.user_id
        WHERE b.id = budget_categories.budget_id
        AND e.category = budget_categories.category_name
        AND e.date >= DATE_TRUNC('month', CURRENT_DATE)
    ),
    updated_at = NOW();
*/

-- =========================================
-- SUCCESS! Your MoneyTrack database is ready!
-- =========================================

-- To add sample data:
-- 1. Create a user account in your app first
-- 2. Get your user ID: SELECT id FROM auth.users;
-- 3. Uncomment the sample data section above
-- 4. Replace the placeholder UUIDs with your actual user ID
-- 5. Run the sample data section

-- Your database now includes:
-- ✅ All tables with proper relationships
-- ✅ Row Level Security policies
-- ✅ Automatic triggers for budget tracking
-- ✅ Indexes for optimal performance
-- ✅ Functions for automatic category creation and alerts
