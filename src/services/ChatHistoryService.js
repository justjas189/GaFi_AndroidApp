// Chat History Service - Handles persistent storage and retrieval of chat messages for user sessions

import { supabase } from '../config/supabase';
import DebugUtils from '../utils/DebugUtils';

/**
 * Service class for chat history management
 * Provides secure, user-specific chat history storage and retrieval
 */
export class ChatHistoryService {
  constructor() {
    this.supabase = supabase;
    this.currentSessionId = null;
    this.currentUserId = null; // Track current user to detect switches
    this.maxMessagesPerLoad = 50; // Pagination limit
  }

  /**
   * Initialize or get current chat session for user
   * @param {string} userId - User ID
   * @param {string} sessionName - Optional session name
   * @returns {Promise<Object>} Session result
   */
  async initializeSession(userId, sessionName = null) {
    try {
      DebugUtils.log('CHAT_HISTORY', 'Initializing chat session', { userId, sessionName });

      // Validate userId
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid userId is required');
      }

      // Reset current session if switching users
      if (this.currentUserId && this.currentUserId !== userId) {
        DebugUtils.log('CHAT_HISTORY', 'User changed, resetting session', { 
          oldUserId: this.currentUserId, 
          newUserId: userId 
        });
        this.currentSessionId = null;
      }
      this.currentUserId = userId;

      // Check user preferences first
      const preferencesResult = await this.getUserChatPreferences(userId);
      if (!preferencesResult.success || !preferencesResult.data.enable_history) {
        DebugUtils.log('CHAT_HISTORY', 'Chat history disabled for user', { userId });
        return {
          success: false,
          message: 'Chat history is disabled for this user',
          historyEnabled: false
        };
      }

      // Get or create active session
      let session = await this.getActiveSession(userId);
      
      if (!session) {
        // Create new session
        const sessionData = {
          user_id: userId,
          session_name: sessionName || `Chat ${new Date().toLocaleDateString()}`,
          is_active: true,
          session_metadata: {
            created_source: 'chatbot_context',
            platform: 'mobile_app'
          }
        };

        const { data: newSession, error: createError } = await this.supabase
          .from('chat_sessions')
          .insert(sessionData)
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create session: ${createError.message}`);
        }

        session = newSession;
        DebugUtils.log('CHAT_HISTORY', 'Created new chat session', { sessionId: session.id });
      } else {
        DebugUtils.log('CHAT_HISTORY', 'Using existing active session', { sessionId: session.id });
      }

      this.currentSessionId = session.id;

      return {
        success: true,
        data: session,
        historyEnabled: true
      };
    } catch (error) {
      console.error('Error initializing chat session:', error);
      DebugUtils.error('CHAT_HISTORY', 'Failed to initialize session', error);
      return {
        success: false,
        error: error.message,
        historyEnabled: false
      };
    }
  }

  /**
   * Get active session for user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Active session or null
   */
  async getActiveSession(userId) {
    try {
      const { data: session, error } = await this.supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return session;
    } catch (error) {
      DebugUtils.error('CHAT_HISTORY', 'Error getting active session', error);
      return null;
    }
  }

  /**
   * Save a message to the current session
   * @param {string} userId - User ID
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Save result
   */
  async saveMessage(userId, messageData) {
    try {
      DebugUtils.log('CHAT_HISTORY', 'Saving message', { userId, messageId: messageData.id });

      // Validate inputs
      if (!userId || !messageData) {
        throw new Error('userId and messageData are required');
      }

      if (!this.currentSessionId) {
        // Try to initialize session if not already done
        const sessionResult = await this.initializeSession(userId);
        if (!sessionResult.success) {
          // If session can't be created, skip saving (history disabled)
          return { success: true, skipped: true, reason: 'History disabled' };
        }
      }

      // Check user preferences
      const preferencesResult = await this.getUserChatPreferences(userId);
      if (!preferencesResult.success || !preferencesResult.data.enable_history) {
        return { success: true, skipped: true, reason: 'History disabled' };
      }

      // Prepare message data for database
      const dbMessage = {
        session_id: this.currentSessionId,
        user_id: userId,
        message_text: messageData.text || '',
        is_bot_message: messageData.isBot || false,
        message_data: messageData.data || {},
        timestamp: messageData.timestamp || new Date().toISOString(),
        intent: messageData.intent || null,
        confidence_score: messageData.confidence || null,
        response_time_ms: messageData.processingTime || null,
        message_metadata: {
          message_id: messageData.id,
          is_error: messageData.isError || false,
          platform: 'mobile_app'
        }
      };

      // Insert message
      const { data: savedMessage, error: insertError } = await this.supabase
        .from('chat_messages')
        .insert(dbMessage)
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to save message: ${insertError.message}`);
      }

      // Update session's updated_at timestamp
      await this.supabase
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', this.currentSessionId)
        .eq('user_id', userId);

      // Check if we need to cleanup old messages
      await this.cleanupSessionMessages(userId, this.currentSessionId);

      DebugUtils.log('CHAT_HISTORY', 'Message saved successfully', { 
        messageId: savedMessage.id,
        sessionId: this.currentSessionId 
      });

      return {
        success: true,
        data: savedMessage
      };
    } catch (error) {
      console.error('Error saving message:', error);
      DebugUtils.error('CHAT_HISTORY', 'Failed to save message', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load chat history for current session
   * @param {string} userId - User ID
   * @param {number} limit - Number of messages to load
   * @param {string} beforeTimestamp - Load messages before this timestamp (for pagination)
   * @returns {Promise<Object>} Chat history result
   */
  async loadChatHistory(userId, limit = 50, beforeTimestamp = null) {
    try {
      DebugUtils.log('CHAT_HISTORY', 'Loading chat history', { userId, limit, beforeTimestamp });

      // Check user preferences
      const preferencesResult = await this.getUserChatPreferences(userId);
      if (!preferencesResult.success || !preferencesResult.data.enable_history) {
        return {
          success: true,
          data: [],
          historyEnabled: false,
          message: 'Chat history is disabled'
        };
      }

      // Get or initialize session
      if (!this.currentSessionId) {
        const sessionResult = await this.initializeSession(userId);
        if (!sessionResult.success) {
          return {
            success: true,
            data: [],
            historyEnabled: false,
            message: 'Unable to load session'
          };
        }
      }

      // Build query - ensure we only get messages for this specific user
      let query = this.supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', this.currentSessionId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (beforeTimestamp) {
        query = query.lt('timestamp', beforeTimestamp);
      }

      const { data: messages, error } = await query;

      if (error) {
        throw new Error(`Failed to load chat history: ${error.message}`);
      }

      DebugUtils.log('CHAT_HISTORY', 'Raw messages from database', { 
        userId,
        sessionId: this.currentSessionId,
        totalMessages: messages.length,
        sampleMessages: messages.slice(0, 2).map(m => ({
          id: m.id,
          user_id: m.user_id,
          session_id: m.session_id,
          text: m.message_text?.substring(0, 50) + '...'
        }))
      });

      // Convert database messages back to app format
      const formattedMessages = messages.map(msg => ({
        id: msg.message_metadata?.message_id || msg.id,
        text: msg.message_text,
        isBot: msg.is_bot_message,
        timestamp: new Date(msg.timestamp),
        data: msg.message_data || null,
        intent: msg.intent,
        confidence: msg.confidence_score,
        isError: msg.message_metadata?.is_error || false,
        processingTime: msg.response_time_ms
      }));

      DebugUtils.log('CHAT_HISTORY', 'Chat history loaded successfully', { 
        sessionId: this.currentSessionId,
        messageCount: formattedMessages.length 
      });

      return {
        success: true,
        data: formattedMessages,
        historyEnabled: true,
        sessionId: this.currentSessionId,
        hasMore: messages.length === limit // Indicates if there might be more messages
      };
    } catch (error) {
      console.error('Error loading chat history:', error);
      DebugUtils.error('CHAT_HISTORY', 'Failed to load chat history', error);
      return {
        success: false,
        error: error.message,
        data: [],
        historyEnabled: false
      };
    }
  }

  /**
   * Get user's chat preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Preferences result
   */
  async getUserChatPreferences(userId) {
    try {
      const { data: preferences, error } = await this.supabase
        .from('user_chat_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No preferences found, create default ones
        const defaultPrefs = {
          user_id: userId,
          enable_history: true,
          max_sessions: 50,
          max_messages_per_session: 500,
          auto_delete_after_days: 90,
          context_memory_enabled: true
        };

        const { data: newPrefs, error: createError } = await this.supabase
          .from('user_chat_preferences')
          .insert(defaultPrefs)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        return { success: true, data: newPrefs };
      }

      if (error) {
        throw error;
      }

      return { success: true, data: preferences };
    } catch (error) {
      console.error('Error getting user chat preferences:', error);
      return {
        success: false,
        error: error.message,
        data: {
          enable_history: false,
          context_memory_enabled: false
        }
      };
    }
  }

  /**
   * Update user's chat preferences
   * @param {string} userId - User ID
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} Update result
   */
  async updateChatPreferences(userId, updates) {
    try {
      DebugUtils.log('CHAT_HISTORY', 'Updating chat preferences', { userId, updates });

      const { data: updatedPrefs, error } = await this.supabase
        .from('user_chat_preferences')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update preferences: ${error.message}`);
      }

      return {
        success: true,
        data: updatedPrefs
      };
    } catch (error) {
      console.error('Error updating chat preferences:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all chat sessions for user
   * @param {string} userId - User ID
   * @param {number} limit - Number of sessions to return
   * @returns {Promise<Object>} Sessions result
   */
  async getUserSessions(userId, limit = 20) {
    try {
      const { data: sessions, error } = await this.supabase
        .from('chat_sessions')
        .select(`
          id,
          session_name,
          created_at,
          updated_at,
          is_active,
          session_metadata
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: sessions || []
      };
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Delete a chat session and all its messages
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteSession(userId, sessionId) {
    try {
      DebugUtils.log('CHAT_HISTORY', 'Deleting chat session', { userId, sessionId });

      // Verify ownership
      const { data: session, error: checkError } = await this.supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (checkError || !session) {
        throw new Error('Session not found or access denied');
      }

      // Delete session (messages will be deleted via CASCADE)
      const { error: deleteError } = await this.supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (deleteError) {
        throw deleteError;
      }

      // Reset current session if it was deleted
      if (this.currentSessionId === sessionId) {
        this.currentSessionId = null;
      }

      return {
        success: true,
        message: 'Session deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear all chat history for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Clear result
   */
  async clearAllHistory(userId) {
    try {
      DebugUtils.log('CHAT_HISTORY', 'Clearing all chat history', { userId });

      // Delete all sessions for user (messages will be deleted via CASCADE)
      const { error } = await this.supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Reset current session
      this.currentSessionId = null;

      return {
        success: true,
        message: 'All chat history cleared successfully'
      };
    } catch (error) {
      console.error('Error clearing chat history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start a new chat session (deactivate current and create new)
   * @param {string} userId - User ID
   * @param {string} sessionName - Optional session name
   * @returns {Promise<Object>} New session result
   */
  async startNewSession(userId, sessionName = null) {
    try {
      DebugUtils.log('CHAT_HISTORY', 'Starting new chat session', { userId, sessionName });

      // Deactivate current active session
      await this.supabase
        .from('chat_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Reset current session
      this.currentSessionId = null;

      // Initialize new session
      return await this.initializeSession(userId, sessionName);
    } catch (error) {
      console.error('Error starting new session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup old messages in session based on user preferences
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<void>}
   */
  async cleanupSessionMessages(userId, sessionId) {
    try {
      const preferencesResult = await this.getUserChatPreferences(userId);
      if (!preferencesResult.success) return;

      const { max_messages_per_session } = preferencesResult.data;
      
      if (max_messages_per_session > 0) {
        // Count current messages in session
        const { count, error: countError } = await this.supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId)
          .eq('user_id', userId);

        if (countError) throw countError;

        if (count > max_messages_per_session) {
          // Delete oldest messages
          const { data: oldMessages, error: selectError } = await this.supabase
            .from('chat_messages')
            .select('id')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .order('timestamp', { ascending: true })
            .limit(count - max_messages_per_session);

          if (selectError) throw selectError;

          if (oldMessages.length > 0) {
            const { error: deleteError } = await this.supabase
              .from('chat_messages')
              .delete()
              .in('id', oldMessages.map(msg => msg.id));

            if (deleteError) throw deleteError;

            DebugUtils.log('CHAT_HISTORY', 'Cleaned up old messages', { 
              sessionId,
              deletedCount: oldMessages.length 
            });
          }
        }
      }
    } catch (error) {
      DebugUtils.error('CHAT_HISTORY', 'Error cleaning up session messages', error);
    }
  }

  /**
   * Get conversation context for AI (recent messages for context)
   * @param {string} userId - User ID
   * @param {number} contextLimit - Number of recent messages for context
   * @returns {Promise<Object>} Context result
   */
  async getConversationContext(userId, contextLimit = 10) {
    try {
      const preferencesResult = await this.getUserChatPreferences(userId);
      if (!preferencesResult.success || !preferencesResult.data.context_memory_enabled) {
        return {
          success: true,
          data: [],
          contextEnabled: false
        };
      }

      if (!this.currentSessionId) {
        return {
          success: true,
          data: [],
          contextEnabled: true
        };
      }

      const { data: recentMessages, error } = await this.supabase
        .from('chat_messages')
        .select('message_text, is_bot_message, intent, timestamp')
        .eq('user_id', userId)
        .eq('session_id', this.currentSessionId)
        .order('timestamp', { ascending: false })
        .limit(contextLimit);

      if (error) {
        throw error;
      }

      // Format for AI context (reverse to chronological order)
      const contextMessages = (recentMessages || [])
        .reverse()
        .map(msg => ({
          role: msg.is_bot_message ? 'assistant' : 'user',
          content: msg.message_text,
          intent: msg.intent,
          timestamp: msg.timestamp
        }));

      return {
        success: true,
        data: contextMessages,
        contextEnabled: true
      };
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        contextEnabled: false
      };
    }
  }
}