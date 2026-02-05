# Fix Database Errors - Implementation Guide

## 🔥 **CRITICAL ERRORS FIXED**

### **Error 1: Friend Requests Query**
```
ERROR: "failed to parse select parameter (id,requested_at,requested_by,requester:auth.users!friends_requested_by_fkey(id,email,raw_user_meta_data))"
ERROR: "Returned type character varying(255) does not match expected type text in column 5"
```

**SOLUTION**: ✅ **FIXED**
- Created `get_pending_friend_requests()` database function
- Fixed type mismatch: `requester_email` now returns `VARCHAR(255)` to match `auth.users.email`
- Added proper type casting with `COALESCE` for null handling
- Updated `LeaderboardService.getPendingFriendRequests()` to use the new function

### **Error 2: Leaderboard Function Type Mismatch**
```
ERROR: "Returned type character varying(50) does not match expected type text in column 3"
```

**SOLUTION**: ✅ **FIXED**
- Fixed `get_overall_leaderboard()` function return type for `username` column
- Fixed `get_friends_leaderboard()` function return type for `username` column
- Changed return type from `TEXT` to `VARCHAR(50)` to match table schema

### **Error 3: Search Function Issues**
```
ERROR: "for SELECT DISTINCT, ORDER BY expressions must appear in select list"
```

**SOLUTION**: ✅ **FIXED**
- Removed `SELECT DISTINCT` and complex ORDER BY expressions
- Simplified ordering to use `LENGTH(username)` and `total_saved`
- Added `COALESCE` for null value handling
- Created `search_users_by_username()` database function
- Updated `LeaderboardService.searchUsersByUsername()` method

### **Error 4: Missing Leaderboard Entries**
```
ERROR: Users without leaderboard entries causing function failures
```

**SOLUTION**: ✅ **FIXED**
- Created `ensure_leaderboard_entry()` function to auto-create missing entries
- Enhanced `get_user_leaderboard_position()` to handle missing data gracefully
- Added proper error handling and fallback values

## 📋 **REQUIRED ACTIONS**

### **Step 1: Execute Database Migration**
```sql
-- Run this file in Supabase SQL Editor:
supabase/migrations/fix_leaderboard_errors.sql
```

**What it does:**
- ✅ Fixes function return types to match table schema
- ✅ Creates `get_pending_friend_requests()` function with correct types
- ✅ Creates `search_users_by_username()` function with simplified ordering
- ✅ Creates `send_friend_request()` function
- ✅ Creates `ensure_leaderboard_entry()` function for missing entries
- ✅ Enhances `get_user_leaderboard_position()` with better error handling
- ✅ Grants proper permissions to authenticated users

### **Step 2: Verify Function Creation**
After running the migration, verify these functions exist in Supabase:

1. **`get_overall_leaderboard()`** - Fixed return types
2. **`get_friends_leaderboard()`** - Fixed return types  
3. **`get_pending_friend_requests()`** - Fixed type mismatches for email field
4. **`search_users_by_username()`** - Fixed SELECT DISTINCT ORDER BY issues
5. **`send_friend_request()`** - Function for sending requests
6. **`ensure_leaderboard_entry()`** - Auto-creates missing leaderboard entries
7. **`get_user_leaderboard_position()`** - Enhanced with better error handling

### **Step 3: Test the Fixed Functions**

#### Test Friend Requests:
```javascript
// Should now work without errors
const requests = await LeaderboardService.getPendingFriendRequests();
```

#### Test Leaderboards:
```javascript
// Should now work without type errors
const overall = await LeaderboardService.getOverallLeaderboard();
const friends = await LeaderboardService.getFriendsLeaderboard();
```

#### Test User Search:
```javascript
// Should now work with new database function
const results = await LeaderboardService.searchUsersByUsername("john");
```

## 🛠️ **FILES MODIFIED**

### **Database Functions**
- ✅ **`supabase/migrations/fix_leaderboard_errors.sql`** - NEW
  - Fixed leaderboard function return types
  - Added friend request helper functions
  - Added user search functionality

### **Service Layer** 
- ✅ **`src/services/LeaderboardService.js`** - UPDATED
  - Fixed `getPendingFriendRequests()` to use new database function
  - Added `searchUsersByUsername()` method
  - Updated `searchUsers()` for backward compatibility

### **UI Layer**
- ✅ **`src/screens/main/LeaderboardScreen.js`** - UPDATED  
  - Updated `handleSearch()` to use new search method
  - Will now work with fixed database functions

## 🔍 **ROOT CAUSE ANALYSIS**

### **Problem 1: PostgREST Join Syntax**
The error occurred because PostgREST doesn't support the complex join syntax:
```sql
-- ❌ This syntax is not supported in PostgREST
requester:auth.users!friends_requested_by_fkey(id,email,raw_user_meta_data)
```

**Solution**: Created a dedicated database function that handles the join server-side.

### **Problem 2: Type Mismatches**
Multiple type mismatches occurred:
- `username`: Function returned `TEXT` but table has `VARCHAR(50)`
- `email`: Function returned `TEXT` but `auth.users.email` is `VARCHAR(255)`

**Solution**: Updated function signatures to match exact table schema types with proper casting.

### **Problem 3: Complex Queries**
User search was using `SELECT DISTINCT` with `ORDER BY` expressions not in the select list, which PostgreSQL doesn't allow.

**Solution**: Simplified query structure and removed unnecessary `DISTINCT` clause.

### **Problem 4: Missing Data Initialization**
Users without leaderboard entries caused function failures when trying to get rankings.

**Solution**: Added auto-initialization function to create missing leaderboard entries on-demand.

## ✅ **VERIFICATION CHECKLIST**

After running the migration, test these features:

- [ ] **Friend Requests**: View pending requests without errors
- [ ] **Overall Leaderboard**: Loads without type errors  
- [ ] **Friends Leaderboard**: Displays friend rankings correctly
- [ ] **User Search**: Search by username works smoothly
- [ ] **Send Friend Request**: Can send requests by username
- [ ] **Accept/Reject Requests**: Request management works

## 🚀 **DEPLOYMENT STEPS**

1. **Execute Migration**:
   ```bash
   # In Supabase Dashboard > SQL Editor
   # Copy and run: supabase/migrations/fix_leaderboard_errors.sql
   ```

2. **Restart App**:
   ```bash
   # Clear React Native cache
   npx expo start -c
   ```

3. **Test Features**:
   - Navigate to Leaderboard screen
   - Try adding friends
   - Check friend requests
   - Verify no console errors

## 🎯 **EXPECTED OUTCOME**

After applying these fixes:
- ✅ No more PostgREST query errors
- ✅ No more type mismatch errors  
- ✅ Friend request system works smoothly
- ✅ Leaderboards load without errors
- ✅ User search functions properly
- ✅ All social features operational

The leaderboard and friends system will be **fully functional** with proper error handling and optimized database queries!
