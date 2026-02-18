-- Migration: Expand selected_character CHECK constraint for all purchasable skins
-- Date: 2025-07-28
-- Adds: ash_ketchum, bruce_lee, chef_stephen, detective_carol, lily, mira, nurse_joy, policeman

ALTER TABLE character_customizations
  DROP CONSTRAINT IF EXISTS character_customizations_selected_character_check;

ALTER TABLE character_customizations
  ADD CONSTRAINT character_customizations_selected_character_check
  CHECK (selected_character IN (
    'girl', 'jasper', 'businessman', 'businesswoman',
    'ash_ketchum', 'bruce_lee', 'chef_stephen', 'detective_carol',
    'lily', 'mira', 'nurse_joy', 'policeman'
  ));
