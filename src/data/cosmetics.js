// src/data/cosmetics.js
//
// Single source of truth for character cosmetics (skins).
//
// Three screens used to each carry their own copy of this catalogue, which drifted
// apart over time (mismatched prices/descriptions, the selected_character CHECK-key
// bug). They now all read from `COSMETICS` below:
//   • BoutiqueScreen        — maps COSMETICS into the Sprouts store grid
//   • AchievementDashboard  — maps COSMETICS into the legacy Store modal
//   • GameScreen (Closet)   — consumes the derived CHARACTER_SPRITES lookup
//
// Each cosmetic's `characterKey` is the contract that ties everything together: it
// is the key in CHARACTER_SPRITES, the value persisted to
// character_customizations.selected_character, and the value stored in
// unlocked_characters. Keep these keys in lockstep with the DB CHECK constraint
// (see 20260625_align_character_skin_constraint.sql) — a key here that the
// constraint rejects makes "Equip" silently fail.
//
// Pricing in Sprouts. `isDefault: true` skins are owned by everyone from day one;
// they can be equipped but never bought (price 0).
//
// NOTE: every `sprite` require() uses a static string literal on purpose — Metro
// resolves asset requires at bundle time and cannot follow a variable/template path.

export const COSMETICS = [
  {
    id: 'skin_girl',
    characterKey: 'girl',
    name: 'Maya',
    description: 'The default bright student with big dreams',
    price: 0,
    icon: '👧',
    color: '#FF69B4',
    isDefault: true,
    sprite: require('../../assets/Game_Graphics/Character_Animation/GirlWalk.png'),
  },
  {
    id: 'skin_jasper',
    characterKey: 'jasper',
    name: 'Jasper',
    description: 'A determined young saver',
    price: 0,
    icon: '👦',
    color: '#4A90D9',
    isDefault: true,
    sprite: require('../../assets/Game_Graphics/Character_Animation/JasperWalk.png'),
  },
  {
    id: 'skin_businessman',
    characterKey: 'businessman',
    name: 'Business Marco',
    description: 'A professional look for the serious saver',
    price: 50,
    icon: '👔',
    color: '#2C3E50',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Businessman.png'),
  },
  {
    id: 'skin_businesswoman',
    characterKey: 'businesswoman',
    name: 'Business Elena',
    description: 'Power suit for the ambitious achiever',
    price: 50,
    icon: '👩‍💼',
    color: '#8E44AD',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Businesswoman.png'),
  },
  {
    id: 'skin_budget_trainer',
    characterKey: 'budget_trainer',
    name: 'Budget Trainer',
    description: "Gotta save 'em all! A trainer of budgets",
    price: 100,
    icon: '🧢',
    color: '#E53935',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Budget Trainer.png'),
  },
  {
    id: 'skin_martial_artist',
    characterKey: 'martial_artist',
    name: 'Martial Artist',
    description: 'Disciplined finances, disciplined life',
    price: 100,
    icon: '🥋',
    color: '#FFC107',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Martial Artist.png'),
  },
  {
    id: 'skin_chef_stephen',
    characterKey: 'chef_stephen',
    name: 'Chef Stephen',
    description: 'Cooking up smart savings recipes',
    price: 75,
    icon: '👨‍🍳',
    color: '#FF7043',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Chef Stephen.png'),
  },
  {
    id: 'skin_detective_carol',
    characterKey: 'detective_carol',
    name: 'Detective Carol',
    description: 'Investigating every peso spent',
    price: 75,
    icon: '🕵️',
    color: '#5C6BC0',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Detective Carol.png'),
  },
  {
    id: 'skin_lily',
    characterKey: 'lily',
    name: 'Lily',
    description: 'A cheerful saver with a green thumb',
    price: 50,
    icon: '🌸',
    color: '#66BB6A',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Lily.png'),
  },
  {
    id: 'skin_mira',
    characterKey: 'mira',
    name: 'Mira',
    description: 'A tech-savvy student tracking every cent',
    price: 50,
    icon: '💜',
    color: '#AB47BC',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Mira.png'),
  },
  {
    id: 'skin_head_nurse',
    characterKey: 'head_nurse',
    name: 'Head Nurse',
    description: 'Healing your finances back to health',
    price: 100,
    icon: '👩‍⚕️',
    color: '#EC407A',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Head Nurse.png'),
  },
  {
    id: 'skin_policeman',
    characterKey: 'policeman',
    name: 'Officer Dan',
    description: 'Keeping your spending in check',
    price: 75,
    icon: '👮',
    color: '#1565C0',
    isDefault: false,
    sprite: require('../../assets/Game_Graphics/Character_Animation/Policeman.png'),
  },
];

// characterKeys owned by everyone from day one. Boutique + Store seed ownership
// from this; GameScreen's Closet uses it as the unlock floor.
export const DEFAULT_OWNED_KEYS = COSMETICS
  .filter((item) => item.isDefault)
  .map((item) => item.characterKey);

// GameScreen consumes a lookup keyed by characterKey (CHARACTER_SPRITES[selectedCharacter])
// and iterates it for the Closet. Derived from COSMETICS so order + data stay in sync.
// Insertion order follows the COSMETICS array, which is the Closet's display order.
export const CHARACTER_SPRITES = COSMETICS.reduce((acc, item) => {
  acc[item.characterKey] = {
    name: item.name,
    description: item.description,
    sprite: item.sprite,
    icon: item.icon,
    color: item.color,
  };
  return acc;
}, {});

export default COSMETICS;
