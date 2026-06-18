// src/services/GameModeNotificationService.js
// Unified, registry-driven notification service for GaFI's GAME MODES.
//
// Mirrors the structure of GoalNotificationService (preference get/set, schedule,
// cancel, resync, test) but generalised across modes via a single MODE_CHANNELS
// registry. Adding a new mode = add one registry entry; the scheduling, cancelling,
// preference, and test plumbing all key off it dynamically — no per-mode branches.
//
// Modes:
//   • daily        – fixed-time daily "log your expenses" reminder (repeats)
//   • story_mode   – nudge to continue an in-progress Story Mode level/day
//   • custom_mode  – nudge tied to an active Custom Mode challenge (optional deadline)
//
// All scheduling uses expo-notifications local triggers. Scheduled notification IDs
// are persisted in AsyncStorage keyed by mode so they can be cancelled at any time.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';

// ─── Registry ────────────────────────────────────────────────────────────────
// One declarative entry per mode. UI (NotificationSettingsScreen) and this service
// both read from here, so the two never drift.
export const MODE_CHANNELS = {
  daily: {
    id: 'daily',
    prefKey: 'notif_pref_mode_daily',
    storageKey: 'mode_notif_ids_daily',
    title: 'Daily Tracker',
    emoji: '📝',
    // Default fire time when none supplied
    defaultTime: { hour: 18, minute: 0 },
    repeats: true,
  },
  story_mode: {
    id: 'story_mode',
    prefKey: 'notif_pref_mode_story',
    storageKey: 'mode_notif_ids_story',
    title: 'Story Mode',
    emoji: '📖',
    defaultTime: { hour: 19, minute: 0 },
    repeats: true, // daily "continue your story" nudge while a session is active
  },
  custom_mode: {
    id: 'custom_mode',
    prefKey: 'notif_pref_mode_custom',
    storageKey: 'mode_notif_ids_custom',
    title: 'Custom Mode',
    emoji: '🛠️',
    defaultTime: { hour: 20, minute: 0 },
    repeats: true,
  },
};

class GameModeNotificationService {
  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCES (registry-driven — same opt-in default as GoalNotificationService)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Read a mode preference (boolean). Defaults to true (opt-in). */
  async getPreference(modeId) {
    const channel = MODE_CHANNELS[modeId];
    if (!channel) return true;
    try {
      const value = await AsyncStorage.getItem(channel.prefKey);
      return value === null ? true : value === 'true';
    } catch {
      return true;
    }
  }

  /** Read every mode preference at once → { daily, story_mode, custom_mode }. */
  async getAllPreferences() {
    const out = {};
    for (const modeId of Object.keys(MODE_CHANNELS)) {
      out[modeId] = await this.getPreference(modeId);
    }
    return out;
  }

  /**
   * Set a mode preference. When turned OFF we cancel that mode's notifications;
   * when turned ON we (re)schedule using whatever context the caller passes
   * (or the registry default time).
   *
   * @param {string} modeId
   * @param {boolean} enabled
   * @param {object} [context] – forwarded to scheduleModeReminder on enable
   */
  async setPreference(modeId, enabled, context = {}) {
    const channel = MODE_CHANNELS[modeId];
    if (!channel) return;
    try {
      await AsyncStorage.setItem(channel.prefKey, enabled ? 'true' : 'false');
      if (enabled) {
        await this.scheduleModeReminder(modeId, context);
      } else {
        await this.cancelModeReminder(modeId);
      }
      DebugUtils.log('MODE_NOTIF', 'Preference updated', { modeId, enabled });
    } catch (err) {
      DebugUtils.error('MODE_NOTIF', 'setPreference failed', err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Schedule the reminder(s) for a single mode. Cancels any prior ones first so
   * this is safe to call repeatedly (e.g. when a Story session advances a day).
   *
   * @param {string} modeId
   * @param {object} [context]
   * @param {{hour:number,minute:number}} [context.time]  – override fire time
   * @param {string} [context.label]   – e.g. Story level name / Custom challenge name
   * @param {number} [context.day]     – Story Mode current day
   * @param {string|Date|null} [context.deadline] – Custom Mode deadline (one-shot)
   */
  async scheduleModeReminder(modeId, context = {}) {
    const channel = MODE_CHANNELS[modeId];
    if (!channel) return;

    try {
      // Respect the user's toggle
      const enabled = await this.getPreference(modeId);
      if (!enabled) {
        DebugUtils.log('MODE_NOTIF', 'Mode disabled by user — not scheduling', { modeId });
        return;
      }

      // Clear stale notifications for this mode first
      await this.cancelModeReminder(modeId);

      const { title, body } = this._buildMessage(modeId, context);
      const trigger = this._buildTrigger(channel, context);
      if (!trigger) {
        DebugUtils.log('MODE_NOTIF', 'No valid trigger — skipping', { modeId });
        return;
      }

      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: `mode_${modeId}`, modeId, ...context },
          sound: 'default',
        },
        trigger,
      });

      await AsyncStorage.setItem(channel.storageKey, JSON.stringify([notifId]));
      DebugUtils.log('MODE_NOTIF', 'Scheduled mode reminder', { modeId, notifId, trigger });
    } catch (err) {
      DebugUtils.error('MODE_NOTIF', 'scheduleModeReminder failed', { modeId, err });
    }
  }

  /** Cancel every scheduled notification for a mode. */
  async cancelModeReminder(modeId) {
    const channel = MODE_CHANNELS[modeId];
    if (!channel) return;
    try {
      const raw = await AsyncStorage.getItem(channel.storageKey);
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        for (const id of ids) {
          try {
            await Notifications.cancelScheduledNotificationAsync(id);
          } catch (_) {
            // already fired / removed — fine
          }
        }
      }
      await AsyncStorage.removeItem(channel.storageKey);
      DebugUtils.log('MODE_NOTIF', 'Cancelled mode reminder', { modeId });
    } catch (err) {
      DebugUtils.error('MODE_NOTIF', 'cancelModeReminder failed', { modeId, err });
    }
  }

  /**
   * Re-sync all modes on startup / when game state changes. Pass the live mode
   * context so in-progress Story/Custom sessions reschedule, finished ones cancel.
   *
   * @param {object} state
   * @param {boolean} [state.storyActive]  – a Story Mode session is in progress
   * @param {object}  [state.storyContext] – { label, day, time }
   * @param {boolean} [state.customActive] – a Custom Mode challenge is in progress
   * @param {object}  [state.customContext]– { label, deadline, time }
   * @param {object}  [state.dailyContext] – { time }
   */
  async resyncAll(state = {}) {
    try {
      // Daily always reschedules from its own stored pref
      await this._resyncOne('daily', state.dailyContext || {});

      if (state.storyActive) {
        await this.scheduleModeReminder('story_mode', state.storyContext || {});
      } else {
        await this.cancelModeReminder('story_mode');
      }

      if (state.customActive) {
        await this.scheduleModeReminder('custom_mode', state.customContext || {});
      } else {
        await this.cancelModeReminder('custom_mode');
      }

      DebugUtils.log('MODE_NOTIF', 'Resync complete', {
        storyActive: !!state.storyActive,
        customActive: !!state.customActive,
      });
    } catch (err) {
      DebugUtils.error('MODE_NOTIF', 'resyncAll failed', err);
    }
  }

  async _resyncOne(modeId, context) {
    const enabled = await this.getPreference(modeId);
    if (enabled) {
      await this.scheduleModeReminder(modeId, context);
    } else {
      await this.cancelModeReminder(modeId);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST  (gated by the caller — NotificationSettingsScreen only renders the
  //        trigger when IS_DEVELOPMENT, satisfying the production guard)
  // ═══════════════════════════════════════════════════════════════════════════

  async sendTestNotification(modeId) {
    const channel = MODE_CHANNELS[modeId];
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      const { title, body } = this._buildMessage(modeId, { test: true });
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${title} (Test)`,
          body,
          data: { type: `test_mode_${modeId}` },
          sound: 'default',
        },
        trigger: null, // immediate
      });

      DebugUtils.log('MODE_NOTIF', 'Test notification sent', { modeId });
    } catch (err) {
      DebugUtils.error('MODE_NOTIF', 'sendTestNotification failed', { modeId, err });
      throw err; // surface to UI
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE
  // ═══════════════════════════════════════════════════════════════════════════

  /** Build a daily/date trigger from registry defaults + caller overrides. */
  _buildTrigger(channel, context) {
    // Custom Mode with an explicit deadline → one-shot DATE trigger
    if (context.deadline) {
      const date = new Date(context.deadline);
      date.setHours(channel.defaultTime.hour, channel.defaultTime.minute, 0, 0);
      if (date <= new Date()) return null; // already passed
      return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
    }

    const time = context.time || channel.defaultTime;
    if (channel.repeats) {
      // SDK 54: DAILY trigger repeats every day at hour:minute. No `repeats` key.
      return {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
      };
    }
    // Non-repeating fallback: next occurrence of the time
    const date = new Date();
    date.setHours(time.hour, time.minute, 0, 0);
    if (date <= new Date()) date.setDate(date.getDate() + 1);
    return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
  }

  /** Compose a mode-appropriate title/body, optionally personalised by context. */
  _buildMessage(modeId, context = {}) {
    const label = context.label;
    switch (modeId) {
      case 'story_mode':
        return {
          title: '📖 Your Story Awaits!',
          body: label
            ? `Day ${context.day ?? ''} of "${label}" is waiting. Continue your Story Mode journey!`.replace('Day  of', 'Day of')
            : 'Pick up where you left off and continue your Story Mode journey!',
        };
      case 'custom_mode':
        return {
          title: '🛠️ Custom Challenge Check-In',
          body: label
            ? `Keep your "${label}" challenge on track — log today's progress!`
            : 'Keep your Custom Mode challenge on track — log today\'s progress!',
        };
      case 'daily':
      default:
        return {
          title: '📝 Time to Track!',
          body: "Don't forget to log today's expenses. Stay on top of your spending game!",
        };
    }
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────────
export const gameModeNotificationService = new GameModeNotificationService();
export { GameModeNotificationService };
export default gameModeNotificationService;
