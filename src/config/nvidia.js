// NVIDIA API configuration for Llama model
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';
import { ChatMemoryManager } from '../services/ChatMemoryManager';
import { ErrorRecoveryManager } from '../services/ErrorRecoveryManager';
import { BudgetAlertManager } from '../services/BudgetAlertManager';

// Initialize service instances
const chatMemoryManager = new ChatMemoryManager();
const errorRecoveryManager = new ErrorRecoveryManager();
const budgetAlertManager = new BudgetAlertManager();

// NVIDIA API configuration
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1";

// Your NVIDIA API key
const NVIDIA_API_KEY = "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";

// Enhanced chat completion function with error recovery
export const getChatCompletion = async (messages, options = {}) => {
  const startTime = Date.now();
  
  try {
    const {
      temperature = 0.6,
      top_p = 0.95,
      max_tokens=4096,
      frequency_penalty=0.7,
      presence_penalty=0.5,
      stream=false,
    } = options;

    DebugUtils.log('NVIDIA_API', 'Making chat completion request', {
      messageCount: messages.length,
      maxTokens: max_tokens,
      freqPenalty: frequency_penalty,
      presencePenalty: presence_penalty,
      temperature
    });

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages,
        temperature,
        top_p,
        frequency_penalty,
        presence_penalty,
        max_tokens,
        stream
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      DebugUtils.error('NVIDIA_API', 'API request failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      throw new Error(`NVIDIA API error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;
    
    DebugUtils.log('NVIDIA_API', 'Chat completion successful', {
      responseTime,
      tokensUsed: data.usage?.total_tokens || 'unknown'
    });

    return data.choices[0].message.content;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    DebugUtils.error('NVIDIA_API', 'Chat completion failed', {
      error: error.message,
      responseTime
    });
    
    // Use error recovery system
    const recovery = await errorRecoveryManager.handleError('nvidia_api_error', {
      error: error.message,
      responseTime,
      messageCount: messages.length
    }, { messages });
    
    if (recovery.success && recovery.type === 'local_fallback') {
      // Return a basic fallback response
      return "I'm having trouble connecting to my AI services, but I can still help with basic expense tracking. Please try again or use simpler commands.";
    }
    
    throw error;
  }
};

// System prompts for different scenarios
export const SYSTEM_PROMPTS = {
  COMPLEX_ANALYSIS: `You are MoneyTrack AI, a financial assistant for university/college students in the Philippines. 
Use detailed thinking for complex financial analysis. Always respond in a helpful, friendly tone.
Focus on practical money-saving tips for students. Use Philippine Peso (₱) currency.
Think step by step when analyzing spending patterns and providing financial advice.`,

  SIMPLE_QUERIES: `You are MoneyTrack AI, a financial assistant for university/college students in the Philippines.
Provide quick, direct answers to simple questions. Use Philippine Peso (₱) currency.
Keep responses concise and actionable.`,

  EXPENSE_CATEGORIZATION: `You are an expense categorization expert. Categorize transactions into these categories:
- food (meals, groceries, snacks)
- transportation (jeepney, bus, taxi, gas)
- entertainment (movies, games, social activities)
- shopping (clothes, gadgets, personal items)
- utilities (bills, phone load, internet)
- others (miscellaneous expenses)

Respond with just the category name in lowercase.`,
  TRANSACTION_LOGGING: `You are a transaction parser. Extract expense details from natural language input.
Return a JSON object with: amount (number), category (string), note (string), date (ISO string).
If any field is missing, use reasonable defaults or ask for clarification.`
};

// Helper function to determine which system prompt to use
export const getSystemPrompt = (queryType) => {
  switch (queryType) {
    case 'analysis':
    case 'planning':
    case 'tips':
      return SYSTEM_PROMPTS.COMPLEX_ANALYSIS;
    case 'categorization':
      return SYSTEM_PROMPTS.EXPENSE_CATEGORIZATION;
    case 'transaction':
      return SYSTEM_PROMPTS.TRANSACTION_LOGGING;
    default:
      return SYSTEM_PROMPTS.SIMPLE_QUERIES;
  }
};

// Financial tips knowledge base for students
export const FINANCIAL_TIPS = [
  "Use the 70/20/10 rule: 70% needs, 20% wants, 10% savings",
  "Cook meals instead of eating out to save ₱100-200 per day",
  "Use student discounts whenever available",
  "Set aside money for textbooks at the start of each semester",
  "Use public transportation or walk when possible",
  "Buy generic brands for basic necessities",
  "Share streaming subscriptions with roommates",
  "Use free campus facilities like gym and library",
  "Look for part-time jobs or freelance opportunities",
  "Track every expense to identify spending patterns"
];

// Function to get personalized financial tips
export const getPersonalizedTip = (userExpenses, userBudget) => {
  const tips = [...FINANCIAL_TIPS];
  
  // Add context-specific tips based on spending patterns
  if (userExpenses && userBudget) {
    const foodSpending = userExpenses.filter(e => e.category === 'food')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const transportSpending = userExpenses.filter(e => e.category === 'transportation')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    if (foodSpending > userBudget.categories?.food?.limit * 0.8) {
      tips.unshift("Your food spending is high. Try meal prepping to save money!");
    }
    
    if (transportSpending > userBudget.categories?.transportation?.limit * 0.8) {
      tips.unshift("Consider using student transport cards or walking more to save on transport costs.");
    }
  }
  
  return tips[Math.floor(Math.random() * Math.min(tips.length, 3))];
};

// Enhanced AI-powered expense analysis with memory optimization
export const analyzeExpenses = async (expenses, budget = null) => {
  if (!expenses || expenses.length === 0) {
    return [{
      id: 'welcome',
      type: 'info',
      title: 'Welcome to MoneyTrack',
      message: 'Start tracking your expenses to get AI-powered insights!',
      icon: 'bulb-outline',
      color: '#4CAF50'
    }];
  }

  try {
    DebugUtils.log('NVIDIA_AI', 'Starting expense analysis', {
      expenseCount: expenses.length,
      hasBudget: !!budget
    });

    // Use memory manager to optimize data processing
    const expenseData = expenses.slice(0, 20).map(expense => ({
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      note: expense.note
    }));

    const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const monthlyBudget = budget?.monthly || 0;

    const messages = [
      {
        role: 'system',
        content: `You are a Filipino financial advisor AI specializing in college student budgeting. Analyze spending patterns and provide actionable insights in Filipino context. 

CRITICAL: Respond with ONLY a valid JSON array. Do not include any explanatory text, greetings, or additional content. 

Return insights as a JSON array with this exact format:
[
  {
    "type": "info",
    "title": "Brief Title",
    "message": "Actionable insight message (max 120 chars)",
    "icon": "ionicon-name",
    "color": "#hexcolor"
  }
]

Valid types: info, warning, error, success
CRITICAL: Use ONLY these valid Ionicons names (modern format):
- bulb-outline, warning-outline, checkmark-circle-outline, trending-up-outline, trending-down-outline
- wallet-outline, restaurant-outline, car-outline, film-outline, bag-outline, build-outline
- analytics-outline, rocket-outline, school-outline, happy-outline, list-outline
- information-circle-outline, alert-circle-outline, close-circle-outline

DO NOT use old formats like: ion-ios-*, ion-md-*, ios-*, md-*

Focus on: spending patterns, budget adherence, category-specific tips, and Filipino student context (jeepney, canteen, etc).`
      },
      {
        role: 'user',
        content: `Analyze these expenses for insights:
        
        Total Spent: ₱${totalSpent.toLocaleString()}
        Monthly Budget: ₱${monthlyBudget.toLocaleString()}
        Recent Expenses: ${JSON.stringify(expenseData)}
        
        Provide 2-3 actionable insights focusing on spending patterns, budget efficiency, and student-friendly Filipino tips.`
      }
    ];

    const response = await getChatCompletion(messages, {
      temperature: 0.3,
      max_tokens: 1200, // Increased from 800 to allow complete responses
      frequency_penalty: 0.3,
      presence_penalty: 0.2
    });

    // Parse the AI response with error recovery
    let insights;
    try {
      // Clean and extract JSON from the response
      const cleanedResponse = extractJSON(response);
      insights = JSON.parse(cleanedResponse);
      
      // Validate the parsed insights
      if (!Array.isArray(insights)) {
        throw new Error('Response is not an array');
      }
      
      // Ensure each insight has required fields and valid icons
      insights = insights.filter(insight => 
        insight && 
        typeof insight === 'object' && 
        insight.title && 
        insight.message
      ).map(insight => ({
        type: insight.type || 'info',
        title: insight.title,
        message: insight.message,
        icon: validateIconName(insight.icon), // Validate and fix icon names
        color: insight.color || '#4CAF50'
      }));
      
      DebugUtils.log('NVIDIA_AI', 'AI analysis successful', { insightCount: insights.length });
    } catch (parseError) {
      DebugUtils.error('NVIDIA_AI', 'AI response parsing failed', parseError);
      DebugUtils.log('NVIDIA_AI', 'Raw response that failed to parse', { response: response.substring(0, 200) });
      
      // Use error recovery for parsing failures
      const recovery = await errorRecoveryManager.handleError('ai_parsing_error', {
        response,
        parseError: parseError.message
      }, {});
      
      // Fallback to manual insights
      insights = generateFallbackInsights(expenses, budget);
    }

    // Ensure insights have unique IDs and are properly formatted
    return insights.map((insight, index) => ({
      ...insight,
      id: `ai-insight-${Date.now()}-${index}`
    }));

  } catch (error) {
    DebugUtils.error('NVIDIA_AI', 'Error analyzing expenses with AI', error);
    
    // Use error recovery system
    await errorRecoveryManager.handleError('ai_analysis_error', {
      error: error.message,
      expenseCount: expenses.length
    }, {});
    
    return generateFallbackInsights(expenses, budget);
  }
};

// Enhanced AI-powered recommendations with budget alerts
export const getRecommendations = async (userProfile, expenses, budget = null) => {
  if (!expenses || expenses.length === 0) {
    return [{
      id: 'start-tracking',
      type: 'info',
      title: 'Start Your Journey',
      message: 'Begin tracking expenses to receive personalized recommendations!',
      icon: 'rocket-outline',
      color: '#2196F3'
    }];
  }

  try {
    DebugUtils.log('NVIDIA_AI', 'Generating recommendations', {
      userId: userProfile?.id,
      expenseCount: expenses.length,
      hasBudget: !!budget
    });

    const categorySpending = {};
    expenses.forEach(expense => {
      const cat = expense.category.toLowerCase();
      categorySpending[cat] = (categorySpending[cat] || 0) + parseFloat(expense.amount);
    });

    const topCategory = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)[0];

    // Check for budget alerts before generating recommendations
    if (userProfile?.id && budget) {
      const totalSpent = Object.values(categorySpending).reduce((a,b) => a+b, 0);
      const alerts = await budgetAlertManager.processExpenseAlert(
        userProfile.id,
        { amount: 0, category: 'check' }, // Dummy expense for checking
        budget,
        categorySpending
      );
      
      // If there are critical alerts, prioritize those in recommendations
      if (alerts.length > 0) {
        const criticalAlerts = alerts.filter(alert => 
          alert.level === 'critical' || alert.level === 'exceeded'
        );
        
        if (criticalAlerts.length > 0) {
          return criticalAlerts.map(alert => ({
            id: alert.id,
            type: alert.level === 'exceeded' ? 'error' : 'warning',
            title: alert.title,
            message: alert.message,
            icon: alert.icon,
            color: alert.color,
            actions: alert.actions
          }));
        }
      }
    }

    const messages = [
      {
        role: 'system',
        content: `You are a financial coach for Filipino college students. Provide personalized money-saving recommendations.

CRITICAL: Respond with ONLY a valid JSON array. Do not include any explanatory text, greetings, or additional content.

Return as JSON array with this format:
[
  {
    "type": "success",
    "title": "Action Title", 
    "message": "Specific actionable recommendation (max 240 chars)",
    "icon": "ionicon-name",
    "color": "#hexcolor"
  }
]

Valid types: success, info, warning
CRITICAL: Use ONLY these valid Ionicons names (modern format):
- bulb-outline, warning-outline, checkmark-circle-outline, trending-up-outline, trending-down-outline
- wallet-outline, restaurant-outline, car-outline, film-outline, bag-outline, build-outline
- analytics-outline, rocket-outline, school-outline, happy-outline, list-outline
- information-circle-outline, alert-circle-outline, close-circle-outline

DO NOT use old formats like: ion-ios-*, ion-md-*, ios-*, md-*

Focus on: Filipino student context, practical savings tips, budget optimization, and healthy financial habits.`
      },
      {
        role: 'user',
        content: `Generate 2-3 personalized recommendations for this student:
        
        Top Spending Category: ${topCategory ? `${topCategory[0]} (₱${topCategory[1].toLocaleString()})` : 'No data'}
        Total Monthly Spending: ₱${categorySpending ? Object.values(categorySpending).reduce((a,b) => a+b, 0).toLocaleString() : '0'}
        Budget: ₱${budget?.monthly?.toLocaleString() || 'Not set'}
        
        Focus on practical, student-friendly Philippine context recommendations.`
      }
    ];

    const response = await getChatCompletion(messages, {
      temperature: 0.3,
      max_tokens: 1500, // Increased from 800 to allow complete responses
      frequency_penalty: 0.5,
      presence_penalty: 0.3
    });

    let recommendations;
    try {
      // Clean and extract JSON from the response
      const cleanedResponse = extractJSON(response);
      recommendations = JSON.parse(cleanedResponse);
      
      // Validate the parsed recommendations
      if (!Array.isArray(recommendations)) {
        throw new Error('Response is not an array');
      }
      
      // Ensure each recommendation has required fields and valid icons
      recommendations = recommendations.filter(rec => 
        rec && 
        typeof rec === 'object' && 
        rec.title && 
        rec.message
      ).map(rec => ({
        type: rec.type || 'success',
        title: rec.title,
        message: rec.message,
        icon: validateIconName(rec.icon), // Validate and fix icon names
        color: rec.color || '#4CAF50'
      }));
      
      DebugUtils.log('NVIDIA_AI', 'Recommendations generated successfully', { 
        recommendationCount: recommendations.length 
      });
    } catch (parseError) {
      DebugUtils.error('NVIDIA_AI', 'Recommendation parsing failed', parseError);
      DebugUtils.log('NVIDIA_AI', 'Raw response that failed to parse', { response: response.substring(0, 200) });
      
      // Use error recovery
      await errorRecoveryManager.handleError('ai_parsing_error', {
        response,
        parseError: parseError.message
      }, {});
      
      recommendations = generateFallbackRecommendations(expenses, budget);
    }

    return recommendations.map((rec, index) => ({
      ...rec,
      id: `ai-rec-${Date.now()}-${index}`
    }));

  } catch (error) {
    DebugUtils.error('NVIDIA_AI', 'Error getting AI recommendations', error);
    
    // Use error recovery system
    await errorRecoveryManager.handleError('ai_recommendation_error', {
      error: error.message,
      expenseCount: expenses.length
    }, {});
    
    return generateFallbackRecommendations(expenses, budget);
  }
};

// Helper function to extract JSON from mixed text responses
const extractJSON = (response) => {
  try {
    DebugUtils.log('NVIDIA_AI', 'Attempting to extract JSON from response', { 
      responseStart: response.substring(0, 100) 
    });
    
    // Check for truncated response first
    if (response.trim().endsWith(',') || 
        response.trim().endsWith('"') || 
        (!response.trim().endsWith(']') && !response.trim().endsWith('}'))) {
      DebugUtils.warn('NVIDIA_AI', 'Response appears to be truncated', { 
        responseEnd: response.slice(-50) 
      });
      throw new Error('Response is truncated - insufficient tokens');
    }
    
    // First, try to parse as-is
    JSON.parse(response);
    return response;
  } catch (error) {
    // If direct parsing fails, try to extract JSON from the response
    
    // Look for JSON array patterns
    const arrayMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      DebugUtils.log('NVIDIA_AI', 'Found JSON array pattern', { match: arrayMatch[0].substring(0, 100) });
      return arrayMatch[0];
    }
    
    // Try to fix incomplete JSON by finding the start and attempting completion
    const incompleteMatch = response.match(/\[\s*\{[\s\S]*$/);
    if (incompleteMatch) {
      const incomplete = incompleteMatch[0];
      DebugUtils.warn('NVIDIA_AI', 'Found incomplete JSON, attempting to complete it', { 
        incomplete: incomplete.substring(0, 100) 
      });
      
      // Try to complete the JSON by adding missing properties and closing brackets
      let completed = incomplete;
      
      // If it ends with a comma or quote, try to complete the object
      if (completed.trim().endsWith(',') || completed.trim().endsWith('"')) {
        // Add missing icon and color if not present
        if (!completed.includes('"icon"')) {
          completed += '\n    "icon": "bulb-outline",';
        }
        if (!completed.includes('"color"')) {
          completed += '\n    "color": "#4CAF50"';
        }
        completed += '\n  }\n]';
        
        try {
          JSON.parse(completed);
          DebugUtils.log('NVIDIA_AI', 'Successfully completed truncated JSON');
          return completed;
        } catch (e) {
          DebugUtils.warn('NVIDIA_AI', 'Failed to complete JSON', { error: e.message });
        }
      }
    }
    
    // Look for JSON object patterns (single object that should be wrapped in array)
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      // Check if it's a valid single object by trying to parse it
      try {
        const testParse = JSON.parse(objectMatch[0]);
        if (typeof testParse === 'object' && !Array.isArray(testParse)) {
          DebugUtils.log('NVIDIA_AI', 'Found valid single JSON object, wrapping in array', { match: objectMatch[0].substring(0, 100) });
          return `[${objectMatch[0]}]`;
        }
      } catch (e) {
        DebugUtils.log('NVIDIA_AI', 'Object match found but not valid JSON', { error: e.message });
      }
    }
    
    // Try to find content between code blocks
    const codeBlockMatch = response.match(/```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      DebugUtils.log('NVIDIA_AI', 'Found JSON in code block', { match: codeBlockMatch[1].substring(0, 100) });
      return codeBlockMatch[1];
    }
    
    // Try to clean up common issues
    let cleaned = response.trim();
    
    // Remove common prefixes
    cleaned = cleaned.replace(/^(Here's?|Here are|Based on|The analysis shows?)[\s\S]*?(\[|\{)/, '$2');
    
    // Remove common suffixes after JSON
    cleaned = cleaned.replace(/(\]|\})\s*[\s\S]*$/, '$1');
    
    // Try to find the first [ or { and last ] or }
    const startBracket = Math.min(
      cleaned.indexOf('[') >= 0 ? cleaned.indexOf('[') : Infinity,
      cleaned.indexOf('{') >= 0 ? cleaned.indexOf('{') : Infinity
    );
    
    if (startBracket !== Infinity) {
      const substring = cleaned.substring(startBracket);
      const endBracket = Math.max(
        substring.lastIndexOf(']'),
        substring.lastIndexOf('}')
      );
      
      if (endBracket > 0) {
        const extracted = substring.substring(0, endBracket + 1);
        DebugUtils.log('NVIDIA_AI', 'Extracted JSON by bracket matching', { 
          extracted: extracted.substring(0, 100) 
        });
        return extracted;
      }
    }
    
    DebugUtils.error('NVIDIA_AI', 'Could not extract valid JSON from response', { 
      response: response.substring(0, 200) 
    });
    
    // Return empty array as last resort
    return '[]';
  }
};

// Valid Ionicons names (modern format only)
const VALID_ICONICONS = [
  'bulb-outline', 'warning-outline', 'checkmark-circle-outline', 'trending-up-outline', 'trending-down-outline',
  'wallet-outline', 'restaurant-outline', 'car-outline', 'film-outline', 'bag-outline', 'build-outline',
  'analytics-outline', 'rocket-outline', 'school-outline', 'happy-outline', 'list-outline',
  'information-circle-outline', 'alert-circle-outline', 'close-circle-outline', 'fast-food-outline',
  'bus-outline', 'cart-outline', 'apps-outline', 'ellipsis-horizontal-outline', 'bicycle-outline'
];

// Function to validate and fix icon names
const validateIconName = (iconName) => {
  if (!iconName || typeof iconName !== 'string') {
    return 'bulb-outline'; // Default fallback
  }
  
  // Check if it's already a valid modern icon
  if (VALID_ICONICONS.includes(iconName)) {
    return iconName;
  }
  
  // Convert old formats to modern equivalents
  const iconMappings = {
    'ion-ios-list': 'list-outline',
    'ion-ios-pie': 'analytics-outline',
    'ion-ios-warning': 'warning-outline',
    'ion-md-cash': 'wallet-outline',
    'ion-md-close': 'close-circle-outline',
    'ios-list': 'list-outline',
    'ios-pie': 'analytics-outline',
    'ios-warning': 'warning-outline',
    'md-cash': 'wallet-outline',
    'md-close': 'close-circle-outline',
    'list': 'list-outline',
    'pie': 'analytics-outline',
    'cash': 'wallet-outline',
    'close': 'close-circle-outline'
  };
  
  const mapped = iconMappings[iconName];
  if (mapped) {
    DebugUtils.log('NVIDIA_AI', 'Converted legacy icon name', { 
      oldIcon: iconName, 
      newIcon: mapped 
    });
    return mapped;
  }
  
  // Try to find a partial match
  const lowerIcon = iconName.toLowerCase();
  const partialMatch = VALID_ICONICONS.find(validIcon => 
    validIcon.includes(lowerIcon) || lowerIcon.includes(validIcon.replace('-outline', ''))
  );
  
  if (partialMatch) {
    DebugUtils.log('NVIDIA_AI', 'Found partial icon match', { 
      originalIcon: iconName, 
      matchedIcon: partialMatch 
    });
    return partialMatch;
  }
  
  DebugUtils.warn('NVIDIA_AI', 'Invalid icon name, using fallback', { 
    invalidIcon: iconName 
  });
  return 'bulb-outline'; // Default fallback
};

// Enhanced fallback insights with budget alert integration
const generateFallbackInsights = (expenses, budget) => {
  const insights = [];
  const totalSpent = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  
  DebugUtils.log('NVIDIA_AI', 'Generating fallback insights', {
    totalSpent,
    expenseCount: expenses.length,
    hasBudget: !!budget
  });
  
  // Category analysis with enhanced insights
  const categorySpending = {};
  expenses.forEach(expense => {
    const cat = expense.category.toLowerCase();
    categorySpending[cat] = (categorySpending[cat] || 0) + parseFloat(expense.amount);
  });

  const topCategory = Object.entries(categorySpending).sort(([,a], [,b]) => b - a)[0];
  
  if (topCategory) {
    const categoryName = topCategory[0].charAt(0).toUpperCase() + topCategory[0].slice(1);
    insights.push({
      type: 'info',
      title: `Top Spending: ${categoryName}`,
      message: `You spent most on ${topCategory[0]}: ₱${topCategory[1].toLocaleString()}`,
      icon: getCategoryIcon(topCategory[0]),
      color: '#FF9800'
    });
  }

  // Enhanced budget analysis with real-time alerts
  if (budget?.monthly > 0) {
    const percentage = (totalSpent / budget.monthly) * 100;
    
    if (percentage > 100) {
      insights.push({
        type: 'error',
        title: 'Budget Exceeded!',
        message: `You've exceeded your budget by ₱${(totalSpent - budget.monthly).toLocaleString()}`,
        icon: 'warning-outline',
        color: '#F44336'
      });
    } else if (percentage > 90) {
      insights.push({
        type: 'warning',
        title: 'Budget Alert',
        message: `${percentage.toFixed(0)}% used - only ₱${(budget.monthly - totalSpent).toLocaleString()} left!`,
        icon: 'alert-circle-outline',
        color: '#FF5722'
      });
    } else if (percentage > 75) {
      insights.push({
        type: 'warning',
        title: 'Budget Warning',
        message: `${percentage.toFixed(0)}% of budget used - time to slow down spending`,
        icon: 'warning-outline',
        color: '#FF9800'
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Budget on Track',
        message: `${(100 - percentage).toFixed(0)}% budget remaining - good job!`,
        icon: 'checkmark-circle-outline',
        color: '#4CAF50'
      });
    }
  }

  // Smart spending pattern insights
  if (expenses.length >= 5) {
    const recentExpenses = expenses.slice(-5);
    const avgAmount = recentExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0) / recentExpenses.length;
    
    if (avgAmount > 200) {
      insights.push({
        type: 'info',
        title: 'Spending Pattern',
        message: `Recent avg: ₱${avgAmount.toFixed(0)} - consider smaller purchases`,
        icon: 'trending-up-outline',
        color: '#2196F3'
      });
    }
  }

  return insights;
};

// Enhanced fallback recommendations with personalized tips
const generateFallbackRecommendations = (expenses, budget) => {
  const recommendations = [];
  
  DebugUtils.log('NVIDIA_AI', 'Generating fallback recommendations', {
    expenseCount: expenses.length,
    hasBudget: !!budget
  });

  // Analyze spending patterns for personalized tips
  const categorySpending = {};
  expenses.forEach(expense => {
    const cat = expense.category.toLowerCase();
    categorySpending[cat] = (categorySpending[cat] || 0) + parseFloat(expense.amount);
  });

  const topCategory = Object.entries(categorySpending).sort(([,a], [,b]) => b - a)[0];

  // Category-specific recommendations
  if (topCategory) {
    const [category, amount] = topCategory;
    const categoryRecs = getCategoryRecommendations(category, amount);
    recommendations.push(...categoryRecs);
  }

  // Budget-based recommendations
  if (budget?.monthly > 0) {
    const totalSpent = Object.values(categorySpending).reduce((a,b) => a+b, 0);
    const percentage = (totalSpent / budget.monthly) * 100;
    
    if (percentage > 80) {
      recommendations.push({
        type: 'warning',
        title: 'Budget Management',
        message: 'Switch to essential spending only for the rest of the month',
        icon: 'shield-outline',
        color: '#FF5722'
      });
    }
  }

  // General student-friendly tips
  recommendations.push({
    type: 'success',
    title: 'Student Savings Tip',
    message: 'Use your student ID for discounts at restaurants and stores',
    icon: 'school-outline',
    color: '#4CAF50'
  });

  return recommendations.slice(0, 3); // Limit to 3 recommendations
};

// Get category-specific recommendations
const getCategoryRecommendations = (category, amount) => {
  const recommendations = [];
  
  switch (category) {
    case 'food':
      if (amount > 2000) {
        recommendations.push({
          type: 'success',
          title: 'Food Savings',
          message: 'Try meal prepping on weekends to save ₱500+ monthly',
          icon: 'restaurant-outline',
          color: '#4CAF50'
        });
      }
      break;
      
    case 'transportation':
      if (amount > 1000) {
        recommendations.push({
          type: 'info',
          title: 'Transport Savings',
          message: 'Consider walking or biking for short distances',
          icon: 'bicycle-outline',
          color: '#2196F3'
        });
      }
      break;
      
    case 'entertainment':
      if (amount > 1500) {
        recommendations.push({
          type: 'info',
          title: 'Entertainment Budget',
          message: 'Look for free campus events and student discounts',
          icon: 'happy-outline',
          color: '#9C27B0'
        });
      }
      break;
      
    case 'shopping':
      recommendations.push({
        type: 'success',
        title: 'Smart Shopping',
        message: 'Make a list before shopping to avoid impulse purchases',
        icon: 'list-outline',
        color: '#FF9800'
      });
      break;
      
    default:
      recommendations.push({
        type: 'info',
        title: 'General Tip',
        message: 'Track every expense to identify saving opportunities',
        icon: 'analytics-outline',
        color: '#607D8B'
      });
  }
  
  return recommendations;
};

// Get category-specific icons
const getCategoryIcon = (category) => {
  const icons = {
    food: 'restaurant-outline',
    transportation: 'car-outline',
    entertainment: 'film-outline',
    shopping: 'bag-outline',
    utilities: 'build-outline',
    others: 'ellipsis-horizontal-outline'
  };
  
  return icons[category] || 'wallet-outline';
};

// Real-time budget alert processor
export const processExpenseForAlerts = async (userId, expense, currentBudget, categorySpending) => {
  try {
    if (!userId || !expense) return [];

    DebugUtils.log('NVIDIA_AI', 'Processing expense for budget alerts', {
      userId,
      expenseAmount: expense.amount,
      category: expense.category
    });

    // Use budget alert manager to check for alerts
    const alerts = await budgetAlertManager.processExpenseAlert(
      userId,
      expense,
      currentBudget,
      categorySpending
    );

    return alerts.map(alert => ({
      id: alert.id,
      type: alert.level === 'exceeded' ? 'error' : 
            alert.level === 'critical' ? 'warning' : 'info',
      title: alert.title,
      message: alert.message,
      icon: alert.icon,
      color: alert.color,
      timestamp: alert.timestamp,
      actions: alert.actions,
      category: alert.category,
      data: alert.data
    }));

  } catch (error) {
    DebugUtils.error('NVIDIA_AI', 'Error processing expense alerts', error);
    return [];
  }
};

// Memory-optimized conversation context
export const getOptimizedConversationContext = async (userId, sessionId, limit = 10) => {
  try {
    const result = await chatMemoryManager.loadMessages(userId, sessionId, 0, limit);
    
    // Return only essential context for AI processing
    return result.messages.map(msg => ({
      role: msg.isBot ? 'assistant' : 'user',
      content: msg.text,
      timestamp: msg.timestamp
    }));
  } catch (error) {
    DebugUtils.error('NVIDIA_AI', 'Error getting conversation context', error);
    return [];
  }
};

// Enhanced error recovery for AI failures
export const handleAIFailure = async (errorType, context) => {
  try {
    const recovery = await errorRecoveryManager.handleError(errorType, context, {});
    
    if (recovery.success) {
      return {
        success: true,
        fallbackResponse: recovery.response.text,
        recoveryType: recovery.type,
        requiresUserAction: recovery.response.requiresUserAction,
        actionType: recovery.response.actionType
      };
    }
    
    return { success: false, error: 'Recovery failed' };
  } catch (error) {
    DebugUtils.error('NVIDIA_AI', 'Error in AI failure recovery', error);
    return { success: false, error: error.message };
  }
};
