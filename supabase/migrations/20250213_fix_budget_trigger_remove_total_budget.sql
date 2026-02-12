-- =========================================
-- FIX: Remove total_budget references from trigger function
-- =========================================
-- The 'total_budget' column was removed from the 'budgets' table.
-- The trigger function 'create_default_budget_categories()' still references
-- NEW.total_budget, causing PostgreSQL error 42703:
--   "record 'new' has no field 'total_budget'"
--
-- This migration rewrites the function to use NEW.monthly instead.
-- =========================================

-- Step 1: Drop the existing trigger so we can safely replace the function
DROP TRIGGER IF EXISTS trigger_default_categories ON budgets;
DROP TRIGGER IF EXISTS create_budget_categories_trigger ON budgets;

-- Step 2: Replace the function to use NEW.monthly instead of NEW.total_budget
CREATE OR REPLACE FUNCTION create_default_budget_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO budget_categories (budget_id, category_name, allocated_amount) VALUES
    (NEW.id, 'food',            COALESCE(NEW.monthly, 0) * 0.30),
    (NEW.id, 'transportation',  COALESCE(NEW.monthly, 0) * 0.15),
    (NEW.id, 'entertainment',   COALESCE(NEW.monthly, 0) * 0.10),
    (NEW.id, 'shopping',        COALESCE(NEW.monthly, 0) * 0.20),
    (NEW.id, 'utilities',       COALESCE(NEW.monthly, 0) * 0.15),
    (NEW.id, 'others',          COALESCE(NEW.monthly, 0) * 0.10);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate the trigger
CREATE TRIGGER trigger_default_categories
  AFTER INSERT ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION create_default_budget_categories();
