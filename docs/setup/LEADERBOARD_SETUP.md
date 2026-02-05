# Leaderboard System Setup Guide

## Overview
This guide will help you se## Features Included

### 🆔 **Username System**
- **Username Management**: Set and change usernames through dedicated UI
- **Smart Suggestions**: Auto-generated username suggestions based on user data
- **Real-time Validation**: Live username availability checking
- **Settings Integration**: Manage username from app settings
- **Required for Social**: Username required to access leaderboards and friend features

### 🏆 **Leaderboard System**
- **Overall Leaderboard**: Ranks all users by total savings and achievement points
- **Friends Leaderboard**: Shows rankings among connected friends only
- **User Position**: Displays current user's rank and nearby competitors
- **Real-time Updates**: Automatic updates when users add savings progress

### 👥 **Enhanced Social Features**
- **Friend Management**: Send, accept, and manage friend requests
- **Improved User Search**: Find users by username with display names
- **Profile-based Discovery**: Search through user profiles for better results
- **Friend Activity**: See friends' savings progress and achievements
- **Social Competition**: Compete with friends for better rankings

### 🎖️ **Achievement System**
- **Progress Tracking**: Achievements for various milestones
- **Point System**: Earn points for different accomplishments
- **Visual Indicators**: Badges and progress indicators
- **Motivation**: Gamified elements to encourage savingeaderboard system with social features for MoneyTrack, including the new username functionality that enables friend management.

## New Features Added

### 🆔 **Username System**
- **Username Column**: Added to profiles table with validation and uniqueness constraints
- **Username Setup Screen**: Interactive UI for setting/changing usernames
- **Automatic Username Generation**: Smart suggestions based on name/email
- **Validation**: Real-time username availability checking
- **Settings Integration**: Username management in app settings

### 🔍 **Enhanced Friend Search**
- **Profile-based Search**: Search users by username from profiles table
- **Better User Discovery**: Display names and usernames for easier identification
- **Fallback System**: Graceful degradation if profile search fails

## Database Setup

1. **Execute Username Migration**
   ```sql
   -- First run the username migration
   -- File: supabase/migrations/add_username_to_profiles.sql
   ```
   - Open Supabase SQL Editor
   - Copy and paste the contents of `supabase/migrations/add_username_to_profiles.sql`
   - Execute the script to add username support

2. **Execute Leaderboard Schema** 
   ```sql
   -- Then run the leaderboard schema
   -- File: supabase/leaderboard_schema.sql
   ```
   - Copy and paste the contents of `supabase/leaderboard_schema.sql`
   - Execute the script to create leaderboard tables and functions

3. **Verify Database Setup**
   After running both schemas, you should have:
   - `profiles` table with `username` column
   - `leaderboards` table for user rankings
   - `friends` table for friend relationships
   - `leaderboard_achievements` table for achievement system
   - Functions for username management and friend operations
   - RLS policies for data security

## New Database Features

### Username Management
- **`is_username_available()`**: Check if username is available
- **`update_user_username()`**: Safely update user's username
- **`send_friend_request()`**: Updated to use profiles table
- **Username Validation**: Format and uniqueness constraints
- **Auto-sync**: Username changes sync between profiles and leaderboards

### Database Functions
- **Username validation**: Alphanumeric + underscore, 3-30 characters
- **Availability checking**: Real-time availability verification
- **Auto-generation**: Smart username suggestions for new users
- **Conflict resolution**: Handles username conflicts gracefully

## Database Setup

1. **Execute Database Schema**
   - Open Supabase SQL Editor
   - Copy and paste the contents of `supabase/leaderboard_schema.sql`
   - Execute the script to create all necessary tables, functions, and policies

2. **Verify Database Setup**
   After running the schema, you should have these new tables:
   - `leaderboards` - User progress tracking
   - `friends` - Friend relationships
   - `leaderboard_achievements` - Achievement system
   - Various functions and triggers for automation

## Features Included

### 🏆 Leaderboard System
- **Overall Leaderboard**: Ranks all users by total savings and achievement points
- **Friends Leaderboard**: Shows rankings among connected friends only
- **User Position**: Displays current user's rank and nearby competitors
- **Real-time Updates**: Automatic updates when users add savings progress

### 👥 Social Features
- **Friend Management**: Send, accept, and manage friend requests
- **User Search**: Find other users by email or display name
- **Friend Activity**: See friends' savings progress and achievements
- **Social Competition**: Compete with friends for better rankings

### 🎖️ Achievement System
- **Progress Tracking**: Achievements for various milestones
- **Point System**: Earn points for different accomplishments
- **Visual Indicators**: Badges and progress indicators
- **Motivation**: Gamified elements to encourage saving

## Navigation Integration

The complete system has been integrated into your navigation:
- **Access**: Navigate from SavingsGoalsScreen using the podium icon in header
- **Username Check**: Automatically prompts for username setup if not set
- **Routes**: 
  - `navigation.navigate('Leaderboard')` - Main leaderboard screen
  - `navigation.navigate('UsernameSetup')` - Username management screen
- **Settings**: Username management available in app settings
- **Stack**: All screens added to MainNavigator

## How to Use

### For Users
1. **Set Username**: First-time users will be prompted to set username when accessing social features
2. **View Leaderboard**: Tap the podium icon in Savings Goals screen
3. **Manage Username**: Change username anytime through Settings > Username
4. **Add Friends**: Use the search function to find friends by username
5. **Send Requests**: Send friend requests to other MoneyTrack users
6. **Track Progress**: Monitor your ranking and achievements
7. **Compete**: View friends' progress and try to climb the rankings

### For Development
1. **Test Username Flow**: 
   - Create test accounts without usernames
   - Try accessing leaderboard to trigger username setup
   - Test username suggestions and validation
   - Verify username changes sync properly

2. **Test Social Features**:
   - Create multiple test accounts with usernames
   - Test friend request functionality between accounts
   - Verify leaderboard rankings work correctly
   - Test search functionality with various queries

3. **Customize Features**:
   - Modify username validation rules in migration file
   - Adjust username suggestions in ProfileService
   - Add new achievement types as needed
   - Customize leaderboard ranking algorithms

## File Structure

```
src/
├── services/
│   ├── LeaderboardService.js      # Social features and leaderboard logic
│   └── ProfileService.js          # Username management and profile operations
├── screens/main/
│   ├── LeaderboardScreen.js       # Complete leaderboard UI component
│   ├── UsernameSetupScreen.js     # Username setup and management UI
│   └── SettingsScreen.js          # Updated with username management
└── navigation/
    └── MainNavigator.js           # Updated with all new routes

supabase/
├── leaderboard_schema.sql         # Database schema and functions
└── migrations/
    └── add_username_to_profiles.sql # Username column and functions
```

## Key Components

### ProfileService.js
- **Purpose**: Handles username and profile operations
- **Features**: Username validation, availability checking, suggestions
- **Methods**: updateUsername, searchUsers, generateSuggestions, validateUsername

### UsernameSetupScreen.js
- **Purpose**: Interactive username setup and management
- **Features**: Real-time validation, suggestions, availability checking
- **Components**: Input validation, suggestion chips, requirements display

### LeaderboardService.js (Updated)
- **Purpose**: Handles all leaderboard operations with enhanced user search
- **Features**: Friend management, rankings, achievements, profile-based search
- **Methods**: Enhanced searchUsers method with profile table integration

### LeaderboardScreen.js
- **Purpose**: Complete React Native UI for leaderboards
- **Features**: Tabbed interface, search, friend management, achievements
- **Components**: Enhanced user search with usernames and display names

### add_username_to_profiles.sql
- **Purpose**: Database migration for username support
- **Features**: Column addition, validation, functions, RLS policies
- **Security**: Username uniqueness, format validation, search permissions

## Testing Checklist

- [ ] Execute add_username_to_profiles.sql in Supabase
- [ ] Execute leaderboard_schema.sql in Supabase
- [ ] Test username setup flow for new users
- [ ] Verify username validation and availability checking
- [ ] Test username suggestions generation
- [ ] Navigate to leaderboard from savings screen
- [ ] Test username requirement prompt for leaderboard access
- [ ] Create test accounts and set usernames
- [ ] Test friend request flow using usernames
- [ ] Verify leaderboard rankings update correctly
- [ ] Test user search by username functionality
- [ ] Check achievement system works
- [ ] Test username management through settings
- [ ] Verify privacy and RLS policies

## Next Steps

1. **Database Setup**: 
   - Execute add_username_to_profiles.sql in Supabase SQL Editor
   - Execute leaderboard_schema.sql in Supabase SQL Editor
2. **Test Username Flow**: Create account and test username setup process
3. **Test Social Features**: Create multiple accounts to test friend functionality
4. **Monitor Performance**: Check username search and leaderboard load times
5. **User Experience**: Ensure smooth flow from username setup to social features

## Troubleshooting

### Common Issues
- **Username Setup Not Appearing**: Check if add_username_to_profiles.sql was executed
- **Navigation Error**: Ensure UsernameSetupScreen is properly imported in MainNavigator
- **Database Error**: Verify all schema functions were created successfully
- **Friend Requests Not Working**: Check if username column exists in profiles table
- **Search Not Finding Users**: Verify users have usernames set
- **Rankings Not Updating**: Verify triggers and sync functions are working

### Debug Tips
- Check Supabase logs for database function errors
- Use React Native debugger for navigation and component issues
- Test with multiple user accounts for username conflicts
- Monitor console for ProfileService and LeaderboardService errors
- Verify RLS policies allow appropriate access to profiles table

## Security Features

- **Username Uniqueness**: Enforced at database level with unique constraints
- **Format Validation**: Server-side validation for username format requirements
- **RLS Policies**: Row Level Security for profile data access
- **Search Permissions**: Users can search usernames but not access private data
- **Input Sanitization**: Prevents SQL injection and malicious input
- **Rate Limiting**: Prevents spam through database constraints

## Troubleshooting

### Common Issues
- **Navigation Error**: Ensure LeaderboardScreen is properly imported in MainNavigator
- **Database Error**: Verify all schema functions were created successfully
- **Friend Requests Not Working**: Check RLS policies are enabled
- **Rankings Not Updating**: Verify triggers are functioning properly

### Debug Tips
- Check Supabase logs for database errors
- Use React Native debugger for component issues
- Test with multiple user accounts for social features
- Monitor console for service layer errors

## Additional Notes

- The leaderboard system is designed to encourage user engagement through social competition
- Privacy is maintained through Row Level Security policies
- The achievement system can be expanded with new milestone types
- Friend relationships are mutual (both users see each other as friends)
- Rankings are calculated based on total savings progress and achievement points

Your complete leaderboard system is now ready for testing and deployment!
