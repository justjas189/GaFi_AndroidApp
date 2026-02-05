# Fix for Password Reset "Invalid or expired code" Error

## Problem
The issue was caused by:
1. Using two different code systems (custom 6-digit vs Supabase built-in tokens)
2. The verification function marking codes as "used" immediately, causing double-verification failures

## Solution

### Step 1: Run the Updated Database Functions
Copy and paste the contents of `fix_password_reset_functions.sql` into your Supabase SQL Editor and run it.

This creates two new functions:
- `check_password_reset_code()` - Verifies code without marking as used
- `verify_and_use_password_reset_code()` - Verifies and marks code as used (for final reset)

### Step 2: Test the Flow
1. Use the "Forgot Password" screen to generate a code
2. In development mode, you'll see the code in an Alert dialog
3. Enter the code and new password in the verification screen
4. The code will be verified and used only once during the final password reset

### Key Changes Made:
1. **AuthContext.js**: 
   - Removed conflicting Supabase email sending
   - Updated to use new database functions
   - Fixed double-verification issue

2. **VerifyResetCodeScreen.js**:
   - Removed separate verification step
   - Now calls `resetPassword` directly

3. **Database Functions**:
   - Added `check_password_reset_code()` for safe verification
   - Added `verify_and_use_password_reset_code()` for final use

### Development Testing:
- In development mode, generated codes are shown in Alert dialogs
- Check console logs for detailed flow information
- Codes expire after 1 hour

### Production Setup:
- You'll need to integrate with an email service (SendGrid, AWS SES, etc.)
- Remove the development Alert dialogs
- Configure proper email templates

The error should now be resolved!
