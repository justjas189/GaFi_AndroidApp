-- Add avatar_url to profiles so Google (and future OAuth) profile pictures
-- can be persisted and queried (leaderboard, friends list, etc.).
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.profiles.avatar_url IS
  'URL of the user avatar. Populated from the OAuth provider (e.g. Google user_metadata.avatar_url) on sign-in.';
