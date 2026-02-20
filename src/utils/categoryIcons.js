/**
 * Shared category icon mapping — single source of truth for Ionicons names.
 *
 * Keys match the canonical Title-Case category names defined in categoryUtils.js.
 * Both ExpenseScreen and CalendarScreen import from here so every screen renders
 * identical icons for the same category.
 */

import { normalizeCategory } from './categoryUtils';

const CATEGORY_ICON_MAP = {
  'Food & Dining':  'fast-food-outline',
  'Transport':      'bus-outline',
  'Shopping':       'cart-outline',
  'Groceries':      'nutrition-outline',
  'Entertainment':  'film-outline',
  'Electronics':    'phone-portrait-outline',
  'School Supplies':'book-outline',
  'Utilities':      'build-outline',
  'Health':         'medkit-outline',
  'Education':      'school-outline',
  'Other':          'apps-outline',
  'No Spend Day':   'checkmark-circle-outline',
};

/**
 * Returns the Ionicons icon name for a given expense category.
 *
 * Internally normalizes the raw category string via `normalizeCategory` so
 * legacy or variant spellings (e.g. "food", "transportation") resolve
 * correctly without any extra handling at the call site.
 *
 * @param {string} category  Raw category string from DB or user input.
 * @returns {string}         Ionicons icon name.
 */
export const getCategoryIcon = (category) => {
  const canonical = normalizeCategory(category);
  return CATEGORY_ICON_MAP[canonical] || 'apps-outline';
};

export default getCategoryIcon;
