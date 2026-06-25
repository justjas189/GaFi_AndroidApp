-- Power-up inventory — consumable items bought in the Trading Post.
-- Date: 2026-06-25
--
-- Unlike cosmetics (one-time toggles persisted on character_customizations), power-ups
-- are CONSUMABLES: a user can own multiples (e.g. 2 Streak Shields). We store the whole
-- inventory as a single JSONB map of itemId -> quantity directly on user_levels, so it
-- rides along with the existing Sprouts balance plumbing (one row read covers both the
-- wallet AND the inventory) and inherits user_levels' owner-scoped RLS policies — no new
-- table or policy required.
--
-- Shape: {"streak_shield": 2, "quest_reroll": 1, "double_sprouts": 0, "week_skip": 1}
-- Catalogue + prices live in src/data/powerups.js; the purchase/spend flow lives in
-- src/services/InventoryService.js (which deducts via EconomyService.spendSprouts so
-- Sprouts stay the single source of truth for the balance).

ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS inventory JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Defensive: guarantee no NULLs if the column pre-existed as nullable.
UPDATE user_levels SET inventory = '{}'::jsonb WHERE inventory IS NULL;
