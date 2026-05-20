-- Add app_mode discriminator for Story vs Custom expenses
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS app_mode text NOT NULL DEFAULT 'custom';

UPDATE public.expenses
SET app_mode = 'custom'
WHERE app_mode IS NULL;

ALTER TABLE public.expenses
  ADD CONSTRAINT IF NOT EXISTS expenses_app_mode_check
  CHECK (app_mode IN ('story', 'custom'));

CREATE INDEX IF NOT EXISTS idx_expenses_user_mode_date
  ON public.expenses (user_id, app_mode, date);

-- Update budget/alert triggers to ignore story expenses
CREATE OR REPLACE FUNCTION update_category_spent_amount()
RETURNS TRIGGER AS $$
DECLARE
  user_budget_id UUID;
  expense_user_id UUID;
  expense_category TEXT;
  expense_amount NUMERIC(12, 2);
  expense_mode TEXT;
BEGIN
  expense_user_id := COALESCE(NEW.user_id, OLD.user_id);
  expense_category := COALESCE(NEW.category, OLD.category);
  expense_amount := COALESCE(NEW.amount, OLD.amount, 0);
  expense_mode := COALESCE(NEW.app_mode, OLD.app_mode, 'custom');

  IF expense_mode = 'story' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO user_budget_id
  FROM budgets
  WHERE user_id = expense_user_id
    AND budget_period = 'monthly'
  LIMIT 1;

  IF user_budget_id IS NOT NULL THEN
    UPDATE budget_categories
    SET
      spent_amount = (
        SELECT COALESCE(SUM(amount), 0)
        FROM expenses
        WHERE user_id = expense_user_id
          AND category = expense_category
          AND app_mode = 'custom'
          AND date >= DATE_TRUNC('month', CURRENT_DATE)
      ),
      updated_at = NOW()
    WHERE budget_id = user_budget_id
      AND category_name = expense_category;

    INSERT INTO budget_categories (budget_id, category_name, allocated_amount, spent_amount)
    SELECT user_budget_id, expense_category, 0, expense_amount
    WHERE NOT EXISTS (
      SELECT 1 FROM budget_categories
      WHERE budget_id = user_budget_id
        AND category_name = expense_category
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_budget_alerts()
RETURNS TRIGGER AS $$
DECLARE
  category_limit DECIMAL(12, 2);
  total_spent DECIMAL(12, 2);
  user_budget_id UUID;
BEGIN
  IF NEW.app_mode = 'story' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO user_budget_id
  FROM budgets
  WHERE user_id = NEW.user_id
    AND budget_period = 'monthly'
  LIMIT 1;

  IF user_budget_id IS NOT NULL THEN
    SELECT
      bc.allocated_amount,
      bc.spent_amount
    INTO category_limit, total_spent
    FROM budget_categories bc
    WHERE bc.budget_id = user_budget_id
      AND bc.category_name = NEW.category;

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
            'You have exceeded your ' || NEW.category || ' budget by PHP ' || (total_spent - category_limit)
          ELSE
            'You have spent 80% of your ' || NEW.category || ' budget (PHP ' || total_spent || ' of PHP ' || category_limit || ')'
        END,
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
