# GaFi - Gamified Financial Intelligence

<p align="center">
  <img src="assets/MoneyTrack_Logo.png" alt="GaFi Logo" width="200"/>
</p>

GaFi (Gamified Finance) is an innovative mobile application that transforms personal finance management into an engaging, game-like experience. Built with React Native and Expo, GaFi helps users—especially students—learn financial literacy through interactive gameplay, AI-powered insights, and gamified challenges.

## 🎮 What Makes GaFi Different?

Unlike traditional finance apps, GaFi uses **gamification** to make budgeting fun and educational:
- **Play through Story Mode** to learn budgeting fundamentals
- **Earn XP and unlock achievements** for smart financial decisions
- **Customize your character** with unlockable skins from the in-game store
- **Compete with friends** on the leaderboard
- **Chat with MonT**, your AI financial mascot

## Features

### Gamified Learning Experience
- **Story Mode** - Three progressive levels teaching financial concepts:
  - **Level 1: Budget Basics** - Learn the 50/30/20 budgeting rule
  - **Level 2: Goal Setter** - Set and achieve savings goals
  - **Level 3: Super Saver** - Master saving 30% of your budget
- **Custom Mode** - Create your own budgeting rules and challenges
- **Interactive Dorm Map** - Navigate locations to manage expenses, visit the closet, and track spending

### Character & Customization
- **Multiple Characters** - Choose your avatar (Maya, Jasper, and more)
- **Unlockable Skins** - Earn XP and purchase character skins from the Store
- **Closet System** - Preview and equip your unlocked cosmetics

### Achievements & Progression
- **24+ Achievements** - Unlock badges for financial milestones
- **XP System** - Earn experience points for good financial habits
- **Rank Tiers** - Progress from "Rookie Tracker" to "Economy God"
- **Leaderboard** - Compete globally or with friends

### Koin - AI Financial Mascot
- **Personalized Advice** - Get AI-powered spending recommendations
- **Natural Language Chat** - Ask questions about your finances
- **Spending Analysis** - Receive insights based on your habits
- **Draggable Chat Bubble** - Access Koin from anywhere in the app

### 💰 Expense Management
- **Quick Expense Entry** - Log expenses via the Notebook in-game
- **Category Tracking** - Organize spending (Food, Transport, Shopping, etc.)
- **Budget Allocation** - Set limits for Needs, Wants, and Savings
- **"No Spend Day" Tracking** - Maintain streaks for spending-free days

### 📊 Analytics & Insights
- **AI-Powered Predictions** - Forecast next month's spending
- **Category Breakdown** - Visual pie charts and bar graphs
- **Spending Trends** - Track if you're improving over time
- **Monthly Comparisons** - See your progress month-over-month

### 📅 Calendar & History
- **Daily Expense View** - See spending by date
- **Pattern Recognition** - Identify spending habits
- **Historical Data** - Access complete transaction history

### 👥 Social Features
- **Friends System** - Add friends and track their progress
- **Friend Leaderboard** - Compete within your circle
- **Friend Requests** - Connect with other users

### 🎓 For Schools
- **School-Wide Mode** - Deploy GaFi across educational institutions
- **Teacher/Admin Features** - Monitor student financial literacy progress
- **Student Accounts** - Age-appropriate financial education

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or later)
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/justjas189/GaFi_AndroidApp.git
cd GaFi_AndroidApp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your Supabase and API keys
```

4. **Start the development server:**
```bash
npx expo start
```

### Running the App
- Press `a` to run on Android emulator
- Press `i` to run on iOS simulator
- Scan the QR code with Expo Go app on your phone

### Backend Setup (Optional - for AI features)
```bash
cd backend
pip install -r requirements.txt
python app.py
```

## 📁 Project Structure

```
GaFi_AndroidApp/
├── App.js                 # Main application entry point
├── app.json               # Expo configuration
├── package.json           # Dependencies and scripts
│
├── src/                   # Main source code
│   ├── components/        # Reusable UI components
│   │   └── gamification/  # Game-related components
│   ├── config/            # App configuration (Supabase, NVIDIA AI)
│   ├── context/           # React contexts (Auth, Data, Theme)
│   ├── hooks/             # Custom React hooks
│   ├── navigation/        # Navigation setup
│   ├── screens/           # Screen components
│   │   ├── auth/          # Login, SignUp, Password Recovery
│   │   ├── main/          # Home, Game, Expenses, Settings
│   │   └── onboarding/    # Budget setup, user preferences
│   ├── services/          # API and database services
│   └── utils/             # Utility functions
│
├── assets/                # Static assets
│   ├── Game_Graphics/     # Maps, sprites, character animations
│   ├── mascot/            # MonT mascot images
│   └── mont/              # Additional mascot assets
│
├── backend/               # Python backend for AI features
│   ├── app.py             # Flask API server
│   ├── mascot.py          # MonT AI chatbot logic
│   └── requirements.txt   # Python dependencies
│
├── supabase/              # Database schema
│   └── migrations/        # SQL migration files
│
└── docs/                  # Documentation
    ├── setup/             # Setup and deployment guides
    ├── features/          # Feature documentation
    └── troubleshooting/   # Bug fixes and solutions
```

## 🛠️ Tech Stack

### Frontend
- **React Native** - Cross-platform mobile framework
- **Expo** - Development and build toolchain
- **React Navigation** - Screen navigation
- **React Native Chart Kit** - Data visualization
- **React Native Calendars** - Calendar functionality

### Backend & Database
- **Supabase** - PostgreSQL database and authentication
- **NVIDIA NIM API** - AI-powered insights and recommendations
- **Flask** - Python backend for AI mascot

### State Management
- **React Context** - Global state (Auth, Data, Theme)
- **AsyncStorage** - Local data persistence

## 🎮 Game Mechanics

### XP System
| Action | XP Earned |
|--------|-----------|
| Log an expense | +5 XP |
| Stay under budget | +20 XP |
| Complete Story Mode level | +100 XP |
| Achieve savings goal | +50 XP |
| No-spend day | +10 XP |

### Rank Progression
| Rank | XP Required |
|------|-------------|
| 🌱 Rookie Tracker | 0 |
| 📝 Budget Apprentice | 100 |
| 🔍 Money Scout | 250 |
| ⚔️ Savings Warrior | 500 |
| 🛡️ Finance Knight | 1,000 |
| 🎯 Budget Master | 2,000 |
| 🏰 Wealth Guardian | 3,500 |
| 👑 Money Legend | 5,000 |
| 🧙 Financial Sage | 7,500 |
| ⭐ Economy God | 10,000 |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is developed for educational purposes as part of a capstone project.

## 🙏 Acknowledgments

- **NVIDIA** - NIM API for AI-powered insights
- **Supabase** - Backend infrastructure
- **Expo** - Development framework
- **React Native Community** - Open source libraries

---

<p align="center">
  <b>GaFi</b> - Making Financial Literacy Fun! 🎮💰
</p>
