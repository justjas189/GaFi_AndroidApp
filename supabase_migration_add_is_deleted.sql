-- Migration: Add soft-delete support and timestamp tracking to goals_custom_mode
-- Run this in your Supabase SQL Editor before deploying the app changes.

-- ═══════════════════════════════════════════════════════════════════
-- Goals: soft-delete flag and timestamps
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.goals_custom_mode
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE public.goals_custom_mode
  ADD COLUMN IF NOT EXISTS achieved_at timestamp with time zone NULL;

ALTER TABLE public.goals_custom_mode
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone NULL;

-- ═══════════════════════════════════════════════════════════════════
-- Savings: named accounts with location type
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.savings_accounts_custom_mode (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  location_type text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT savings_accounts_custom_mode_pkey PRIMARY KEY (id),
  CONSTRAINT savings_accounts_custom_mode_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_savings_accounts_custom_mode_user
  ON public.savings_accounts_custom_mode USING btree (user_id) TABLESPACE pg_default;

-- Link savings logs to the new accounts table
ALTER TABLE public.savings_logs_custom_mode
  ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES public.savings_accounts_custom_mode(id) ON DELETE CASCADE;
