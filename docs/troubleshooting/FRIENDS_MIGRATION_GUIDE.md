# Friends Feature Database Migration Guide

## Current Status

Your Friends feature has been successfully integrated into the app, but there are database function type mismatches that need to be fixed. The terminal output shows these specific errors:

```
ERROR  Database error getting friends list: {"code": "42804", "details": "Returned type character varying does not match expected type text in column 4.", "hint": null, "message": "structure of query does not match function result type"}
```

## What's Working ✅

1. **Navigation**: Friends screens are properly integrated into navigation
2. **UI Components**: FriendRequestsScreen and FriendsListScreen are working
3. **Overall Leaderboard**: Working with sample data fallbacks
4. **Error Handling**: Robust error handling prevents crashes

## What Needs Fixing ❌

1. **Database Functions**: PostgreSQL functions have type mismatches between varchar(30) and TEXT
2. **Friends Leaderboard**: Not loading due to function errors
3. **Friend Requests**: get_friend_requests function needs type casting

## How to Fix

### Option 1: Supabase Dashboard (Recommended)

1. **Open your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Apply the Migration**
   - Copy the entire contents of: `supabase/migrations/20250806_friends_system_fix.sql`
   - Paste it into the SQL Editor
   - Click "Run" to execute

### Option 2: Using the Migration Script

If you have the Supabase CLI set up:

```bash
cd "c:\Users\Jasper John\Desktop\MoneyTrack-Android"
npx supabase db reset --linked
# or
npx supabase migration up
```

### Option 3: Manual Function Updates

If you prefer to fix functions individually, here are the key fixes needed:

1. **Fix get_friend_requests function**:
```sql
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

## Testing After Migration

After applying the migration:

1. **Restart the app**: Press `r` in the terminal to reload
2. **Check terminal output**: Look for successful API calls
3. **Test Friends features**:
   - Navigate to LeaderboardScreen
   - Try switching between Overall and Friends tabs
   - Check for friend requests and friends list

## Current App Behavior

While the migration is pending:
- **Overall leaderboard**: Shows sample data (Top Saver, Money Master, Smart Spender)
- **Friends leaderboard**: Empty but won't crash
- **Navigation**: All Friends screens accessible
- **Error handling**: Graceful degradation with detailed logging

## Debug Information

The app logs show:
- ✅ User authentication working
- ✅ Overall leaderboard API calls succeeding 
- ❌ Friends-related RPC calls failing with type mismatches
- ✅ Sample data fallbacks working correctly

## Files Modified

1. `src/navigation/MainNavigator.js` - Added Friends screens
2. `src/services/FriendService.js` - Enhanced error handling
3. `src/screens/main/LeaderboardScreen.js` - Individual error handling
4. `supabase/migrations/20250806_friends_system_fix.sql` - Database fixes

## Next Steps

1. **Apply the database migration** using one of the methods above
2. **Test the Friends feature** after migration
3. **Add test users** to see real Friends leaderboard data
4. **Set up usernames** for users who need them for the Friends feature

The Friends feature integration is complete - you just need to apply the database migration to resolve the type casting issues!
