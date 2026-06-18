-- Migration: Sync the profiles table with every column the app queries.
-- Created: 2026-06-17
--
-- WHY: The base `profiles` table (NEW_COMPLETE_SCHEMA.sql) only defines
--   id, full_name, email, created_at, updated_at.
-- The client reads/writes additional columns that were each introduced in
-- separate later migrations (username, user_type, avatar_url) plus one that
-- had NO migration at all (onboarding_completed). If any of these are missing
-- on the live database, PostgREST rejects the request:
--   - GET  .../profiles?select=...,user_type,...  -> 400 (42703 undefined column)
--   - POST .../profiles?on_conflict=id            -> 400 (PGRST204 schema cache)
--
-- This migration is fully idempotent — safe to run repeatedly. It guarantees
-- the deployed schema matches the code so the 400s stop.

-- 1. username (Friends feature) — TEXT, UNIQUE, nullable (OAuth users may lack one).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- 2. user_type — 'student' | 'employee' | NULL.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_user_type'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT check_user_type
      CHECK (user_type IS NULL OR user_type IN ('student', 'employee'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

-- 3. avatar_url — OAuth profile picture URL.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 4. onboarding_completed — read in login(), written in markOnboardingComplete().
--    This column never had a migration; add it now.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- 4b. Backfill: accounts that predate this migration are already onboarded (the
--     column is brand new and defaults FALSE, which would wrongly re-route them
--     through onboarding). Mark them complete using a FIXED cutoff = the
--     migration date — NOT now(). A fixed cutoff is re-run safe: genuinely
--     un-onboarded users who sign up AFTER this date are never touched, so this
--     UPDATE stays idempotent even if the migration is replayed.
UPDATE public.profiles
SET onboarding_completed = TRUE
WHERE onboarding_completed = FALSE
  AND created_at < TIMESTAMPTZ '2026-06-17 00:00:00+00';

-- 5. Force PostgREST to reload its schema cache so the new columns are
--    immediately queryable without waiting for the periodic refresh.
NOTIFY pgrst, 'reload schema';
