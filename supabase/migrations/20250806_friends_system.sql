-- Friends System Schema
-- This migration adds tables and functions for the friend request and friendship system

-- Create friends table
CREATE TABLE IF NOT EXISTS friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure no duplicate friendships
  UNIQUE(user_id, friend_id),
  -- Ensure users can't friend themselves
  CHECK (user_id != friend_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);

-- Enable RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friends table
CREATE POLICY "Users can view their own friendships" ON friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" ON friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friend requests" ON friends
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friendships" ON friends
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Function to send friend request
CREATE OR REPLACE FUNCTION send_friend_request(
  friend_username TEXT
)
RETURNS JSON AS $$
DECLARE
  friend_user_id UUID;
  existing_request INTEGER;
  result JSON;
BEGIN
  -- Get friend's user ID from username
  SELECT p.id INTO friend_user_id
  FROM profiles p
  WHERE p.username = friend_username OR p.full_name = friend_username;
  
  IF friend_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;
  
  -- Check if friendship already exists
  SELECT COUNT(*) INTO existing_request
  FROM friends
  WHERE (user_id = auth.uid() AND friend_id = friend_user_id)
     OR (user_id = friend_user_id AND friend_id = auth.uid());
  
  IF existing_request > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Friend request already exists'
    );
  END IF;
  
  -- Create friend request
  INSERT INTO friends (user_id, friend_id, status)
  VALUES (auth.uid(), friend_user_id, 'pending');
  
  RETURN json_build_object(
    'success', true,
    'message', 'Friend request sent successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to respond to friend request
CREATE OR REPLACE FUNCTION respond_to_friend_request(
  requester_id UUID,
  response TEXT
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Validate response
  IF response NOT IN ('accepted', 'rejected') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid response'
    );
  END IF;
  
  -- Update friend request
  UPDATE friends
  SET status = response, updated_at = NOW()
  WHERE user_id = requester_id AND friend_id = auth.uid() AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Friend request not found'
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Friend request ' || response
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get friend requests
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
    f.status
  FROM friends f
  JOIN profiles p ON f.user_id = p.id
  WHERE f.friend_id = auth.uid() AND f.status = 'pending'
  ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get friends list
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
    p.username as friend_username,
    COALESCE(ul.current_level, 1) as current_level,
    COALESCE(ul.total_saved, 0) as total_saved
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

-- Function to search users for adding friends
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
    p.username,
    COALESCE(ul.current_level, 1) as current_level
  FROM profiles p
  LEFT JOIN user_levels ul ON p.id = ul.user_id
  WHERE (
    p.username ILIKE '%' || search_term || '%' 
    OR p.full_name ILIKE '%' || search_term || '%'
  )
  AND p.id != auth.uid()
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

-- Add username column to profiles if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
    ALTER TABLE profiles ADD COLUMN username TEXT UNIQUE;
  END IF;
END $$;
