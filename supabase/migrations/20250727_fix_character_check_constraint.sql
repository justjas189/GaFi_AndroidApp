-- Migration: Expand selected_character CHECK constraint to include all purchasable skins
-- Date: 2025-07-27
-- Problem: CHECK only allowed ('girl', 'jasper') but Store sells 'businessman' & 'businesswoman' skins

ALTER TABLE character_customizations
  DROP CONSTRAINT IF EXISTS character_customizations_selected_character_check;

ALTER TABLE character_customizations
  ADD CONSTRAINT character_customizations_selected_character_check
  CHECK (selected_character IN ('girl', 'jasper', 'businessman', 'businesswoman'));
