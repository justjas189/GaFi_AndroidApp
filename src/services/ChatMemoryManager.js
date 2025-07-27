// Chat Memory Management Service
// Optimizes memory usage for large conversation histories
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';

export class ChatMemoryManager {
  constructor() {
    this.maxMessagesInMemory = 50; // Keep only 50 messages in active memory
    this.maxSessionsInCache = 10;  // Cache only 10 recent sessions
    this.compressionThreshold = 100; // Compress sessions with 100+ messages
    this.memoryPressureThreshold = 0.8; // Start cleanup at 80% memory usage
    
    // In-memory cache for active conversations
    this.activeCache = new Map();
    this.sessionMetadata = new Map();
    
    // Initialize memory monitoring
    this.initializeMemoryMonitoring();
  }

  /**
   * Initialize memory monitoring and cleanup
   */
  initializeMemoryMonitoring() {
    // Clean up memory every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, 5 * 60 * 1000);

    // Monitor memory pressure
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryPressure();
    }, 30 * 1000);
  }

  /**
   * Initialize session for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Initialization result
   */
  async initializeSession(userId) {
    try {
      DebugUtils.log('CHAT_MEMORY', 'Initializing session', { userId });
      
      // Initialize user session metadata
      if (!this.sessionMetadata.has(userId)) {
        this.sessionMetadata.set(userId, {
          lastAccess: Date.now(),
          messageCount: 0,
          compressionLevel: 0,
          cacheSize: 0
        });
      }

      // Clear any old cache for this user
      const oldCacheKeys = Array.from(this.activeCache.keys()).filter(key => key.startsWith(userId));
      oldCacheKeys.forEach(key => this.activeCache.delete(key));

      DebugUtils.log('CHAT_MEMORY', 'Session initialized successfully', { userId });
      
      return {
        success: true,
        message: 'Session initialized successfully'
      };
    } catch (error) {
      DebugUtils.error('CHAT_MEMORY', 'Failed to initialize session', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load messages with pagination and smart caching
   * @param {string} userId - User ID
   * @param {number} page - Page number (0-based)
   * @param {number} limit - Messages per page
   * @returns {Promise<Object>} Paginated messages
   */
  async loadMessages(userId, page = 0, limit = 20) {
    try {
      DebugUtils.log('CHAT_MEMORY', 'Loading messages', { userId, page, limit });
      
      // Use default session ID for main chat
      const sessionId = 'main';
      const cacheKey = `${userId}_${sessionId}`;
      
      // Check if session is in active cache
      if (this.activeCache.has(cacheKey)) {
        const cachedSession = this.activeCache.get(cacheKey);
        return this.paginateMessages(cachedSession.messages, page, limit);
      }

      // Load from storage
      const storageKey = `chat_session_${userId}_${sessionId}`;
      const sessionData = await AsyncStorage.getItem(storageKey);
      
      if (!sessionData) {
        return { 
          success: true,
          data: [], 
          hasMore: false, 
          totalCount: 0 
        };
      }

      const parsedSession = JSON.parse(sessionData);
      
      // Cache the session if it's being actively used
      this.cacheSession(cacheKey, parsedSession);
      
      const result = this.paginateMessages(parsedSession.messages, page, limit);
      return {
        success: true,
        data: result.messages,
        hasMore: result.hasMore,
        totalCount: result.totalCount
      };
    } catch (error) {
      DebugUtils.error('CHAT_MEMORY', 'Error loading messages', error);
      return { 
        success: false,
        data: [], 
        error: error.message 
      };
    }
  }

  /**
   * Paginate messages array
   * @param {Array} messages - All messages
   * @param {number} page - Page number
   * @param {number} limit - Messages per page
   * @returns {Object} Paginated result
   */
  paginateMessages(messages, page, limit) {
    const startIndex = page * limit;
    const endIndex = startIndex + limit;
    const paginatedMessages = messages.slice(startIndex, endIndex);
    
    return {
      messages: paginatedMessages,
      hasMore: endIndex < messages.length,
      totalCount: messages.length,
      page,
      limit
    };
  }

  /**
   * Cache session in memory with smart eviction
   * @param {string} cacheKey - Cache key
   * @param {Object} sessionData - Session data
   */
  cacheSession(cacheKey, sessionData) {
    // Evict oldest session if cache is full
    if (this.activeCache.size >= this.maxSessionsInCache) {
      const oldestKey = this.activeCache.keys().next().value;
      this.activeCache.delete(oldestKey);
      DebugUtils.log('CHAT_MEMORY', 'Evicted oldest session from cache', { evictedKey: oldestKey });
    }

    // Store compressed version if messages are too many
    const optimizedSession = this.optimizeSessionData(sessionData);
    this.activeCache.set(cacheKey, optimizedSession);
    
    // Update metadata
    this.sessionMetadata.set(cacheKey, {
      lastAccessed: Date.now(),
      messageCount: sessionData.messages?.length || 0,
      sizeEstimate: JSON.stringify(optimizedSession).length
    });

    DebugUtils.log('CHAT_MEMORY', 'Session cached', { 
      cacheKey, 
      messageCount: optimizedSession.messages?.length,
      cacheSize: this.activeCache.size 
    });
  }

  /**
   * Optimize session data for memory efficiency
   * @param {Object} sessionData - Raw session data
   * @returns {Object} Optimized session data
   */
  optimizeSessionData(sessionData) {
    if (!sessionData.messages) return sessionData;

    const messages = sessionData.messages;
    
    // Keep only essential message data
    const optimizedMessages = messages.map(msg => ({
      id: msg.id,
      text: msg.text,
      isBot: msg.isBot,
      timestamp: msg.timestamp,
      // Remove heavy data like processingTime, validation details, etc.
      ...(msg.data && { data: this.compressMessageData(msg.data) })
    }));

    // If too many messages, keep only recent ones in memory
    const messagesToKeep = optimizedMessages.length > this.maxMessagesInMemory 
      ? optimizedMessages.slice(-this.maxMessagesInMemory)
      : optimizedMessages;

    return {
      ...sessionData,
      messages: messagesToKeep,
      isOptimized: true,
      originalMessageCount: messages.length
    };
  }

  /**
   * Compress message data to reduce memory footprint
   * @param {Object} data - Message data
   * @returns {Object} Compressed data
   */
  compressMessageData(data) {
    if (!data) return data;

    // Keep only essential data fields
    return {
      ...(data.transaction && { 
        transaction: {
          amount: data.transaction.amount,
          category: data.transaction.category
        }
      }),
      ...(data.categoryInfo && { 
        categoryInfo: {
          totalSpent: data.categoryInfo.totalSpent,
          remaining: data.categoryInfo.remaining
        }
      })
    };
  }

  /**
   * Add message to active session
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message to add
   */
  async addMessage(userId, sessionId, message) {
    try {
      const cacheKey = `${userId}_${sessionId}`;
      
      // Add to cache if session is active
      if (this.activeCache.has(cacheKey)) {
        const session = this.activeCache.get(cacheKey);
        session.messages.push(message);
        
        // Maintain message limit in memory
        if (session.messages.length > this.maxMessagesInMemory) {
          session.messages = session.messages.slice(-this.maxMessagesInMemory);
        }
        
        // Update metadata
        const metadata = this.sessionMetadata.get(cacheKey);
        if (metadata) {
          metadata.lastAccessed = Date.now();
          metadata.messageCount = session.messages.length;
        }
      }

      DebugUtils.log('CHAT_MEMORY', 'Message added to cache', { cacheKey, messageId: message.id });
    } catch (error) {
      DebugUtils.error('CHAT_MEMORY', 'Error adding message to cache', error);
    }
  }

  /**
   * Cache a message for a user
   * @param {string} userId - User ID
   * @param {Object} message - Message to cache
   */
  async cacheMessage(userId, message) {
    try {
      const sessionId = 'main';
      await this.addMessage(userId, sessionId, message);
    } catch (error) {
      DebugUtils.error('CHAT_MEMORY', 'Error caching message', error);
    }
  }

  /**
   * Get optimized conversation context
   * @param {string} userId - User ID
   * @param {number} limit - Number of recent messages
   * @returns {Promise<Object>} Optimized context
   */
  async getOptimizedContext(userId, limit = 10) {
    try {
      const result = await this.loadMessages(userId, 0, limit);
      
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data.slice(-limit) // Get most recent messages
        };
      }
      
      return {
        success: false,
        data: [],
        error: 'Failed to load context'
      };
    } catch (error) {
      DebugUtils.error('CHAT_MEMORY', 'Error getting optimized context', error);
      return {
        success: false,
        data: [],
        error: error.message
      };
    }
  }

  /**
   * Perform memory cleanup based on usage patterns
   */
  performMemoryCleanup() {
    try {
      DebugUtils.log('CHAT_MEMORY', 'Starting memory cleanup');
      
      const now = Date.now();
      const cleanupThreshold = 45 * 60 * 1000; // 30 minutes
      
      // Remove inactive sessions from cache
      for (const [cacheKey, metadata] of this.sessionMetadata.entries()) {
        if (now - metadata.lastAccessed > cleanupThreshold) {
          this.activeCache.delete(cacheKey);
          this.sessionMetadata.delete(cacheKey);
          DebugUtils.log('CHAT_MEMORY', 'Cleaned up inactive session', { cacheKey });
        }
      }

      // Force garbage collection hint
      if (global.gc) {
        global.gc();
      }

      DebugUtils.log('CHAT_MEMORY', 'Memory cleanup completed', {
        activeSessions: this.activeCache.size,
        metadataEntries: this.sessionMetadata.size
      });
    } catch (error) {
      DebugUtils.error('CHAT_MEMORY', 'Error during memory cleanup', error);
    }
  }

  /**
   * Check memory pressure and take action
   */
  async checkMemoryPressure() {
    try {
      // Calculate estimated memory usage
      const totalSize = Array.from(this.sessionMetadata.values())
        .reduce((sum, meta) => sum + (meta.sizeEstimate || 0), 0);
      
      const estimatedMB = totalSize / (1024 * 1024);
      
      // If memory usage is high, be more aggressive with cleanup
      if (estimatedMB > 10) { // 10MB threshold
        DebugUtils.log('CHAT_MEMORY', 'High memory usage detected, forcing cleanup', { estimatedMB });
        
        // Keep only most recent sessions
        const sortedSessions = Array.from(this.sessionMetadata.entries())
          .sort(([,a], [,b]) => b.lastAccessed - a.lastAccessed);
        
        const sessionsToKeep = Math.floor(this.maxSessionsInCache / 2);
        const sessionsToRemove = sortedSessions.slice(sessionsToKeep);
        
        for (const [cacheKey] of sessionsToRemove) {
          this.activeCache.delete(cacheKey);
          this.sessionMetadata.delete(cacheKey);
        }
        
        DebugUtils.log('CHAT_MEMORY', 'Aggressive cleanup completed', {
          removedSessions: sessionsToRemove.length,
          remainingSessions: this.activeCache.size
        });
      }
    } catch (error) {
      DebugUtils.error('CHAT_MEMORY', 'Error checking memory pressure', error);
    }
  }

  /**
   * Get memory usage statistics
   * @returns {Object} Memory statistics
   */
  getMemoryStats() {
    const totalSessions = this.activeCache.size;
    const totalSize = Array.from(this.sessionMetadata.values())
      .reduce((sum, meta) => sum + (meta.sizeEstimate || 0), 0);
    
    const totalMessages = Array.from(this.sessionMetadata.values())
      .reduce((sum, meta) => sum + meta.messageCount, 0);

    return {
      activeSessions: totalSessions,
      totalMessages,
      estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      cacheHitRate: this.getCacheHitRate(),
      lastCleanup: this.lastCleanupTime
    };
  }

  /**
   * Calculate cache hit rate
   * @returns {number} Hit rate percentage
   */
  getCacheHitRate() {
    // This would be implemented with actual hit/miss tracking
    // For now, return estimated value based on cache usage
    return this.activeCache.size > 0 ? 85 : 0;
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.activeCache.clear();
    this.sessionMetadata.clear();
    DebugUtils.log('CHAT_MEMORY', 'All cache cleared');
  }

  /**
   * Cleanup on app termination
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    this.clearCache();
    DebugUtils.log('CHAT_MEMORY', 'ChatMemoryManager destroyed');
  }
}

// Export singleton instance
export const chatMemoryManager = new ChatMemoryManager();
