-- Sprouts economy — the soft currency earned through real financial behaviour.
-- Purpose: decouple the spendable in-game currency ("Sprouts") from lifetime XP /
--   the leaderboard score. Before this, "Spendable" was derived as
--   (earned XP − spent XP), so spending in the store implicitly spent XP. Sprouts
--   are now a real, independently-awarded balance.
-- Date: 2026-06-25
--
-- Storage lives on user_levels (the per-user game-stat row) so it rides along with
-- the existing loadGameProgress / incrementUserLevelStats plumbing. Existing
-- user_levels RLS policies already scope every row to its owner, so no new policy
-- is required for these columns.
--
-- Earn rates (enforced in src/services/EconomyService.js):
--   +10  per Story Mode daily task completed
--   +50  per Story Mode level/week passed
--   +5   per Custom Mode expense logged (capped at the first 3 logs / day, anti-farm)
-- Sink: AchievementDashboard store (character skins) deducts from sprouts_balance.
--
-- sprouts_balance  — current spendable balance (goes up on award, down on purchase)
-- sprouts_lifetime — total ever earned (never decreases; for stats / future Chronicle)

ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS sprouts_balance INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS sprouts_lifetime INTEGER NOT NULL DEFAULT 0;

-- Defensive: guarantee no NULLs if the columns pre-existed as nullable.
UPDATE user_levels SET sprouts_balance = 0 WHERE sprouts_balance IS NULL;
UPDATE user_levels SET sprouts_lifetime = 0 WHERE sprouts_lifetime IS NULL;
