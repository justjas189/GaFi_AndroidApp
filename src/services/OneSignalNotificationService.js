// src/services/OneSignalNotificationService.js
// Centralized OneSignal notification service for GaFI
// Handles: Budget alerts, Level-up celebrations, Weekly check-ins, Term resets

import { OneSignal } from 'react-native-onesignal';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';

// ─── OneSignal App ID & REST API Key ────────────────────────────────────────
// The App ID is loaded at init in App.js. The REST API key is used for
// server-to-device pushes (Level Up, etc.). Replace with your actual key.
const ONESIGNAL_APP_ID = '2f15e79a-b878-4ac7-a918-9d6d8bc28d60';
const ONESIGNAL_REST_API_KEY = 'os_v2_app_f4k6pgvypbfmpkiytvwyxqunmb2yookacehea54gxzblreriqpciwgypd7gwxopjngt4pma2rt453s7m2jfdi4u5l5gvqsp575eyeia'; // Set this in your .env or constants

// ─── Notification Preference Keys ───────────────────────────────────────────
const PREF_KEYS = {
  BUDGET_ALERTS: 'notif_pref_budget_alerts',
  LEVEL_UP: 'notif_pref_level_up',
  WEEKLY_CHECKIN: 'notif_pref_weekly_checkin',
  BUDGET_RESET: 'notif_pref_budget_reset',
  DAILY_REMINDER: 'notif_pref_daily_reminder',
  DAILY_REMINDER_TIME: 'notif_pref_daily_reminder_time',
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

class OneSignalNotificationService {
  constructor() {
    this._lastAlertTimestamps = {};
    this._initialized = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Call after the user authenticates. Links the OneSignal device to the
   * Supabase user ID so targeted pushes and segments work.
   */
  async loginUser(userId, userEmail) {
    try {
      if (!userId) {
        DebugUtils.warn('ONESIGNAL', 'loginUser called without userId');
        return;
      }

      // Set the external user ID so OneSignal can target this device
      OneSignal.login(userId);

      // Tag the user with helpful metadata for dashboard segments
      OneSignal.User.addTags({
        user_id: userId,
        email: userEmail || '',
        app_version: '1.0.0',
        platform: 'mobile',
        active_user: 'true',
      });

      // Restore saved preferences as OneSignal tags
      await this._syncPreferenceTags();

      this._initialized = true;
      DebugUtils.log('ONESIGNAL', 'User logged in to OneSignal', { userId });
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to login user', error);
    }
  }

  /**
   * Call when the user logs out.
   */
  async logoutUser() {
    try {
      OneSignal.logout();
      this._initialized = false;
      DebugUtils.log('ONESIGNAL', 'User logged out of OneSignal');
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to logout user', error);
    }
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
   */
  async checkBudgetThresholds(budget, newExpenseAmount, newExpenseCategory) {
    try {
      const enabled = await this.getPreference(PREF_KEYS.BUDGET_ALERTS);
      if (enabled === false) return; // User opted out

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

        // Add a OneSignal tag so the dashboard can also react
        OneSignal.User.addTag(alert.type, 'true');
        OneSignal.User.addTag(`${alert.type}_pct`, String(alert.percentage));

        // Send in-app local notification
        await this._sendLocalNotification(
          alert.type === 'budget_exceeded' ? '🚨 Budget Exceeded!' :
          alert.type === 'budget_critical' ? '🔴 Budget Critical!' :
          '⚠️ Budget Warning',
          alert.message,
          { type: alert.type, category: alert.category }
        );

        this._markCooldown(cooldownKey, COOLDOWNS[alert.type] || COOLDOWNS.budget_warning);
        DebugUtils.log('ONESIGNAL', 'Budget alert fired', alert);
      }
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Error checking budget thresholds', error);
    }
  }

  /**
   * Clear budget warning tags — call when a budget is reset or the user
   * starts a new cycle.
   */
  async clearBudgetTags() {
    try {
      OneSignal.User.removeTags([
        'budget_warning', 'budget_warning_pct',
        'budget_critical', 'budget_critical_pct',
        'budget_exceeded', 'budget_exceeded_pct',
      ]);
      DebugUtils.log('ONESIGNAL', 'Budget tags cleared');
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to clear budget tags', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LEVEL UP CELEBRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a celebratory push notification when the user reaches a milestone.
   * Uses OneSignal REST API for targeted delivery to a specific external user.
   *
   * @param {string} userId         – Supabase user ID (used as external_id)
   * @param {string} milestoneType  – 'level_complete' | 'goal_reached' | 'achievement'
   * @param {Object} details        – { levelName?, goalName?, xpEarned?, badgeName? }
   */
  async sendLevelUpNotification(userId, milestoneType = 'level_complete', details = {}) {
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

      // Tag the milestone for dashboard segments
      OneSignal.User.addTags({
        last_milestone: milestoneType,
        last_milestone_date: new Date().toISOString(),
      });

      // ── Send via REST API for targeted push ────────────────────────────
      await this._sendPushViaREST(userId, heading, message, {
        type: 'level_up',
        milestoneType,
        ...details,
      });

      // Also fire a local notification as fallback
      await this._sendLocalNotification(heading, message, {
        type: 'level_up',
        milestoneType,
      });

      this._markCooldown('level_up', COOLDOWNS.level_up);
      DebugUtils.log('ONESIGNAL', 'Level up notification sent', { milestoneType, details });
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to send level up notification', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. KOIN AI WEEKLY CHECK-IN (Tag Management)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Ensure the user is tagged as "active" so the OneSignal dashboard
   * recurring segment (every Sunday at 5 PM) includes them.
   *
   * Call this periodically (e.g. on app open).
   */
  async updateActiveUserTag() {
    try {
      const enabled = await this.getPreference(PREF_KEYS.WEEKLY_CHECKIN);
      if (enabled === false) {
        OneSignal.User.removeTag('weekly_checkin_opt_in');
        return;
      }

      OneSignal.User.addTags({
        active_user: 'true',
        weekly_checkin_opt_in: 'true',
        last_active: new Date().toISOString(),
      });
      DebugUtils.log('ONESIGNAL', 'Active user tag updated for weekly check-in');
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to update active user tag', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. NEW TERM / BUDGET RESET NOTIFICATION
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

        trigger = { date: nextMonth };
      } else {
        // Weekly: schedule 7 days from the last reset at 8:00 AM
        const nextWeek = new Date(lastResetDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(8, 0, 0, 0);

        if (nextWeek <= new Date()) {
          nextWeek.setDate(nextWeek.getDate() + 7);
        }

        trigger = { date: nextWeek };
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

      // Also tag on OneSignal for dashboard-managed resets
      OneSignal.User.addTag('budget_cycle', cycle);

      DebugUtils.log('ONESIGNAL', 'Budget reset notification scheduled', {
        cycle,
        trigger,
        notificationId,
      });
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to schedule budget reset notification', error);
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
      DebugUtils.error('ONESIGNAL', 'Failed to cancel budget reset notification', error);
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
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });

      await AsyncStorage.setItem('expense_reminder_id', notificationId);
      await AsyncStorage.setItem(PREF_KEYS.DAILY_REMINDER, 'true');
      await AsyncStorage.setItem(PREF_KEYS.DAILY_REMINDER_TIME, JSON.stringify({ hour, minute }));

      DebugUtils.log('ONESIGNAL', 'Daily reminder scheduled', { hour, minute, notificationId });
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to schedule daily reminder', error);
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
      DebugUtils.error('ONESIGNAL', 'Failed to cancel daily reminder', error);
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
   * Set a notification preference and sync the corresponding OneSignal tag.
   */
  async setPreference(key, enabled) {
    try {
      await AsyncStorage.setItem(key, enabled ? 'true' : 'false');
      await this._syncPreferenceTag(key, enabled);
      DebugUtils.log('ONESIGNAL', 'Preference updated', { key, enabled });
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'Failed to set preference', error);
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
   */
  async sendTestNotification(type = 'budget_warning') {
    switch (type) {
      case 'budget_warning':
        await this._sendLocalNotification(
          '⚠️ Budget Warning (Test)',
          "Watch out! You've used 85% of your 'Wants' budget for this level. Play it safe!",
          { type: 'test_budget_warning' }
        );
        break;

      case 'budget_critical':
        await this._sendLocalNotification(
          '🔴 Budget Critical (Test)',
          "Critical! You've used 95% of your 'Food' budget. Almost at the limit!",
          { type: 'test_budget_critical' }
        );
        break;

      case 'level_up':
        await this._sendLocalNotification(
          '🎉 Level Complete! (Test)',
          'You successfully managed your Needs vs. Wants. Tap to claim your next challenge!',
          { type: 'test_level_up' }
        );
        break;

      case 'weekly_checkin':
        await this._sendLocalNotification(
          '🤖 Koin AI Weekly Check-In (Test)',
          'Koin AI has analyzed your spending this week. Tap here to see your personalized tip on how to save more next week!',
          { type: 'test_weekly_checkin' }
        );
        break;

      case 'budget_reset':
        await this._sendLocalNotification(
          '💰 A New Cycle Begins! (Test)',
          'Your budget has been reset. Start fresh and make this cycle count!',
          { type: 'test_budget_reset' }
        );
        break;

      case 'daily_reminder':
        await this._sendLocalNotification(
          '📝 Time to Track! (Test)',
          "Don't forget to log today's expenses. Stay on top of your spending game!",
          { type: 'test_daily_reminder' }
        );
        break;

      default:
        await this._sendLocalNotification(
          '🔔 Test Notification',
          'This is a test notification from GaFI!',
          { type: 'test' }
        );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Send a local notification using expo-notifications.
   */
  async _sendLocalNotification(title, body, data = {}) {
    try {
      // Configure the notification handler for foreground
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

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
      DebugUtils.error('ONESIGNAL', 'Failed to send local notification', error);
    }
  }

  /**
   * Send a push notification via OneSignal REST API to a specific user.
   */
  async _sendPushViaREST(externalUserId, heading, message, data = {}) {
    try {
      // Skip REST API call if the key is not configured
      if (!ONESIGNAL_REST_API_KEY || ONESIGNAL_REST_API_KEY === 'YOUR_ONESIGNAL_REST_API_KEY') {
        DebugUtils.warn('ONESIGNAL', 'REST API key not configured — skipping push via REST');
        return;
      }

      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_external_user_ids: [externalUserId],
          headings: { en: heading },
          contents: { en: message },
          data,
        }),
      });

      const result = await response.json();
      DebugUtils.log('ONESIGNAL', 'REST API push result', result);
    } catch (error) {
      DebugUtils.error('ONESIGNAL', 'REST API push failed', error);
    }
  }

  /**
   * Sync a single preference as a OneSignal tag.
   */
  async _syncPreferenceTag(key, enabled) {
    const tagMap = {
      [PREF_KEYS.BUDGET_ALERTS]: 'budget_alerts_opt_in',
      [PREF_KEYS.LEVEL_UP]: 'level_up_opt_in',
      [PREF_KEYS.WEEKLY_CHECKIN]: 'weekly_checkin_opt_in',
      [PREF_KEYS.BUDGET_RESET]: 'budget_reset_opt_in',
      [PREF_KEYS.DAILY_REMINDER]: 'daily_reminder_opt_in',
    };

    const tagName = tagMap[key];
    if (tagName) {
      if (enabled) {
        OneSignal.User.addTag(tagName, 'true');
      } else {
        OneSignal.User.removeTag(tagName);
      }
    }
  }

  /**
   * Sync all stored preferences to OneSignal tags.
   */
  async _syncPreferenceTags() {
    const prefs = await this.getAllPreferences();
    for (const [name, key] of Object.entries(PREF_KEYS)) {
      if (name === 'DAILY_REMINDER_TIME') continue;
      const enabled = prefs[name];
      await this._syncPreferenceTag(key, enabled);
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
export const notificationService = new OneSignalNotificationService();

// Also export the class and preference keys for use in settings
export { OneSignalNotificationService, PREF_KEYS, BUDGET_THRESHOLDS };
export default notificationService;
