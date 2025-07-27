/**
 * Security utilities for MoneyTrack
 * Handles data encryption, secure storage, and security validations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import DebugUtils from './DebugUtils';

class SecurityManager {
  constructor() {
    this.encryptionKey = null;
    this.secureFields = new Set(['password', 'pin', 'token', 'secret', 'key']);
    this.rateLimits = new Map();
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 300000; // 5 minutes
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    try {
      await this.initializeEncryption();
      this.setupRateLimiting();
      DebugUtils.debug('SECURITY', 'Security manager initialized');
    } catch (error) {
      DebugUtils.error('SECURITY', 'Failed to initialize security manager', error);
    }
  }

  /**
   * Initialize encryption (simplified for React Native)
   */
  async initializeEncryption() {
    // In a real app, you'd use react-native-keychain or similar
    // For now, we'll use a basic approach
    const storedKey = await AsyncStorage.getItem('app_encryption_key');
    if (!storedKey) {
      this.encryptionKey = this.generateSimpleKey();
      await AsyncStorage.setItem('app_encryption_key', this.encryptionKey);
    } else {
      this.encryptionKey = storedKey;
    }
  }

  /**
   * Generate a simple encryption key (for demonstration)
   */
  generateSimpleKey() {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('');
  }

  /**
   * Simple encryption (for demonstration - use proper encryption in production)
   */
  encrypt(data) {
    if (!data || typeof data !== 'string') return data;
    
    try {
      // Simple XOR encryption (NOT SECURE - use proper encryption in production)
      const key = this.encryptionKey;
      let result = '';
      
      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i);
        const keyCode = key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode ^ keyCode);
      }
      
      return btoa(result); // Base64 encode
    } catch (error) {
      DebugUtils.error('SECURITY', 'Encryption failed', error);
      return data;
    }
  }

  /**
   * Simple decryption (for demonstration)
   */
  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') return encryptedData;
    
    try {
      const data = atob(encryptedData); // Base64 decode
      const key = this.encryptionKey;
      let result = '';
      
      for (let i = 0; i < data.length; i++) {
        const charCode = data.charCodeAt(i);
        const keyCode = key.charCodeAt(i % key.length);
        result += String.fromCharCode(charCode ^ keyCode);
      }
      
      return result;
    } catch (error) {
      DebugUtils.error('SECURITY', 'Decryption failed', error);
      return encryptedData;
    }
  }

  /**
   * Securely store sensitive data
   */
  async secureStore(key, value) {
    try {
      let dataToStore = value;
      
      // Encrypt sensitive data
      if (this.isSensitiveData(key, value)) {
        dataToStore = this.encrypt(JSON.stringify(value));
      } else if (typeof value === 'object') {
        dataToStore = JSON.stringify(value);
      }
      
      await AsyncStorage.setItem(`secure_${key}`, dataToStore);
      DebugUtils.debug('SECURITY', 'Data securely stored', { key });
    } catch (error) {
      DebugUtils.error('SECURITY', 'Secure storage failed', error);
      throw error;
    }
  }

  /**
   * Securely retrieve stored data
   */
  async secureRetrieve(key) {
    try {
      const storedData = await AsyncStorage.getItem(`secure_${key}`);
      if (!storedData) return null;
      
      // Decrypt if it was encrypted
      if (this.isSensitiveData(key)) {
        return JSON.parse(this.decrypt(storedData));
      }
      
      try {
        return JSON.parse(storedData);
      } catch {
        return storedData;
      }
    } catch (error) {
      DebugUtils.error('SECURITY', 'Secure retrieval failed', error);
      return null;
    }
  }

  /**
   * Check if data is sensitive
   */
  isSensitiveData(key, value = null) {
    const keyLower = key.toLowerCase();
    
    // Check if key contains sensitive field names
    for (const field of this.secureFields) {
      if (keyLower.includes(field)) return true;
    }
    
    // Check if value contains sensitive data
    if (value && typeof value === 'object') {
      const valueStr = JSON.stringify(value).toLowerCase();
      for (const field of this.secureFields) {
        if (valueStr.includes(field)) return true;
      }
    }
    
    return false;
  }

  /**
   * Setup rate limiting
   */
  setupRateLimiting() {
    // Clear old rate limit entries every hour
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.rateLimits) {
        if (now - data.lastAttempt > 3600000) { // 1 hour
          this.rateLimits.delete(key);
        }
      }
    }, 3600000);
  }

  /**
   * Check rate limit for an action
   */
  checkRateLimit(identifier, action = 'default') {
    const key = `${identifier}_${action}`;
    const now = Date.now();
    const rateLimitData = this.rateLimits.get(key);
    
    if (!rateLimitData) {
      this.rateLimits.set(key, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
        isLocked: false
      });
      return { allowed: true, remainingAttempts: this.maxLoginAttempts - 1 };
    }
    
    // Check if still locked out
    if (rateLimitData.isLocked && (now - rateLimitData.lastAttempt) < this.lockoutDuration) {
      const timeRemaining = this.lockoutDuration - (now - rateLimitData.lastAttempt);
      return { 
        allowed: false, 
        isLocked: true, 
        timeRemaining: Math.ceil(timeRemaining / 1000) 
      };
    }
    
    // Reset if lockout period expired
    if (rateLimitData.isLocked && (now - rateLimitData.lastAttempt) >= this.lockoutDuration) {
      rateLimitData.attempts = 0;
      rateLimitData.isLocked = false;
    }
    
    // Increment attempts
    rateLimitData.attempts++;
    rateLimitData.lastAttempt = now;
    
    // Check if should be locked
    if (rateLimitData.attempts >= this.maxLoginAttempts) {
      rateLimitData.isLocked = true;
      DebugUtils.warn('SECURITY', 'Rate limit exceeded', { identifier, action, attempts: rateLimitData.attempts });
      return { 
        allowed: false, 
        isLocked: true, 
        timeRemaining: Math.ceil(this.lockoutDuration / 1000) 
      };
    }
    
    return { 
      allowed: true, 
      remainingAttempts: this.maxLoginAttempts - rateLimitData.attempts 
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  resetRateLimit(identifier, action = 'default') {
    const key = `${identifier}_${action}`;
    this.rateLimits.delete(key);
    DebugUtils.debug('SECURITY', 'Rate limit reset', { identifier, action });
  }

  /**
   * Validate and sanitize financial amount
   */
  validateFinancialAmount(amount) {
    if (typeof amount === 'string') {
      // Remove currency symbols and formatting
      amount = amount.replace(/[₱$,\s]/g, '');
    }
    
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
      throw new Error('Invalid amount format');
    }
    
    if (numAmount < 0) {
      throw new Error('Amount cannot be negative');
    }
    
    if (numAmount > 10000000) { // 10 million limit
      throw new Error('Amount exceeds maximum limit');
    }
    
    // Round to 2 decimal places
    return Math.round(numAmount * 100) / 100;
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  sanitizeInput(input, options = {}) {
    if (!input || typeof input !== 'string') return input;
    
    let sanitized = input.trim();
    
    // Remove potentially dangerous characters
    if (options.strict !== false) {
      sanitized = sanitized.replace(/[<>"\';\\]/g, '');
    }
    
    // Limit length
    const maxLength = options.maxLength || 1000;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    return sanitized;
  }

  /**
   * Generate secure session token
   */
  generateSessionToken() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const platform = Platform.OS.substring(0, 3);
    
    return `${timestamp}_${random}_${platform}`;
  }

  /**
   * Validate session token
   */
  validateSessionToken(token) {
    if (!token || typeof token !== 'string') return false;
    
    const parts = token.split('_');
    if (parts.length !== 3) return false;
    
    const [timestamp, random, platform] = parts;
    
    // Check timestamp (token shouldn't be older than 24 hours)
    const tokenTime = parseInt(timestamp, 36);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (now - tokenTime > maxAge) return false;
    
    // Basic format validation
    if (random.length < 8 || platform.length !== 3) return false;
    
    return true;
  }

  /**
   * Hash sensitive data (simple implementation)
   */
  hash(data) {
    if (!data) return data;
    
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  /**
   * Validate email format
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check password strength
   */
  checkPasswordStrength(password) {
    const strength = {
      score: 0,
      feedback: []
    };
    
    if (!password) {
      strength.feedback.push('Password is required');
      return strength;
    }
    
    if (password.length >= 8) {
      strength.score++;
    } else {
      strength.feedback.push('Password should be at least 8 characters long');
    }
    
    if (/[A-Z]/.test(password)) {
      strength.score++;
    } else {
      strength.feedback.push('Password should contain uppercase letters');
    }
    
    if (/[a-z]/.test(password)) {
      strength.score++;
    } else {
      strength.feedback.push('Password should contain lowercase letters');
    }
    
    if (/\d/.test(password)) {
      strength.score++;
    } else {
      strength.feedback.push('Password should contain numbers');
    }
    
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      strength.score++;
    } else {
      strength.feedback.push('Password should contain special characters');
    }
    
    return strength;
  }

  /**
   * Secure data cleanup when user logs out
   */
  async secureCleanup() {
    try {
      // Clear sensitive stored data
      const keys = await AsyncStorage.getAllKeys();
      const secureKeys = keys.filter(key => key.startsWith('secure_'));
      
      await AsyncStorage.multiRemove(secureKeys);
      
      // Clear rate limits
      this.rateLimits.clear();
      
      // Clear encryption key
      this.encryptionKey = null;
      
      DebugUtils.debug('SECURITY', 'Secure cleanup completed');
    } catch (error) {
      DebugUtils.error('SECURITY', 'Secure cleanup failed', error);
    }
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      encryptionEnabled: !!this.encryptionKey,
      activeRateLimits: this.rateLimits.size,
      platform: Platform.OS,
      secureStorageAvailable: !!AsyncStorage,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export default new SecurityManager();
