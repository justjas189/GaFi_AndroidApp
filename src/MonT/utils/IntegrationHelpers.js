// Integration helpers for MonT Mascot System
// This file contains utilities to help integrate MonT across the app

/**
 * Helper functions to trigger contextual mascot reactions (Enhanced with Duo-inspired features)
 */
export const MascotIntegrationHelpers = {
  
  // Financial context reactions with Duo-style personality
  onBudgetExceeded: (mascot, overageAmount) => {
    mascot.triggerMascotReaction('BUDGET_WARNING', {
      customMessage: `MonT: WHOA! You're ₱${overageAmount?.toLocaleString()} over budget! Time to course-correct! �`,
      duration: 4000
    });
  },

  onSavingsGoalReached: (mascot, goalName, amount) => {
    mascot.triggerMascotReaction('GOAL_ACHIEVED', {
      customMessage: `MonT: LEGENDARY! You CRUSHED your ${goalName} goal of ₱${amount?.toLocaleString()}! 🏆`,
      duration: 5000,
      celebrationType: 'goal_achieved'
    });
  },

  onSavingsAdded: (mascot, amount, totalSaved) => {
    mascot.triggerMascotReaction('SAVINGS_ADDED', {
      customMessage: `MonT: BOOM! ₱${amount?.toLocaleString()} saved! Total treasure: ₱${totalSaved?.toLocaleString()}! 💰`,
      duration: 3000
    });
  },

  onGoodSpendingDay: (mascot, remainingBudget) => {
    mascot.triggerMascotReaction('DAILY_LOGIN', {
      customMessage: `MonT: SMART SPENDER! ₱${remainingBudget?.toLocaleString()} left - you're crushing it! 👍`,
      duration: 3000
    });
  },

  onEncouragementNeeded: (mascot) => {
    mascot.triggerMascotReaction('ENCOURAGEMENT_NEEDED', {
      customMessage: "MonT: Hey! CHAMPIONS don't quit! You're building AMAZING financial habits! 💪",
      duration: 4000
    });
  },

  // Duo-inspired streak reactions
  onStreakMilestone: (mascot, streakDays) => {
    const celebrationMessages = {
      7: `MonT: WEEK WARRIOR! 7-day streak is LEGENDARY! 🔥`,
      14: `MonT: TWO WEEKS! You're officially UNSTOPPABLE! 🚀`,
      30: `MonT: MONTH MASTER! 30 days of PURE DEDICATION! 👑`,
      100: `MonT: CENTURION! 100 days! You're in the HALL OF FAME! 🏆`
    };
    
    const message = celebrationMessages[streakDays] || `MonT: ${streakDays} DAYS! This streak is INCREDIBLE! 🔥`;
    
    mascot.triggerMascotReaction('STREAK_MILESTONE', {
      customMessage: message,
      duration: 5000,
      celebrationType: 'streak_milestone'
    });
  },

  onStreakDanger: (mascot, streakDays) => {
    mascot.triggerMascotReaction('STREAK_DANGER', {
      customMessage: `MonT: STREAK EMERGENCY! Don't lose those ${streakDays} days! Come back! �`,
      duration: 4000
    });
  },

  // Navigation context reactions with Duo personality
  onChatScreenOpen: (mascot) => {
    mascot.triggerMascotReaction('CHAT_STARTED', {
      customMessage: "MonT: Chat mode ACTIVATED! How can I help you WIN today? 💬",
      duration: 2500
    });
  },

  onHomeScreenOpen: (mascot, userStats) => {
    if (userStats?.currentStreak >= 7) {
      mascot.triggerMascotReaction('DAILY_LOGIN', {
        customMessage: `Amazing! ${userStats.currentStreak} day streak! You're on fire! 🔥`,
        duration: 3000
      });
    } else {
      mascot.triggerMascotReaction('APP_OPENED', {
        customMessage: "Welcome back! Let's check on your financial progress! 😊",
        duration: 2500
      });
    }
  },

  onGoalsScreenOpen: (mascot, goalsCount) => {
    if (goalsCount === 0) {
      mascot.triggerMascotReaction('ENCOURAGEMENT_NEEDED', {
        customMessage: "Ready to set your first savings goal? I'll help you every step of the way! 🎯",
        duration: 3000
      });
    } else {
      mascot.triggerMascotReaction('APP_OPENED', {
        customMessage: `You have ${goalsCount} active goal${goalsCount > 1 ? 's' : ''}! Let's check your progress! 📊`,
        duration: 3000
      });
    }
  },

  // Achievement reactions
  onFirstSavings: (mascot) => {
    mascot.triggerMascotReaction('SAVINGS_ADDED', {
      customMessage: "🎉 Your first savings entry! This is the beginning of something amazing! 🌟",
      duration: 4000
    });
  },

  onWeeklyGoal: (mascot) => {
    mascot.triggerMascotReaction('GOAL_ACHIEVED', {
      customMessage: "You hit your weekly savings target! Consistency is key! 📈",
      duration: 3000
    });
  },

  onLearningProgress: (mascot, topicsCompleted) => {
    mascot.triggerMascotReaction('TIP_REQUESTED', {
      customMessage: `Great job learning! You've completed ${topicsCompleted} financial topics! 🧠`,
      duration: 3000
    });
  },

  // Error/support reactions
  onError: (mascot, errorType = 'general') => {
    const messages = {
      network: "I'm having trouble connecting. Don't worry, I'll be back soon! 📶",
      data: "Something went wrong with your data. Let me help you fix this! 🔧",
      general: "Oops! Something unexpected happened. I'm here to help! 😅"
    };

    mascot.triggerMascotReaction('BUDGET_WARNING', {
      customMessage: messages[errorType] || messages.general,
      duration: 3000
    });
  },

  // Utility function to get contextual tips
  getContextualTip: (mascot, context) => {
    const tips = {
      budget: "💡 Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings!",
      savings: "💡 Even saving ₱20 a day adds up to ₱7,300 in a year!",
      goals: "💡 Break big goals into smaller milestones - it's more motivating!",
      spending: "💡 Wait 24 hours before big purchases - you might change your mind!",
      emergency: "💡 Start with ₱1,000 emergency fund, then build to 3-6 months expenses!"
    };

    mascot.triggerMascotReaction('TIP_REQUESTED', {
      customMessage: tips[context] || tips.savings,
      duration: 4000
    });
  }
};

/**
 * Configuration for mascot behavior in different screens
 */
export const MascotScreenConfig = {
  HomeScreen: {
    showFloating: true,
    position: 'bottom-right',
    autoGreeting: true,
    greetingDelay: 2000
  },
  
  SavingsGoalsScreen: {
    showFloating: true,
    position: 'bottom-right',
    autoGreeting: true,
    greetingDelay: 1500
  },
  
  ChatScreen: {
    showFloating: false, // Chat screen has integrated mascot
    showInHeader: true,
    autoGreeting: false
  },
  
  ExpenseScreen: {
    showFloating: true,
    position: 'bottom-right',
    autoGreeting: false
  },
  
  LearnScreen: {
    showFloating: true,
    position: 'bottom-right',
    autoGreeting: true,
    greetingDelay: 2500
  }
};

export default MascotIntegrationHelpers;
