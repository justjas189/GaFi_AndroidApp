/**
 * Category normalization utility.
 *
 * Maps every known category variant (legacy DB names, shorthand, etc.)
 * to the canonical Title-Case names used by GameScreen EXPENSE_CATEGORIES.
 *
 * Canonical categories:
 *   Food & Dining, Transport, Shopping, Groceries, Entertainment,
 *   Electronics, School Supplies, Utilities, Health, Education,
 *   Other, No Spend Day
 */

const CATEGORY_MAP = {
  // ── Food & Dining ──────────────────────────────
  'food & dining': 'Food & Dining',
  'food and dining': 'Food & Dining',
  'food': 'Food & Dining',
  'meals': 'Food & Dining',
  'dining': 'Food & Dining',
  'restaurant': 'Food & Dining',
  'takeout': 'Food & Dining',
  'snacks': 'Food & Dining',
  'coffee': 'Food & Dining',
  'cafe': 'Food & Dining',

  // ── Transport ──────────────────────────────────
  'transport': 'Transport',
  'transportation': 'Transport',
  'commute': 'Transport',
  'travel': 'Transport',
  'fuel': 'Transport',
  'gas': 'Transport',
  'bus': 'Transport',
  'uber': 'Transport',
  'grab': 'Transport',

  // ── Shopping ───────────────────────────────────
  'shopping': 'Shopping',
  'shop': 'Shopping',
  'clothes': 'Shopping',
  'clothing': 'Shopping',
  'shoes': 'Shopping',

  // ── Groceries ──────────────────────────────────
  'groceries': 'Groceries',
  'grocery': 'Groceries',

  // ── Entertainment ──────────────────────────────
  'entertainment': 'Entertainment',
  'leisure': 'Entertainment',
  'fun': 'Entertainment',
  'movies': 'Entertainment',
  'cinema': 'Entertainment',
  'games': 'Entertainment',
  'gaming': 'Entertainment',
  'hobby': 'Entertainment',

  // ── Electronics ────────────────────────────────
  'electronics': 'Electronics',
  'gadgets': 'Electronics',
  'tech': 'Electronics',
  'laptop': 'Electronics',
  'phone': 'Electronics',

  // ── School Supplies ────────────────────────────
  'school supplies': 'School Supplies',
  'school': 'School Supplies',
  'supplies': 'School Supplies',
  'textbooks': 'School Supplies',
  'stationery': 'School Supplies',
  'books': 'School Supplies',

  // ── Utilities ──────────────────────────────────
  'utilities': 'Utilities',
  'bills': 'Utilities',
  'utility': 'Utilities',
  'electricity': 'Utilities',
  'water': 'Utilities',
  'internet': 'Utilities',
  'rent': 'Utilities',

  // ── Health ─────────────────────────────────────
  'health': 'Health',
  'medical': 'Health',
  'medicine': 'Health',
  'doctor': 'Health',

  // ── Education ──────────────────────────────────
  'education': 'Education',
  'tuition': 'Education',
  'school fees': 'Education',
  'course': 'Education',

  // ── Other ──────────────────────────────────────
  'other': 'Other',
  'others': 'Other',
  'misc': 'Other',
  'miscellaneous': 'Other',

  // ── No Spend Day ───────────────────────────────
  'no spend day': 'No Spend Day',
  'no spend': 'No Spend Day',
};

/**
 * Normalizes a category string to the canonical Title-Case name.
 *
 * @param {string} category  Raw category from DB or user input.
 * @returns {string}         Canonical category name (e.g. "Food & Dining").
 */
export const normalizeCategory = (category) => {
  if (!category) return 'Other';
  const key = category.toLowerCase().trim();
  return CATEGORY_MAP[key] || 'Other';
};

export default normalizeCategory;
