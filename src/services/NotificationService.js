// src/services/NotificationService.js
// Centralized local-notification service for GaFI (expo-notifications).
// Handles: Budget alerts, Level-up celebrations, Budget/term resets,
// Daily expense reminders, and notification preferences.
//
// Remote push (server-sent) is handled separately via Expo push tokens —
// see src/hooks/usePushNotifications.js + src/services/PushTokenService.js.
// The global foreground notification handler is set once in that hook.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';

// ─── Notification Preference Keys ───────────────────────────────────────────
const PREF_KEYS = {
  BUDGET_ALERTS: 'notif_pref_budget_alerts',
  LEVEL_UP: 'notif_pref_level_up',
  WEEKLY_CHECKIN: 'notif_pref_weekly_checkin',
  BUDGET_RESET: 'notif_pref_budget_reset',
  DAILY_REMINDER: 'notif_pref_daily_reminder',
  DAILY_REMINDER_TIME: 'notif_pref_daily_reminder_time',
  GOAL_DEADLINE: 'notif_pref_goal_deadline',
};

// ─── Budget Alert Thresholds ────────────────────────────────────────────────
const BUDGET_THRESHOLDS = {
  WARNING: 0.85,   // 85% — "Low Health" warning
  CRITICAL: 0.95,  // 95% — Critical
  EXCEEDED: 1.0,   // 100% — Over budget
};

// ─── Cooldown durations (ms) ────────────────────────────────────────────────
const COOLDOWNS = {
  budget_warning: 6 * 60 * 60 * 1000,   // 6 hours
  budget_critical: 3 * 60 * 60 * 1000,  // 3 hours
  budget_exceeded: 1 * 60 * 60 * 1000,  // 1 hour
  level_up: 5 * 60 * 1000,              // 5 minutes
};

class NotificationService {
  constructor() {
    this._lastAlertTimestamps = {};
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. BUDGET THRESHOLD ALERT  — "Low Health" Warning
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check budget percentages after an expense is logged.
   * If any category or overall budget crosses the threshold, fire an alert.
   *
   * @param {Object} budget   – { monthly, weekly, categories: { food: { limit, spent }, … } }
   * @param {number} newExpenseAmount – The amount just added
   * @param {string} newExpenseCategory – The category of the new expense (normalized)
   * @returns {Array} The triggered alerts ({ type, category, percentage, message })
   *   so callers can mirror them in-app (toast). Local notifications keep their
   *   cooldown; the returned array is pre-cooldown so in-app feedback always
   *   reflects the current budget state. Empty when opted out or on error.
   */
  async checkBudgetThresholds(budget, newExpenseAmount, newExpenseCategory) {
    try {
      const enabled = await this.getPreference(PREF_KEYS.BUDGET_ALERTS);
      if (enabled === false) return []; // User opted out

      const alerts = [];

      // ── Check individual category ──────────────────────────────────────
      const category = budget?.categories?.[newExpenseCategory];
      if (category && category.limit > 0) {
        const newSpent = (category.spent || 0) + newExpenseAmount;
        const pct = newSpent / category.limit;

        if (pct >= BUDGET_THRESHOLDS.EXCEEDED) {
          alerts.push({
            type: 'budget_exceeded',
            category: newExpenseCategory,
            percentage: Math.round(pct * 100),
            message: `🚨 Budget Busted! You've exceeded your ${this._formatCategory(newExpenseCategory)} budget! Time to regroup.`,
          });
        } else if (pct >= BUDGET_THRESHOLDS.CRITICAL) {
          alerts.push({
            type: 'budget_critical',
            category: newExpenseCategory,
            percentage: Math.round(pct * 100),
            message: `🔴 Critical! You've used ${Math.round(pct * 100)}% of your ${this._formatCategory(newExpenseCategory)} budget. Almost at the limit!`,
          });
        } else if (pct >= BUDGET_THRESHOLDS.WARNING) {
          alerts.push({
            type: 'budget_warning',
            category: newExpenseCategory,
            percentage: Math.round(pct * 100),
            message: `⚠️ Watch out! You've used ${Math.round(pct * 100)}% of your '${this._formatCategory(newExpenseCategory)}' budget for this level. Play it safe!`,
          });
        }
      }

      // ── Check overall monthly budget ───────────────────────────────────
      if (budget?.monthly > 0) {
        const totalSpent = Object.values(budget.categories || {}).reduce(
          (sum, cat) => sum + (cat.spent || 0), 0
        ) + newExpenseAmount;
        const overallPct = totalSpent / budget.monthly;

        if (overallPct >= BUDGET_THRESHOLDS.EXCEEDED && !alerts.find(a => a.type === 'budget_exceeded')) {
          alerts.push({
            type: 'budget_exceeded',
            category: 'overall',
            percentage: Math.round(overallPct * 100),
            message: `🚨 Budget Exceeded! You've gone over your monthly budget. Time to reassess your strategy!`,
          });
        } else if (overallPct >= BUDGET_THRESHOLDS.WARNING && !alerts.find(a => a.type === 'budget_warning')) {
          alerts.push({
            type: 'budget_warning',
            category: 'overall',
            percentage: Math.round(overallPct * 100),
            message: `⚠️ Watch out! You've used ${Math.round(overallPct * 100)}% of your monthly budget. Play it safe!`,
          });
        }
      }

      // ── Fire alerts (with cooldown) ────────────────────────────────────
      for (const alert of alerts) {
        const cooldownKey = `${alert.type}_${alert.category}`;
        if (this._isOnCooldown(cooldownKey)) continue;

        // Send a local notification
        await this._sendLocalNotification(
          alert.type === 'budget_exceeded' ? '🚨 Budget Exceeded!' :
          alert.type === 'budget_critical' ? '🔴 Budget Critical!' :
          '⚠️ Budget Warning',
          alert.message,
          { type: alert.type, category: alert.category }
        );

        this._markCooldown(cooldownKey, COOLDOWNS[alert.type] || COOLDOWNS.budget_warning);
        DebugUtils.log('NOTIF', 'Budget alert fired', alert);
      }

      return alerts;
    } catch (error) {
      DebugUtils.error('NOTIF', 'Error checking budget thresholds', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LEVEL UP CELEBRATION  (local notification)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fire a celebratory local notification when the user reaches a milestone.
   *
   * @param {string} milestoneType  – 'level_complete' | 'goal_reached' | 'achievement'
   * @param {Object} details        – { levelName?, goalName?, xpEarned?, badgeName? }
   */
  async sendLevelUpNotification(milestoneType = 'level_complete', details = {}) {
    try {
      const enabled = await this.getPreference(PREF_KEYS.LEVEL_UP);
      if (enabled === false) return;

      if (this._isOnCooldown('level_up')) return;

      let heading = '🎉 Level Complete!';
      let message = 'You successfully managed your Needs vs. Wants. Tap to claim your next challenge!';

      if (milestoneType === 'goal_reached' && details.goalName) {
        heading = '🎯 Goal Reached!';
        message = `You finally saved enough for ${details.goalName}! Amazing discipline!`;
      } else if (milestoneType === 'achievement' && details.badgeName) {
        heading = '🏆 Achievement Unlocked!';
        message = `You earned the "${details.badgeName}" badge! Keep up the great work!`;
      } else if (details.levelName) {
        message = `You completed "${details.levelName}"! ${details.xpEarned ? `+${details.xpEarned} XP earned. ` : ''}Tap to claim your next challenge!`;
      }

      await this._sendLocalNotification(heading, message, {
        type: 'level_up',
        milestoneType,
      });

      this._markCooldown('level_up', COOLDOWNS.level_up);
      DebugUtils.log('NOTIF', 'Level up notification sent', { milestoneType, details });
    } catch (error) {
      DebugUtils.error('NOTIF', 'Failed to send level up notification', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. NEW TERM / BUDGET RESET NOTIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Schedule a local notification for the budget reset date.
   * Call this after a budget is created/updated or at app startup.
   *
   * @param {'monthly'|'weekly'} cycle  – Budget cycle type
   * @param {Date} [lastResetDate]      – The date of the last reset (defaults to now)
   */
  async scheduleBudgetResetNotification(cycle = 'monthly', lastResetDate = new Date()) {
    try {
      const enabled = await this.getPreference(PREF_KEYS.BUDGET_RESET);
      if (enabled === false) {
        await this.cancelBudgetResetNotification();
        return;
      }

      // Cancel any existing reset notification first
      await this.cancelBudgetResetNotification();

      let trigger;
      if (cycle === 'monthly') {
        // Schedule for the 1st of the next month at 8:00 AM
        const nextMonth = new Date(lastResetDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(8, 0, 0, 0);

        // If the date is in the past, push to next month
        if (nextMonth <= new Date()) {
          nextMonth.setMonth(nextMonth.getMonth() + 1);
        }

        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextMonth
        };
      } else {
        // Weekly: schedule 7 days from the last reset at 8:00 AM
        const nextWeek = new Date(lastResetDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(8, 0, 0, 0);

        if (nextWeek <= new Date()) {
          nextWeek.setDate(nextWeek.getDate() + 7);
        }

        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nextWeek
        };
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💰 A New Cycle Begins!',
          body: cycle === 'monthly'
            ? 'Your monthly budget has been reset. Start fresh and make this month count!'
            : 'Your weekly budget has been reset. A new week, a new chance to save!',
          data: { type: 'budget_reset', cycle },
          sound: 'default',
        },
        trigger,
      });

      await AsyncStorage.setItem('budget_reset_notification_id', notificationId);
      await AsyncStorage.setItem('budget_reset_cycle', cycle);

      DebugUtils.log('NOTIF', 'Budget reset notification scheduled', {
        cycle,
        trigger,
        notificationId,
      });
    } catch (error) {
      DebugUtils.error('NOTIF', 'Failed to schedule budget reset notification', error);
    }
  }

  /**
   * Cancel any pending budget reset notification.
   */
  async cancelBudgetResetNotification() {
    try {
      const existingId = await AsyncStorage.getItem('budget_reset_notification_id');
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem('budget_reset_notification_id');
      }
    } catch (error) {
      DebugUtils.error('NOTIF', 'Failed to cancel budget reset notification', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DAILY EXPENSE REMINDER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Schedule a daily reminder to track expenses (local notification).
   *
   * @param {number} hour   – Hour (0-23), default 18 (6 PM)
   * @param {number} minute – Minute (0-59), default 0
   */
  async scheduleDailyReminder(hour = 18, minute = 0) {
    try {
      await this.cancelDailyReminder();

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📝 Time to Track!',
          body: "Don't forget to log today's expenses. Stay on top of your spending game!",
          data: { type: 'daily_reminder' },
          sound: 'default',
        },
        // SDK 54 requires a typed trigger. DAILY repeats every day at
        // hour:minute automatically — no `repeats` key (that legacy shape throws).
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      await AsyncStorage.setItem('expense_reminder_id', notificationId);
      await AsyncStorage.setItem(PREF_KEYS.DAILY_REMINDER, 'true');
      await AsyncStorage.setItem(PREF_KEYS.DAILY_REMINDER_TIME, JSON.stringify({ hour, minute }));

      DebugUtils.log('NOTIF', 'Daily reminder scheduled', { hour, minute, notificationId });
    } catch (error) {
      DebugUtils.error('NOTIF', 'Failed to schedule daily reminder', error);
    }
  }

  /**
   * Cancel the daily expense reminder.
   */
  async cancelDailyReminder() {
    try {
      const existingId = await AsyncStorage.getItem('expense_reminder_id');
      if (existingId) {
        await Notifications.cancelScheduledNotificationAsync(existingId);
        await AsyncStorage.removeItem('expense_reminder_id');
      }
      await AsyncStorage.setItem(PREF_KEYS.DAILY_REMINDER, 'false');
    } catch (error) {
      DebugUtils.error('NOTIF', 'Failed to cancel daily reminder', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a notification preference (boolean).
   * Returns true by default (opt-in).
   */
  async getPreference(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return true; // Default: enabled
      return value === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Set a notification preference.
   */
  async setPreference(key, enabled) {
    try {
      await AsyncStorage.setItem(key, enabled ? 'true' : 'false');
      DebugUtils.log('NOTIF', 'Preference updated', { key, enabled });
    } catch (error) {
      DebugUtils.error('NOTIF', 'Failed to set preference', error);
    }
  }

  /**
   * Get all notification preferences.
   */
  async getAllPreferences() {
    const prefs = {};
    for (const [name, key] of Object.entries(PREF_KEYS)) {
      prefs[name] = await this.getPreference(key);
    }

    // Also load daily reminder time
    try {
      const timeStr = await AsyncStorage.getItem(PREF_KEYS.DAILY_REMINDER_TIME);
      prefs.DAILY_REMINDER_TIME = timeStr ? JSON.parse(timeStr) : { hour: 18, minute: 0 };
    } catch {
      prefs.DAILY_REMINDER_TIME = { hour: 18, minute: 0 };
    }

    return prefs;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST / DEBUG HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a test notification for each type (useful from NotificationTestScreen).
   * Re-throws so the UI surfaces failures.
   */
  async sendTestNotification(type = 'budget_warning') {
    try {
      const testPayloads = {
        budget_warning: {
          title: '⚠️ Budget Warning (Test)',
          body: "Watch out! You've used 85% of your 'Wants' budget for this level. Play it safe!",
          data: { type: 'test_budget_warning' },
        },
        budget_critical: {
          title: '🔴 Budget Critical (Test)',
          body: "Critical! You've used 95% of your 'Food' budget. Almost at the limit!",
          data: { type: 'test_budget_critical' },
        },
        level_up: {
          title: '🎉 Level Complete! (Test)',
          body: 'You successfully managed your Needs vs. Wants. Tap to claim your next challenge!',
          data: { type: 'test_level_up' },
        },
        weekly_checkin: {
          title: '🤖 Koin AI Weekly Check-In (Test)',
          body: 'Koin AI has analyzed your spending this week. Tap here to see your personalized tip on how to save more next week!',
          data: { type: 'test_weekly_checkin' },
        },
        budget_reset: {
          title: '💰 A New Cycle Begins! (Test)',
          body: 'Your budget has been reset. Start fresh and make this cycle count!',
          data: { type: 'test_budget_reset' },
        },
        daily_reminder: {
          title: '📝 Time to Track! (Test)',
          body: "Don't forget to log today's expenses. Stay on top of your spending game!",
          data: { type: 'test_daily_reminder' },
        },
        goal_deadline: {
          title: '🎯 Goal Deadline Reminder (Test)',
          body: '⏰ 15 days left for "New Laptop"! Keep saving!',
          data: { type: 'test_goal_deadline' },
        },
      };

      const payload = testPayloads[type] ?? {
        title: '🔔 Test Notification',
        body: 'This is a test notification from GaFI!',
        data: { type: 'test' },
      };

      await Notifications.scheduleNotificationAsync({
        content: { ...payload, sound: 'default' },
        trigger: null,
      });

      DebugUtils.log('NOTIF', 'Test notification sent', { type });
    } catch (err) {
      DebugUtils.error('NOTIF', 'sendTestNotification failed', err);
      throw err; // Re-throw so NotificationTestScreen can show the real error
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send an immediate local notification using expo-notifications.
   * The global foreground handler is set in usePushNotifications.
   */
  async _sendLocalNotification(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Immediately
      });
    } catch (error) {
      DebugUtils.error('NOTIF', 'Failed to send local notification', error);
    }
  }

  /**
   * Format a category name for display.
   */
  _formatCategory(cat) {
    if (!cat) return 'Unknown';
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  /**
   * Check if an alert type is on cooldown.
   */
  _isOnCooldown(key) {
    const lastTime = this._lastAlertTimestamps[key];
    if (!lastTime) return false;
    const cooldown = COOLDOWNS[key] || COOLDOWNS.budget_warning;
    return Date.now() - lastTime < cooldown;
  }

  /**
   * Mark an alert type as recently fired.
   */
  _markCooldown(key, duration) {
    this._lastAlertTimestamps[key] = Date.now();
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();

// Also export the class and preference keys for use in settings
export { NotificationService, PREF_KEYS, BUDGET_THRESHOLDS };
export default notificationService;
