-- Fix data access and RLS policies to ensure proper user data isolation
-- Date: 2025-07-16

-- First, reset all RLS policies to ensure proper data isolation
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert access for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable update access for own profile" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete access for own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can create own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;

DROP POLICY IF EXISTS "Users can view own budget categories" ON public.budget_categories;
DROP POLICY IF EXISTS "Users can create own budget categories" ON public.budget_categories;
DROP POLICY IF EXISTS "Users can update own budget categories" ON public.budget_categories;
DROP POLICY IF EXISTS "Users can delete own budget categories" ON public.budget_categories;

DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can create own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

-- Re-enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Create strict RLS policies for profiles table
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- Create strict RLS policies for budgets table
CREATE POLICY "budgets_select_policy" ON public.budgets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "budgets_insert_policy" ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_update_policy" ON public.budgets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "budgets_delete_policy" ON public.budgets
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create strict RLS policies for budget_categories table
CREATE POLICY "budget_categories_select_policy" ON public.budget_categories
  FOR SELECT TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM budgets WHERE id = budget_categories.budget_id)
  );

CREATE POLICY "budget_categories_insert_policy" ON public.budget_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM budgets WHERE id = budget_categories.budget_id)
  );

CREATE POLICY "budget_categories_update_policy" ON public.budget_categories
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM budgets WHERE id = budget_categories.budget_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM budgets WHERE id = budget_categories.budget_id)
  );

CREATE POLICY "budget_categories_delete_policy" ON public.budget_categories
  FOR DELETE TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM budgets WHERE id = budget_categories.budget_id)
  );

-- Create strict RLS policies for expenses table
CREATE POLICY "expenses_select_policy" ON public.expenses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "expenses_insert_policy" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expenses_update_policy" ON public.expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expenses_delete_policy" ON public.expenses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create strict RLS policies for notes table
CREATE POLICY "notes_select_policy" ON public.notes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notes_insert_policy" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_update_policy" ON public.notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notes_delete_policy" ON public.notes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Service role bypass policies (for admin operations)
CREATE POLICY "service_role_bypass_profiles" ON public.profiles
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bypass_budgets" ON public.budgets
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bypass_budget_categories" ON public.budget_categories
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bypass_expenses" ON public.expenses
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bypass_notes" ON public.notes
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure proper permissions are granted
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.budgets TO authenticated;
GRANT ALL ON public.budget_categories TO authenticated;
GRANT ALL ON public.expenses TO authenticated;
GRANT ALL ON public.notes TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create indexes for better performance on user-scoped queries
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_budget_id ON public.budget_categories(budget_id);
