# Friends Database Fix Instructions

## Problem
The Friends feature is experiencing database errors due to type mismatches in the PostgreSQL functions.

Error: `structure of query does not match function result type`

## Solution
Apply the database fix by running the SQL migration in your Supabase dashboard.

## Steps to Fix:

### 1. Open Supabase Dashboard
- Go to your Supabase project dashboard
- Navigate to SQL Editor

### 2. Run the Fix Migration
Copy and paste the contents of `supabase/migrations/20250806_friends_system_fix.sql` into the SQL Editor and execute it.

### 3. Verify the Fix
After running the migration:

1. Test the friends search functionality
2. Check friend requests loading
3. Verify friends list displays correctly

## What the Fix Does:

1. **Fixes Type Casting**: Adds explicit `::TEXT` casting for status fields
2. **Improves Error Handling**: Better fallback values with `COALESCE`
3. **Username Validation**: Ensures only users with usernames can be found
4. **Null Safety**: Handles cases where user_levels table might not exist yet

## Alternative: Manual Fix in SQL Editor

If you prefer to run the commands manually:

```sql
-- Fix get_friend_requests function
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
```

## After Applying the Fix

The Friends feature should work correctly with:
- ✅ Friend request loading
- ✅ Friends list display
- ✅ User search functionality
- ✅ Proper error handling

## Test the Fix

1. Open the app and navigate to Social tab
2. Try searching for users (you need a username set first)
3. Send a friend request
4. Check friend requests in the mail icon
5. Verify friends list loads properly

If you still see errors after applying this fix, please check:
1. Ensure the `user_levels` table exists (run `user_levels_fix.sql` if needed)
2. Verify your user has a username set in Settings → Profile
3. Check Supabase logs for any remaining issues
