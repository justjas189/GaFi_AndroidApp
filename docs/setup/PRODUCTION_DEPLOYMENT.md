# Production Deployment Guide for MoneyTrack

## 🔐 Environment Variables Setup

### For Development:
1. Copy `.env.example` to `.env`
2. Fill in your actual API keys in `.env`

### For Production:
1. Set up environment variables in your deployment platform
2. Use `.env.production` as a template
3. **NEVER** commit real API keys to version control

## 📱 Required Environment Variables

### Supabase (Database & Auth)
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_anon_key
```

### NVIDIA AI (Optional but recommended)
```
EXPO_PUBLIC_NVIDIA_API_KEY=your_nvidia_api_key
```

### Other APIs (Optional)
```
OPENROUTER_API_KEY=your_openrouter_key
DEEPSEEK_API_KEY=your_deepseek_key
```

## 🚀 Deployment Options

### 1. EAS Build (Recommended for Expo)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure for production
eas build:configure

# Build APK for Android
eas build -p android --profile production

# Build for iOS
eas build -p ios --profile production
```

### 2. Bare React Native Build
```bash
# Android APK
cd android && ./gradlew assembleRelease

# iOS Build (requires Xcode)
npx react-native run-ios --configuration Release
```

## 🔒 Security Checklist

- [ ] All API keys are stored as environment variables
- [ ] `.env` files are in `.gitignore`
- [ ] No hardcoded secrets in source code
- [ ] Supabase RLS (Row Level Security) is enabled
- [ ] NVIDIA API key has proper rate limits
- [ ] Production database is separate from development

## 📦 Build Configuration

### EAS Build Profile (eas.json)
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "your_production_supabase_url",
        "EXPO_PUBLIC_SUPABASE_KEY": "your_production_supabase_key",
        "EXPO_PUBLIC_NVIDIA_API_KEY": "your_production_nvidia_key"
      }
    }
  }
}
```

## 🔧 Pre-Deployment Steps

1. **Test with production environment variables**
2. **Verify all API connections work**
3. **Test authentication flow**
4. **Verify AI features work with production keys**
5. **Test on physical devices**
6. **Check app performance**

## 📱 App Store Deployment

### Google Play Store
1. Generate signed APK/AAB
2. Upload to Google Play Console
3. Set up app listing
4. Configure store presence

### Apple App Store
1. Build with Xcode or EAS
2. Upload to App Store Connect
3. Submit for review
4. Configure app metadata

## 🛡️ Production Monitoring

- Monitor API usage and limits
- Set up error tracking (Sentry, Bugsnag)
- Monitor Supabase usage
- Track app performance metrics

## 🆘 Troubleshooting

### Common Issues:
- **API keys not loading**: Check environment variable names
- **Supabase connection fails**: Verify URL and key
- **AI features not working**: Check NVIDIA API key and limits
- **Build fails**: Ensure all dependencies are installed

### Debug Commands:
```bash
# Check environment variables
npx expo config --type=public

# Test build locally
npx expo build:android --local
```

## 📞 Support

If you encounter issues:
1. Check this guide first
2. Verify environment variables
3. Test API connections individually
4. Check deployment platform logs
