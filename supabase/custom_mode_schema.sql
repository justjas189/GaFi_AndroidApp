-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  CustomModeDashboard — Supabase Schema                                     ║
-- ║  Run this entire block in the Supabase SQL Editor (one-shot).              ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝


-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
-- uuid-ossp is enabled by default on Supabase; this is a safety-net.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1.  budgets_custom_mode  (1-to-1 per user)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS budgets_custom_mode (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL UNIQUE
                           REFERENCES auth.users (id) ON DELETE CASCADE,
  total_income NUMERIC     NOT NULL DEFAULT 0,
  needs_pct    INTEGER     NOT NULL DEFAULT 50,
  wants_pct    INTEGER     NOT NULL DEFAULT 30,
  savings_pct  INTEGER     NOT NULL DEFAULT 20,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Business rule: savings can never drop below 20 %
  CONSTRAINT chk_savings_floor CHECK (savings_pct >= 20),

  -- Sanity: percentages must total 100
  CONSTRAINT chk_pct_total     CHECK (needs_pct + wants_pct + savings_pct = 100),

  -- Sanity: no negative percentages
  CONSTRAINT chk_pct_positive  CHECK (needs_pct >= 0 AND wants_pct >= 0)
);

-- Auto-update the updated_at timestamp on every row change
CREATE OR REPLACE FUNCTION update_budgets_custom_mode_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_budgets_custom_mode_updated ON budgets_custom_mode;
CREATE TRIGGER trg_budgets_custom_mode_updated
  BEFORE UPDATE ON budgets_custom_mode
  FOR EACH ROW
  EXECUTE FUNCTION update_budgets_custom_mode_timestamp();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2.  goals_custom_mode  (1-to-Many per user)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS goals_custom_mode (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES auth.users (id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  target_amount   NUMERIC     NOT NULL CHECK (target_amount > 0),
  current_amount  NUMERIC     NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date     DATE,
  is_completed    BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup for a user's goals (most-recent first)
CREATE INDEX IF NOT EXISTS idx_goals_custom_mode_user
  ON goals_custom_mode (user_id, created_at DESC);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3.  savings_logs_custom_mode  (1-to-Many per user)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS savings_logs_custom_mode (
  id        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID        NOT NULL
                        REFERENCES auth.users (id) ON DELETE CASCADE,
  amount    NUMERIC     NOT NULL CHECK (amount != 0),
  location  TEXT        NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only the three generic categories are legal
  CONSTRAINT chk_location_enum CHECK (
    location IN ('TRADITIONAL BANK', 'EWALLET', 'PHYSICAL SAVING')
  )
);

-- Fast lookup for a user's savings logs (most-recent first)
CREATE INDEX IF NOT EXISTS idx_savings_logs_custom_mode_user
  ON savings_logs_custom_mode (user_id, logged_at DESC);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4.  Row Level Security (RLS)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ── 4a.  budgets_custom_mode ────────────────────────────────────────────────

ALTER TABLE budgets_custom_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own budget"
  ON budgets_custom_mode FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget"
  ON budgets_custom_mode FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget"
  ON budgets_custom_mode FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget"
  ON budgets_custom_mode FOR DELETE
  USING (auth.uid() = user_id);


-- ── 4b.  goals_custom_mode ─────────────────────────────────────────────────

ALTER TABLE goals_custom_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals"
  ON goals_custom_mode FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON goals_custom_mode FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON goals_custom_mode FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON goals_custom_mode FOR DELETE
  USING (auth.uid() = user_id);


-- ── 4c.  savings_logs_custom_mode ───────────────────────────────────────────

ALTER TABLE savings_logs_custom_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own savings logs"
  ON savings_logs_custom_mode FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own savings logs"
  ON savings_logs_custom_mode FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings logs"
  ON savings_logs_custom_mode FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own savings logs"
  ON savings_logs_custom_mode FOR DELETE
  USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Done.  All three tables are ready with FK cascades, CHECK constraints,
-- auto-updating timestamps, indexes, and locked-down RLS policies.
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
