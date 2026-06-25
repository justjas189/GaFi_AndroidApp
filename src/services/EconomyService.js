/**
 * EconomyService — the single engine for the "Sprouts" soft currency.
 *
 * Sprouts are the in-game spendable currency, earned through REAL financial
 * behaviour and spent in the AchievementDashboard store. They are deliberately
 * decoupled from lifetime XP / the leaderboard score: awarding or spending
 * Sprouts never touches a user's XP.
 *
 * Storage: user_levels.sprouts_balance (current) + user_levels.sprouts_lifetime
 * (total ever earned). See migration 20260625_add_sprouts_economy.sql.
 *
 * Earn rates live here (SPROUTS_REWARDS) so every caller agrees on the numbers:
 *   • Story daily task   → +10  (per task)
 *   • Story week passed   → +50
 *   • Custom expense log  → +5   (first 3 logs/day only — anti-farm cap)
 *
 * Every method is defensive: a missing column (pre-migration) or auth gap is
 * caught and returns a safe zero/failure rather than throwing, matching the rest
 * of the data layer.
 */

import { supabase } from '../config/supabase';
import { getSessionForMutation } from './AuthSessionHelper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import gameDatabaseService from './GameDatabaseService';

// Single source of truth for earn rates + caps.
export const SPROUTS_REWARDS = {
  DAILY_TASK: 10,        // per Story Mode daily task completed
  STORY_WEEK_PASSED: 50, // per Story Mode level/week passed
  EXPENSE_LOG: 5,        // per Custom Mode expense logged (within the daily cap)
};

// Anti-farm: only the first N expenses logged per day earn Sprouts, so users
// can't grind currency by logging fake 1-peso expenses.
export const EXPENSE_DAILY_CAP = 3;

// Double Sprout Token: while a buff is running, every gameplay EARN is multiplied
// by this. The buff is a single expiry timestamp per user in AsyncStorage (no DB
// column — it's device-local, time-boxed state, not a balance). System grants
// (refunds, the legacy seed) opt out so they pay back exactly.
export const SPROUT_MULTIPLIER = 2;
export const MULTIPLIER_DURATION_HOURS = 24;

class EconomyService {
  // ─── helpers ──────────────────────────────────────────────

  async _resolveUserId(userId) {
    if (userId) return userId;
    try {
      const { userId: uid } = await getSessionForMutation();
      return uid || null;
    } catch (_) {
      return null;
    }
  }

  // Local (not UTC) YYYY-MM-DD so the daily cap rolls over at the user's midnight.
  _localDateKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ─── Double Sprout Token: the 2x earn buff ────────────────

  _multiplierKey(uid) {
    return `sprout_multiplier_expiry_${uid}`;
  }

  // Raw expiry (ms epoch) for an already-resolved uid; 0 if none. Internal so the
  // hot earn path (awardSprouts) reads it without re-resolving the session.
  async _expiryFor(uid) {
    try {
      const raw = await AsyncStorage.getItem(this._multiplierKey(uid));
      return raw ? parseInt(raw, 10) || 0 : 0;
    } catch (_) {
      return 0;
    }
  }

  /**
   * Buff status for the UI (badge + countdown). Returns expiry, whether it's live,
   * and the ms remaining. Safe defaults on any failure.
   * @returns {Promise<{active: boolean, expiry: number, remainingMs: number}>}
   */
  async getMultiplierStatus(userId) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return { active: false, expiry: 0, remainingMs: 0 };
      const expiry = await this._expiryFor(uid);
      const remainingMs = Math.max(0, expiry - Date.now());
      return { active: remainingMs > 0, expiry, remainingMs };
    } catch (_) {
      return { active: false, expiry: 0, remainingMs: 0 };
    }
  }

  /** The live earn multiplier: SPROUT_MULTIPLIER while the buff runs, else 1. */
  async getActiveMultiplier(userId) {
    const { active } = await this.getMultiplierStatus(userId);
    return active ? SPROUT_MULTIPLIER : 1;
  }

  /**
   * Start (or refresh) the 2x buff for N hours. Called after a Double Sprout Token
   * is consumed. Returns the new expiry timestamp (ms), or 0 on failure so the
   * caller can refund the token.
   */
  async setMultiplier(userId, hours = MULTIPLIER_DURATION_HOURS) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return 0;
      const expiry = Date.now() + hours * 60 * 60 * 1000;
      await AsyncStorage.setItem(this._multiplierKey(uid), String(expiry));
      console.log(`✨ 2x Sprouts active for ${uid} → expires ${new Date(expiry).toISOString()}`);
      return expiry;
    } catch (err) {
      console.warn('⚠️ setMultiplier error:', err.message);
      return 0;
    }
  }

  // ─── reads ────────────────────────────────────────────────

  /**
   * Current spendable Sprouts balance for a user. Returns 0 on any failure.
   */
  async getSproutsBalance(userId) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return 0;

      const { data, error } = await supabase
        .from('user_levels')
        .select('sprouts_balance')
        .eq('user_id', uid)
        .maybeSingle();

      if (error) throw error;
      return data?.sprouts_balance || 0;
    } catch (err) {
      console.warn('⚠️ getSproutsBalance error:', err.message);
      return 0;
    }
  }

  // ─── core: award ──────────────────────────────────────────

  /**
   * Award Sprouts to a user. Increments both balance and lifetime totals.
   * @param {string|null} userId  - explicit user id, or null to auto-resolve.
   * @param {number} amount        - positive integer to add (pre-multiplier).
   * @param {string} reason        - source tag for the audit trail / Koin context.
   * @param {{multiplier?: boolean}} [opts] - multiplier defaults true (gameplay earns
   *        double while the buff is live); pass false for system grants that must pay
   *        back exactly (refunds, legacy seed).
   * @returns {Promise<number|null>} new balance, or null on failure.
   */
  async awardSprouts(userId, amount, reason = 'unknown', { multiplier = true } = {}) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return null;

      let amt = Math.round(Number(amount) || 0);
      if (amt <= 0) return null;

      // Double Sprout Token: double gameplay earns while the buff runs. The check is
      // skipped for system grants (multiplier:false) so a refund never inflates.
      let boosted = false;
      if (multiplier) {
        const expiry = await this._expiryFor(uid);
        if (expiry > Date.now()) {
          amt *= SPROUT_MULTIPLIER;
          boosted = true;
        }
      }

      // Step 1: ensure the user_levels row exists (race-safe, DO NOTHING on conflict).
      await supabase
        .from('user_levels')
        .upsert({ user_id: uid }, { onConflict: 'user_id', ignoreDuplicates: true });

      // Step 2: read current totals.
      const { data: existing, error: readErr } = await supabase
        .from('user_levels')
        .select('sprouts_balance, sprouts_lifetime')
        .eq('user_id', uid)
        .single();
      if (readErr) throw readErr;

      const newBalance = (existing?.sprouts_balance || 0) + amt;
      const newLifetime = (existing?.sprouts_lifetime || 0) + amt;

      // Step 3: write incremented totals.
      const { error: updErr } = await supabase
        .from('user_levels')
        .update({
          sprouts_balance: newBalance,
          sprouts_lifetime: newLifetime,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', uid);
      if (updErr) throw updErr;

      // Audit trail (non-critical — reuses game_activity_log, never blocks).
      gameDatabaseService.logActivity({
        activityType: 'sprouts_awarded',
        details: { amount: amt, reason, balance: newBalance, boosted },
        amount: amt,
      });

      console.log(`🌱 +${amt} Sprouts${boosted ? ' (2x)' : ''} (${reason}) → balance ${newBalance}`);
      return newBalance;
    } catch (err) {
      console.warn('⚠️ awardSprouts error:', err.message);
      return null;
    }
  }

  // ─── core: spend ──────────────────────────────────────────

  /**
   * Spend Sprouts (store purchase). Fails (no deduction) if the balance is short.
   * @returns {Promise<{success: boolean, balance: number, error?: string}>}
   */
  async spendSprouts(userId, amount, reason = 'purchase') {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return { success: false, balance: 0, error: 'not_authenticated' };

      const amt = Math.round(Number(amount) || 0);
      if (amt <= 0) {
        return { success: false, balance: await this.getSproutsBalance(uid), error: 'invalid_amount' };
      }

      const { data: existing, error: readErr } = await supabase
        .from('user_levels')
        .select('sprouts_balance')
        .eq('user_id', uid)
        .maybeSingle();
      if (readErr) throw readErr;

      const balance = existing?.sprouts_balance || 0;
      if (balance < amt) {
        return { success: false, balance, error: 'insufficient_funds' };
      }

      const newBalance = balance - amt;
      const { error: updErr } = await supabase
        .from('user_levels')
        .update({ sprouts_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('user_id', uid);
      if (updErr) throw updErr;

      gameDatabaseService.logActivity({
        activityType: 'sprouts_spent',
        details: { amount: amt, reason, balance: newBalance },
        amount: amt,
      });

      console.log(`🛒 -${amt} Sprouts (${reason}) → balance ${newBalance}`);
      return { success: true, balance: newBalance };
    } catch (err) {
      console.warn('⚠️ spendSprouts error:', err.message);
      return { success: false, balance: 0, error: err.message };
    }
  }

  // ─── Custom Mode: expense reward with anti-farm daily cap ──

  /**
   * Award Sprouts for logging a Custom Mode expense, capped at the first
   * EXPENSE_DAILY_CAP logs per day (tracked locally per user+date). Beyond the
   * cap the call no-ops so fake micro-expenses can't farm currency.
   * @returns {Promise<{awarded: number, capped?: boolean, count: number, balance?: number}>}
   */
  async awardSproutsForExpense(userId, { dailyCap = EXPENSE_DAILY_CAP, amount = SPROUTS_REWARDS.EXPENSE_LOG } = {}) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return { awarded: 0, count: 0 };

      const key = `sprouts_expense_count_${uid}_${this._localDateKey()}`;
      const raw = await AsyncStorage.getItem(key);
      const count = raw ? parseInt(raw, 10) || 0 : 0;

      if (count >= dailyCap) {
        return { awarded: 0, capped: true, count };
      }

      // awardSprouts applies the 2x buff internally; read it here only so the
      // returned `awarded` reflects what actually landed (drives the toast copy).
      const multiplier = await this.getActiveMultiplier(uid);

      // Increment the daily counter BEFORE awarding so a failed award still
      // consumes the slot only after a successful write below — see order.
      const balance = await this.awardSprouts(uid, amount, 'expense_log');
      if (balance === null) {
        // Award failed (e.g. pre-migration) — don't burn a daily slot.
        return { awarded: 0, count };
      }

      await AsyncStorage.setItem(key, String(count + 1));
      return {
        awarded: amount * multiplier,
        boosted: multiplier > 1,
        capped: false,
        count: count + 1,
        balance,
      };
    } catch (err) {
      console.warn('⚠️ awardSproutsForExpense error:', err.message);
      return { awarded: 0, count: 0 };
    }
  }

  // ─── one-time legacy seed ─────────────────────────────────

  /**
   * Seed a starting balance from the legacy "Spendable" value (earned − spent XP)
   * so existing users don't lose their store-spending power on the cutover.
   * Caller must guard this to run only once per user (see AchievementDashboard).
   */
  async seedSprouts(userId, amount) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return 0;

      // Idempotent: if the user has ever earned a Sprout (lifetime > 0), they're
      // already on the new economy — never seed again (guards cross-device runs).
      const { data, error } = await supabase
        .from('user_levels')
        .select('sprouts_lifetime')
        .eq('user_id', uid)
        .maybeSingle();
      if (error) throw error;
      if ((data?.sprouts_lifetime || 0) > 0) {
        return await this.getSproutsBalance(uid);
      }

      const amt = Math.round(Number(amount) || 0);
      if (amt <= 0) return await this.getSproutsBalance(uid);
      // System grant — must seed the exact legacy amount, never doubled by a buff.
      return await this.awardSprouts(uid, amt, 'legacy_spendable_seed', { multiplier: false });
    } catch (err) {
      console.warn('⚠️ seedSprouts error:', err.message);
      return await this.getSproutsBalance(userId);
    }
  }
}

// Export a singleton instance (matches GameDatabaseService).
const economyService = new EconomyService();
export default economyService;
