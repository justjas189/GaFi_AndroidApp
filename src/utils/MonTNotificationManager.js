// Global MonT Notification Manager
// Provides easy methods for any screen to trigger the draggable bubble notifications

import { useMascot } from '../MonT/context/MascotContext';
import { MASCOT_STATES, MASCOT_TRIGGERS } from '../MonT/constants/MascotStates';

// Hook for easy global MonT notifications
export const useMonTNotifications = () => {
  const mascot = useMascot();

  const notifications = {
    // Budget-related notifications
    budgetWarning: (overspent, category = 'Monthly Budget') => {
      const message = `🚨 ${category} exceeded by ₱${overspent.toFixed(2)}! Let's be more careful 💪`;
      mascot.showGlobalBubbleNotification(message, 4000, true);
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.BUDGET_WARNING, {
        customMessage: message,
        overspent,
        category
      });
    },

    budgetOnTrack: (remaining, daysLeft) => {
      const message = `✅ Great job! ₱${remaining.toFixed(2)} left for ${daysLeft} days! You're crushing it! 🎯`;
      mascot.showGlobalBubbleNotification(message, 3500, true);
    },

    dailyBudgetAlert: (spent, limit) => {
      const message = `💡 Daily spending: ₱${spent.toFixed(2)} of ₱${limit.toFixed(2)}. Stay strong! 💪`;
      mascot.showGlobalBubbleNotification(message, 3000, false);
    },

    // Goal-related notifications
    goalAchieved: (goalName, amount) => {
      const message = `🎉 GOAL ACHIEVED! ${goalName} - ₱${amount.toFixed(2)}! You're unstoppable! 🏆`;
      mascot.showGlobalBubbleNotification(message, 5000, true);
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.GOAL_ACHIEVED, {
        customMessage: message,
        goalName,
        amount
      });
    },

    goalProgress: (goalName, progress) => {
      const message = `🎯 ${goalName}: ${progress}% complete! Keep pushing! 🚀`;
      mascot.showGlobalBubbleNotification(message, 3000, false);
    },

    // Savings-related notifications
    savingsAdded: (amount, totalSaved) => {
      const message = `💰 +₱${amount.toFixed(2)} saved! Total: ₱${totalSaved.toFixed(2)}! Every peso counts! ⭐`;
      mascot.showGlobalBubbleNotification(message, 3500, true);
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.SAVINGS_ADDED, {
        customMessage: message,
        amount,
        totalSaved
      });
    },

    // Learning-related notifications
    lessonCompleted: (lessonName) => {
      const message = `📚 Lesson complete: ${lessonName}! Your financial IQ is growing! 🧠`;
      mascot.showGlobalBubbleNotification(message, 4000, true);
    },

    tipShared: (tip) => {
      const message = `💡 Pro tip: ${tip} 🎯`;
      mascot.showGlobalBubbleNotification(message, 4500, false);
    },

    // Achievement notifications
    streakMilestone: (days) => {
      const message = `🔥 ${days}-day streak! You're on fire! Keep the momentum! 🚀`;
      mascot.showGlobalBubbleNotification(message, 4000, true);
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.STREAK_MILESTONE, {
        customMessage: message,
        streak: days
      });
    },

    levelUp: (newLevel) => {
      const message = `🎉 LEVEL UP! You're now Level ${newLevel}! Amazing progress! ⭐`;
      mascot.showGlobalBubbleNotification(message, 5000, true);
    },

    // Daily notifications
    welcomeBack: (name) => {
      const message = `👋 Welcome back, ${name}! Ready to tackle your finances today? 💪`;
      mascot.showGlobalBubbleNotification(message, 3000, false);
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.DAILY_LOGIN, {
        customMessage: message
      });
    },

    dailyReminder: () => {
      const messages = [
        "💡 Don't forget to log today's expenses! Stay on track! 📝",
        "🎯 Quick reminder: Check your budget progress! You've got this! 💪",
        "⏰ Time for a quick financial check-in! Let's see how you're doing! 📊",
        "🌟 Remember your goals! Every small step counts! 🚀",
        "💰 Pro tip: Review yesterday's spending for better insights! 🧠"
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      mascot.showGlobalBubbleNotification(randomMessage, 4000, false);
    },

    // Encouragement notifications
    motivationalBoost: () => {
      const messages = [
        "💪 You're doing amazing! Financial freedom is within reach! 🎯",
        "🌟 Every peso saved is a step toward your dreams! Keep going! ✨",
        "🚀 Your dedication to budgeting is impressive! Stay strong! 💪",
        "🏆 Champions like you never give up! You've got this! 🔥",
        "⭐ Your future self will thank you for these smart choices! 🙌"
      ];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      mascot.showGlobalBubbleNotification(randomMessage, 4000, true);
    },

    // Custom notification
    custom: (message, duration = 3000, shouldPulse = false) => {
      mascot.showGlobalBubbleNotification(message, duration, shouldPulse);
    }
  };

  return notifications;
};

// Direct utility functions for quick usage
export const MonTNotificationManager = {
  // Quick budget alert
  budgetAlert: (mascot, overspent, category) => {
    const message = `🚨 ${category} exceeded by ₱${overspent.toFixed(2)}! Time to strategize! 💪`;
    mascot.showGlobalBubbleNotification(message, 4000, true);
  },

  // Quick celebration
  celebrate: (mascot, achievement) => {
    const message = `🎉 ${achievement}! You're absolutely incredible! 🏆`;
    mascot.showGlobalBubbleNotification(message, 5000, true);
  },

  // Quick tip
  showTip: (mascot, tip) => {
    const message = `💡 ${tip} 🎯`;
    mascot.showGlobalBubbleNotification(message, 4500, false);
  },

  // Quick encouragement
  encourage: (mascot) => {
    const encouragements = [
      "You're doing fantastic! Keep it up! 💪",
      "Every step forward counts! Stay strong! 🌟",
      "Your dedication is inspiring! 🚀",
      "Financial success is in your future! ⭐",
      "You've got this! Believe in yourself! 🔥"
    ];
    const message = encouragements[Math.floor(Math.random() * encouragements.length)];
    mascot.showGlobalBubbleNotification(message, 3500, true);
  }
};

export default useMonTNotifications;
