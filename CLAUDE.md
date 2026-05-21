# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Installation & Setup:**
- `npm install` - Install project dependencies
- `cp .env.example .env` - Create environment file (add Supabase and API keys)
- For backend: `cd backend && pip install -r requirements.txt`

**Running the Application:**
- `npx expo start` - Start Expo development server
  - Press `a` to run on Android emulator
  - Press `i` to run on iOS simulator  
  - Scan QR code with Expo Go app on physical device
- `npm run android` - Build and run on Android
- `npm run ios` - Build and run on iOS
- `npm run web` - Start web version

**Backend Services:**
- From project root: `cd backend && python app.py` - Start Flask API server for AI features

**Environment Variables:**
Create `.env` file with:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_NVIDIA_API_KEY=your_nvidia_nim_api_key
ONESIGNAL_APP_ID=your_onesignal_app_id
```

## Project Architecture

**Core Structure:**
- `App.js` - Application entry point
- `src/` - Main source code organized by concern:
  - `components/` - Reusable UI components (gamification subfolder for game-specific elements)
  - `config/` - Supabase and NVIDIA AI configuration
  - `context/` - React contexts (Auth, Data, Theme)
  - `hooks/` - Custom React hooks
  - `navigation/` - React Navigation setup (stack and tab navigators)
  - `screens/` - Screen components organized by feature:
    - `auth/` - Login, SignUp, Password Recovery screens
    - `main/` - Core app screens (Home, Game, Expenses, Settings)
    - `onboarding/` - Budget setup and user preference screens
  - `services/` - API and database services (Supabase integration)
  - `utils/` - Utility functions and helpers
- `assets/` - Static assets (game graphics, character animations, mascot images)
- `backend/` - Python Flask backend for AI mascot functionality:
  - `app.py` - Main API server
  - `mascot.py` - AI chatbot logic using NVIDIA NIM
  - `requirements.txt` - Python dependencies
- `supabase/` - Database schema and migration files
- `docs/` - Additional documentation

**Key Technologies:**
- State Management: React Context API + AsyncStorage for persistence
- Navigation: React Navigation (stack and bottom tab navigators)
- Styling: NativeWind (Tailwind CSS for React Native)
- Data Visualization: React Native Chart Kit
- Calendar: React Native Calendars
- Backend: Supabase (PostgreSQL + Auth) + Python/Flask for AI services
- AI Features: NVIDIA NIM API for financial insights and recommendations
- Notifications: OneSignal for push notifications

**Game Mechanics Implementation:**
- XP system rewards financial behaviors (logging expenses, budget adherence, goal completion)
- Rank progression tied to accumulated XP
- Story Mode implements progressive financial education through three levels
- Custom Mode allows user-defined budgeting rules
- AI mascot (Koin) provides personalized advice via natural language chat
