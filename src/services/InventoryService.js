/**
 * InventoryService — the engine for consumable power-ups bought in the Trading Post.
 *
 * Power-ups are stackable consumables (own multiples), unlike cosmetics which are
 * one-time toggles. The inventory is a JSONB map of itemId -> quantity stored on
 * user_levels.inventory (see 20260625_add_powerup_inventory.sql), riding along with
 * the Sprouts balance so a single row read covers both wallet and inventory.
 *
 * Purchases deduct through EconomyService.spendSprouts — Sprouts remain the single
 * source of truth for the balance. The buy is spend-first, grant-second (mirroring
 * BoutiqueScreen): if the inventory write fails after a successful spend, the Sprouts
 * are refunded so a user is never charged for an item they didn't receive.
 *
 * Every method is defensive: a missing column (pre-migration) or auth gap is caught
 * and returns a safe empty/failure rather than throwing, matching the data layer.
 */

import { supabase } from '../config/supabase';
import { getSessionForMutation } from './AuthSessionHelper';
import gameDatabaseService from './GameDatabaseService';
import EconomyService from './EconomyService';

class InventoryService {
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

  // Normalise whatever the column returns into a plain { id: count } map.
  _normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw;
  }

  // ─── reads ────────────────────────────────────────────────

  /**
   * Full power-up inventory map for a user, e.g. { streak_shield: 2 }. Returns {} on
   * any failure (no row, pre-migration column, auth gap).
   */
  async getInventory(userId) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return {};

      const { data, error } = await supabase
        .from('user_levels')
        .select('inventory')
        .eq('user_id', uid)
        .maybeSingle();

      if (error) throw error;
      return this._normalize(data?.inventory);
    } catch (err) {
      console.warn('⚠️ getInventory error:', err.message);
      return {};
    }
  }

  // ─── core: buy ────────────────────────────────────────────

  /**
   * Buy one of a power-up: spend its price in Sprouts, then +1 its inventory count.
   * Spend-first so the balance is authoritative; refunds the spend if the grant write
   * fails so the user is never charged without receiving the item.
   *
   * @param {string|null} userId
   * @param {{id: string, price: number}} item
   * @returns {Promise<{success: boolean, balance: number, inventory: object, error?: string}>}
   */
  async buyItem(userId, item) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return { success: false, balance: 0, inventory: {}, error: 'not_authenticated' };
      if (!item?.id) return { success: false, balance: 0, inventory: {}, error: 'invalid_item' };

      // Step 1: deduct Sprouts. Bails (no inventory change) if the balance is short.
      const spend = await EconomyService.spendSprouts(uid, item.price, `powerup:${item.id}`);
      if (!spend.success) {
        return { success: false, balance: spend.balance, inventory: await this.getInventory(uid), error: spend.error };
      }

      // Step 2: read the current inventory and increment this item by one.
      const current = await this.getInventory(uid);
      const next = { ...current, [item.id]: (current[item.id] || 0) + 1 };

      // Step 3: persist the new inventory map.
      const { error: updErr } = await supabase
        .from('user_levels')
        .update({ inventory: next, updated_at: new Date().toISOString() })
        .eq('user_id', uid);

      if (updErr) {
        // Grant failed after the spend went through — refund so the user keeps parity.
        // multiplier:false so the refund returns exactly what was spent, never doubled.
        const refunded = await EconomyService.awardSprouts(uid, item.price, `powerup_refund:${item.id}`, { multiplier: false });
        return {
          success: false,
          balance: refunded ?? spend.balance + item.price,
          inventory: current,
          error: 'write_failed',
        };
      }

      // Audit trail (non-critical — reuses game_activity_log, never blocks).
      gameDatabaseService.logActivity({
        activityType: 'powerup_purchased',
        details: { itemId: item.id, price: item.price, owned: next[item.id] },
        amount: item.price,
      });

      console.log(`🛒 Bought power-up ${item.id} → owned ${next[item.id]}, balance ${spend.balance}`);
      return { success: true, balance: spend.balance, inventory: next };
    } catch (err) {
      console.warn('⚠️ buyItem error:', err.message);
      return { success: false, balance: 0, inventory: {}, error: err.message };
    }
  }

  // ─── core: consume ────────────────────────────────────────

  /**
   * Spend one (or more) of a power-up from the inventory — the hook the game loop
   * will call when a power-up's effect actually fires (streak save, reroll, etc.).
   * No-ops (returns failure) if the user doesn't own enough. Floors at zero.
   *
   * @returns {Promise<{success: boolean, inventory: object, error?: string}>}
   */
  async consumeItem(userId, itemId, qty = 1) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return { success: false, inventory: {}, error: 'not_authenticated' };

      const amt = Math.max(1, Math.round(Number(qty) || 1));
      const current = await this.getInventory(uid);
      const have = current[itemId] || 0;
      if (have < amt) {
        return { success: false, inventory: current, error: 'not_owned' };
      }

      const next = { ...current, [itemId]: have - amt };
      const { error: updErr } = await supabase
        .from('user_levels')
        .update({ inventory: next, updated_at: new Date().toISOString() })
        .eq('user_id', uid);
      if (updErr) throw updErr;

      gameDatabaseService.logActivity({
        activityType: 'powerup_consumed',
        details: { itemId, qty: amt, owned: next[itemId] },
      });

      return { success: true, inventory: next };
    } catch (err) {
      console.warn('⚠️ consumeItem error:', err.message);
      return { success: false, inventory: {}, error: err.message };
    }
  }

  // Grant items back into inventory without charging (the inverse of consumeItem).
  // Used to roll back an activation whose side-effect failed after the decrement.
  async _grantItem(uid, itemId, qty = 1) {
    try {
      const amt = Math.max(1, Math.round(Number(qty) || 1));
      const current = await this.getInventory(uid);
      const next = { ...current, [itemId]: (current[itemId] || 0) + amt };
      await supabase
        .from('user_levels')
        .update({ inventory: next, updated_at: new Date().toISOString() })
        .eq('user_id', uid);
      return next;
    } catch (err) {
      console.warn('⚠️ _grantItem error:', err.message);
      return null;
    }
  }

  // ─── activation: Double Sprout Token ──────────────────────

  /**
   * Activate a Double Sprout Token: consume one from inventory and start the 24h
   * 2x earn buff (EconomyService owns the timer). Consume-first so a failed buff
   * write rolls the token back — the user is never charged a token for no buff.
   * No-ops if the buff is already running (don't waste a token).
   *
   * @returns {Promise<{success: boolean, inventory: object, expiry?: number, error?: string}>}
   */
  async activateDoubleSprouts(userId) {
    try {
      const uid = await this._resolveUserId(userId);
      if (!uid) return { success: false, inventory: {}, error: 'not_authenticated' };

      // Already boosted → keep the token for later, surface the live expiry.
      const status = await EconomyService.getMultiplierStatus(uid);
      if (status.active) {
        return { success: false, inventory: await this.getInventory(uid), expiry: status.expiry, error: 'already_active' };
      }

      // Step 1: consume the token (fails cleanly if none owned).
      const consumed = await this.consumeItem(uid, 'double_sprouts', 1);
      if (!consumed.success) {
        return { success: false, inventory: consumed.inventory, error: consumed.error || 'not_owned' };
      }

      // Step 2: arm the buff. If the timer write fails, refund the token.
      const expiry = await EconomyService.setMultiplier(uid);
      if (!expiry) {
        const restored = await this._grantItem(uid, 'double_sprouts', 1);
        return { success: false, inventory: restored ?? consumed.inventory, error: 'activation_failed' };
      }

      console.log(`🌱✨ Double Sprout Token used → 2x until ${new Date(expiry).toISOString()}`);
      return { success: true, inventory: consumed.inventory, expiry };
    } catch (err) {
      console.warn('⚠️ activateDoubleSprouts error:', err.message);
      return { success: false, inventory: {}, error: err.message };
    }
  }
}

// Export a singleton instance (matches EconomyService / GameDatabaseService).
const inventoryService = new InventoryService();
export default inventoryService;
