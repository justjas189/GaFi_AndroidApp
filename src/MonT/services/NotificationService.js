// src/services/NotificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  static async initialize() {
    try {
      // Check if we're running on a physical device
      if (!Device.isDevice) {
        console.log('Notifications only work on physical devices');
        return false;
      }

      // Request permissions for both local and push notifications
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      });
      
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
      }

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('mont-reminders', {
          name: 'MonT Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2196F3',
          sound: true,
          description: 'Notifications from MonT for expense tracking reminders and alerts',
        });
      }

      // Get push token for EAS Build (production)
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: '0cffb8c4-017c-48c6-b442-da0d803548f4', // Your actual project ID from app.json
        });
        console.log('Push token obtained:', token.data);
        
        // Store the push token for server-side notifications
        await AsyncStorage.setItem('expo_push_token', token.data);
      } catch (tokenError) {
        console.log('Push token not available (likely in Expo Go):', tokenError.message);
        // This is expected in Expo Go, push notifications will work in EAS Build
      }

      console.log('Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  // Schedule daily expense tracking reminder with Duo-inspired personality (WORKS IN BOTH EXPO GO AND EAS BUILD)
  static async scheduleDailyExpenseReminder(hour = 18, minute = 0) {
    try {
      // Cancel existing reminder
      await this.cancelNotification('daily-expense-reminder');

      // Use proper trigger format for both Expo Go and EAS Build
      const trigger = {
        hour,
        minute,
        repeats: true,
      };

      // Duo-inspired message variations with MonT's personality
      const duoStyleMessages = [
        "MonT: The day is passing, you haven't tracked your expenses yet! 📊",
        "MonT: Your wallet misses you! Track your expenses now! 💸", 
        "MonT: Don't leave me hanging! Where are today's expenses? 🤔",
        "MonT: I'll wait... but your budget won't! Track those expenses! ⏰",
        "MonT: Your future self called - they want you to track expenses now! 📞",
        "MonT: These expenses won't track themselves! Let's go! 🚀",
        "MonT: Missing you! Come back and update your expenses! 🥺"
      ];

      const randomMessage = duoStyleMessages[Math.floor(Math.random() * duoStyleMessages.length)];

      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: 'daily-expense-reminder',
        content: {
          title: "MonT: Don't forget! 💰",
          body: randomMessage,
          data: {
            type: 'expense_reminder',
            mascot: 'mont',
            screen: 'Expenses',
            personality: 'duo_inspired'
          },
          categoryIdentifier: 'mont-reminders',
        },
        trigger,
      });

      // Save notification settings
      await AsyncStorage.setItem('expense_reminder_time', JSON.stringify({ hour, minute }));
      await AsyncStorage.setItem('expense_reminder_id', notificationId);

      console.log('Daily expense reminder scheduled for', `${hour}:${minute.toString().padStart(2, '0')}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling daily reminder:', error);
      throw error;
    }
  }

  // Schedule savings goal reminder with Duo-inspired urgency (WORKS IN BOTH EXPO GO AND EAS BUILD)
  static async scheduleSavingsReminder(goalName, targetDate, reminderDays = [1, 7]) {
    try {
      const notifications = [];
      
      for (const days of reminderDays) {
        const reminderDate = new Date(targetDate);
        reminderDate.setDate(reminderDate.getDate() - days);
        
        if (reminderDate > new Date()) {
          // Duo-inspired goal reminder messages
          const urgencyMessages = {
            1: [
              `MonT: URGENT! Your "${goalName}" goal deadline is TOMORROW! 🚨`,
              `MonT: Last chance! "${goalName}" goal ends in 24 hours! ⏰`,
              `MonT: Don't let me down! "${goalName}" deadline is tomorrow! 😤`
            ],
            7: [
              `MonT: Week warning! Your "${goalName}" goal needs attention! 📅`,
              `MonT: Time check! "${goalName}" goal deadline in 7 days! 🗓️`,
              `MonT: Still time to crush "${goalName}"! One week left! 💪`
            ]
          };

          const messages = urgencyMessages[days] || [`MonT: "${goalName}" goal deadline in ${days} days!`];
          const randomMessage = messages[Math.floor(Math.random() * messages.length)];
          
          const notificationId = await Notifications.scheduleNotificationAsync({
            identifier: `savings-reminder-${goalName}-${days}d`,
            content: {
              title: "MonT: Goal Reminder! 🎯",
              body: randomMessage,
              data: {
                type: 'savings_reminder',
                goalName,
                daysLeft: days,
                screen: 'Goals',
                personality: 'duo_inspired'
              },
              categoryIdentifier: 'mont-reminders',
            },
            trigger: reminderDate,
          });
          
          notifications.push(notificationId);
        }
      }

      return notifications;
    } catch (error) {
      console.error('Error scheduling savings reminder:', error);
      throw error;
    }
  }

  // Schedule budget warning notifications with Duo-style personality (IMMEDIATE NOTIFICATION)
  static async scheduleBudgetWarning(category, percentage, amount) {
    try {
      // Duo-inspired budget warnings with MonT's personality
      const duoStyleWarnings = {
        80: [
          `MonT: Whoa there! 80% of your ${category} budget is gone! 😅`,
          `MonT: Pump the brakes! You've used 80% of ${category} budget! 🛑`,
          `MonT: Warning signal! ${category} budget at 80%! 📊`
        ],
        90: [
          `MonT: RED ALERT! 90% of ${category} budget spent! 🚨`,
          `MonT: Danger zone! You're at 90% ${category} budget! ⚠️`,
          `MonT: Last 10%! Be careful with ${category} spending! �`
        ],
        100: [
          `MonT: BUDGET BROKEN! You overspent on ${category}! 💸`,
          `MonT: Oops! ${category} budget officially exceeded! 😱`,
          `MonT: Houston, we have a ${category} problem! 🚀💥`
        ]
      };

      const messages = duoStyleWarnings[percentage] || [`MonT: Budget alert for ${category}!`];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: `budget-warning-${category}-${percentage}`,
        content: {
          title: "MonT: Budget Alert! 💰",
          body: randomMessage,
          data: {
            type: 'budget_warning',
            category,
            percentage,
            amount,
            screen: 'Budget',
            personality: 'duo_inspired'
          },
          categoryIdentifier: 'mont-reminders',
        },
        trigger: null, // Immediate notification
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling budget warning:', error);
      throw error;
    }
  }

  // Schedule celebration notifications with Duo-style enthusiasm (IMMEDIATE NOTIFICATION)
  static async scheduleCelebration(type, message) {
    try {
      // Duo-inspired celebration messages with MonT's personality
      const duoStyleCelebrations = {
        goal_achieved: {
          title: "🎉 MonT: LEGENDARY! Goal Smashed! 🏆",
          messages: [
            message || "INCREDIBLE! You crushed that goal like a champion! 💪",
            message || "BOOM! Goal destroyed! You're unstoppable! 🚀",
            message || "AMAZING! That goal didn't stand a chance! ⭐",
            message || "FANTASTIC! You just leveled up your finances! 🔥"
          ]
        },
        streak_milestone: {
          title: "🔥 MonT: STREAK MASTER! On Fire! 🔥",
          messages: [
            message || "You're ON FIRE! This streak is incredible! 🔥",
            message || "STREAK LEGEND! Your consistency is paying off! 💪",
            message || "UNSTOPPABLE! This streak proves you're dedicated! ⚡",
            message || "STREAK HERO! You're building amazing habits! 🏆"
          ]
        },
        level_up: {
          title: "⭐ MonT: LEVEL UP! You're Evolving! 🚀",
          messages: [
            message || "LEVEL UP! Your financial game just got stronger! 💪",
            message || "EVOLUTION COMPLETE! You've reached a new level! ⭐", 
            message || "POWER UP! Your financial skills are growing! 🌟",
            message || "RANK UP! You're becoming a savings master! 🏆"
          ]
        }
      };

      const celebData = duoStyleCelebrations[type] || {
        title: "🎉 MonT: Great Job! 🎉",
        messages: [message || "You're doing amazing! Keep it up! 🌟"]
      };

      const randomMessage = celebData.messages[Math.floor(Math.random() * celebData.messages.length)];

      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: `celebration-${type}-${Date.now()}`,
        content: {
          title: celebData.title,
          body: randomMessage,
          data: {
            type: 'celebration',
            celebrationType: type,
            screen: 'Home',
            personality: 'duo_inspired',
            triggerAnimation: true // Flag for Lottie animations
          },
          categoryIdentifier: 'mont-reminders',
        },
        trigger: null, // Immediate notification
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling celebration:', error);
      throw error;
    }
  }

  // Schedule streak reminder notifications (Duo-inspired feature)
  static async scheduleStreakReminder(streakDays, lastActivityDate) {
    try {
      const hoursSinceLastActivity = (new Date() - new Date(lastActivityDate)) / (1000 * 60 * 60);
      
      // Only remind if user hasn't been active for more than 18 hours
      if (hoursSinceLastActivity < 18) return null;

      // Duo-inspired streak anxiety messages
      const streakMessages = [
        `MonT: Your ${streakDays}-day streak is in danger! Don't break it now! 🔥`,
        `MonT: STREAK ALERT! ${streakDays} days could be lost! Come back! 😰`,
        `MonT: I'm worried about your streak! ${streakDays} days of progress! 🥺`,
        `MonT: Your streak is crying! ${streakDays} days need protecting! 😢`,
        `MonT: DON'T ABANDON YOUR STREAK! ${streakDays} days is too good to lose! 🚨`
      ];

      const randomMessage = streakMessages[Math.floor(Math.random() * streakMessages.length)];

      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: `streak-reminder-${Date.now()}`,
        content: {
          title: "MonT: Streak in Danger! 🔥💔",
          body: randomMessage,
          data: {
            type: 'streak_reminder',
            streakDays,
            screen: 'Home',
            personality: 'duo_inspired_urgent'
          },
          categoryIdentifier: 'mont-reminders',
        },
        trigger: {
          seconds: 60 // Remind in 1 minute if still inactive
        },
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling streak reminder:', error);
      throw error;
    }
  }

  // Schedule "stern" encouragement notifications (Duo's signature style)
  static async scheduleSternEncouragement(reason = 'inactivity') {
    try {
      const sternMessages = {
        inactivity: [
          "MonT: I see what you're doing... (not tracking expenses) 👀",
          "MonT: Your wallet called. It's lonely without expense tracking! 📱",
          "MonT: These expenses won't track themselves... obviously! 🙄",
          "MonT: I'll just wait here... for your expense updates... ⏰",
          "MonT: Financial responsibility doesn't take days off! Neither should you! 💼"
        ],
        missed_goal: [
          "MonT: So... about that savings goal you're ignoring... 🤔",
          "MonT: Your goal is collecting dust! Time to blow it off! 🌪️",
          "MonT: Goals don't achieve themselves! Shocking, I know! 😏",
          "MonT: That goal is still waiting for your attention! 👂"
        ],
        overspending: [
          "MonT: We need to talk about your spending choices... 💸",
          "MonT: Your budget is crying! Can you hear it? 😢",
          "MonT: I'm not angry, just... disappointed in your spending! 😔",
          "MonT: Let's pretend that last purchase didn't happen... 🙈"
        ]
      };

      const messages = sternMessages[reason] || sternMessages.inactivity;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];

      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: `stern-encouragement-${reason}-${Date.now()}`,
        content: {
          title: "MonT: We Need to Chat... 🤨",
          body: randomMessage,
          data: {
            type: 'stern_encouragement',
            reason,
            screen: 'Home',
            personality: 'duo_inspired_stern'
          },
          categoryIdentifier: 'mont-reminders',
        },
        trigger: null, // Immediate notification
      });

      return notificationId;
    } catch (error) {
      console.error('Error scheduling stern encouragement:', error);
      throw error;
    }
  }

  // Get push token for server-side notifications (EAS BUILD ONLY)
  static async getPushToken() {
    try {
      const token = await AsyncStorage.getItem('expo_push_token');
      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Send push notification via server (for future server integration)
  static async sendPushNotification(token, title, body, data = {}) {
    try {
      const message = {
        to: token,
        sound: 'default',
        title,
        body,
        data,
        categoryId: 'mont-reminders',
      };

      // This would be sent to your server endpoint
      // For now, we'll just log it as a placeholder
      console.log('Push notification would be sent:', message);
      
      return message;
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  // Cancel specific notification
  static async cancelNotification(identifier) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log(`Notification ${identifier} cancelled`);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  // Cancel all notifications
  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  // Get all scheduled notifications
  static async getScheduledNotifications() {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Send instant notification for testing
  static async sendInstantNotification(title, body, data = {}) {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        identifier: `instant-${Date.now()}`,
        content: {
          title,
          body,
          data: {
            type: 'instant_test',
            timestamp: new Date().toISOString(),
            ...data
          },
          categoryIdentifier: 'mont-reminders',
        },
        trigger: null, // Send immediately
      });

      console.log('Instant notification sent:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error sending instant notification:', error);
      throw error;
    }
  }

  // Handle notification response
  static addNotificationResponseListener(handler) {
    return Notifications.addNotificationResponseReceivedListener(handler);
  }
}