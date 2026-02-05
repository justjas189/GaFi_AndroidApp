// Mascot Context for Global State Management
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MASCOT_STATES, MASCOT_TRIGGERS, MASCOT_PERSONALITY } from '../constants/MascotStates';

// Mascot messages for different triggers (Enhanced with Duo-inspired personality)
const MASCOT_MESSAGES = {
  [MASCOT_TRIGGERS.APP_OPENED]: [
    "MonT here! Ready to dominate your finances today? Let's GO! 🚀",
    "Financial warrior mode: ACTIVATED! What's our mission today? ⚡",
    "Hey there! Let's make today financially LEGENDARY! ✨",
    "Good to see you! Time to crush those money goals! 🎯",
    "Hi friend! Ready to build that wealth empire? 🏆"
  ],
  [MASCOT_TRIGGERS.SAVINGS_ADDED]: [
    "BOOM! Another peso in the treasure chest! You're unstoppable! 🌟",
    "YES! That's how champions save! Every peso counts! 🚀",
    "CRUSHING IT! Your future self is doing a happy dance! 🙌",
    "LEGEND! Small consistent actions = BIG results! 💪",
    "AMAZING! You just leveled up your financial game! ⭐"
  ],
  [MASCOT_TRIGGERS.GOAL_ACHIEVED]: [
    "🎉 GOAL OBLITERATED! You're absolutely LEGENDARY! 🏆",
    "INCREDIBLE! You didn't just reach it, you SMASHED it! 🎊",
    "PHENOMENAL! This is what determination looks like! ⭐",
    "OUTSTANDING! Goal achieved, confidence BOOSTED! 🚀",
    "UNBELIEVABLE! You're proving you can achieve ANYTHING! �"
  ],
  [MASCOT_TRIGGERS.STREAK_MILESTONE]: [
    "🔥 STREAK MASTER! You're ON FIRE and unstoppable! 🔥",
    "INCREDIBLE consistency! This streak is LEGENDARY! 💪",
    "WOW! Your dedication is absolutely INSPIRING! �",
    "STREAK CHAMPION! This momentum is POWERFUL! 🏃‍♂️",
    "CONSISTENCY KING/QUEEN! Keep this energy! ⚡"
  ],
  [MASCOT_TRIGGERS.DAILY_LOGIN]: [
    "Daily warrior is BACK! Let's conquer today! 😊",
    "Check-in complete! What financial magic shall we create? 🤔",
    "Another day, another chance to be AMAZING! 🌱",
    "Welcome back, superstar! Ready to be PRODUCTIVE? ⚡",
    "Daily habit activated! You're building SUCCESS! 🎯"
  ],
  [MASCOT_TRIGGERS.BUDGET_WARNING]: [
    "WHOA! Budget alarm is ringing! Time to be strategic! 📊",
    "ALERT! Your spending needs some gentle guidance! ⚠️",
    "Budget check time! Let's make SMART choices together! 🎯",
    "WARNING! But don't worry, we'll navigate this together! 🧠",
    "Budget boundary detected! Let's course-correct! 🛑"
  ],
  [MASCOT_TRIGGERS.IDLE_TOO_LONG]: [
    "I MISS YOU! Your financial dreams are calling! 🥺",
    "Your money goals are lonely without you! Come back! 💝",
    "Financial progress is waiting! Ready to continue? 🤗",
    "Hey there! Your success story needs its next chapter! 📞",
    "Your future self is wondering where you went! �"
  ],
  [MASCOT_TRIGGERS.CHAT_STARTED]: [
    "I'm ALL EARS! What's on your brilliant mind? 👂",
    "Chat mode: ACTIVATED! How can I help you WIN? 💬",
    "I'm here for you! Let's solve this together! 🤗",
    "Question time! I LOVE helping you succeed! 🎯",
    "Ready to help! Your success is my mission! 💪"
  ],
  [MASCOT_TRIGGERS.TIP_REQUESTED]: [
    "WISDOM TIME! I LOVE sharing financial secrets! 💡",
    "Knowledge = POWER! Here's something game-changing:",
    "Great question! Here's a tip that creates WEALTH:",
    "Learning mode! This wisdom will serve you well:",
    "Financial tip incoming! This could change everything! 🚀"
  ],
  [MASCOT_TRIGGERS.ENCOURAGEMENT_NEEDED]: [
    "You've GOT this! Every step forward is VICTORY! 💪",
    "Don't give up! Your progress is absolutely INSPIRING! 🌟",
    "Believe in yourself! You're STRONGER than you think! ⚡",
    "Keep going! SUCCESS is just around the corner! 🏆",
    "Remember: CHAMPIONS don't quit! You're a champion! 👑"
  ]
};

// Initial state
const initialState = {
  currentState: MASCOT_STATES.IDLE,
  isVisible: true,
  showBubble: false,
  bubbleText: '',
  bubbleTimeout: null,
  notificationCount: 0,
  lastInteraction: null,
  isAnimating: false,
  userStats: {
    totalSavings: 0,
    currentStreak: 0,
    goalsAchieved: 0,
    lastLogin: null,
    savingsThisMonth: 0,
    longestStreak: 0
  },
  mascotMemory: {
    userName: null,
    favoriteGoals: [],
    completedTutorials: [],
    personalityAdjustments: {},
    interactionHistory: [],
    learningData: {}
  },
  preferences: {
    animationsEnabled: true,
    soundEnabled: true,
    motivationFrequency: 'normal', // 'low', 'normal', 'high'
    personalityType: 'balanced' // 'encouraging', 'balanced', 'focused'
  }
};

// Reducer for mascot state management
const mascotReducer = (state, action) => {
  switch (action.type) {
    case 'SET_STATE':
      return { 
        ...state, 
        currentState: action.payload,
        lastInteraction: new Date().toISOString()
      };
    
    case 'SHOW_BUBBLE':
      // Clear existing timeout if any
      if (state.bubbleTimeout) {
        clearTimeout(state.bubbleTimeout);
      }
      
      return {
        ...state,
        showBubble: true,
        bubbleText: action.payload.text,
        currentState: action.payload.state || state.currentState,
        bubbleTimeout: action.payload.timeout || null
      };
    
    case 'HIDE_BUBBLE':
      return { 
        ...state, 
        showBubble: false, 
        bubbleText: '',
        bubbleTimeout: null
      };
    
    case 'UPDATE_STATS':
      return {
        ...state,
        userStats: { ...state.userStats, ...action.payload }
      };
    
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notificationCount: state.notificationCount + 1
      };
    
    case 'CLEAR_NOTIFICATIONS':
      return { ...state, notificationCount: 0 };
    
    case 'UPDATE_MEMORY':
      return {
        ...state,
        mascotMemory: { ...state.mascotMemory, ...action.payload }
      };
    
    case 'SET_VISIBILITY':
      return { ...state, isVisible: action.payload };
    
    case 'RECORD_INTERACTION':
      const newInteraction = {
        type: action.payload.type,
        timestamp: new Date().toISOString(),
        data: action.payload.data || {}
      };
      
      return { 
        ...state, 
        lastInteraction: new Date().toISOString(),
        mascotMemory: {
          ...state.mascotMemory,
          interactionHistory: [
            ...state.mascotMemory.interactionHistory.slice(-49), // Keep last 50 interactions
            newInteraction
          ]
        }
      };
    
    case 'SET_ANIMATING':
      return { ...state, isAnimating: action.payload };
    
    case 'UPDATE_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.payload }
      };
    
    default:
      return state;
  }
};

// Context
const MascotContext = createContext();

// Provider component
export const MascotProvider = ({ children }) => {
  const [state, dispatch] = useReducer(mascotReducer, initialState);

  // Load persisted mascot data
  useEffect(() => {
    loadMascotData();
    setupIdleDetection();
    
    // Cleanup function
    return () => {
      if (state.bubbleTimeout) {
        clearTimeout(state.bubbleTimeout);
      }
    };
  }, []);

  // Save mascot data when important state changes
  useEffect(() => {
    saveMascotData();
  }, [state.mascotMemory, state.userStats, state.preferences]);

  const loadMascotData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('mascot_data');
      if (savedData) {
        const { mascotMemory, userStats, preferences } = JSON.parse(savedData);
        if (mascotMemory) dispatch({ type: 'UPDATE_MEMORY', payload: mascotMemory });
        if (userStats) dispatch({ type: 'UPDATE_STATS', payload: userStats });
        if (preferences) dispatch({ type: 'UPDATE_PREFERENCES', payload: preferences });
      }
    } catch (error) {
      console.error('Error loading mascot data:', error);
    }
  };

  const saveMascotData = async () => {
    try {
      const dataToSave = {
        mascotMemory: state.mascotMemory,
        userStats: state.userStats,
        preferences: state.preferences
      };
      await AsyncStorage.setItem('mascot_data', JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving mascot data:', error);
    }
  };

  const setupIdleDetection = () => {
    // Check for idle state every 5 minutes
    const idleTimer = setInterval(() => {
      const now = new Date();
      const lastInteraction = state.lastInteraction ? new Date(state.lastInteraction) : now;
      const timeDiff = now - lastInteraction;
      const minutesIdle = timeDiff / (1000 * 60);

      // Only trigger if user preferences allow and mascot is visible
      if (minutesIdle > 30 && state.isVisible && state.preferences.motivationFrequency !== 'low') {
        triggerMascotReaction(MASCOT_TRIGGERS.IDLE_TOO_LONG);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(idleTimer);
  };

  // Main function to trigger mascot reactions
  const triggerMascotReaction = (trigger, data = {}) => {
    if (!state.isVisible || !state.preferences.animationsEnabled) return;

    const messages = MASCOT_MESSAGES[trigger] || ["Hey there! 👋"];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    let newState = MASCOT_STATES.HAPPY;
    let customMessage = randomMessage;
    
    // Customize message based on data
    if (data.customMessage) {
      customMessage = data.customMessage;
    }
    
    switch (trigger) {
      case MASCOT_TRIGGERS.SAVINGS_ADDED:
        newState = MASCOT_STATES.CELEBRATING;
        if (data.amount) {
          customMessage = `${randomMessage}\n\nYou saved ₱${data.amount.toLocaleString()} today! 🎉`;
        }
        dispatch({ type: 'UPDATE_STATS', payload: { 
          totalSavings: (state.userStats.totalSavings || 0) + (data.amount || 0),
          savingsThisMonth: (state.userStats.savingsThisMonth || 0) + (data.amount || 0)
        }});
        break;
      
      case MASCOT_TRIGGERS.GOAL_ACHIEVED:
        newState = MASCOT_STATES.EXCITED;
        dispatch({ type: 'UPDATE_STATS', payload: { 
          goalsAchieved: (state.userStats.goalsAchieved || 0) + 1
        }});
        break;
      
      case MASCOT_TRIGGERS.STREAK_MILESTONE:
        newState = MASCOT_STATES.CONGRATULATING;
        if (data.streak) {
          customMessage = `${randomMessage}\n\n${data.streak} days strong! 🔥`;
          dispatch({ type: 'UPDATE_STATS', payload: { 
            currentStreak: data.streak,
            longestStreak: Math.max(state.userStats.longestStreak || 0, data.streak)
          }});
        }
        break;
      
      case MASCOT_TRIGGERS.BUDGET_WARNING:
        newState = MASCOT_STATES.WORRIED;
        break;
      
      case MASCOT_TRIGGERS.CHAT_STARTED:
        newState = MASCOT_STATES.THINKING;
        break;
      
      case MASCOT_TRIGGERS.IDLE_TOO_LONG:
        newState = MASCOT_STATES.SLEEPING;
        dispatch({ type: 'ADD_NOTIFICATION' });
        break;
      
      case MASCOT_TRIGGERS.TIP_REQUESTED:
        newState = MASCOT_STATES.FOCUSED;
        break;
      
      case MASCOT_TRIGGERS.ENCOURAGEMENT_NEEDED:
        newState = MASCOT_STATES.ENCOURAGING;
        break;
      
      default:
        newState = MASCOT_STATES.HAPPY;
    }

    // Set animating state
    dispatch({ type: 'SET_ANIMATING', payload: true });

    // Create timeout for bubble auto-hide
    const timeout = setTimeout(() => {
      dispatch({ type: 'HIDE_BUBBLE' });
      setTimeout(() => {
        dispatch({ type: 'SET_STATE', payload: MASCOT_STATES.IDLE });
        dispatch({ type: 'SET_ANIMATING', payload: false });
      }, 1000);
    }, data.duration || 4000);

    dispatch({
      type: 'SHOW_BUBBLE',
      payload: { 
        text: customMessage, 
        state: newState,
        timeout: timeout
      }
    });

    // Record interaction for learning
    dispatch({ 
      type: 'RECORD_INTERACTION', 
      payload: { 
        type: trigger, 
        data: { 
          message: customMessage, 
          state: newState,
          context: data.context || {}
        }
      }
    });
  };

  // Update user stats (called from your existing services)
  const updateUserStats = (newStats) => {
    const oldStats = state.userStats || {
      totalSavings: 0,
      currentStreak: 0,
      goalsAchieved: 0,
      savingsThisMonth: 0
    };
    
    dispatch({ type: 'UPDATE_STATS', payload: newStats });
    
    // Trigger appropriate reactions based on stat changes
    if ((newStats.totalSavings || 0) > (oldStats.totalSavings || 0)) {
      const amountAdded = (newStats.totalSavings || 0) - (oldStats.totalSavings || 0);
      triggerMascotReaction(MASCOT_TRIGGERS.SAVINGS_ADDED, {
        amount: amountAdded
      });
    }
    
    if ((newStats.currentStreak || 0) > (oldStats.currentStreak || 0) && (newStats.currentStreak || 0) % 5 === 0) {
      triggerMascotReaction(MASCOT_TRIGGERS.STREAK_MILESTONE, {
        streak: newStats.currentStreak
      });
    }

    if ((newStats.goalsAchieved || 0) > (oldStats.goalsAchieved || 0)) {
      triggerMascotReaction(MASCOT_TRIGGERS.GOAL_ACHIEVED);
    }
  };

  // Personalize mascot based on user behavior
  const personalizeMascot = (behaviorData) => {
    const personalityAdjustments = {
      ...state.mascotMemory.personalityAdjustments,
      ...behaviorData,
      lastUpdated: new Date().toISOString()
    };
    
    dispatch({
      type: 'UPDATE_MEMORY',
      payload: { personalityAdjustments }
    });
  };

  // Set mascot visibility
  const setMascotVisibility = (visible) => {
    dispatch({ type: 'SET_VISIBILITY', payload: visible });
  };

  // Clear notifications
  const clearNotifications = () => {
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  };

  // Update preferences
  const updatePreferences = (newPreferences) => {
    dispatch({ type: 'UPDATE_PREFERENCES', payload: newPreferences });
  };

  // Get contextual message based on current app state
  const getContextualMessage = (screenName, userAction) => {
    const contextualMessages = {
      'HomeScreen': {
        'screen_enter': "Welcome to your financial dashboard! 📊",
        'goal_progress': "Looking good! Keep up the momentum! 💪"
      },
      'SavingsGoalsScreen': {
        'screen_enter': "Time to work on those goals! 🎯",
        'goal_created': "New goal added! Let's make it happen! ✨"
      },
      'ExpenseScreen': {
        'screen_enter': "Tracking expenses? Smart move! 📝",
        'expense_added': "Expense logged! Awareness is the first step! 👍"
      },
      'LeaderboardScreen': {
        'screen_enter': "Check out your amazing progress! 🏆",
        'rank_improved': "You're climbing the leaderboard! 🚀"
      },
      'ChatScreen': {
        'screen_enter': "Ready to chat? I'm here to help! 💬",
        'message_sent': "Great question! Let me help you with that! 🤔"
      }
    };

    const screenMessages = contextualMessages[screenName];
    if (screenMessages && screenMessages[userAction]) {
      return screenMessages[userAction];
    }
    
    return "Keep up the great work! 😊";
  };

  // Force trigger a specific state (for testing or special events)
  const forceState = (newState, message = '', duration = 3000) => {
    dispatch({ type: 'SET_ANIMATING', payload: true });
    
    const timeout = setTimeout(() => {
      dispatch({ type: 'HIDE_BUBBLE' });
      setTimeout(() => {
        dispatch({ type: 'SET_STATE', payload: MASCOT_STATES.IDLE });
        dispatch({ type: 'SET_ANIMATING', payload: false });
      }, 500);
    }, duration);

    dispatch({
      type: 'SHOW_BUBBLE',
      payload: { 
        text: message, 
        state: newState,
        timeout: timeout
      }
    });
  };

  // Global draggable bubble notification system
  const showGlobalBubbleNotification = (message, duration = 3000, triggerPulse = true) => {
    // This will trigger the global draggable component to show a notification
    dispatch({
      type: 'SHOW_BUBBLE',
      payload: { 
        text: message, 
        state: MASCOT_STATES.EXCITED,
        timeout: setTimeout(() => {
          dispatch({ type: 'HIDE_BUBBLE' });
        }, duration),
        globalBubble: true,
        triggerPulse: triggerPulse
      }
    });
  };

  const value = {
    // State
    ...state,
    
    // Actions
    triggerMascotReaction,
    updateUserStats,
    personalizeMascot,
    setMascotVisibility,
    clearNotifications,
    updatePreferences,
    getContextualMessage,
    forceState,
    showGlobalBubbleNotification,
    
    // Trigger constants
    MASCOT_TRIGGERS,
    MASCOT_STATES
  };

  return (
    <MascotContext.Provider value={value}>
      {children}
    </MascotContext.Provider>
  );
};

// Hook to use mascot context
export const useMascot = () => {
  const context = useContext(MascotContext);
  if (!context) {
    throw new Error('useMascot must be used within a MascotProvider');
  }
  return context;
};

// Higher-order component to add mascot integration to any screen
export const withMascotIntegration = (WrappedComponent, screenName) => {
  return (props) => {
    const mascot = useMascot();
    
    useEffect(() => {
      // Trigger screen enter reaction
      const message = mascot.getContextualMessage(screenName, 'screen_enter');
      setTimeout(() => {
        mascot.triggerMascotReaction(MASCOT_TRIGGERS.APP_OPENED, {
          customMessage: message,
          context: { screen: screenName }
        });
      }, 1000);
    }, []);

    return (
      <WrappedComponent
        {...props}
        mascot={mascot}
        screenName={screenName}
      />
    );
  };
};

export { MASCOT_TRIGGERS, MASCOT_STATES };
export default MascotContext;
