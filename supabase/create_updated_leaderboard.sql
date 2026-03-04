-- ============================================================
-- STEP 1: Create the updated_leaderboard table
-- ============================================================
-- This table stores pre-aggregated leaderboard data from
-- user_achievements + profiles so all users can read it.

CREATE TABLE IF NOT EXISTS public.updated_leaderboard (
  user_id uuid NOT NULL,
  username varchar(100) NOT NULL DEFAULT '',
  full_name varchar(255) NOT NULL DEFAULT '',
  total_points integer NOT NULL DEFAULT 0,
  achievements_count integer NOT NULL DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT updated_leaderboard_pkey PRIMARY KEY (user_id),
  CONSTRAINT updated_leaderboard_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Index for fast ordering
CREATE INDEX IF NOT EXISTS idx_updated_leaderboard_total_points
  ON public.updated_leaderboard (total_points DESC);

-- ============================================================
-- STEP 2: Enable RLS but allow ALL authenticated users to read
-- ============================================================
ALTER TABLE public.updated_leaderboard ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can read the full leaderboard
CREATE POLICY "Anyone can view leaderboard"
  ON public.updated_leaderboard
  FOR SELECT
  TO authenticated
  USING (true);

-- Only the system (triggers/functions) can insert/update/delete
-- via SECURITY DEFINER functions below

-- ============================================================
-- STEP 3: Create the refresh function (SECURITY DEFINER)
-- ============================================================
-- This function rebuilds the leaderboard from user_achievements + profiles.
-- SECURITY DEFINER means it runs with the function owner's privileges,
-- bypassing RLS on user_achievements.

CREATE OR REPLACE FUNCTION public.refresh_updated_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert aggregated data for every user that has achievements
  INSERT INTO public.updated_leaderboard (user_id, username, full_name, total_points, achievements_count, last_updated)
  SELECT
    ua.user_id,
    COALESCE(p.username, ''),
    COALESCE(p.full_name, p.username, ''),
    COALESCE(SUM(ua.points), 0)::integer,
    COUNT(ua.id)::integer,
    now()
  FROM public.user_achievements ua
  LEFT JOIN public.profiles p ON p.id = ua.user_id
  GROUP BY ua.user_id, p.username, p.full_name
  ON CONFLICT (user_id)
  DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    total_points = EXCLUDED.total_points,
    achievements_count = EXCLUDED.achievements_count,
    last_updated = now();

  -- Remove users who no longer have any achievements
  DELETE FROM public.updated_leaderboard
  WHERE user_id NOT IN (SELECT DISTINCT user_id FROM public.user_achievements);
END;
$$;

-- ============================================================
-- STEP 4: Create trigger to auto-refresh on achievement changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_refresh_leaderboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_updated_leaderboard();
  RETURN NULL;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_refresh_leaderboard ON public.user_achievements;

CREATE TRIGGER trg_refresh_leaderboard
  AFTER INSERT OR UPDATE OR DELETE
  ON public.user_achievements
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_refresh_leaderboard();

-- ============================================================
-- STEP 5: Seed the table with current data
-- ============================================================
SELECT public.refresh_updated_leaderboard();

-- ============================================================
-- DONE! Verify it worked:
-- ============================================================
SELECT * FROM public.updated_leaderboard ORDER BY total_points DESC;
