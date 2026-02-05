-- Fix budget table columns to match app expectations
-- This migration adds the missing columns that the app expects

-- Add the missing columns to the budgets table
ALTER TABLE budgets 
ADD COLUMN IF NOT EXISTS monthly DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS savings_goal DECIMAL(12, 2) DEFAULT 0;

-- Update existing records to use total_budget as monthly if they exist
UPDATE budgets 
SET monthly = total_budget 
WHERE monthly = 0 AND total_budget > 0;

-- Note: We're keeping total_budget column for backward compatibility
-- You can drop it later if not needed: ALTER TABLE budgets DROP COLUMN total_budget;

-- Update the unique constraint to include the new structure
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_user_id_budget_period_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_unique UNIQUE(user_id);

-- Comment explaining the column structure:
-- total_budget: Legacy column (can be removed later)
-- monthly: Monthly budget limit
-- weekly: Weekly budget limit  
-- savings_goal: Target savings amount
