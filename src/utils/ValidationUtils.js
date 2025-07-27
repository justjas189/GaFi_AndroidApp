/**
 * Input validation utilities for MoneyTrack
 * Provides comprehensive validation for financial data and user inputs
 */

// Financial validation constants
const VALIDATION_RULES = {
  amount: {
    min: 0.01,
    max: 1000000,
    precision: 2
  },
  description: {
    minLength: 1,
    maxLength: 500
  },
  category: {
    allowed: ['food', 'transportation', 'entertainment', 'shopping', 'utilities', 'others']
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '@$!%*?&'
  }
};

/**
 * Validate monetary amount
 * @param {number|string} amount - Amount to validate
 * @returns {Object} Validation result
 */
export const validateAmount = (amount) => {
  const result = { isValid: true, errors: [], sanitized: null };
  
  // Convert to number if string
  let numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[₱,\s]/g, '')) : amount;
  
  if (isNaN(numAmount)) {
    result.isValid = false;
    result.errors.push('Amount must be a valid number');
    return result;
  }
  
  if (numAmount < VALIDATION_RULES.amount.min) {
    result.isValid = false;
    result.errors.push(`Amount must be at least ₱${VALIDATION_RULES.amount.min}`);
  }
  
  if (numAmount > VALIDATION_RULES.amount.max) {
    result.isValid = false;
    result.errors.push(`Amount cannot exceed ₱${VALIDATION_RULES.amount.max.toLocaleString()}`);
  }
  
  // Round to 2 decimal places
  result.sanitized = Math.round(numAmount * 100) / 100;
  
  return result;
};

/**
 * Validate expense category
 * @param {string} category - Category to validate
 * @returns {Object} Validation result
 */
export const validateCategory = (category) => {
  const result = { isValid: true, errors: [], sanitized: null };
  
  if (!category || typeof category !== 'string') {
    result.isValid = false;
    result.errors.push('Category is required');
    return result;
  }
  
  const normalizedCategory = category.toLowerCase().trim();
  
  if (!VALIDATION_RULES.category.allowed.includes(normalizedCategory)) {
    result.sanitized = 'others'; // Default fallback
    result.errors.push(`Category '${category}' not recognized, defaulting to 'others'`);
  } else {
    result.sanitized = normalizedCategory;
  }
  
  return result;
};

/**
 * Validate description/note
 * @param {string} description - Description to validate
 * @returns {Object} Validation result
 */
export const validateDescription = (description) => {
  const result = { isValid: true, errors: [], sanitized: null };
  
  if (!description) {
    result.sanitized = '';
    return result;
  }
  
  if (typeof description !== 'string') {
    result.isValid = false;
    result.errors.push('Description must be text');
    return result;
  }
  
  const trimmed = description.trim();
  
  if (trimmed.length > VALIDATION_RULES.description.maxLength) {
    result.isValid = false;
    result.errors.push(`Description cannot exceed ${VALIDATION_RULES.description.maxLength} characters`);
    return result;
  }
  
  // Sanitize description (remove potentially harmful content)
  result.sanitized = trimmed
    .replace(/[<>]/g, '') // Remove < and > to prevent XSS
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  return result;
};

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export const validateEmail = (email) => {
  const result = { isValid: true, errors: [], sanitized: null };
  
  if (!email || typeof email !== 'string') {
    result.isValid = false;
    result.errors.push('Email is required');
    return result;
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (!VALIDATION_RULES.email.pattern.test(trimmed)) {
    result.isValid = false;
    result.errors.push('Please enter a valid email address');
    return result;
  }
  
  result.sanitized = trimmed;
  return result;
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with strength details
 */
export const validatePassword = (password) => {
  const result = { 
    isValid: true, 
    errors: [], 
    strength: {
      score: 0,
      hasUppercase: false,
      hasLowercase: false,
      hasNumbers: false,
      hasSpecialChars: false,
      hasMinLength: false
    }
  };
  
  if (!password || typeof password !== 'string') {
    result.isValid = false;
    result.errors.push('Password is required');
    return result;
  }
  
  const rules = VALIDATION_RULES.password;
  
  // Check length
  if (password.length >= rules.minLength) {
    result.strength.hasMinLength = true;
    result.strength.score++;
  } else {
    result.isValid = false;
    result.errors.push(`Password must be at least ${rules.minLength} characters long`);
  }
  
  // Check uppercase
  if (/[A-Z]/.test(password)) {
    result.strength.hasUppercase = true;
    result.strength.score++;
  } else if (rules.requireUppercase) {
    result.isValid = false;
    result.errors.push('Password must contain at least one uppercase letter');
  }
  
  // Check lowercase
  if (/[a-z]/.test(password)) {
    result.strength.hasLowercase = true;
    result.strength.score++;
  } else if (rules.requireLowercase) {
    result.isValid = false;
    result.errors.push('Password must contain at least one lowercase letter');
  }
  
  // Check numbers
  if (/\d/.test(password)) {
    result.strength.hasNumbers = true;
    result.strength.score++;
  } else if (rules.requireNumbers) {
    result.isValid = false;
    result.errors.push('Password must contain at least one number');
  }
  
  // Check special characters
  const specialCharRegex = new RegExp(`[${rules.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
  if (specialCharRegex.test(password)) {
    result.strength.hasSpecialChars = true;
    result.strength.score++;
  } else if (rules.requireSpecialChars) {
    result.isValid = false;
    result.errors.push(`Password must contain at least one special character (${rules.specialChars})`);
  }
  
  return result;
};

/**
 * Validate date input
 * @param {string|Date} date - Date to validate
 * @returns {Object} Validation result
 */
export const validateDate = (date) => {
  const result = { isValid: true, errors: [], sanitized: null };
  
  let dateObj;
  
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    result.isValid = false;
    result.errors.push('Invalid date format');
    return result;
  }
  
  if (isNaN(dateObj.getTime())) {
    result.isValid = false;
    result.errors.push('Invalid date');
    return result;
  }
  
  // Check if date is not too far in the future
  const now = new Date();
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  if (dateObj > oneYearFromNow) {
    result.isValid = false;
    result.errors.push('Date cannot be more than one year in the future');
    return result;
  }
  
  // Check if date is not too far in the past (10 years)
  const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  
  if (dateObj < tenYearsAgo) {
    result.isValid = false;
    result.errors.push('Date cannot be more than 10 years in the past');
    return result;
  }
  
  result.sanitized = dateObj.toISOString();
  return result;
};

/**
 * Validate complete expense object
 * @param {Object} expense - Expense object to validate
 * @returns {Object} Validation result with sanitized data
 */
export const validateExpense = (expense) => {
  const result = { isValid: true, errors: [], sanitized: {} };
  
  if (!expense || typeof expense !== 'object') {
    result.isValid = false;
    result.errors.push('Expense data is required');
    return result;
  }
  
  // Validate amount
  const amountValidation = validateAmount(expense.amount);
  if (!amountValidation.isValid) {
    result.isValid = false;
    result.errors.push(...amountValidation.errors);
  } else {
    result.sanitized.amount = amountValidation.sanitized;
  }
  
  // Validate category
  const categoryValidation = validateCategory(expense.category);
  result.sanitized.category = categoryValidation.sanitized;
  if (categoryValidation.errors.length > 0) {
    result.errors.push(...categoryValidation.errors);
  }
  
  // Validate description
  const descriptionValidation = validateDescription(expense.note || expense.description);
  if (!descriptionValidation.isValid) {
    result.isValid = false;
    result.errors.push(...descriptionValidation.errors);
  } else {
    result.sanitized.note = descriptionValidation.sanitized;
  }
  
  // Validate date
  const dateValidation = validateDate(expense.date || new Date());
  if (!dateValidation.isValid) {
    result.isValid = false;
    result.errors.push(...dateValidation.errors);
  } else {
    result.sanitized.date = dateValidation.sanitized;
  }
  
  return result;
};

/**
 * Sanitize user input for database storage
 * @param {string} input - Raw user input
 * @returns {string} Sanitized input
 */
export const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potential XSS characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 1000); // Limit length
};

export default {
  validateAmount,
  validateCategory,
  validateDescription,
  validateEmail,
  validatePassword,
  validateDate,
  validateExpense,
  sanitizeInput,
  VALIDATION_RULES
};
