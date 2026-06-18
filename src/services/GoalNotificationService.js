// src/services/GoalNotificationService.js
// Goal Deadline Notification Service for GaFI
//
// Scheduling rules:
//   • Goal deadline > 30 days away  → monthly reminders (every ~30 days)
//   • ≤ 30 days remaining           → notify at 15-day mark
//   • After 15-day mark             → notify at 10d, 5d, 1d remaining
//   • Goal completed / deleted      → cancel ALL pending notifications for that goal
//
// All notifications fire at 00:01 AM (fixed, not user-configurable).
// Notification IDs are stored in AsyncStorage keyed by goal ID so they
// can be cancelled at any time.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';

// ─── Constants ───────────────────────────────────────────────────────────────

/** AsyncStorage key prefix — full key: `goal_notif_ids_{goalId}` */
const STORAGE_KEY_PREFIX = 'goal_notif_ids_';

/** User preference key — mirrors the pattern in NotificationService */
const PREF_KEY_GOAL_DEADLINE = 'notif_pref_goal_deadline';

/** Fixed notification hour / minute (00:01 AM device-local time) */
const NOTIF_HOUR = 0;
const NOTIF_MINUTE = 1;

/** Day-before-deadline milestones that always get a notification */
const MILESTONE_DAYS = [15, 10, 5, 1];

/** Safety cap — never schedule more than this many notifications per goal */
const MAX_NOTIFS_PER_GOAL = 8;

/** ms in one day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return a new Date set to NOTIF_HOUR:NOTIF_MINUTE on the same calendar day
 * as `date` (device-local time).
 */
const atNotifTime = (date) => {
  const d = new Date(date);
  d.setHours(NOTIF_HOUR, NOTIF_MINUTE, 0, 0);
  return d;
};

// ─── Service ─────────────────────────────────────────────────────────────────

class GoalNotificationService {

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Schedule all deadline notifications for a single goal.
   *
   * Call this immediately after a goal with a deadline is created, or after
   * its deadline is edited.
   *
   * @param {string} goalId          – UUID of the goal (used as AsyncStorage key)
   * @param {string} goalTitle       – Human-readable goal name
   * @param {string|null} targetDate – ISO date string (YYYY-MM-DD) or null
   * @param {number} currentAmount   – How much has already been saved (snapshot)
   * @param {number} targetAmount    – The savings target
   */
  async scheduleGoalNotifications(goalId, goalTitle, targetDate, currentAmount = 0, targetAmount = 0) {
    try {
      if (!goalId || !targetDate) {
        DebugUtils.log('GOAL_NOTIF', 'Skipping schedule — no goalId or targetDate', { goalId, targetDate });
        return;
      }

      // Respect the user's preference toggle
      const enabled = await this._isEnabled();
      if (!enabled) {
        DebugUtils.log('GOAL_NOTIF', 'Goal deadline notifications disabled by user');
        return;
      }

      const deadline = new Date(targetDate);
      // Treat deadline as end-of-day so same-day goals are handled gracefully
      deadline.setHours(23, 59, 59, 999);

      const now = new Date();
      if (deadline <= now) {
        DebugUtils.log('GOAL_NOTIF', 'Deadline already passed — skipping', { goalId });
        return;
      }

      // Cancel any previously scheduled notifications for this goal first
      // (handles the "edit deadline" case cleanly)
      await this.cancelGoalNotifications(goalId);

      // Calculate which dates to notify on
      const notifDates = this._calculateNotificationDates(now, deadline);

      if (notifDates.length === 0) {
        DebugUtils.log('GOAL_NOTIF', 'No future notification dates — skipping', { goalId });
        return;
      }

      // Schedule each notification and collect the IDs
      const scheduledIds = [];
      for (const { date, daysLeft } of notifDates) {
        try {
          const body = this._buildMessage(goalTitle, daysLeft);
          const title = this._buildTitle(daysLeft);

          const notifId = await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: {
                type: 'goal_deadline',
                goalId,
                daysLeft,
              },
              sound: 'default',
            },
            trigger: { 
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date 
            },
          });

          scheduledIds.push(notifId);
          DebugUtils.log('GOAL_NOTIF', `Scheduled notification`, {
            goalId,
            daysLeft,
            fireAt: date.toISOString(),
            notifId,
          });
        } catch (scheduleErr) {
          DebugUtils.error('GOAL_NOTIF', 'Failed to schedule single notification', scheduleErr);
          // Continue scheduling the rest even if one fails
        }
      }

      // Persist the IDs so we can cancel them later
      if (scheduledIds.length > 0) {
        await AsyncStorage.setItem(
          `${STORAGE_KEY_PREFIX}${goalId}`,
          JSON.stringify(scheduledIds),
        );
        DebugUtils.log('GOAL_NOTIF', `${scheduledIds.length} notifications scheduled for goal`, { goalId });
      }
    } catch (err) {
      DebugUtils.error('GOAL_NOTIF', 'scheduleGoalNotifications failed', err);
    }
  }

  /**
   * Cancel ALL pending notifications for a goal.
   *
   * Call this when:
   *   • A goal is marked as completed (is_completed = true)
   *   • A goal is soft-deleted (is_deleted = true)
   *
   * @param {string} goalId
   */
  async cancelGoalNotifications(goalId) {
    try {
      if (!goalId) return;

      const raw = await AsyncStorage.getItem(`${STORAGE_KEY_PREFIX}${goalId}`);
      if (!raw) return; // Nothing stored — nothing to cancel

      const ids = JSON.parse(raw);
      if (!Array.isArray(ids) || ids.length === 0) return;

      let cancelledCount = 0;
      for (const id of ids) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
          cancelledCount++;
        } catch (_) {
          // Notification may have already fired or been removed — that's fine
        }
      }

      await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${goalId}`);
      DebugUtils.log('GOAL_NOTIF', `Cancelled ${cancelledCount} notifications for goal`, { goalId });
    } catch (err) {
      DebugUtils.error('GOAL_NOTIF', 'cancelGoalNotifications failed', err);
    }
  }

  /**
   * Re-sync all goal notifications on app startup.
   *
   * Handles the case where the app was reinstalled (AsyncStorage wiped) or
   * notifications expired without firing.  Pass in the full list of active
   * goals fetched from Supabase.
   *
   * @param {Array<{
   *   id: string,
   *   title: string,
   *   target_date: string|null,
   *   current_amount: number,
   *   target_amount: number,
   *   is_completed: boolean,
   *   is_deleted: boolean,
   * }>} activeGoals
   */
  async resyncAllGoalNotifications(activeGoals) {
    try {
      if (!Array.isArray(activeGoals) || activeGoals.length === 0) return;

      DebugUtils.log('GOAL_NOTIF', `Resyncing notifications for ${activeGoals.length} goals`);

      for (const goal of activeGoals) {
        // Skip completed or deleted goals — make sure no stale notifs remain
        if (goal.is_completed || goal.is_deleted) {
          await this.cancelGoalNotifications(goal.id);
          continue;
        }

        // Skip goals without a deadline
        if (!goal.target_date) continue;

        // Reschedule (cancelGoalNotifications is called internally first)
        await this.scheduleGoalNotifications(
          goal.id,
          goal.title,
          goal.target_date,
          parseFloat(goal.current_amount) || 0,
          parseFloat(goal.target_amount) || 0,
        );
      }

      DebugUtils.log('GOAL_NOTIF', 'Resync complete');
    } catch (err) {
      DebugUtils.error('GOAL_NOTIF', 'resyncAllGoalNotifications failed', err);
    }
  }

  /**
   * Fire an immediate (trigger: null) test notification for the goal channel.
   * Used by the "Test Goal Notification" button on NotificationTestScreen.
   */
  async sendTestNotification() {
    try {
      // Ensure the handler is set for foreground display
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎯 Goal Deadline Reminder (Test)',
          body: '⏰ 5 days left for "New Laptop"! You\'re 65% there — keep saving!',
          data: { type: 'goal_deadline_test' },
          sound: 'default',
        },
        trigger: null, // Fires immediately
      });

      DebugUtils.log('GOAL_NOTIF', 'Test notification sent');
    } catch (err) {
      DebugUtils.error('GOAL_NOTIF', 'sendTestNotification failed', err);
      throw err; // Re-throw so the UI can show an error message
    }
  }

  // ─── Preference helpers ───────────────────────────────────────────────────

  /**
   * Read the goal deadline notification preference.
   * Returns true by default (opt-in).
   */
  async getPreference() {
    try {
      const value = await AsyncStorage.getItem(PREF_KEY_GOAL_DEADLINE);
      return value === null ? true : value === 'true';
    } catch {
      return true;
    }
  }

  /**
   * Write the goal deadline notification preference.
   * When disabled, cancels ALL currently-scheduled goal notifications.
   *
   * @param {boolean} enabled
   * @param {Array} activeGoals – Pass current goals so we can cancel if turning off
   */
  async setPreference(enabled, activeGoals = []) {
    try {
      await AsyncStorage.setItem(PREF_KEY_GOAL_DEADLINE, enabled ? 'true' : 'false');

      if (!enabled) {
        // Cancel everything that was scheduled
        for (const goal of activeGoals) {
          await this.cancelGoalNotifications(goal.id);
        }
        DebugUtils.log('GOAL_NOTIF', 'Preference disabled — all goal notifications cancelled');
      } else {
        // Re-schedule for active goals
        await this.resyncAllGoalNotifications(activeGoals);
        DebugUtils.log('GOAL_NOTIF', 'Preference enabled — notifications re-synced');
      }
    } catch (err) {
      DebugUtils.error('GOAL_NOTIF', 'setPreference failed', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Read the preference flag (internal shorthand).
   */
  async _isEnabled() {
    return this.getPreference();
  }

  /**
   * Calculate the full list of notification fire-dates for a goal.
   *
   * Algorithm
   * ─────────
   * Phase 1 — Monthly reminders (only when deadline > 30 days away)
   *   Start one calendar month after `now`, keep adding months while the
   *   resulting date is still > 30 days before the deadline.
   *
   * Phase 2 — Milestone reminders
   *   Always schedule at 15 days, 10 days, 5 days, and 1 day before deadline
   *   (skipping any that are already in the past).
   *
   * Result is sorted chronologically, de-duplicated, and capped at
   * MAX_NOTIFS_PER_GOAL entries.
   *
   * @param {Date} now
   * @param {Date} deadline  – end-of-day deadline (23:59:59)
   * @returns {{ date: Date, daysLeft: number }[]}
   */
  _calculateNotificationDates(now, deadline) {
    const dates = []; // { date: Date, daysLeft: number }
    const deadlineMs = deadline.getTime();
    const daysRemaining = Math.ceil((deadlineMs - now.getTime()) / MS_PER_DAY);

    if (daysRemaining <= 0) return [];

    // ── Phase 1: Monthly reminders ────────────────────────────────────────
    if (daysRemaining > 30) {
      let cursor = new Date(now);
      cursor.setMonth(cursor.getMonth() + 1);
      cursor = atNotifTime(cursor);

      // Keep adding monthly reminders while we are still > 30 days before deadline
      while (cursor.getTime() < deadlineMs - 30 * MS_PER_DAY) {
        if (cursor > now) {
          const daysLeft = Math.ceil((deadlineMs - cursor.getTime()) / MS_PER_DAY);
          dates.push({ date: new Date(cursor), daysLeft });
        }
        cursor = new Date(cursor);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    // ── Phase 2: Milestone reminders ──────────────────────────────────────
    for (const daysBefore of MILESTONE_DAYS) {
      const fireDate = atNotifTime(new Date(deadlineMs - daysBefore * MS_PER_DAY));
      if (fireDate > now) {
        dates.push({ date: fireDate, daysLeft: daysBefore });
      }
    }

    // Sort chronologically
    dates.sort((a, b) => a.date.getTime() - b.date.getTime());

    // De-duplicate (same timestamp → keep first)
    const seen = new Set();
    const unique = dates.filter(({ date }) => {
      const key = date.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Cap at MAX_NOTIFS_PER_GOAL (take the most recent ones — closer to deadline
    // = more actionable, so we keep from the end if we must trim)
    if (unique.length > MAX_NOTIFS_PER_GOAL) {
      // Keep the first (N - MAX) monthly ones trimmed, always keep milestones
      return unique.slice(unique.length - MAX_NOTIFS_PER_GOAL);
    }

    return unique;
  }

  /**
   * Build the notification title based on urgency.
   *
   * @param {number} daysLeft
   * @returns {string}
   */
  _buildTitle(daysLeft) {
    if (daysLeft === 1)  return '🚨 Last Day Tomorrow!';
    if (daysLeft <= 5)   return '🔥 Goal Deadline Approaching!';
    if (daysLeft <= 15)  return '⏰ Goal Deadline Reminder';
    return '📌 Goal Check-In';
  }

  _buildMessage(goalTitle, daysLeft) {
    if (daysLeft === 1) {
      return `🚨 TOMORROW is the deadline for "${goalTitle}"! Finish strong!`;
    }
    if (daysLeft <= 5) {
      return `🔥 Only ${daysLeft} days left for "${goalTitle}"!`;
    }
    if (daysLeft <= 15) {
      return `⏰ ${daysLeft} days remaining for "${goalTitle}". Keep it up!`;
    }
    // Monthly check-in
    return `📌 Goal Check-In: "${goalTitle}" deadline is coming up. Keep saving!`;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const goalNotificationService = new GoalNotificationService();
export { PREF_KEY_GOAL_DEADLINE };
export default goalNotificationService;
