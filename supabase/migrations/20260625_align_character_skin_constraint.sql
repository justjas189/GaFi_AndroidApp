-- Align the selected_character CHECK constraint with the skins the app actually ships.
-- Date: 2026-06-25
--
-- Why: src/screens/main/GameScreen.js (CHARACTER_SPRITES) and the new Koin's
-- Boutique use the keys `budget_trainer`, `martial_artist`, `head_nurse`. The
-- previous constraint (20250728_expand_character_constraint.sql) only allowed the
-- legacy placeholder keys `ash_ketchum`, `bruce_lee`, `nurse_joy`. Equipping
-- Budget Trainer or Head Nurse (both sold in the Boutique) therefore failed the
-- CHECK on character_customizations.selected_character, so the equip never
-- persisted (saveCharacterCustomization swallows the error → reverts on reload).
--
-- Fix: allow the union of the real keys + the legacy keys (legacy kept so any
-- existing rows / older clients don't violate the constraint).

ALTER TABLE character_customizations
  DROP CONSTRAINT IF EXISTS character_customizations_selected_character_check;

ALTER TABLE character_customizations
  ADD CONSTRAINT character_customizations_selected_character_check
  CHECK (selected_character IN (
    -- Keys the app currently ships (GameScreen CHARACTER_SPRITES + Boutique)
    'girl', 'jasper', 'businessman', 'businesswoman',
    'budget_trainer', 'martial_artist', 'chef_stephen', 'detective_carol',
    'lily', 'mira', 'head_nurse', 'policeman',
    -- Legacy placeholder keys (kept for backwards compatibility)
    'ash_ketchum', 'bruce_lee', 'nurse_joy'
  ));
