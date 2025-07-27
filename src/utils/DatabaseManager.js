/**
 * Database Connection Manager for MoneyTrack
 * Handles connection pooling, retry logic, and error handling
 */

import { supabase } from '../config/supabase';
import DebugUtils from '../utils/DebugUtils';

class DatabaseManager {
  constructor() {
    this.connectionPool = new Map();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000
    };
    this.queryTimeout = 10000; // 10 seconds
  }

  /**
   * Execute query with retry logic and performance monitoring
   * @param {Function} queryFn - Function that returns a Supabase query
   * @param {string} operation - Operation name for logging
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query result
   */
  async executeQuery(queryFn, operation, options = {}) {
    const startTime = DebugUtils.startTimer(`db_${operation}`);
    let lastError;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Set up query timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), this.queryTimeout);
        });

        // Execute query with timeout
        const queryPromise = queryFn();
        const result = await Promise.race([queryPromise, timeoutPromise]);

        // Log successful operation
        const duration = DebugUtils.endTimer(`db_${operation}`, startTime);
        DebugUtils.debug('DATABASE', `${operation} completed`, {
          duration,
          attempt,
          cacheHit: options.fromCache
        });

        return result;

      } catch (error) {
        lastError = error;
        
        // Log attempt failure
        DebugUtils.warn('DATABASE', `${operation} attempt ${attempt} failed`, {
          error: error.message,
          code: error.code,
          details: error.details
        });

        // Don't retry on certain errors
        if (this.isNonRetryableError(error) || attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Calculate delay for next retry
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelay
        );

        await this.sleep(delay);
      }
    }

    // All retries failed
    DebugUtils.error('DATABASE', `${operation} failed after ${this.retryConfig.maxRetries} attempts`, lastError);
    throw lastError;
  }

  /**
   * Check if error should not be retried
   * @param {Error} error - Database error
   * @returns {boolean} True if error should not be retried
   */
  isNonRetryableError(error) {
    const nonRetryableCodes = [
      'PGRST116', // Row not found
      '42P01',    // Table doesn't exist
      '23505',    // Unique constraint violation
      '23503',    // Foreign key violation
      '42501'     // Insufficient privilege
    ];

    return nonRetryableCodes.includes(error.code) || 
           error.message?.includes('JWT') || 
           error.message?.includes('authentication');
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get user expenses with caching and optimization
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Expenses result
   */
  async getUserExpenses(userId, filters = {}) {
    const cacheKey = `expenses_${userId}_${JSON.stringify(filters)}`;
    
    // Check cache first
    if (this.connectionPool.has(cacheKey)) {
      const cached = this.connectionPool.get(cacheKey);
      if (Date.now() - cached.timestamp < 30000) { // 30 second cache
        DebugUtils.debug('DATABASE', 'Returning cached expenses', { userId });
        return { ...cached.data, fromCache: true };
      }
    }

    const result = await this.executeQuery(
      () => {
        let query = supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });

        // Apply filters
        if (filters.startDate) {
          query = query.gte('date', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('date', filters.endDate);
        }
        if (filters.category) {
          query = query.eq('category', filters.category);
        }
        if (filters.limit) {
          query = query.limit(filters.limit);
        }

        return query;
      },
      'getUserExpenses',
      { userId, filters }
    );

    // Cache successful results
    if (result && !result.error) {
      this.connectionPool.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Insert expense with validation and error handling
   * @param {Object} expenseData - Expense data to insert
   * @returns {Promise<Object>} Insert result
   */
  async insertExpense(expenseData) {
    // Validate required fields
    if (!expenseData.user_id || !expenseData.amount) {
      throw new Error('Missing required fields: user_id and amount');
    }

    // Sanitize data
    const sanitizedData = {
      user_id: expenseData.user_id,
      amount: parseFloat(expenseData.amount),
      category: expenseData.category || 'others',
      note: expenseData.note?.substring(0, 500) || '',
      date: expenseData.date || new Date().toISOString()
    };

    const result = await this.executeQuery(
      () => supabase.from('expenses').insert(sanitizedData).select().single(),
      'insertExpense',
      { userId: expenseData.user_id }
    );

    // Invalidate related caches
    this.invalidateUserCache(expenseData.user_id);

    return result;
  }

  /**
   * Update expense with optimistic updates
   * @param {string} expenseId - Expense ID
   * @param {string} userId - User ID for security
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Update result
   */
  async updateExpense(expenseId, userId, updates) {
    const sanitizedUpdates = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    // Remove undefined values
    Object.keys(sanitizedUpdates).forEach(key => {
      if (sanitizedUpdates[key] === undefined) {
        delete sanitizedUpdates[key];
      }
    });

    const result = await this.executeQuery(
      () => supabase
        .from('expenses')
        .update(sanitizedUpdates)
        .eq('id', expenseId)
        .eq('user_id', userId) // Security: ensure user can only update their own expenses
        .select()
        .single(),
      'updateExpense',
      { expenseId, userId }
    );

    // Invalidate related caches
    this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Delete expense with cascade handling
   * @param {string} expenseId - Expense ID
   * @param {string} userId - User ID for security
   * @returns {Promise<Object>} Delete result
   */
  async deleteExpense(expenseId, userId) {
    const result = await this.executeQuery(
      () => supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('user_id', userId) // Security: ensure user can only delete their own expenses
        .select()
        .single(),
      'deleteExpense',
      { expenseId, userId }
    );

    // Invalidate related caches
    this.invalidateUserCache(userId);

    return result;
  }

  /**
   * Get user budget with caching
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Budget result
   */
  async getUserBudget(userId) {
    const cacheKey = `budget_${userId}`;
    
    // Check cache
    if (this.connectionPool.has(cacheKey)) {
      const cached = this.connectionPool.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache for budget
        return { ...cached.data, fromCache: true };
      }
    }

    const result = await this.executeQuery(
      () => supabase
        .from('budgets')
        .select(`
          *,
          budget_categories (*)
        `)
        .eq('user_id', userId)
        .single(),
      'getUserBudget',
      { userId }
    );

    // Cache successful results
    if (result && !result.error) {
      this.connectionPool.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;
  }

  /**
   * Batch insert multiple expenses
   * @param {Array} expenses - Array of expense objects
   * @returns {Promise<Object>} Batch insert result
   */
  async batchInsertExpenses(expenses) {
    if (!Array.isArray(expenses) || expenses.length === 0) {
      throw new Error('Invalid expenses array');
    }

    // Validate and sanitize all expenses
    const sanitizedExpenses = expenses.map(expense => ({
      user_id: expense.user_id,
      amount: parseFloat(expense.amount),
      category: expense.category || 'others',
      note: expense.note?.substring(0, 500) || '',
      date: expense.date || new Date().toISOString()
    }));

    const result = await this.executeQuery(
      () => supabase.from('expenses').insert(sanitizedExpenses).select(),
      'batchInsertExpenses',
      { count: expenses.length }
    );

    // Invalidate caches for affected users
    const userIds = [...new Set(expenses.map(e => e.user_id))];
    userIds.forEach(userId => this.invalidateUserCache(userId));

    return result;
  }

  /**
   * Invalidate all cached data for a user
   * @param {string} userId - User ID
   */
  invalidateUserCache(userId) {
    const keysToDelete = [];
    
    for (const [key] of this.connectionPool) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.connectionPool.delete(key));
    
    DebugUtils.debug('DATABASE', 'Cache invalidated for user', { 
      userId, 
      keysInvalidated: keysToDelete.length 
    });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.connectionPool.clear();
    DebugUtils.debug('DATABASE', 'All cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.connectionPool.size,
      keys: Array.from(this.connectionPool.keys()),
      memoryUsage: JSON.stringify(Array.from(this.connectionPool.values())).length
    };
  }

  /**
   * Health check for database connection
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      const result = await supabase.from('profiles').select('id').limit(1);
      const responseTime = Date.now() - startTime;

      return {
        healthy: !result.error,
        responseTime,
        error: result.error?.message
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: null,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export default new DatabaseManager();
