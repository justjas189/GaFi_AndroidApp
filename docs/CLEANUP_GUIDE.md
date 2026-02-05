# MoneyTrack Cleanup Guide

This document identifies files and folders that should be removed or reorganized before pushing to GitHub.

## Files to DELETE (Temporary/Development Only)

### Root Level - Test & Debug Files
- [ ] `.env copy` - Duplicate env file
- [ ] `App_MINIMAL.js` - Test/backup version
- [ ] `convert_logo.py` - One-time script
- [ ] `create_app_icons.py` - One-time script  
- [ ] `create_logo_png.py` - One-time script
- [ ] `debug_import_test.js` - Debug file
- [ ] `syntax_test.js` - Test file
- [ ] `test_food_query.mjs` - Test file
- [ ] `test_nlp_enhancements.js` - Test file
- [ ] `test_nlp_enhancements.mjs` - Test file
- [ ] `test_simple.mjs` - Test file
- [ ] `IMPORT_PATH_VERIFICATION.js` - Debug file
- [ ] `mascot_backend.py` - Duplicate of backend/mascot.py
- [ ] `run_migration.mjs` - One-time migration script
- [ ] `TestPiggyBankScreen.js` - Test file
- [ ] `test-navigation.sh` - Test script
- [ ] `email-confirmation.html` - Template (move to docs or templates)
- [ ] `supabase-signup-email-template.html` - Template (move to docs or templates)
- [ ] `setup_friends_system.sql` - Duplicate of supabase migrations
- [ ] `Table_Schema.pdf` - Move to docs

### Folders to Review
- [ ] `Test/` - Empty test folder, can be deleted
- [ ] `Confirm_Email/` - Contains single HTML file, can be merged
- [ ] `MoneyTrack/` - Appears to be unused Expo template (evaluate if needed)

## Documentation Files to MOVE to `docs/` folder

- [ ] `AUTHENTICATION_ENHANCEMENT.md`
- [ ] `DATABASE_SCHEMA_ANALYSIS.md`
- [ ] `EMAIL_CONFIRMATION_SETUP.md`
- [ ] `FIXES_APPLIED_SUMMARY.md`
- [ ] `FIX_DATABASE_ERRORS.md`
- [ ] `FRIENDS_DATABASE_FIX.md`
- [ ] `FRIENDS_FEATURE_INTEGRATION.md`
- [ ] `FRIENDS_MIGRATION_GUIDE.md`
- [ ] `IMPLEMENTATION_GUIDE.md`
- [ ] `IMPLEMENTATION_STATUS.md`
- [ ] `IMPORT_FIX_SUMMARY.md`
- [ ] `INTEGRATION_COMPLETE.md`
- [ ] `LEADERBOARD_SETUP.md`
- [ ] `LOGIN_HANGING_FINAL_FIX.md`
- [ ] `LOGIN_HANGING_FIX.md`
- [ ] `LONG_NAME_LAYOUT_FIX.md`
- [ ] `MASCOT_SETUP.md`
- [ ] `MODAL_CHAT_IMPLEMENTATION.md`
- [ ] `MONT_DRAGGABLE_BUBBLE_IMPLEMENTATION.md`
- [ ] `MONT_ENHANCEMENT_SUMMARY.md`
- [ ] `PASSWORD_RESET_FIX.md`
- [ ] `PRODUCTION_DEPLOYMENT.md`
- [ ] `REBRANDING_SUMMARY.md`
- [ ] `SAVINGS_GOALS_TESTING.md`
- [ ] `SCHOOL_WIDE_IMPLEMENTATION_GUIDE.md`
- [ ] `SETTINGS_LOGOUT_FIX.md`
- [ ] `SETUP_6_DIGIT_RESET.md`
- [ ] `SUPABASE_6_DIGIT_SETUP.md`
- [ ] `USER_TYPE_FEATURE.md`

## Game Assets to REORGANIZE

Move `Mall/` and `School/` folders into `assets/Game_Graphics/Maps/`:
```
assets/
  Game_Graphics/
    Maps/
      Mall/
      School/
```

## Recommended Final Structure

```
MoneyTrack-Android/
├── .gitignore
├── .env.example          # Template for environment variables
├── App.js                # Main app entry
├── app.json              # Expo config
├── babel.config.js
├── eas.json              # EAS Build config
├── index.js
├── package.json
├── README.md             # Main documentation
├── tsconfig.json
│
├── assets/               # All static assets
│   ├── Game_Graphics/
│   │   ├── Maps/
│   │   │   ├── Mall/
│   │   │   └── School/
│   │   └── Character_Animation/
│   ├── mascot/
│   ├── mont/
│   └── icons/
│
├── backend/              # Python backend for AI features
│   ├── app.py
│   ├── mascot.py
│   ├── requirements.txt
│   └── .env.example
│
├── docs/                 # All documentation
│   ├── setup/
│   ├── features/
│   └── troubleshooting/
│
├── scripts/              # Build/migration scripts
│   └── migrations/
│
├── src/                  # Main source code
│   ├── components/       # Reusable UI components
│   ├── config/           # App configuration
│   ├── context/          # React contexts
│   ├── hooks/            # Custom React hooks
│   ├── navigation/       # Navigation setup
│   ├── screens/          # Screen components
│   ├── services/         # API/database services
│   └── utils/            # Utility functions
│
└── supabase/             # Database migrations
    └── migrations/
```

## Commands to Execute Cleanup

Run these commands in PowerShell from the project root:

```powershell
# Create docs folder
New-Item -ItemType Directory -Path "docs" -Force

# Move documentation files
$docs = @(
    "AUTHENTICATION_ENHANCEMENT.md",
    "DATABASE_SCHEMA_ANALYSIS.md",
    "EMAIL_CONFIRMATION_SETUP.md",
    # ... (add all .md files except README.md)
)
foreach ($doc in $docs) {
    if (Test-Path $doc) { Move-Item $doc "docs/" }
}

# Remove temporary files
$tempFiles = @(
    ".env copy",
    "App_MINIMAL.js",
    "convert_logo.py",
    "create_app_icons.py",
    "create_logo_png.py",
    "debug_import_test.js",
    "syntax_test.js",
    "test_food_query.mjs",
    "test_nlp_enhancements.js",
    "test_nlp_enhancements.mjs",
    "test_simple.mjs",
    "IMPORT_PATH_VERIFICATION.js",
    "mascot_backend.py",
    "run_migration.mjs",
    "TestPiggyBankScreen.js",
    "test-navigation.sh"
)
foreach ($file in $tempFiles) {
    if (Test-Path $file) { Remove-Item $file }
}

# Remove empty Test folder
if (Test-Path "Test") { Remove-Item "Test" -Recurse }
```
