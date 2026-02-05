# MoneyTrack - Personal Finance Management App

MoneyTrack is a mobile application built with React Native and Expo that helps users manage their personal finances effectively. With features like expense tracking, budget management, and financial insights, MoneyTrack makes it easy to stay on top of your financial goals.

## Features

- **User Authentication**
  - Secure login and registration
  - Password recovery
  - Terms and conditions agreement

- **Budget Management**
  - Set monthly budget goals
  - Track savings targets
  - Categorize expenses
  - Monitor spending limits by category

- **Expense Tracking**
  - Record daily expenses
  - Categorize transactions
  - View expense history
  - Generate spending reports

- **Calendar View**
  - Track expenses by date
  - View daily spending patterns
  - Plan future expenses

- **Note Taking**
  - Add financial notes
  - Track financial decisions
  - Store important reminders

- **Analytics**
  - Visual expense graphs
  - Category breakdown
  - Spending trends
  - Monthly overview

## Getting Started

### Prerequisites
- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/jasjohn9/MoneyTrack.git
\`\`\`

2. Navigate to the project directory:
\`\`\`bash
cd MoneyTrack
\`\`\`

3. Install dependencies:
\`\`\`bash
npm install
# or
yarn install
\`\`\`

4. Start the development server:
\`\`\`bash
npx expo start
\`\`\`

### Running the App

- Press 'a' to run on Android emulator
- Press 'i' to run on iOS simulator
- Scan the QR code with Expo Go app on your phone

## Project Structure

```
MoneyTrack-Android/
├── App.js                 # Main application entry point
├── app.json               # Expo configuration
├── package.json           # Dependencies and scripts
│
├── src/                   # Main source code
│   ├── components/        # Reusable UI components
│   │   └── gamification/  # Game-related components
│   ├── config/            # App configuration (Supabase, etc.)
│   ├── context/           # React contexts (Auth, Data, Theme)
│   ├── hooks/             # Custom React hooks
│   ├── navigation/        # Navigation setup
│   ├── screens/           # Screen components
│   │   ├── auth/          # Authentication screens
│   │   ├── main/          # Main app screens
│   │   └── onboarding/    # Onboarding screens
│   ├── services/          # API and database services
│   └── utils/             # Utility functions
│
├── assets/                # Static assets
│   ├── Game_Graphics/     # Game maps, sprites, animations
│   ├── mascot/            # MonT mascot images
│   └── mont/              # Additional mascot assets
│
├── backend/               # Python backend for AI features
│   ├── app.py             # Main Flask API
│   ├── mascot.py          # MonT AI chatbot
│   └── requirements.txt   # Python dependencies
│
├── supabase/              # Database migrations
│   └── migrations/        # SQL migration files
│
├── scripts/               # Build and migration scripts
│
└── docs/                  # Documentation
    ├── setup/             # Setup guides
    ├── features/          # Feature documentation
    └── troubleshooting/   # Fix guides
```

## Technologies Used

- React Native
- Expo
- React Navigation
- AsyncStorage
- React Native Safe Area Context
- React Native Screens
- React Native Calendars
- Expo Vector Icons

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## Acknowledgments

- Icons provided by Expo Vector Icons
- Calendar functionality by React Native Calendars
- Navigation system by React Navigation
