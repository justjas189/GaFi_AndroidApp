// src/data/powerups.js
//
// Single source of truth for consumable power-ups sold in the Trading Post.
//
// Power-ups differ from cosmetics (src/data/cosmetics.js): cosmetics are one-time
// toggles (own it once, equip/unequip), while power-ups are CONSUMABLES the user can
// stack multiples of. Ownership is therefore a count, persisted as a JSONB map of
// `id` -> quantity on user_levels.inventory (see 20260625_add_powerup_inventory.sql).
//
// Each item's `id` is the contract: it is the JSONB key in the inventory map and the
// reason tag passed to EconomyService.spendSprouts (`powerup:<id>`). Prices are in
// Sprouts. Keep this catalogue as the only place prices/copy are defined so the store,
// inventory, and any future "use this power-up" surface never drift apart.
//
// NOTE: this step ships the store + inventory only. Wiring each power-up's EFFECT into
// the game loop (streak protection, task reroll, the 2x earn window, week skip) is
// follow-up work — InventoryService.consumeItem() is the hook those flows will call.

export const POWERUPS = [
  {
    id: 'streak_shield',
    name: 'Streak Shield',
    description: 'Keep your daily streak alive through one missed day.',
    price: 60,
    icon: 'shield-checkmark',
    color: '#2EC4B6',
  },
  {
    id: 'quest_reroll',
    name: 'Quest Reroll',
    description: "Swap a daily task you don't like for a fresh one.",
    price: 40,
    icon: 'dice',
    color: '#7C5CFC',
  },
  {
    id: 'double_sprouts',
    name: 'Double Sprout Token',
    description: 'Double the Sprouts you earn for the next 24 hours.',
    price: 30,
    icon: 'sparkles',
    color: '#F5A623',
    // First power-up whose effect is wired (the others are store-only for now): owning
    // one shows a "Use" action that arms the 24h 2x earn buff via
    // InventoryService.activateDoubleSprouts → EconomyService.setMultiplier.
    activatable: true,
  },
  {
    id: 'week_skip',
    name: 'Week Skip Pass',
    description: 'Auto-pass one Story week when money is tight.',
    price: 150,
    icon: 'play-skip-forward',
    color: '#EC407A',
  },
];

export default POWERUPS;
