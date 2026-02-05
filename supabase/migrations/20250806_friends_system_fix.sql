-- Fixed Friends System Schema
-- This fixes the type mismatch in get_friend_requests function

-- Drop and recreate the get_friend_requests function with proper casting
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
    p.full_name as requester_name,
    p.username as requester_username,
    f.created_at,
    f.status::TEXT as status
  FROM friends f
  JOIN profiles p ON f.user_id = p.id
  WHERE f.friend_id = auth.uid() AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the get_friends_list function for consistency
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
    p.full_name as friend_name,
    COALESCE(p.username, p.full_name) as friend_username,
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

-- Fix the search_users function as well
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
    p.full_name,
    COALESCE(p.username, p.full_name) as username,
    COALESCE(ul.current_level, 1) as current_level
  FROM profiles p
  LEFT JOIN user_levels ul ON p.id = ul.user_id
  WHERE (
    p.username ILIKE '%' || search_term || '%' 
    OR p.full_name ILIKE '%' || search_term || '%'
  )
  AND p.id != auth.uid()
  AND p.username IS NOT NULL  -- Only return users with usernames
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
