# 6-Digit Password Reset Setup Guide

## Overview
This guide helps you set up a 6-digit code system for password resets instead of email confirmation links.

## Database Setup

### 1. Run the Migration
Execute the SQL migration file in your Supabase SQL editor:
```sql
-- Run the contents of: supabase/migrations/password_reset_codes_system.sql
```

### 2. Set up Row Level Security (RLS)
Add these RLS policies in Supabase:

```sql
-- Enable RLS on the password_reset_codes table
ALTER TABLE password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Allow the service role to manage reset codes
CREATE POLICY "Service role can manage reset codes" ON password_reset_codes
FOR ALL USING (auth.role() = 'service_role');

-- Allow anon users to call the functions (needed for password reset)
GRANT EXECUTE ON FUNCTION generate_password_reset_code TO anon;
GRANT EXECUTE ON FUNCTION verify_password_reset_code TO anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_reset_codes TO service_role;
```

## Email Template Setup

### 1. Update Supabase Email Template
1. Go to **Authentication** → **Email Templates** in your Supabase dashboard
2. Select **Reset Password** template
3. Replace the template with:

```html
<h2>Reset Your Password</h2>
<p>You requested to reset your password for your MoneyTrack account.</p>
<p>Your 6-digit verification code is:</p>
<h1 style="font-size: 32px; letter-spacing: 8px; text-align: center; color: #4F46E5; font-family: monospace;">{{ .Token }}</h1>
<p>Enter this code in the MoneyTrack app to reset your password.</p>
<p>This code will expire in 1 hour.</p>
<p>If you didn't request this, please ignore this email.</p>
```

### 2. Configure SMTP Settings
Make sure you have proper SMTP settings configured in Supabase:
- Go to **Settings** → **Auth** → **SMTP Settings**
- Configure your email provider (Gmail, SendGrid, etc.)

## Environment Variables
Make sure you have these environment variables set:

```env
# In your .env file
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EXPO_PUBLIC_APP_URL=moneytrack://  # For deep linking
```

## Testing the Implementation

### 1. Test the Flow
1. Go to Forgot Password screen
2. Enter your email
3. Check your email for the 6-digit code
4. Enter the code in the VerifyResetCodeScreen
5. Set a new password

### 2. Verify Database Records
Check that codes are being created and marked as used:
```sql
SELECT * FROM password_reset_codes ORDER BY created_at DESC;
```

### 3. Test Code Expiration
Codes should expire after 1 hour and cannot be reused.

## Maintenance

### Cleanup Expired Codes
Set up a periodic cleanup job (you can use Supabase Edge Functions or a cron job):

```sql
SELECT cleanup_expired_reset_codes();
```

## Security Considerations

1. **Code Expiration**: Codes expire after 1 hour
2. **Single Use**: Each code can only be used once
3. **Rate Limiting**: Consider adding rate limiting to prevent spam
4. **HTTPS Only**: Ensure all communication is over HTTPS
5. **Code Complexity**: 6-digit numeric codes provide reasonable security for short-term use

## Troubleshooting

### Common Issues

1. **Email not received**:
   - Check SMTP configuration
   - Check spam folder
   - Verify email template is correctly set

2. **Code verification fails**:
   - Check if code has expired
   - Verify the email matches exactly
   - Check database for code existence

3. **Password update fails**:
   - Ensure service role key is correctly configured
   - Check user exists in auth.users table
   - Verify password meets requirements

### Debug Queries

```sql
-- Check recent codes for an email
SELECT * FROM password_reset_codes 
WHERE email = 'user@example.com' 
ORDER BY created_at DESC;

-- Check if a code is valid
SELECT * FROM password_reset_codes 
WHERE email = 'user@example.com' 
  AND code = '123456' 
  AND used = FALSE 
  AND expires_at > NOW();
```

## Features Included

✅ **6-digit code generation**
✅ **Email delivery with custom template**
✅ **Code verification**
✅ **Expiration handling (1 hour)**
✅ **Single-use codes**
✅ **Resend functionality**
✅ **Password strength validation**
✅ **Clean UI with themed components**
✅ **Auto-advance between input fields**
✅ **Cleanup of expired codes**
