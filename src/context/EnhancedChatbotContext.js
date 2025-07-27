// Enhanced Chatbot Context with Database Integration and Chat History
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getChatCompletion, getSystemPrompt } from '../config/nvidia';
import { useAuth } from './AuthContext';
import { useData } from './DataContext';
import { BudgetNLPProcessor } from '../services/BudgetNLPProcessor';
import { BudgetDatabaseService } from '../services/BudgetDatabaseService_NEW';
import { ChatHistoryService } from '../services/ChatHistoryService';
import { ChatMemoryManager } from '../services/ChatMemoryManager';
import { ErrorRecoveryManager } from '../services/ErrorRecoveryManager';
import { BudgetAlertManager } from '../services/BudgetAlertManager';
import DebugUtils from '../utils/DebugUtils';

const ChatbotContext = createContext();

export const useChatbot = () => {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};

export const ChatbotProvider = ({ children }) => {
  const { user } = useAuth();
  const dataContext = useData(); // Get the full DataContext
  const { expenses, budget, loadData, calculateTotalExpenses, getExpensesByDateRange } = dataContext;
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [nlpProcessor] = useState(() => new BudgetNLPProcessor());
  const [dbService] = useState(() => new BudgetDatabaseService());
  const [chatHistoryService] = useState(() => new ChatHistoryService());
  const [memoryManager] = useState(() => new ChatMemoryManager());
  const [errorRecovery] = useState(() => new ErrorRecoveryManager());
  const [budgetAlerts] = useState(() => new BudgetAlertManager());

  // Initialize chatbot with welcome message and load chat history
  useEffect(() => {
    if (user) {
      // Clear previous user's messages first
      setMessages([]);
      initializeChatSession();
      // Initialize budget alerts manager for the user
      initializeBudgetAlerts();
    } else {
      // Clear messages when user logs out
      setMessages([]);
    }
  }, [user]);

  /**
   * Initialize budget alerts for the user
   */
  const initializeBudgetAlerts = async () => {
    if (!user) return;

    try {
      await budgetAlerts.initializeForUser(user.id);
      DebugUtils.log('ENHANCED_CHATBOT', 'Budget alerts initialized', { userId: user.id });
    } catch (error) {
      DebugUtils.error('ENHANCED_CHATBOT', 'Failed to initialize budget alerts', error);
    }
  };

  /**
   * Initialize chat session and load history
   */
  const initializeChatSession = async () => {
    if (!user) return;

    try {
      setIsLoadingHistory(true);
      DebugUtils.log('ENHANCED_CHATBOT', 'Initializing chat session', { 
        userId: user.id,
        userEmail: user.email,
        currentMessageCount: messages.length 
      });

      // Initialize chat session
      const sessionResult = await chatHistoryService.initializeSession(user.id);
      setHistoryEnabled(sessionResult.historyEnabled);

      DebugUtils.log('ENHANCED_CHATBOT', 'Session initialization result', { 
        success: sessionResult.success,
        historyEnabled: sessionResult.historyEnabled,
        sessionId: sessionResult.data?.id 
      });

      if (sessionResult.success && sessionResult.historyEnabled) {
        // Initialize memory manager and load optimized history
        try {
          await memoryManager.initializeSession(user.id);
          const historyResult = await memoryManager.loadMessages(user.id, 1, 50);
          
          DebugUtils.log('ENHANCED_CHATBOT', 'Memory-optimized history load result', { 
            success: historyResult.success,
            messageCount: historyResult.data?.length || 0,
            firstMessage: historyResult.data?.[0]?.text?.substring(0, 50) + '...' || 'none'
          });
          
          if (historyResult.success && historyResult.data.length > 0) {
            DebugUtils.log('ENHANCED_CHATBOT', 'Loaded optimized chat history', { 
              messageCount: historyResult.data.length 
            });
            setMessages(historyResult.data);
            return;
          }
        } catch (memoryError) {
          DebugUtils.error('ENHANCED_CHATBOT', 'Memory manager initialization failed, falling back to regular history', memoryError);
          
          // Fallback to regular chat history
          const historyResult = await chatHistoryService.loadChatHistory(user.id, 50);
          
          DebugUtils.log('ENHANCED_CHATBOT', 'Fallback chat history load result', { 
            success: historyResult.success,
            messageCount: historyResult.data?.length || 0,
            firstMessage: historyResult.data?.[0]?.text?.substring(0, 50) + '...' || 'none'
          });
          
          if (historyResult.success && historyResult.data.length > 0) {
            DebugUtils.log('ENHANCED_CHATBOT', 'Loaded fallback chat history', { 
              messageCount: historyResult.data.length 
            });
            setMessages(historyResult.data);
            return;
          }
        }
      }

      // If no history loaded or history disabled, show welcome message
      if (messages.length === 0) {
        const userName = user.name || user.email?.split('@')[0] || 'there';
        const welcomeMessage = {
          id: '1',
          text: `Hi ${userName}! 👋\n\nI'm MonT, your MoneyTrack AI assistant powered by NVIDIA LLaMA. I can help you:\n\n💰 Record expenses: "I spent ₱250 on lunch"\n📊 Check your budget: "How much have I spent this month?"\n📈 Update budget: "Set my budget to ₱15,000"\n📋 Get financial tips: "Give me money saving tips"\n📈 Analyze spending patterns with AI insights\n\n${historyEnabled ? '💾 Your conversation history is being saved for continuity.' : '🔒 Chat history is disabled for privacy.'}\n\n🤖 Powered by advanced AI for intelligent financial assistance!\n\nWhat would you like to do today?`,
          isBot: true,
          timestamp: new Date()
        };

        setMessages([welcomeMessage]);

        // Save welcome message to history if enabled
        if (historyEnabled && sessionResult.success) {
          try {
            await chatHistoryService.saveMessage(user.id, welcomeMessage);
            await memoryManager.cacheMessage(user.id, welcomeMessage);
          } catch (saveError) {
            DebugUtils.error('ENHANCED_CHATBOT', 'Failed to save welcome message', saveError);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing chat session:', error);
      DebugUtils.error('ENHANCED_CHATBOT', 'Failed to initialize chat session', error);
      
      // Fallback to basic welcome message
      if (messages.length === 0) {
        const userName = user.name || user.email?.split('@')[0] || 'there';
        setMessages([{
          id: '1',
          text: `Hi ${userName}! 👋\n\nI'm MonT, your MoneyTrack AI assistant. I can help you manage your finances.\n\nWhat would you like to do today?`,
          isBot: true,
          timestamp: new Date()
        }]);
      }
      setHistoryEnabled(false);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  /**
   * Main function to send messages and get AI responses
   * @param {string} message - User's message
   * @returns {Promise<Object>} Response result
   */
  const sendMessage = async (message) => {
    if (!message.trim() || !user) return;

    DebugUtils.log('ENHANCED_CHATBOT', 'Processing user message', { message, userId: user?.id });

    const userMessage = {
      id: Date.now().toString(),
      text: message,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Save user message to history with memory management
    if (historyEnabled) {
      try {
        await chatHistoryService.saveMessage(user.id, userMessage);
        await memoryManager.cacheMessage(user.id, userMessage);
      } catch (error) {
        DebugUtils.error('ENHANCED_CHATBOT', 'Failed to save user message', error);
      }
    }

    setIsLoading(true);

    try {
      // Get optimized conversation context with memory management
      let conversationContext = [];
      if (historyEnabled) {
        const contextResult = await memoryManager.getOptimizedContext(user.id, 10);
        if (contextResult.success) {
          conversationContext = contextResult.data;
        }
      }

      // Process user input with NLP
      DebugUtils.log('ENHANCED_CHATBOT', 'Starting NLP processing', { message });
      const nlpResult = await nlpProcessor.processInput(message);
      DebugUtils.log('ENHANCED_CHATBOT', 'NLP processing result', { 
        intent: nlpResult.intent, 
        confidence: nlpResult.confidence,
        entities: nlpResult.entities 
      });
      
      // Handle the request based on intent with error recovery
      let response;
      try {
        if (nlpResult.success && nlpResult.confidence > 0.3) {
          DebugUtils.log('ENHANCED_CHATBOT', 'Using intent-based handling', { intent: nlpResult.intent });
          response = await handleIntentBasedRequest(nlpResult);
        } else {
          DebugUtils.log('ENHANCED_CHATBOT', 'Using fallback general query', { confidence: nlpResult.confidence });
          // Fallback to general AI response with conversation context
          response = await handleGeneralQuery(message, nlpResult, conversationContext);
        }
      } catch (processingError) {
        DebugUtils.error('ENHANCED_CHATBOT', 'Error in intent processing', processingError);
        // Use error recovery for intelligent fallback
        response = await errorRecovery.handleError(processingError, message, nlpResult);
      }

      DebugUtils.log('ENHANCED_CHATBOT', 'Response generated', { success: response.success });

      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text,
        isBot: true,
        timestamp: new Date(),
        data: response.data || null,
        intent: nlpResult.intent,
        confidence: nlpResult.confidence,
        processingTime: nlpResult.processingTime
      };

      setMessages(prev => [...prev, botMessage]);

      // Save bot message to history with memory management
      if (historyEnabled) {
        try {
          await chatHistoryService.saveMessage(user.id, botMessage);
          await memoryManager.cacheMessage(user.id, botMessage);
        } catch (error) {
          DebugUtils.error('ENHANCED_CHATBOT', 'Failed to save bot message', error);
        }
      }

      // Check for budget alerts if this was an expense-related interaction
      if (nlpResult.intent === 'record_expense' && response.success && response.data) {
        try {
          const alertResult = await budgetAlerts.processExpenseAlert(user.id, response.data);
          if (alertResult.shouldAlert && alertResult.alert) {
            // Add budget alert as a system message
            const alertMessage = {
              id: (Date.now() + 2).toString(),
              text: alertResult.alert.message,
              isBot: true,
              timestamp: new Date(),
              isAlert: true,
              alertType: alertResult.alert.type
            };
            
            setMessages(prev => [...prev, alertMessage]);
            
            // Save alert message to history
            if (historyEnabled) {
              await chatHistoryService.saveMessage(user.id, alertMessage);
              await memoryManager.cacheMessage(user.id, alertMessage);
            }
          }
        } catch (alertError) {
          DebugUtils.error('ENHANCED_CHATBOT', 'Error processing budget alert', alertError);
        }
      }

      // Log interaction for analytics
      await dbService.logInteraction(user.id, {
        userInput: message,
        intent: nlpResult.intent,
        extractedData: nlpResult.entities,
        chatbotResponse: response.text,
        success: response.success,
        errorMessage: response.error,
        processingTime: nlpResult.processingTime
      });

      DebugUtils.logChatbotAction('enhanced_chatbot_response', message, {
        intent: nlpResult.intent,
        success: response.success
      });

      return { success: true, response: botMessage };
    } catch (error) {
      console.error('Chat error:', error);
      DebugUtils.error('ENHANCED_CHATBOT', 'Error processing message', error);
      
      // Use intelligent error recovery
      let errorResponse;
      try {
        errorResponse = await errorRecovery.handleError(error, message, nlpResult || {});
      } catch (recoveryError) {
        DebugUtils.error('ENHANCED_CHATBOT', 'Error recovery failed', recoveryError);
        errorResponse = {
          text: "Sorry, I encountered an error processing your request. Please try again or rephrase your message.",
          success: false
        };
      }
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: errorResponse.text,
        isBot: true,
        timestamp: new Date(),
        isError: true,
        recovery: errorResponse.recovery || null
      };

      setMessages(prev => [...prev, errorMessage]);
      
      // Save error message to history with memory management
      if (historyEnabled) {
        try {
          await chatHistoryService.saveMessage(user.id, errorMessage);
          await memoryManager.cacheMessage(user.id, errorMessage);
        } catch (saveError) {
          DebugUtils.error('ENHANCED_CHATBOT', 'Failed to save error message', saveError);
        }
      }
      
      // Log error interaction
      await dbService.logInteraction(user.id, {
        userInput: message,
        intent: 'error',
        extractedData: {},
        chatbotResponse: errorMessage.text,
        success: false,
        errorMessage: error.message
      });

      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle requests based on detected intent
   * @param {Object} nlpResult - NLP processing result
   * @returns {Promise<Object>} Response object
   */
  const handleIntentBasedRequest = async (nlpResult) => {
    const { intent, entities, validation } = nlpResult;

    try {
      switch (intent) {
        case 'expense_log':
          return await handleExpenseLogging(entities, validation);
          
        case 'budget_update':
          return await handleBudgetUpdate(entities, validation);
          
        case 'budget_query':
          return await handleBudgetQuery(entities);
          
        case 'category_query':
          return await handleCategoryQuery(entities);
          
        case 'debug_data':
          return await handleDataDiagnostic();
          
        default:
          return await handleGeneralQuery(nlpResult.originalInput, nlpResult, []);
      }
    } catch (error) {
      console.error(`Error handling ${intent}:`, error);
      return {
        success: false,
        text: `Sorry, I had trouble processing your ${intent.replace('_', ' ')} request. Please try again.`,
        error: error.message
      };
    }
  };

  /**
   * Handle expense logging
   * @param {Object} entities - Extracted entities
   * @param {Object} validation - Validation result
   * @returns {Promise<Object>} Response object
   */
  const handleExpenseLogging = async (entities, validation) => {
    DebugUtils.log('ENHANCED_CHATBOT', 'Handling expense logging', { entities, validation });
    
    if (!validation.isValid) {
      DebugUtils.log('ENHANCED_CHATBOT', 'Expense validation failed', validation);
      return {
        success: false,
        text: nlpProcessor.generateClarificationMessage(validation, 'expense_log')
      };
    }

    const { amount, category, description, date } = entities;
    DebugUtils.log('ENHANCED_CHATBOT', 'Attempting to record expense', { amount, category, description, date });
    
    try {
      const result = await dbService.recordExpense(user.id, {
        amount,
        category,
        description,
        date,
        naturalLanguageInput: nlpProcessor.originalInput,
        confidence: nlpProcessor.confidence || 0.8
      });

      DebugUtils.log('ENHANCED_CHATBOT', 'Expense recording result', { success: result.success, error: result.error });

      if (result.success) {
        const categoryInfo = result.categoryInfo;
        let responseText = result.message;
        
        // Refresh the DataContext to update UI immediately
        try {
          await loadData();
          DebugUtils.log('ENHANCED_CHATBOT', 'Data context refreshed after expense recording');
        } catch (refreshError) {
          DebugUtils.error('ENHANCED_CHATBOT', 'Failed to refresh data context', refreshError);
        }
        
        if (categoryInfo && categoryInfo.success) {
          const { data: catData } = categoryInfo;
          responseText += `\n\n📊 ${category.charAt(0).toUpperCase() + category.slice(1)} spending update:`;
          responseText += `\n• Total spent this month: ₱${catData.totalSpent.toLocaleString()}`;
          
          if (catData.allocated > 0) {
            responseText += `\n• Budget allocated: ₱${catData.allocated.toLocaleString()}`;
            responseText += `\n• Remaining: ₱${catData.remaining.toLocaleString()}`;
            
            if (catData.percentage > 80) {
              responseText += `\n\n⚠️ You've used ${catData.percentage.toFixed(1)}% of your ${category} budget!`;
            } else if (catData.percentage > 50) {
              responseText += `\n\n💡 You've used ${catData.percentage.toFixed(1)}% of your ${category} budget.`;
            }
          }
        }

        DebugUtils.logChatbotAction('expense_logged_successfully', nlpProcessor.originalInput, {
          amount,
          category,
          description
        });

        return {
          success: true,
          text: responseText,
          data: {
            transaction: result.data,
            categoryInfo: categoryInfo?.data
          }
        };
      } else {
        DebugUtils.error('ENHANCED_CHATBOT', 'Failed to record expense', result.error);
        return {
          success: false,
          text: `Sorry, I couldn't record that expense: ${result.error}`,
          error: result.error
        };
      }
    } catch (error) {
      DebugUtils.error('ENHANCED_CHATBOT', 'Exception in expense logging', error);
      return {
        success: false,
        text: `Sorry, I encountered an error while recording your expense: ${error.message}`,
        error: error.message
      };
    }
  };

  /**
   * Handle budget updates
   * @param {Object} entities - Extracted entities
   * @param {Object} validation - Validation result
   * @returns {Promise<Object>} Response object
   */
  const handleBudgetUpdate = async (entities, validation) => {
    if (!validation.isValid) {
      return {
        success: false,
        text: nlpProcessor.generateClarificationMessage(validation, 'budget_update')
      };
    }

    const { amount, budgetType, category } = entities;
    
    let result;
    if (budgetType === 'category' && category) {
      result = await dbService.updateCategoryBudget(user.id, category, amount);
    } else {
      result = await dbService.updateTotalBudget(user.id, amount);
    }

    if (result.success) {
      // Refresh the DataContext to update UI immediately
      try {
        await loadData();
        DebugUtils.log('ENHANCED_CHATBOT', 'Data context refreshed after budget update');
      } catch (refreshError) {
        DebugUtils.error('ENHANCED_CHATBOT', 'Failed to refresh data context', refreshError);
      }

      // Get updated budget summary
      const summaryResult = await dbService.getBudgetSummary(user.id);
      
      let responseText = result.message;
      
      if (summaryResult.success) {
        const summary = summaryResult.data;
        responseText += `\n\n📊 Budget Overview:`;
        responseText += `\n• Total Budget: ₱${summary.totalBudget.toLocaleString()}`;
        responseText += `\n• Spent This Month: ₱${summary.totalSpent.toLocaleString()}`;
        responseText += `\n• Remaining: ₱${summary.remaining.toLocaleString()}`;
        responseText += `\n• Usage: ${summary.percentage.toFixed(1)}%`;
      }

      return {
        success: true,
        text: responseText,
        data: {
          budget: result.data,
          summary: summaryResult.data
        }
      };
    } else {
      return {
        success: false,
        text: `Sorry, I couldn't update your budget: ${result.error}`,
        error: result.error
      };
    }
  };

  /**
   * Handle budget queries
   * @param {Object} entities - Extracted entities
   * @returns {Promise<Object>} Response object
   */
  const handleBudgetQuery = async (entities) => {
    const { period = 'this_month' } = entities;
    
    DebugUtils.log('ENHANCED_CHATBOT', 'Budget query using DataContext method', { 
      userId: user?.id, 
      period,
      hasDataContext: !!dataContext,
      expenseCount: expenses?.length || 0
    });
    
    // Use the new DataContext-based method (same as HomeScreen)
    const summaryResult = await dbService.getBudgetSummaryFromContext(user.id, period, dataContext);
    
    if (summaryResult.success) {
      const summary = summaryResult.data;
      
      let responseText = `📊 Budget Summary (${period.replace('_', ' ')}):\n\n`;
      responseText += `💰 Total Budget: ₱${summary.totalBudget.toLocaleString()}\n`;
      responseText += `💸 Total Spent: ₱${summary.totalSpent.toLocaleString()}\n`;
      responseText += `💵 Remaining: ₱${summary.remaining.toLocaleString()}\n`;
      responseText += `📈 Usage: ${summary.percentage.toFixed(1)}%\n\n`;
      
      if (summary.categories && summary.categories.length > 0) {
        responseText += `📋 Category Breakdown:\n`;
        summary.categories.forEach(cat => {
          const percentage = cat.allocated > 0 ? (cat.spent / cat.allocated) * 100 : 0;
          responseText += `• ${cat.name}: ₱${cat.spent.toLocaleString()} / ₱${cat.allocated.toLocaleString()} (${percentage.toFixed(1)}%)\n`;
        });
      }
      
      if (summary.alerts && summary.alerts.length > 0) {
        responseText += `\n🚨 Active Alerts:\n`;
        summary.alerts.slice(0, 3).forEach(alert => {
          responseText += `• ${alert.message}\n`;
        });
      }

      return {
        success: true,
        text: responseText,
        data: summary
      };
    } else {
      return {
        success: false,
        text: `Sorry, I couldn't retrieve your budget information: ${summaryResult.error}`,
        error: summaryResult.error
      };
    }
  };

  /**
   * Handle category-specific queries
   * @param {Object} entities - Extracted entities
   * @returns {Promise<Object>} Response object
   */
  const handleCategoryQuery = async (entities) => {
    const { category, period = 'this_month' } = entities;
    
    if (!category) {
      return {
        success: false,
        text: "Please specify which category you'd like to know about (e.g., food, transportation, entertainment)."
      };
    }

    const result = await dbService.getCategorySpending(user.id, category, period);
    
    if (result.success) {
      const data = result.data;
      
      let responseText = `📊 ${category.charAt(0).toUpperCase() + category.slice(1)} Spending (${period.replace('_', ' ')}):\n\n`;
      responseText += `💸 Total Spent: ₱${data.totalSpent.toLocaleString()}\n`;
      
      if (data.allocated > 0) {
        responseText += `💰 Budget Allocated: ₱${data.allocated.toLocaleString()}\n`;
        responseText += `💵 Remaining: ₱${data.remaining.toLocaleString()}\n`;
        responseText += `📈 Usage: ${data.percentage.toFixed(1)}%\n`;
        
        if (data.percentage > 100) {
          responseText += `\n⚠️ You've exceeded your ${category} budget by ₱${Math.abs(data.remaining).toLocaleString()}!`;
        } else if (data.percentage > 80) {
          responseText += `\n⚠️ You're close to your ${category} budget limit.`;
        }
      }
      
      responseText += `\n🧾 Transactions: ${data.transactionCount}\n`;
      
      if (data.recentTransactions && data.recentTransactions.length > 0) {
        responseText += `\n📝 Recent transactions:\n`;
        data.recentTransactions.slice(0, 3).forEach(tx => {
          const date = new Date(tx.transaction_date).toLocaleDateString();
          responseText += `• ${date}: ₱${parseFloat(tx.amount).toLocaleString()}${tx.description ? ` - ${tx.description}` : ''}\n`;
        });
      }

      return {
        success: true,
        text: responseText,
        data
      };
    } else {
      return {
        success: false,
        text: `Sorry, I couldn't retrieve ${category} spending information: ${result.error}`,
        error: result.error
      };
    }
  };

  /**
   * Handle data diagnostic requests
   * @returns {Promise<Object>} Response object
   */
  const handleDataDiagnostic = async () => {
    try {
      DebugUtils.log('ENHANCED_CHATBOT', 'Running comprehensive data diagnostic', { userId: user.id });
      
      const diagnostic = await dbService.getUserDataDiagnostic(user.id);
      
      if (diagnostic.success) {
        const data = diagnostic.data;
        
        let responseText = `🔍 COMPREHENSIVE DATA DIAGNOSTIC\n`;
        responseText += `User: ${user.id} | Email: ${user.email}\n\n`;
        
        responseText += `📊 TOTAL DISCREPANCY ANALYSIS:\n`;
        responseText += `• App Correct Total: ₱${data.totals.appCorrectTotal.toLocaleString()}\n`;
        responseText += `• Chatbot Incorrect Total: ₱${data.totals.chatbotIncorrectTotal.toLocaleString()}\n`;
        responseText += `• Difference: ₱${data.discrepancyAnalysis.difference.toLocaleString()}\n\n`;
        
        responseText += `💾 YOUR DATA BREAKDOWN:\n`;
        responseText += `• Your Transactions: ${data.transactions.userCount} (₱${data.transactions.userTotal.toLocaleString()})\n`;
        responseText += `• Your Expenses: ${data.expenses.userCount} (₱${data.expenses.userTotal.toLocaleString()})\n`;
        responseText += `• Your Combined Total: ₱${data.totals.combinedUserTotal.toLocaleString()}\n\n`;
        
        responseText += `🚨 CROSS-USER DATA ANALYSIS:\n`;
        responseText += `• Total Users in Database: ${data.crossUserAnalysis.totalUsers}\n`;
        responseText += `• Other Users' Transaction Total: ₱${data.crossUserAnalysis.potentialDataLeakage.otherUsersTransactionTotal.toLocaleString()}\n`;
        responseText += `• Other Users' Expense Total: ₱${data.crossUserAnalysis.potentialDataLeakage.otherUsersExpenseTotal.toLocaleString()}\n`;
        responseText += `• Data Mixed?: ${data.crossUserAnalysis.potentialDataLeakage.isDataMixed ? 'YES ⚠️' : 'No ✅'}\n\n`;
        
        if (data.crossUserAnalysis.totalUsers > 1) {
          responseText += `👥 USER DATA DISTRIBUTION:\n`;
          Object.entries(data.crossUserAnalysis.userDataDistribution).forEach(([uid, userData]) => {
            const isCurrentUser = uid === user.id;
            const marker = isCurrentUser ? '👤 (YOU)' : '👤';
            responseText += `${marker} ${uid}: T:${userData.transactions.count}(₱${userData.transactions.total.toLocaleString()}) E:${userData.expenses.count}(₱${userData.expenses.total.toLocaleString()})\n`;
          });
          responseText += `\n`;
        }
        
        responseText += `🔍 POSSIBLE CAUSES:\n`;
        data.discrepancyAnalysis.possibleCauses.forEach(cause => {
          responseText += `• ${cause}\n`;
        });
        
        if (data.transactions.sampleUserData.length > 0) {
          responseText += `\n📝 SAMPLE YOUR TRANSACTIONS:\n`;
          data.transactions.sampleUserData.forEach(t => {
            responseText += `• ${t.date}: ₱${parseFloat(t.amount).toLocaleString()} (${t.category}) [ID:${t.id}]\n`;
          });
        }
        
        if (data.expenses.sampleUserData.length > 0) {
          responseText += `\n📝 SAMPLE YOUR EXPENSES:\n`;
          data.expenses.sampleUserData.forEach(e => {
            responseText += `• ${e.date.split('T')[0]}: ₱${parseFloat(e.amount).toLocaleString()} (${e.category}) [ID:${e.id}]\n`;
          });
        }

        responseText += `\n🎯 CONCLUSION:\n`;
        if (data.totals.combinedUserTotal === data.totals.appCorrectTotal) {
          responseText += `✅ Your data matches app total. Issue is in chatbot calculation logic.\n`;
        } else if (data.crossUserAnalysis.potentialDataLeakage.isDataMixed) {
          responseText += `⚠️ CRITICAL: Chatbot is including other users' data in calculations!\n`;
        } else {
          responseText += `❓ Data source mismatch detected. Further investigation needed.\n`;
        }

        return {
          success: true,
          text: responseText,
          data: diagnostic.data
        };
      } else {
        return {
          success: false,
          text: `Failed to run diagnostic: ${diagnostic.error}`,
          error: diagnostic.error
        };
      }
    } catch (error) {
      console.error('Error running data diagnostic:', error);
      return {
        success: false,
        text: `Diagnostic error: ${error.message}`,
        error: error.message
      };
    }
  };

  /**
   * Handle general queries using AI with conversation context
   * @param {string} message - User message
   * @param {Object} nlpResult - NLP result for context
   * @param {Array} conversationContext - Previous conversation for context
   * @returns {Promise<Object>} Response object
   */
  const handleGeneralQuery = async (message, nlpResult = {}, conversationContext = []) => {
    try {
      // Get user context for AI
      const userContext = await generateUserContext();
      
      // Determine system prompt based on query complexity
      const systemPrompt = getSystemPrompt(nlpResult.intent || 'simple');
      
      // Build conversation messages with context
      const messages = [
        {
          role: 'system',
          content: `${systemPrompt}\n\nUser Context:\n${userContext}\n\nConversation Context: You are continuing a conversation. Use the previous messages for context but focus on the latest user message.`
        }
      ];

      // Add conversation context if available (last few messages for continuity)
      if (conversationContext.length > 0) {
        // Add up to last 6 messages for context (excluding current message)
        const contextMessages = conversationContext.slice(-6);
        messages.push(...contextMessages);
      }

      // Add current user message
      messages.push({
        role: 'user',
        content: message
      });

      const response = await getChatCompletion(messages, {
        temperature: 0.7,
        max_tokens: 800
      });

      return {
        success: true,
        text: response
      };
    } catch (error) {
      console.error('AI response error:', error);
      return {
        success: false,
        text: "I'm having trouble connecting to my AI services right now. Please try again in a moment.",
        error: error.message
      };
    }
  };

  /**
   * Generate user context for AI responses
   * @returns {Promise<string>} User context string
   */
  const generateUserContext = async () => {
    try {
      const userName = user?.name || user?.email?.split('@')[0] || 'User';
      
      // Get current budget summary using DataContext method (same as HomeScreen)
      const summaryResult = await dbService.getBudgetSummaryFromContext(user.id, 'this_month', dataContext);
      
      if (!summaryResult.success) {
        return `User: ${userName}\nUser has not set up a budget yet.`;
      }

      const summary = summaryResult.data;
      
      let context = `User: ${userName}\n`;
      context += `Current Budget Status:\n`;
      context += `- Total Budget: ₱${summary.totalBudget.toLocaleString()}\n`;
      context += `- Spent This Month: ₱${summary.totalSpent.toLocaleString()}\n`;
      context += `- Remaining: ₱${summary.remaining.toLocaleString()}\n`;
      context += `- Usage: ${summary.percentage.toFixed(1)}%\n`;
      
      if (summary.categories && summary.categories.length > 0) {
        context += `\nTop spending categories:\n`;
        const sortedCategories = summary.categories
          .sort((a, b) => b.spent - a.spent)
          .slice(0, 3);
        
        sortedCategories.forEach(cat => {
          context += `- ${cat.name}: ₱${cat.spent.toLocaleString()}\n`;
        });
      }

      context += `\nPlease address the user by their name when appropriate.`;

      return context;
    } catch (error) {
      console.error('Error generating user context:', error);
      const userName = user?.name || user?.email?.split('@')[0] || 'User';
      return `User: ${userName}\nUnable to load user financial data.`;
    }
  };

  /**
   * Clear chat history and start fresh
   */
  const clearMessages = async () => {
    try {
      if (historyEnabled && user) {
        const result = await chatHistoryService.startNewSession(user.id);
        if (result.success) {
          DebugUtils.log('ENHANCED_CHATBOT', 'Started new chat session');
        }
      }
      
      // Clear local messages
      setMessages([]);
      
      // Re-initialize with welcome message
      await initializeChatSession();
    } catch (error) {
      console.error('Error clearing messages:', error);
      setMessages([]);
    }
  };

  /**
   * Get quick action suggestions based on user's current state
   * @returns {Array} Quick action buttons
   */
  const getQuickActions = () => {
    return [
      {
        id: 'check_budget',
        text: 'Check Budget',
        icon: '📊',
        action: () => sendMessage("Show me my budget status")
      },
      {
        id: 'food_spending',
        text: 'Food Spending',
        icon: '🍔',
        action: () => sendMessage("How much did I spend on food this month?")
      },
      {
        id: 'money_tips',
        text: 'Money Tips',
        icon: '💡',
        action: () => sendMessage("Give me money saving tips")
      }
    ];
  };

  /**
   * Load more chat history (pagination)
   * @param {string} beforeTimestamp - Load messages before this timestamp
   * @returns {Promise<Object>} Load result
   */
  const loadMoreHistory = async (beforeTimestamp) => {
    if (!historyEnabled || !user) {
      return { success: false, message: 'History not available' };
    }

    try {
      setIsLoadingHistory(true);
      const result = await chatHistoryService.loadChatHistory(user.id, 30, beforeTimestamp);
      
      if (result.success && result.data.length > 0) {
        // Prepend older messages to current messages
        setMessages(prev => [...result.data, ...prev]);
        return { success: true, data: result.data, hasMore: result.hasMore };
      }
      
      return { success: true, data: [], hasMore: false };
    } catch (error) {
      console.error('Error loading more history:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoadingHistory(false);
    }
  };

  /**
   * Get user's chat preferences
   * @returns {Promise<Object>} Preferences result
   */
  const getChatPreferences = async () => {
    if (!user) return { success: false, error: 'No user' };
    
    try {
      return await chatHistoryService.getUserChatPreferences(user.id);
    } catch (error) {
      console.error('Error getting chat preferences:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Update user's chat preferences
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} Update result
   */
  const updateChatPreferences = async (updates) => {
    if (!user) return { success: false, error: 'No user' };
    
    try {
      const result = await chatHistoryService.updateChatPreferences(user.id, updates);
      
      if (result.success) {
        // Update local state if history was enabled/disabled
        if ('enable_history' in updates) {
          setHistoryEnabled(updates.enable_history);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error updating chat preferences:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Get user's chat sessions
   * @returns {Promise<Object>} Sessions result
   */
  const getChatSessions = async () => {
    if (!user) return { success: false, error: 'No user' };
    
    try {
      return await chatHistoryService.getUserSessions(user.id);
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Delete a specific chat session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<Object>} Delete result
   */
  const deleteChatSession = async (sessionId) => {
    if (!user) return { success: false, error: 'No user' };
    
    try {
      const result = await chatHistoryService.deleteSession(user.id, sessionId);
      
      if (result.success) {
        // If current session was deleted, reinitialize
        if (chatHistoryService.currentSessionId === sessionId) {
          await initializeChatSession();
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting chat session:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Clear all chat history for user
   * @returns {Promise<Object>} Clear result
   */
  const clearAllHistory = async () => {
    if (!user) return { success: false, error: 'No user' };
    
    try {
      const result = await chatHistoryService.clearAllHistory(user.id);
      
      if (result.success) {
        // Clear local messages and reinitialize
        setMessages([]);
        await initializeChatSession();
      }
      
      return result;
    } catch (error) {
      console.error('Error clearing all history:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    // Core functionality
    messages,
    isLoading,
    isLoadingHistory,
    historyEnabled,
    sendMessage,
    clearMessages,
    getQuickActions,
    nlpProcessor,
    dbService,
    chatHistoryService,
    
    // Enhanced services
    memoryManager,
    errorRecovery,
    budgetAlerts,
    
    // Chat history management
    loadMoreHistory,
    getChatPreferences,
    updateChatPreferences,
    getChatSessions,
    deleteChatSession,
    clearAllHistory
  };

  return (
    <ChatbotContext.Provider value={value}>
      {children}
    </ChatbotContext.Provider>
  );
};
