# Enhanced Authentication System Setup Guide

## Overview
This guide covers the enhanced authentication system with username support, allowing users to register with usernames and login with either email or username.

## New Features

### 🆔 **Enhanced Registration (SignUpScreen)**
- **Username Field**: Optional username field during registration
- **Real-time Validation**: Live username availability checking
- **Visual Feedback**: Icons showing username availability status
- **Smart Validation**: Format validation with helpful error messages
- **Optional Field**: Username is optional but recommended for social features

### 🔐 **Flexible Login (LoginScreen)**
- **Email or Username**: Users can login with either email or username
- **Automatic Resolution**: System automatically resolves username to email
- **Error Handling**: Clear error messages for invalid credentials
- **Backwards Compatible**: Existing email-only users can still login normally

### 🛡️ **Enhanced Security**
- **Database Functions**: Server-side username resolution and validation
- **Availability Checking**: Real-time username availability verification
- **Input Sanitization**: Proper validation and sanitization of inputs
- **RLS Policies**: Secure data access with Row Level Security

## Database Functions Added

### get_email_from_username()
```sql
-- Resolves username to email for login purposes
CREATE OR REPLACE FUNCTION get_email_from_username(p_username TEXT)
RETURNS TEXT AS $$
```
- **Purpose**: Converts username to email for Supabase Auth login
- **Security**: SECURITY DEFINER function with proper validation
- **Usage**: Called automatically during login process

### Enhanced Registration Support
- **Username Storage**: Usernames stored in both auth metadata and profiles table
- **Sync Function**: Automatic sync between profiles and leaderboards tables
- **Availability Check**: Real-time username availability verification

## File Changes

### 📱 **Frontend Updates**

#### SignUpScreen.js
- **New Field**: Username input with availability checking
- **Real-time Feedback**: Visual indicators for username status
- **Enhanced Validation**: Comprehensive form validation
- **Debounced Checking**: Efficient username availability checking
- **Optional Registration**: Username is optional but encouraged

#### LoginScreen.js
- **Flexible Input**: Accepts both email and username
- **Auto-resolution**: Automatically resolves username to email
- **Enhanced Error Handling**: Better error messages and handling
- **Resend Logic**: Smart email resend functionality

#### AuthContext.js
- **Enhanced Register**: Updated to accept optional username
- **Flexible Login**: Modified to handle email or username input
- **Profile Creation**: Automatic profile creation with username
- **Error Handling**: Improved error handling and messaging

### 🗄️ **Backend Updates**

#### add_username_to_profiles.sql
- **New Function**: `get_email_from_username()` for login resolution
- **Enhanced Permissions**: Proper function permissions for authenticated users
- **Login Support**: Database support for username-based login

## User Experience Flow

### 🆕 **New User Registration**
1. **Fill Form**: User enters name, email, password, and optional username
2. **Real-time Check**: Username availability checked as user types
3. **Visual Feedback**: Green checkmark for available, red X for taken
4. **Registration**: Account created with username stored in profile
5. **Verification**: Email verification process (unchanged)

### 🔓 **User Login**
1. **Flexible Input**: User can enter either email or username
2. **Auto-detection**: System detects if input is email (contains @) or username
3. **Resolution**: If username, system looks up corresponding email
4. **Authentication**: Normal Supabase auth process with resolved email
5. **Success**: User logged in regardless of input method

### 🔄 **Backwards Compatibility**
- **Existing Users**: Users without usernames can still login with email
- **Migration**: Existing users get auto-generated usernames
- **Social Features**: Username required for leaderboards and friends
- **Optional Setup**: Username setup prompted when accessing social features

## Setup Instructions

### 1. Database Migration
```sql
-- Execute the updated migration file
-- File: supabase/migrations/add_username_to_profiles.sql
```
- Run the complete migration script in Supabase SQL Editor
- This includes all username functionality and the new login resolution function

### 2. Test Registration Flow
1. **New Account**: Try creating account with username
2. **Availability Check**: Test username availability checking
3. **Visual Feedback**: Verify icons show correctly
4. **Optional Field**: Test registration without username
5. **Error Handling**: Test invalid username formats

### 3. Test Login Flow
1. **Email Login**: Test login with existing email
2. **Username Login**: Test login with username (no @ symbol)
3. **Error Cases**: Test invalid username/email combinations
4. **Mixed Cases**: Test various input formats

### 4. Integration Testing
1. **Social Features**: Verify username integration with leaderboards
2. **Profile Management**: Test username changes through settings
3. **Search Function**: Test user search by username
4. **Friend Requests**: Test sending friend requests by username

## Technical Implementation

### Frontend Logic
```javascript
// Registration with optional username
const result = await register(name, email, password, username || null);

// Login with email or username
const result = await login(emailOrUsername, password);
```

### Database Resolution
```sql
-- Username to email resolution for login
SELECT email FROM profiles WHERE LOWER(username) = LOWER(p_username);
```

### Validation Rules
- **Username Format**: 3-30 characters, alphanumeric + underscore
- **Uniqueness**: Enforced at database level
- **Optional**: Not required for basic app functionality
- **Social Requirement**: Required for leaderboards and friends

## Error Handling

### Registration Errors
- **Username Taken**: Clear message with suggestions to try different username
- **Invalid Format**: Helpful format requirements displayed
- **Availability Check Failed**: Graceful fallback to allow registration
- **Network Issues**: Proper error handling for offline scenarios

### Login Errors
- **Username Not Found**: Clear error message indicating invalid credentials
- **Email Resolution Failed**: Fallback to original input for error messaging
- **Invalid Credentials**: Consistent error message regardless of input type
- **Verification Required**: Proper handling of unverified accounts

## Security Considerations

### Input Validation
- **Server-side Validation**: All validation enforced at database level
- **SQL Injection Prevention**: Parameterized queries and validation
- **Rate Limiting**: Database constraints prevent spam attempts
- **Case Insensitive**: Username lookups are case-insensitive

### Privacy Protection
- **RLS Policies**: Proper Row Level Security for data access
- **Search Permissions**: Users can search usernames but not access private data
- **Function Security**: SECURITY DEFINER functions with proper access control
- **Data Minimization**: Only necessary data exposed through search functions

## Troubleshooting

### Common Issues
- **Username Availability Not Updating**: Check ProfileService implementation
- **Login with Username Fails**: Verify get_email_from_username function exists
- **Registration Errors**: Check database permissions for new functions
- **Visual Feedback Missing**: Verify ActivityIndicator and icons display correctly

### Debug Steps
1. **Check Database**: Verify all functions created successfully
2. **Test Functions**: Test database functions directly in Supabase
3. **Check Permissions**: Ensure proper GRANT statements executed
4. **Monitor Logs**: Check both client and Supabase logs for errors
5. **Test Isolation**: Test each component (registration, login, search) separately

Your enhanced authentication system is now ready with full username support for both registration and login!
