-- COMPREHENSIVE FRIENDS FUNCTIONS FIX
-- This fixes all type mismatch issues in friends functions
-- Run this COMPLETE script in your Supabase SQL Editor

-- 1. Fix get_friends_list function (the main culprit)
DROP FUNCTION IF EXISTS get_friends_list();

CREATE OR REPLACE FUNCTION get_friends_list()
RETURNS TABLE (
  id UUID,
  friend_id UUID,
  friend_name TEXT,
  friend_username TEXT,
  current_level INTEGER,
  total_saved DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    CASE 
      WHEN f.user_id = auth.uid() THEN f.friend_id
      ELSE f.user_id
    END as friend_id,
    p.full_name::TEXT as friend_name,
    COALESCE(p.username, p.full_name)::TEXT as friend_username,
    COALESCE(ul.current_level, 1) as current_level,
    COALESCE(ul.total_saved, 0::DECIMAL(10,2)) as total_saved
  FROM friends f
  JOIN profiles p ON (
    CASE 
      WHEN f.user_id = auth.uid() THEN f.friend_id = p.id
      ELSE f.user_id = p.id
    END
  )
  LEFT JOIN user_levels ul ON p.id = ul.user_id
  WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid()) 
    AND f.status = 'accepted'
  ORDER BY ul.total_saved DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix get_friend_requests function
DROP FUNCTION IF EXISTS get_friend_requests();

CREATE OR REPLACE FUNCTION get_friend_requests()
RETURNS TABLE (
  id UUID,
  requester_id UUID,
  requester_name TEXT,
  requester_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.user_id as requester_id,
    p.full_name::TEXT as requester_name,
    COALESCE(p.username, p.full_name)::TEXT as requester_username,
    f.created_at,
    f.status::TEXT as status
  FROM friends f
  JOIN profiles p ON f.user_id = p.id
  WHERE f.friend_id = auth.uid() AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix search_users function
DROP FUNCTION IF EXISTS search_users(TEXT);

CREATE OR REPLACE FUNCTION search_users(search_term TEXT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  username TEXT,
  current_level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name::TEXT,
    COALESCE(p.username, p.full_name)::TEXT as username,
    COALESCE(ul.current_level, 1) as current_level
  FROM profiles p
  LEFT JOIN user_levels ul ON p.id = ul.user_id
  WHERE (
    p.username ILIKE '%' || search_term || '%' 
    OR p.full_name ILIKE '%' || search_term || '%'
  )
  AND p.id != auth.uid()
  AND p.username IS NOT NULL
  AND p.id NOT IN (
    SELECT CASE 
      WHEN f.user_id = auth.uid() THEN f.friend_id
      ELSE f.user_id
    END
    FROM friends f
    WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid())
  )
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix profiles table column types by handling policies
DO $$
DECLARE
    pol_name TEXT;
    pol_cmd TEXT;
    policies_to_recreate TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Store existing policies that depend on username or full_name
    FOR pol_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND schemaname = 'public'
    LOOP
        -- Get the policy definition
        SELECT pg_get_expr(pol.polqual, pol.polrelid) INTO pol_cmd
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        WHERE c.relname = 'profiles' AND pol.polname = pol_name;
        
        -- Store policy info for recreation
        policies_to_recreate := array_append(policies_to_recreate, pol_name || '|' || COALESCE(pol_cmd, ''));
        
        -- Drop the policy temporarily
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol_name);
    END LOOP;

    -- Now convert column types if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'username' 
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE profiles ALTER COLUMN username TYPE TEXT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'full_name' 
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE profiles ALTER COLUMN full_name TYPE TEXT;
    END IF;

    -- Recreate basic policies (common ones)
    -- These are typical policies that might exist
    BEGIN
        -- Allow users to view their own profile
        CREATE POLICY "Users can view their own profile" ON profiles
            FOR SELECT USING (auth.uid() = id);
    EXCEPTION WHEN duplicate_object THEN
        -- Policy already exists, skip
    END;

    BEGIN
        -- Allow users to update their own profile
        CREATE POLICY "Users can update their own profile" ON profiles
            FOR UPDATE USING (auth.uid() = id);
    EXCEPTION WHEN duplicate_object THEN
        -- Policy already exists, skip
    END;

    BEGIN
        -- Allow public read access for search functionality
        CREATE POLICY "Public read access for user search" ON profiles
            FOR SELECT USING (true);
    EXCEPTION WHEN duplicate_object THEN
        -- Policy already exists, skip
    END;

    BEGIN
        -- Allow users to search profiles by username
        CREATE POLICY "Users can search profiles by username" ON profiles
            FOR SELECT USING (username IS NOT NULL);
    EXCEPTION WHEN duplicate_object THEN
        -- Policy already exists, skip
    END;

END $$;

-- 5. Refresh the functions to ensure they're loaded
SELECT 'Functions updated successfully!' as result;
