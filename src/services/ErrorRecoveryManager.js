// Enhanced Error Recovery System for MonT AI
// Provides intelligent error handling and user guidance
import DebugUtils from '../utils/DebugUtils';

export class ErrorRecoveryManager {
  constructor() {
    this.errorPatterns = new Map();
    this.recoveryStrategies = new Map();
    this.userGuidanceTemplates = new Map();
    this.errorHistory = [];
    this.maxErrorHistory = 50;
    
    this.initializeRecoveryStrategies();
    this.initializeGuidanceTemplates();
  }

  /**
   * Initialize recovery strategies for different error types
   */
  initializeRecoveryStrategies() {
    // NLP Processing Errors
    this.recoveryStrategies.set('nlp_low_confidence', {
      priority: 1,
      actions: ['clarify_intent', 'provide_examples', 'guide_step_by_step'],
      fallback: 'manual_category_selection'
    });

    // Missing Data Errors
    this.recoveryStrategies.set('missing_amount', {
      priority: 1,
      actions: ['ask_for_amount', 'provide_amount_examples'],
      fallback: 'default_amount_prompt'
    });

    this.recoveryStrategies.set('missing_category', {
      priority: 2,
      actions: ['suggest_categories', 'infer_from_context'],
      fallback: 'others_category'
    });

    // Database Errors
    this.recoveryStrategies.set('db_connection_error', {
      priority: 1,
      actions: ['retry_with_backoff', 'cache_locally', 'offline_mode'],
      fallback: 'manual_retry_prompt'
    });

    // API Errors
    this.recoveryStrategies.set('nvidia_api_error', {
      priority: 2,
      actions: ['fallback_to_local_nlp', 'use_cached_response'],
      fallback: 'basic_response'
    });

    // Validation Errors
    this.recoveryStrategies.set('invalid_amount', {
      priority: 1,
      actions: ['format_correction', 'amount_validation_help'],
      fallback: 'amount_input_guide'
    });
  }

  /**
   * Initialize user guidance templates
   */
  initializeGuidanceTemplates() {
    this.userGuidanceTemplates.set('clarify_intent', {
      title: "Let me help you with that! 🤔",
      message: "I'm not quite sure what you'd like to do. Here are some things I can help with:",
      options: [
        "💸 Record an expense (e.g., 'I spent ₱150 on lunch')",
        "📊 Check my budget status",
        "📈 View spending by category", 
        "💡 Get financial tips"
      ],
      prompt: "What would you like to do?"
    });

    this.userGuidanceTemplates.set('missing_amount', {
      title: "Amount needed! 💰",
      message: "I need to know how much you spent. Please include the amount in your message.",
      examples: [
        "₱150 for lunch",
        "Spent 200 pesos on groceries",
        "Paid ₱50 for jeepney fare"
      ],
      prompt: "How much did you spend?"
    });

    this.userGuidanceTemplates.set('missing_category', {
      title: "What type of expense? 🏷️",
      message: "Help me categorize your expense. What did you spend on?",
      categories: [
        { name: "Food", emoji: "🍽️", keywords: "meals, lunch, dinner, snacks" },
        { name: "Transportation", emoji: "🚌", keywords: "jeepney, bus, taxi, gas" },
        { name: "Entertainment", emoji: "🎬", keywords: "movies, games, hangout" },
        { name: "Shopping", emoji: "🛒", keywords: "clothes, gadgets, personal items" },
        { name: "Utilities", emoji: "💡", keywords: "bills, load, internet" },
        { name: "Others", emoji: "📦", keywords: "miscellaneous expenses" }
      ],
      prompt: "Which category fits your expense?"
    });

    this.userGuidanceTemplates.set('step_by_step_expense', {
      title: "Let's record your expense step by step! 📝",
      steps: [
        { step: 1, question: "How much did you spend?", example: "₱150" },
        { step: 2, question: "What category is this?", example: "food" },
        { step: 3, question: "Any details about the expense?", example: "lunch at Jollibee" },
        { step: 4, question: "When did this happen?", example: "today (or specific date)" }
      ],
      currentStep: 1
    });

    this.userGuidanceTemplates.set('connection_error', {
      title: "Connection Issue 📡",
      message: "I'm having trouble connecting to the server. Your data is safe!",
      options: [
        "🔄 Try again",
        "💾 Save offline (will sync when connected)",
        "📱 Continue with basic features"
      ],
      autoRetry: true,
      retryDelay: 3000
    });

    this.userGuidanceTemplates.set('format_help', {
      title: "Format Helper 📋",
      message: "Here are some ways to tell me about your expenses:",
      formats: [
        "💰 Amount first: '₱200 for lunch'",
        "📝 Action first: 'I spent ₱150 on groceries'",
        "🏪 With place: 'Paid ₱50 at 7-Eleven'",
        "📅 With time: 'Yesterday spent ₱300 on shopping'"
      ],
      tip: "💡 Tip: Include the peso sign (₱) or write 'pesos' for clarity!"
    });
  }

  /**
   * Handle error and provide recovery strategy
   * @param {string} errorType - Type of error
   * @param {Object} context - Error context
   * @param {Object} userInput - Original user input
   * @returns {Object} Recovery response
   */
  async handleError(errorType, context = {}, userInput = {}) {
    try {
      DebugUtils.log('ERROR_RECOVERY', 'Handling error', { errorType, context });
      
      // Log error for pattern analysis
      this.logError(errorType, context, userInput);
      
      // Get recovery strategy
      const strategy = this.recoveryStrategies.get(errorType);
      if (!strategy) {
        return this.getGenericRecovery(errorType, context);
      }

      // Execute recovery actions based on priority
      for (const action of strategy.actions) {
        const recovery = await this.executeRecoveryAction(action, context, userInput);
        if (recovery.success) {
          DebugUtils.log('ERROR_RECOVERY', 'Recovery successful', { action, errorType });
          return recovery;
        }
      }

      // Use fallback if all actions fail
      return this.executeFallback(strategy.fallback, context, userInput);

    } catch (error) {
      DebugUtils.error('ERROR_RECOVERY', 'Error in recovery system', error);
      return this.getEmergencyRecovery();
    }
  }

  /**
   * Execute specific recovery action
   * @param {string} action - Recovery action
   * @param {Object} context - Error context
   * @param {Object} userInput - Original user input
   * @returns {Object} Recovery result
   */
  async executeRecoveryAction(action, context, userInput) {
    switch (action) {
      case 'clarify_intent':
        return this.clarifyUserIntent(context, userInput);
      
      case 'ask_for_amount':
        return this.requestMissingAmount(context, userInput);
      
      case 'suggest_categories':
        return this.suggestCategories(context, userInput);
      
      case 'provide_examples':
        return this.provideFormatExamples(context, userInput);
      
      case 'guide_step_by_step':
        return this.initiateStepByStepGuide(context, userInput);
      
      case 'retry_with_backoff':
        return this.retryWithBackoff(context, userInput);
      
      case 'fallback_to_local_nlp':
        return this.useLocalNLPFallback(context, userInput);
      
      case 'infer_from_context':
        return this.inferFromContext(context, userInput);
      
      case 'format_correction':
        return this.helpWithFormatCorrection(context, userInput);
      
      default:
        return { success: false, reason: 'Unknown action' };
    }
  }

  /**
   * Clarify user intent when confidence is low
   */
  clarifyUserIntent(context, userInput) {
    const template = this.userGuidanceTemplates.get('clarify_intent');
    
    return {
      success: true,
      type: 'clarification',
      response: {
        text: `${template.title}\n\n${template.message}\n\n${template.options.join('\n')}\n\n${template.prompt}`,
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: true,
        actionType: 'intent_selection',
        options: template.options
      }
    };
  }

  /**
   * Request missing amount with helpful examples
   */
  requestMissingAmount(context, userInput) {
    const template = this.userGuidanceTemplates.get('missing_amount');
    
    const examplesText = template.examples.map(ex => `• ${ex}`).join('\n');
    
    return {
      success: true,
      type: 'missing_data',
      response: {
        text: `${template.title}\n\n${template.message}\n\n💡 Examples:\n${examplesText}\n\n${template.prompt}`,
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: true,
        actionType: 'amount_input',
        waitingFor: 'amount'
      }
    };
  }

  /**
   * Suggest categories when category is unclear
   */
  suggestCategories(context, userInput) {
    const template = this.userGuidanceTemplates.get('missing_category');
    
    const categoriesText = template.categories.map(cat => 
      `${cat.emoji} **${cat.name}** - ${cat.keywords}`
    ).join('\n');
    
    return {
      success: true,
      type: 'category_selection',
      response: {
        text: `${template.title}\n\n${template.message}\n\n${categoriesText}\n\n${template.prompt}`,
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: true,
        actionType: 'category_selection',
        categories: template.categories
      }
    };
  }

  /**
   * Provide format examples to help user
   */
  provideFormatExamples(context, userInput) {
    const template = this.userGuidanceTemplates.get('format_help');
    
    const formatsText = template.formats.map(format => `• ${format}`).join('\n');
    
    return {
      success: true,
      type: 'format_help',
      response: {
        text: `${template.title}\n\n${template.message}\n\n${formatsText}\n\n${template.tip}`,
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: false,
        actionType: 'format_guidance'
      }
    };
  }

  /**
   * Initiate step-by-step expense recording
   */
  initiateStepByStepGuide(context, userInput) {
    const template = this.userGuidanceTemplates.get('step_by_step_expense');
    const currentStep = template.steps[0];
    
    return {
      success: true,
      type: 'step_by_step',
      response: {
        text: `${template.title}\n\n**Step ${currentStep.step}:** ${currentStep.question}\n\n💡 Example: ${currentStep.example}`,
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: true,
        actionType: 'step_by_step',
        currentStep: 1,
        totalSteps: template.steps.length,
        waitingFor: 'amount'
      }
    };
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryWithBackoff(context, userInput) {
    const template = this.userGuidanceTemplates.get('connection_error');
    
    return {
      success: true,
      type: 'connection_recovery',
      response: {
        text: `${template.title}\n\n${template.message}\n\n${template.options.join('\n')}`,
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: true,
        actionType: 'connection_retry',
        autoRetry: template.autoRetry,
        retryDelay: template.retryDelay
      }
    };
  }

  /**
   * Use local NLP when API fails
   */
  useLocalNLPFallback(context, userInput) {
    // Implement basic local NLP parsing
    const basicParsing = this.basicExpenseParser(userInput.text || '');
    
    if (basicParsing.amount || basicParsing.category) {
      return {
        success: true,
        type: 'local_fallback',
        response: {
          text: "I'm using offline processing. Here's what I understood:\n\n" +
                `Amount: ${basicParsing.amount ? `₱${basicParsing.amount}` : 'Not specified'}\n` +
                `Category: ${basicParsing.category || 'Not specified'}\n\n` +
                "Is this correct?",
          isBot: true,
          timestamp: new Date(),
          requiresUserAction: true,
          actionType: 'confirmation',
          parsedData: basicParsing
        }
      };
    }
    
    return { success: false, reason: 'Could not parse locally' };
  }

  /**
   * Basic local expense parser (no AI)
   */
  basicExpenseParser(text) {
    const result = { amount: null, category: null };
    
    // Extract amount
    const amountPatterns = [
      /₱\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:pesos?|php)/i,
      /(\d+(?:,\d{3})*(?:\.\d{2})?)/
    ];
    
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.amount = parseFloat(match[1].replace(/,/g, ''));
        break;
      }
    }
    
    // Extract category (basic keyword matching)
    const categoryKeywords = {
      food: ['food', 'lunch', 'dinner', 'meal', 'jollibee', 'mcdo', 'eat'],
      transportation: ['jeepney', 'bus', 'taxi', 'grab', 'transport', 'fare'],
      entertainment: ['movie', 'game', 'cinema', 'entertainment'],
      shopping: ['shopping', 'buy', 'bought', 'store', 'mall'],
      utilities: ['bill', 'electric', 'water', 'internet', 'load']
    };
    
    const lowerText = text.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        result.category = category;
        break;
      }
    }
    
    return result;
  }

  /**
   * Infer missing data from conversation context
   */
  inferFromContext(context, userInput) {
    // Check if we have recent context that can fill missing data
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const recentMessages = context.conversationHistory.slice(-3);
      
      // Look for category mentions in recent messages
      if (!context.extractedData?.category) {
        for (const msg of recentMessages) {
          const category = this.basicExpenseParser(msg.text).category;
          if (category) {
            return {
              success: true,
              type: 'context_inference',
              response: {
                text: `Based on our conversation, I'll use "${category}" as the category. Is that correct?`,
                isBot: true,
                timestamp: new Date(),
                requiresUserAction: true,
                actionType: 'confirmation',
                inferredData: { category }
              }
            };
          }
        }
      }
    }
    
    return { success: false, reason: 'No context available' };
  }

  /**
   * Help with format correction
   */
  helpWithFormatCorrection(context, userInput) {
    const commonIssues = [
      "💰 Try using ₱ symbol: '₱150' instead of '150'",
      "📝 Be specific: 'I spent ₱200 on lunch' is clearer than 'spent money'",
      "🏷️ Add category: 'food', 'transport', 'entertainment', etc.",
      "📅 Include when: 'today', 'yesterday', or specific date"
    ];
    
    return {
      success: true,
      type: 'format_correction',
      response: {
        text: "Let me help you format that better! 📝\n\n" +
              "Common tips:\n" + commonIssues.join('\n') + 
              "\n\nTry rephrasing your expense with these tips!",
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: false,
        actionType: 'format_guidance'
      }
    };
  }

  /**
   * Execute fallback strategy
   */
  executeFallback(fallbackType, context, userInput) {
    switch (fallbackType) {
      case 'manual_category_selection':
        return this.suggestCategories(context, userInput);
      
      case 'default_amount_prompt':
        return this.requestMissingAmount(context, userInput);
      
      case 'others_category':
        return {
          success: true,
          type: 'fallback',
          response: {
            text: "I'll categorize this as 'Others' for now. You can change it later if needed.",
            isBot: true,
            timestamp: new Date(),
            fallbackData: { category: 'others' }
          }
        };
      
      default:
        return this.getGenericRecovery('fallback', context);
    }
  }

  /**
   * Generic recovery for unknown errors
   */
  getGenericRecovery(errorType, context) {
    return {
      success: true,
      type: 'generic',
      response: {
        text: "I encountered an issue, but I'm here to help! 🤖\n\n" +
              "Let's try a different approach. What would you like to do?\n\n" +
              "• Record an expense\n• Check budget\n• View spending\n• Get tips",
        isBot: true,
        timestamp: new Date(),
        requiresUserAction: true,
        actionType: 'generic_recovery'
      }
    };
  }

  /**
   * Emergency recovery for system failures
   */
  getEmergencyRecovery() {
    return {
      success: true,
      type: 'emergency',
      response: {
        text: "I'm experiencing some technical difficulties, but your data is safe! 🛡️\n\n" +
              "Please try again in a moment, or contact support if the issue persists.",
        isBot: true,
        timestamp: new Date(),
        isError: true,
        actionType: 'emergency'
      }
    };
  }

  /**
   * Log error for pattern analysis
   */
  logError(errorType, context, userInput) {
    const errorEntry = {
      timestamp: Date.now(),
      type: errorType,
      context,
      userInput: userInput.text || '',
      recovered: false
    };
    
    this.errorHistory.push(errorEntry);
    
    // Maintain history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift();
    }
    
    DebugUtils.log('ERROR_RECOVERY', 'Error logged', errorEntry);
  }

  /**
   * Analyze error patterns for improvements
   */
  analyzeErrorPatterns() {
    const recentErrors = this.errorHistory.slice(-20);
    const errorCounts = {};
    
    recentErrors.forEach(error => {
      errorCounts[error.type] = (errorCounts[error.type] || 0) + 1;
    });
    
    return {
      totalErrors: this.errorHistory.length,
      recentErrors: recentErrors.length,
      topErrors: Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5),
      recoveryRate: this.calculateRecoveryRate()
    };
  }

  /**
   * Calculate recovery success rate
   */
  calculateRecoveryRate() {
    const recoveredErrors = this.errorHistory.filter(e => e.recovered).length;
    return this.errorHistory.length > 0 
      ? (recoveredErrors / this.errorHistory.length * 100).toFixed(1)
      : 0;
  }

  /**
   * Mark error as recovered
   */
  markErrorRecovered(errorTimestamp) {
    const error = this.errorHistory.find(e => e.timestamp === errorTimestamp);
    if (error) {
      error.recovered = true;
      DebugUtils.log('ERROR_RECOVERY', 'Error marked as recovered', { errorTimestamp });
    }
  }
}

// Export singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();
