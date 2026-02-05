# Configure Supabase for 6-Digit Password Reset Codes

## Step 1: Configure Supabase Auth Settings

1. Go to your Supabase Dashboard
2. Navigate to **Authentication > Settings**
3. Scroll down to **Auth Configuration**
4. Set the following:
   - **Enable email confirmations**: ON
   - **Enable password recovery**: ON

## Step 2: Update Email Template for Password Recovery

1. Go to **Authentication > Email Templates**
2. Select **Reset Password** template
3. Replace the email content with:

```html
<h2>Reset Your Password</h2>
<p>Hello,</p>
<p>You requested to reset your password for your MoneyTrack account.</p>
<p><strong>Your 6-digit verification code is:</strong></p>
<div style="font-size: 32px; font-weight: bold; color: #FF6B00; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0;">
  {{ .Token }}
</div>
<p>This code will expire in 1 hour.</p>
<p>If you didn't request this password reset, please ignore this email.</p>
<p>Best regards,<br>The MoneyTrack Team</p>
```

## Step 3: Configure OTP Settings

1. In **Authentication > Settings**
2. Scroll to **OTP Configuration**
3. Set:
   - **OTP expiry duration**: 3600 (1 hour)
   - **OTP length**: 6

## Step 4: Test the Flow

1. Use the "Forgot Password" screen in your app
2. Enter your email address
3. Check your email for the 6-digit code
4. Enter the code in the verification screen
5. Set your new password

## How It Works

- **Email Sending**: Uses Supabase's built-in `resetPasswordForEmail()`
- **Code Verification**: Uses Supabase's `verifyOtp()` with type 'recovery'
- **Password Update**: Uses Supabase's `updateUser()` after successful verification
- **6-Digit Code**: The `{{ .Token }}` in the email template shows the 6-digit code

## Benefits

- ✅ Uses Supabase's native authentication system
- ✅ Automatic code expiration (1 hour)
- ✅ Built-in security features
- ✅ No custom database functions needed
- ✅ Proper email delivery through Supabase
- ✅ Works with Supabase's rate limiting

The custom database functions are no longer needed - you can remove them if desired.
