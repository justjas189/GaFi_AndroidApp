// MonT Mascot States and Expressions
export const MASCOT_STATES = {
  IDLE: 'idle',
  HAPPY: 'happy',
  EXCITED: 'excited',
  THINKING: 'thinking',
  CELEBRATING: 'celebrating',
  ENCOURAGING: 'encouraging',
  SLEEPING: 'sleeping',
  WORRIED: 'worried',
  CONGRATULATING: 'congratulating',
  SURPRISED: 'surprised',
  FOCUSED: 'focused',
  PLAYFUL: 'playful'
};

export const MASCOT_EXPRESSIONS = {
  [MASCOT_STATES.IDLE]: '🤖',
  [MASCOT_STATES.HAPPY]: '😊',
  [MASCOT_STATES.EXCITED]: '🤩',
  [MASCOT_STATES.THINKING]: '🤔',
  [MASCOT_STATES.CELEBRATING]: '🎉',
  [MASCOT_STATES.ENCOURAGING]: '💪',
  [MASCOT_STATES.SLEEPING]: '😴',
  [MASCOT_STATES.WORRIED]: '😟',
  [MASCOT_STATES.CONGRATULATING]: '👏',
  [MASCOT_STATES.SURPRISED]: '😲',
  [MASCOT_STATES.FOCUSED]: '🎯',
  [MASCOT_STATES.PLAYFUL]: '😄'
};

// Mascot behavior triggers (Enhanced with Duo-inspired features)
export const MASCOT_TRIGGERS = {
  APP_OPENED: 'app_opened',
  SAVINGS_ADDED: 'savings_added',
  GOAL_ACHIEVED: 'goal_achieved',
  STREAK_MILESTONE: 'streak_milestone',
  DAILY_LOGIN: 'daily_login',
  FIRST_EXPENSE: 'first_expense',
  BUDGET_WARNING: 'budget_warning',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  IDLE_TOO_LONG: 'idle_too_long',
  CHAT_STARTED: 'chat_started',
  TRANSACTION_ADDED: 'transaction_added',
  GOAL_PROGRESS: 'goal_progress',
  TIP_REQUESTED: 'tip_requested',
  ENCOURAGEMENT_NEEDED: 'encouragement_needed',
  MILESTONE_REACHED: 'milestone_reached',
  // New Duo-inspired triggers
  STREAK_DANGER: 'streak_danger',
  COMEBACK_NEEDED: 'comeback_needed',
  STERN_REMINDER: 'stern_reminder',
  CELEBRATION_ANIMATION: 'celebration_animation'
};

// Enhanced Mascot personality configuration (Duo-inspired)
export const MASCOT_PERSONALITY = {
  encouragement_level: 0.9, // How encouraging (0-1) - Increased for Duo-style motivation
  humor_level: 0.8, // How playful (0-1) - Increased for more personality
  urgency_level: 0.6, // How urgent in reminders (0-1) - Increased for Duo-style persistence
  celebration_intensity: 1.0, // How much to celebrate wins (0-1) - Maximum for Duo-style celebrations
  empathy_level: 0.8, // How empathetic to struggles (0-1) - Increased for supportive guidance
  motivation_frequency: 0.7, // How often to provide motivation (0-1) - Increased for constant encouragement
  duo_inspired_mode: true, // Enable Duo-style personality features
  streak_obsession: 0.9, // How much to focus on streaks (Duo's signature feature)
  friendly_stern_balance: 0.6 // Balance between friendly and firm guidance (0=friendly, 1=stern)
};

// Animation configurations
export const ANIMATION_CONFIGS = {
  bounce: {
    tension: 150,
    friction: 8,
    duration: 600
  },
  celebration: {
    duration: 2000,
    iterations: 3
  },
  thinking: {
    duration: 2000,
    loop: true
  },
  idle: {
    duration: 3000,
    loop: true,
    subtle: true
  }
};

export default {
  MASCOT_STATES,
  MASCOT_EXPRESSIONS,
  MASCOT_TRIGGERS,
  MASCOT_PERSONALITY,
  ANIMATION_CONFIGS
};
