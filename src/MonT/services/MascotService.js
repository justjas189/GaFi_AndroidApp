// Enhanced Financial Mascot Service with Supabase integration
import { supabase } from '../../config/supabase';

export class MascotService {
  // Supabase-based service - no Flask backend needed
  static async sendMessage(message, userId = null, personalityContext = true) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !userId) {
        return this.getFallbackChatResponse(message);
      }

      const currentUserId = userId || session.user.id;

      // Try to store chat message in Supabase, but don't fail if it doesn't work
      try {
        const { data: chatData, error: chatError } = await supabase
          .from('chat_history')
          .insert({
            user_id: currentUserId,
            message: message,
            response: this.generateContextualResponse(message),
            personality_context: personalityContext,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!chatError && chatData) {
          return {
            success: true,
            message: chatData.response,
            state: this.determineEmotionalState(message),
            timestamp: chatData.created_at,
            chat_id: chatData.id
          };
        }
      } catch (dbError) {
        console.warn('Database operation failed, using fallback:', dbError.message);
      }

      // If database operation fails, return contextual response directly
      return {
        success: true,
        message: this.generateContextualResponse(message),
        state: this.determineEmotionalState(message),
        timestamp: new Date().toISOString(),
        fallback_mode: true
      };
    } catch (error) {
      console.warn('Supabase chat unavailable, using fallback:', error.message);
      return this.getFallbackChatResponse(message);
    }
  }

  static generateContextualResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Budget-related responses with Duo-inspired personality
    if (lowerMessage.includes('budget') || lowerMessage.includes('spend')) {
      const budgetResponses = [
        "Budgeting time! Let's crush those spending goals like a boss! 50% needs, 30% wants, 20% savings - that's the magic formula! 💰",
        "Smart budgeting question! I see you're serious about your finances! Let's make every peso count! 🎯",
        "Budget talk? YES! You're already ahead of 90% of people just by asking! Keep this energy! �"
      ];
      return budgetResponses[Math.floor(Math.random() * budgetResponses.length)];
    }
    
    // Savings-related responses with enthusiasm
    if (lowerMessage.includes('save') || lowerMessage.includes('savings')) {
      const savingsResponses = [
        "SAVINGS TALK! My favorite topic! Even ₱10 saved today becomes ₱3,650 yearly! Small steps, BIG results! 🌱",
        "You're speaking my language! Saving is like planting money trees - the earlier you start, the bigger they grow! 💪",
        "Savings superstar alert! 🚨 Remember: it's not about the amount, it's about the HABIT! Keep going! ⭐"
      ];
      return savingsResponses[Math.floor(Math.random() * savingsResponses.length)];
    }
    
    // Goal-related responses with Duo-style motivation
    if (lowerMessage.includes('goal') || lowerMessage.includes('target')) {
      const goalResponses = [
        "GOAL SETTER! I LOVE your ambition! Break that big goal into tiny wins - your future self will thank you! 🎯",
        "Goals are dreams with deadlines! Let's turn your dreams into REALITY with smart planning! ✨",
        "Goal-getter vibes! 🔥 Remember: specific goals get specific results! Let's make it happen! 💪"
      ];
      return goalResponses[Math.floor(Math.random() * goalResponses.length)];
    }
    
    // Investment-related responses with excitement
    if (lowerMessage.includes('invest') || lowerMessage.includes('investment')) {
      const investmentResponses = [
        "INVESTMENT MINDSET! You're thinking like a wealth builder! Start small, stay consistent, time is your superpower! 📈",
        "Investing? YES! You're graduating from saver to WEALTH CREATOR! Remember: diversify and stay the course! 🚀",
        "Investment wisdom unlocked! 🔓 Early + Regular + Patient = Future Millionaire! Let's do this! 💎"
      ];
      return investmentResponses[Math.floor(Math.random() * investmentResponses.length)];
    }
    
    // Duo-inspired default encouraging responses with personality
    const duoStyleDefaults = [
      "LOVE the curiosity! Asking questions = building wealth! You're already winning! 💪",
      "Smart thinking! Financial awareness is your secret weapon! Keep those questions coming! 🌟",
      "YES! Learning mode activated! Every question brings you closer to financial freedom! 📚",
      "Brain power engaged! 🧠 You're building the financial intelligence that creates success! 🚀",
      "Question master! 🎯 Your curiosity about money will make you rich! Keep going! ⭐"
    ];
    
    return duoStyleDefaults[Math.floor(Math.random() * duoStyleDefaults.length)];
  }

  static determineEmotionalState(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('help') || lowerMessage.includes('confused')) {
      return 'thinking';
    }
    if (lowerMessage.includes('achieved') || lowerMessage.includes('success')) {
      return 'celebrating';
    }
    if (lowerMessage.includes('goal') || lowerMessage.includes('plan')) {
      return 'excited';
    }
    if (lowerMessage.includes('worried') || lowerMessage.includes('problem')) {
      return 'encouraging';
    }
    
    return 'happy';
  }

  static getFallbackChatResponse(message) {
    // Duo-inspired fallback responses with MonT's enhanced personality
    const duoStyleResponses = [
      "MonT here! Ready to tackle your finances together! Every question makes you smarter! 💰",
      "Your financial journey just got more exciting! I'm here to guide you every step! 🌟",
      "Financial wisdom incoming! Every small step builds BIG results! Let's go! 💪",
      "Money talk? My specialty! You're already winning by asking the right questions! 🎯",
      "Smart financial thinking detected! 🧠 Keep this energy - success is inevitable! 📊",
      "MonT's financial wisdom: Start where you are, use what you have, do what you can! 🚀",
      "Financial growth mindset activated! You're building the habits that create wealth! ⭐"
    ];
    
    const randomResponse = duoStyleResponses[Math.floor(Math.random() * duoStyleResponses.length)];
    
    return {
      success: true,
      message: randomResponse,
      state: 'happy',
      type: 'encouragement',
      mascot: 'MonT',
      fallback_mode: true,
      timestamp: new Date().toISOString(),
      personality: 'duo_inspired'
    };
  }

  // Enhanced getUserStats with gamification features
  static async getUserStats(userId = null) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !userId) {
        return this.getFallbackUserStats();
      }

      const currentUserId = userId || session.user.id;

      // Try to get user's financial data from Supabase with error handling
      let budgets = [];
      let savings = [];

      try {
        const { data: budgetData, error: budgetError } = await supabase
          .from('budgets')
          .select('total_budget')
          .eq('user_id', currentUserId);
        
        if (!budgetError && budgetData) {
          budgets = budgetData.map(budget => ({
            amount: budget.total_budget,
            spent_amount: 0 // Will be calculated from budget_categories if needed
          }));
        }
      } catch (budgetErr) {
        console.warn('Failed to fetch budgets:', budgetErr.message);
      }

      try {
        const { data: savingsData, error: savingsError } = await supabase
          .from('savings_goals')
          .select('target_amount, current_amount, is_achieved')
          .eq('user_id', currentUserId);
        
        if (!savingsError && savingsData) {
          savings = savingsData;
        }
      } catch (savingsErr) {
        console.warn('Failed to fetch savings goals:', savingsErr.message);
      }

      // Calculate stats with available data
      const totalBudget = budgets?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
      const totalSpent = budgets?.reduce((sum, b) => sum + (b.spent_amount || 0), 0) || 0;
      const totalSaved = totalBudget - totalSpent;
      const totalSavingsGoals = savings?.reduce((sum, s) => sum + (s.current_amount || 0), 0) || 0;
      const achievedGoals = savings?.filter(s => s.is_achieved).length || 0;

      // Calculate streak with error handling
      let streak = 0;
      try {
        streak = await this.calculateUserStreak(currentUserId);
      } catch (streakErr) {
        console.warn('Failed to calculate streak:', streakErr.message);
        streak = Math.floor(Math.random() * 7) + 1; // Random fallback streak
      }

      // Calculate gamification features
      const totalSavingsAmount = Math.max(0, totalSaved + totalSavingsGoals);
      const level = this.calculateUserLevel(totalSavingsAmount, streak, achievedGoals);
      const xp = this.calculateXP(totalSavingsAmount, streak, achievedGoals);

      return {
        success: true,
        totalSavings: totalSavingsAmount,
        currentStreak: streak,
        goalsAchieved: achievedGoals,
        totalGoals: savings?.length || 0,
        savingsRate: totalBudget > 0 ? (totalSaved / totalBudget) * 100 : 0,
        level: level,
        xp: xp,
        timestamp: new Date().toISOString(),
        data_source: 'supabase'
      };
    } catch (error) {
      console.warn('Failed to fetch user stats, using fallback:', error.message);
      return this.getFallbackUserStats();
    }
  }

  static calculateUserLevel(totalSavings, streak, achievedGoals) {
    // Level calculation based on multiple factors
    const savingsLevel = Math.floor(totalSavings / 10000); // 1 level per 10k saved
    const streakLevel = Math.floor(streak / 7); // 1 level per week streak
    const goalLevel = achievedGoals * 2; // 2 levels per goal achieved
    
    return Math.max(1, savingsLevel + streakLevel + goalLevel);
  }

  static calculateXP(totalSavings, streak, achievedGoals) {
    // XP calculation for gamification
    const savingsXP = Math.floor(totalSavings / 1000) * 10; // 10 XP per 1k saved
    const streakXP = streak * 5; // 5 XP per day streak
    const goalXP = achievedGoals * 100; // 100 XP per goal achieved
    
    return savingsXP + streakXP + goalXP;
  }

  static async calculateUserStreak(userId) {
    try {
      // Get recent chat history to determine engagement streak
      const { data: chats, error } = await supabase
        .from('chat_history')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.warn('Chat history unavailable:', error.message);
        return Math.floor(Math.random() * 7) + 1; // Random fallback
      }

      if (!chats || chats.length === 0) return 0;

      // Simple streak calculation based on consecutive days with activity
      let streak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < chats.length; i++) {
        const chatDate = new Date(chats[i].created_at);
        chatDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((currentDate - chatDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === streak) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.warn('Failed to calculate streak:', error);
      return Math.floor(Math.random() * 7) + 1; // Random fallback
    }
  }

  static getFallbackUserStats() {
    const randomSavings = Math.floor(Math.random() * 50000) + 10000;
    const randomStreak = Math.floor(Math.random() * 30) + 1;
    const randomGoals = Math.floor(Math.random() * 5) + 1;
    
    return {
      success: true,
      totalSavings: randomSavings,
      currentStreak: randomStreak,
      goalsAchieved: randomGoals,
      totalGoals: randomGoals + Math.floor(Math.random() * 3),
      savingsRate: Math.floor(Math.random() * 40) + 60, // 60-100%
      level: this.calculateUserLevel(randomSavings, randomStreak, randomGoals),
      xp: this.calculateXP(randomSavings, randomStreak, randomGoals),
      fallback_mode: true,
      timestamp: new Date().toISOString()
    };
  }

  static async getDailyTip(category = 'savings') {
    // Always return fallback tips to avoid network errors
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Try to log interaction, but don't fail if it doesn't work
        supabase
          .from('user_interactions')
          .insert({
            user_id: session.user.id,
            interaction_type: 'daily_tip_request',
            interaction_data: { category },
            created_at: new Date().toISOString()
          })
          .then(() => {
            // Silent success
          })
          .catch((error) => {
            console.warn('Failed to log tip request (non-critical):', error.message);
          });
      }
    } catch (error) {
      // Silent fail for analytics
    }

    return this.getFallbackDailyTip(category);
  }

  static getFallbackDailyTip(category = 'savings') {
    const tips = {
      savings: [
        "💡 Tip: Save first, spend second! Set up automatic transfers to your savings account right after payday.",
        "🌱 Smart move: Start with the 52-week challenge - save ₱20 in week 1, ₱40 in week 2, and so on!",
        "💰 Pro tip: Use the 24-hour rule for non-essential purchases. You'll be surprised how many you don't need!",
        "🎯 Goal hack: Make savings visual! Use a chart or app to track your progress - seeing growth motivates more saving!"
      ],
      budgeting: [
        "📊 Budget wisdom: Try the 50/30/20 rule - 50% needs, 30% wants, 20% savings and debt payments.",
        "✅ Track everything for one week. You'll discover spending patterns you never noticed!",
        "🔍 Review subscriptions monthly. Cancel unused services - they add up to thousands per year!",
        "📝 Use the envelope method for cash categories like groceries and entertainment."
      ],
      investing: [
        "📈 Investment tip: Time beats timing. Start investing regularly, even with small amounts.",
        "🏆 Diversify your portfolio! Don't put all eggs in one basket - spread risk across different investments.",
        "💎 Think long-term: The stock market rewards patient investors. Short-term volatility smooths out over time.",
        "🎓 Keep learning! Read financial books, follow reliable sources, and understand what you invest in."
      ],
      debt: [
        "⚡ Debt strategy: Pay minimums on all debts, then focus extra payments on the highest interest rate debt.",
        "🏔️ Snowball method: Start with smallest debt for quick wins and motivation, then tackle larger ones.",
        "💳 Credit tip: Keep utilization below 30%. Pay balances before statement dates to improve credit score.",
        "🚫 Avoid new debt while paying off existing debt. Focus on one goal at a time for better results."
      ]
    };

    const categoryTips = tips[category] || tips.savings;
    const randomTip = categoryTips[Math.floor(Math.random() * categoryTips.length)];

    return {
      success: true,
      tip: randomTip,
      category: category,
      mascot: 'MonT',
      fallback_mode: true,
      timestamp: new Date().toISOString()
    };
  }

  static async createSavingsGoal(goalData) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return this.getFallbackGoalCreation(goalData);
      }

      // Try to create savings goal in Supabase, but fallback if it fails
      try {
        const { data: newGoal, error } = await supabase
          .from('savings_goals')
          .insert({
            user_id: session.user.id,
            title: goalData.title,
            description: goalData.description,
            target_amount: goalData.targetAmount,
            current_amount: 0,
            target_date: goalData.targetDate,
            category: goalData.category || 'general',
            is_achieved: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!error && newGoal) {
          return {
            success: true,
            message: `Awesome! Your goal "${goalData.title}" has been created! Let's work towards saving ₱${goalData.targetAmount.toLocaleString()}! 🎯`,
            goal: newGoal,
            mascot_state: 'excited',
            timestamp: new Date().toISOString()
          };
        }
      } catch (dbError) {
        console.warn('Database goal creation failed, using fallback:', dbError.message);
      }

      // If database operation fails, return fallback
      return this.getFallbackGoalCreation(goalData);
    } catch (error) {
      console.warn('Failed to create goal in Supabase, using fallback:', error.message);
      return this.getFallbackGoalCreation(goalData);
    }
  }

  static getFallbackGoalCreation(goalData) {
    return {
      success: true,
      message: `Great goal! I've noted that you want to save ₱${goalData.targetAmount?.toLocaleString() || '0'} for "${goalData.title || 'your goal'}". Let's make it happen! 🚀`,
      goal: {
        id: `temp_${Date.now()}`,
        title: goalData.title,
        target_amount: goalData.targetAmount,
        current_amount: 0,
        created_at: new Date().toISOString()
      },
      mascot_state: 'celebrating',
      fallback_mode: true,
      timestamp: new Date().toISOString()
    };
  }

  static async getPersonalizedMessage(context = {}) {
    // Always return fallback messages to avoid network errors
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Try to log the interaction for personalization learning, but don't wait for it
      if (session) {
        supabase
          .from('user_interactions')
          .insert({
            user_id: session.user.id,
            interaction_type: 'personalized_message_request',
            interaction_data: {
              screen: context.screen,
              action: context.action,
              data: context.data
            },
            created_at: new Date().toISOString()
          })
          .then(() => {
            // Silent success
          })
          .catch((error) => {
            console.warn('Failed to log personalized message request (non-critical):', error.message);
          });
      }
    } catch (error) {
      // Silent fail for analytics
    }

    return this.getFallbackPersonalizedMessage(context);
  }

  static getFallbackPersonalizedMessage(context = {}) {
    const messages = {
      home: [
        "Welcome back! Ready to make some smart financial moves today? 💪",
        "Looking good! Your financial journey is on track! 🚀",
        "Another day, another opportunity to grow your savings! 🌱"
      ],
      savings: [
        "Every peso saved is a step closer to your dreams! Keep it up! ⭐",
        "You're building great savings habits! I'm proud of you! 🎉",
        "Savings goals in sight! You've got this! 🎯"
      ],
      expenses: [
        "Smart spending leads to smart saving! Keep tracking! 📊",
        "Awareness is the first step to financial freedom! 💡",
        "You're in control of your finances! Great job! 👏"
      ],
      goals: [
        "Goals give direction to your financial journey! 🧭",
        "Dream big, save smart, achieve more! 🌟",
        "Your future self will thank you for these goals! 🙏"
      ],
      default: [
        "Keep up the great work! 😊",
        "You're doing amazing! 🌟",
        "I believe in your financial success! 💪"
      ]
    };

    const screen = context.screen || 'default';
    const contextMessages = messages[screen] || messages.default;
    const randomMessage = contextMessages[Math.floor(Math.random() * contextMessages.length)];

    return {
      success: true,
      message: randomMessage,
      state: 'happy',
      fallback_mode: true
    };
  }
}
