// TutorialContext.js — Central state for the onboarding tutorial system
// Manages both the in-game Story Mode tutorial and the global App Tour

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const TutorialContext = createContext();

// ─── Tutorial Phases ─────────────────────────────────────────────────────────
// 1. GAME_INTRO   — Koin introduces himself and the app
// 2. GAME_TUTORIAL — Step-by-step in-game walkthrough (user must complete actions)
// 3. APP_TOUR     — Koin walks through each tab (Expenses, Predictions, Explore, Profile)
// 4. COMPLETE     — All tutorials done
export const TUTORIAL_PHASE = {
  IDLE: 'IDLE',
  GAME_INTRO: 'GAME_INTRO',
  GAME_TUTORIAL: 'GAME_TUTORIAL',
  APP_TOUR: 'APP_TOUR',
  COMPLETE: 'COMPLETE',
};

// ─── Koin state within a single step ─────────────────────────────────────────
// SPEAKING   → Koin dialogue is visible, type-ahead playing
// WAITING    → Koin minimized, user must complete the action
// CELEBRATING → Action done! Koin pops back up briefly before advancing
export const KOIN_STATE = {
  SPEAKING: 'SPEAKING',
  WAITING: 'WAITING',
  CELEBRATING: 'CELEBRATING',
};

// ─── In-Game Tutorial Steps (enhanced from existing TUTORIAL_STEPS) ──────────
export const GAME_TUTORIAL_STEPS = [
  {
    id: 'intro_welcome',
    koinDialogue: [
      "Hey there! I'm Koin, your financial buddy! 🪙",
      "Welcome to GaFi — the app that makes learning about money fun and easy!",
      "I'll be your guide through everything. Let's start by exploring your room!"
    ],
    conditionKey: null,
    nextAlwaysEnabled: true,
    highlight: null,
    position: 'center',
  },
  {
    id: 'walk_around',
    koinDialogue: [
      "This is your room! Try tapping anywhere on the screen to walk your character around."
    ],
    conditionKey: 'walked',
    nextAlwaysEnabled: false,
    highlight: 'map',
    position: 'top',
  },
  {
    id: 'closet',
    koinDialogue: [
      "See that closet over there? Walk to it and tap on it!",
      "You can customize your character's outfit in the closet. Let's check it out!"
    ],
    conditionKey: 'closet_opened',
    nextAlwaysEnabled: false,
    highlight: 'closet',
    position: 'right',
  },
  {
    id: 'notebook_and_log',
    koinDialogue: [
      "Great outfit! Now, walk to the Notebook — it's on the desk.",
      "Open it and try logging an expense. Enter any amount and description, then tap Log.",
      "Don't worry — this is just practice! It won't be saved to your real records."
    ],
    conditionKey: 'notebook_expense_logged',
    nextAlwaysEnabled: false,
    highlight: 'notebook',
    position: 'left',
  },
  {
    id: 'exit_door',
    koinDialogue: [
      "Awesome! You just logged your first expense!",
      "Now let's explore the world. Walk to the Exit Door and choose School.",
      "You'll also learn about transport expenses along the way!"
    ],
    conditionKey: 'arrived_at_school',
    nextAlwaysEnabled: false,
    highlight: 'door',
    position: 'bottom',
  },
  {
    id: 'school_intro',
    koinDialogue: [
      "Welcome to School Campus! 🏫",
      "See the NPCs here? You can talk to the Librarian to buy school supplies, or the Canteen staff to buy food.",
      "Walk to either one and log a practice expense!"
    ],
    conditionKey: 'school_expense_logged',
    nextAlwaysEnabled: false,
    highlight: null,
    position: 'top',
  },
  {
    id: 'go_to_mall',
    koinDialogue: [
      "Great job! You're a natural at this!",
      "Now let's visit the Mall! Walk to the School Exit and travel there."
    ],
    conditionKey: 'arrived_at_mall',
    nextAlwaysEnabled: false,
    highlight: null,
    position: 'center',
  },
  {
    id: 'mall_1f_intro',
    koinDialogue: [
      "Welcome to the Mall! 🏬",
      "On the 1st floor, you'll find the Clothing Store 👕, Electronics 📱, and Grocery Store 🛒.",
      "Feel free to approach any NPC to log a practice expense, or just look around!"
    ],
    conditionKey: null,
    nextAlwaysEnabled: true,
    highlight: null,
    position: 'top',
  },
  {
    id: 'go_to_2f',
    koinDialogue: [
      "Let's explore more! Walk to the Escalator to go up to the 2nd floor."
    ],
    conditionKey: 'arrived_at_mall_2f',
    nextAlwaysEnabled: false,
    highlight: null,
    position: 'bottom',
  },
  {
    id: 'mall_2f_intro',
    koinDialogue: [
      "The 2nd floor has the Food Court 🍕 and a Cafe ☕.",
      "You can approach the NPCs to log practice expenses if you'd like!"
    ],
    conditionKey: null,
    nextAlwaysEnabled: true,
    highlight: null,
    position: 'top',
  },
  {
    id: 'go_to_3f',
    koinDialogue: [
      "One more floor to go! Walk to the Escalator to reach the 3rd floor."
    ],
    conditionKey: 'arrived_at_mall_3f',
    nextAlwaysEnabled: false,
    highlight: null,
    position: 'bottom',
  },
  {
    id: 'mall_3f_intro',
    koinDialogue: [
      "The 3rd floor has the Entertainment Hub 🎮 and the Gym 💪.",
      "Every place you visit is an opportunity to practice tracking your expenses!"
    ],
    conditionKey: null,
    nextAlwaysEnabled: true,
    highlight: null,
    position: 'top',
  },
  {
    id: 'go_down_escalator',
    koinDialogue: [
      "You can also go back down! Walk to the Escalator to go down.",
      "Use escalators anytime to move between mall floors."
    ],
    conditionKey: 'went_down_escalator',
    nextAlwaysEnabled: false,
    highlight: null,
    position: 'bottom',
  },
  {
    id: 'game_tutorial_done',
    koinDialogue: [
      "Amazing job! You've learned all the basics — moving around, logging expenses, and navigating the world!",
      "Now let me show you the rest of the GaFi app. There's a lot more to explore!"
    ],
    conditionKey: null,
    nextAlwaysEnabled: true,
    highlight: null,
    position: 'center',
  },
];

// ─── Global App Tour Steps (tab-by-tab walkthrough) ──────────────────────────
export const APP_TOUR_STEPS = [
  {
    id: 'tour_intro',
    tabName: 'Game',
    koinDialogue: [
      "Now let me take you on a quick tour of the GaFi app!",
      "This is the Game tab — where you play Story Mode. Story Mode teaches you the fundamentals of personal finance through fun challenges.",
      "There are 3 levels to complete, and after that, you can create your own Custom challenges!"
    ],
    highlightArea: 'game_main',
  },
  {
    id: 'tour_expenses',
    tabName: 'Expenses',
    koinDialogue: [
      "This is the Expenses tab! 📊",
      "Here, you can see all your spending in detail — charts, categories, and trends.",
      "You can also manually add expenses here and filter them by time period. It's your personal expense tracker!"
    ],
    highlightArea: 'expense_list',
  },
  {
    id: 'tour_predictions',
    tabName: 'Predictions',
    koinDialogue: [
      "This is the Predictions tab! 🔮",
      "GaFi uses AI to analyze your spending patterns and predict your future expenses.",
      "The more data you log, the smarter and more accurate the predictions become!"
    ],
    highlightArea: 'predictions_main',
  },
  {
    id: 'tour_explore',
    tabName: 'Explore',
    koinDialogue: [
      "This is the Explore tab! 🧭",
      "Here you'll find the Leaderboard to compete with friends, Achievements to unlock, and Friend management.",
      "Check back often — there's always something new to discover!"
    ],
    highlightArea: 'explore_grid',
  },
  {
    id: 'tour_profile',
    tabName: 'Profile',
    koinDialogue: [
      "And finally, this is your Profile! 👤",
      "You can view your stats, edit your profile, adjust your budget, and access settings here.",
      "This is also where you can see your overall progress in the app."
    ],
    highlightArea: 'profile_main',
  },
  {
    id: 'tour_complete',
    tabName: 'Game',
    koinDialogue: [
      "And that's the grand tour! 🎉",
      "You're all set to start your financial journey. Head to Story Mode and begin Level 1!",
      "Remember — I'm always here if you need help. Just tap on me anytime! Good luck! 🪙"
    ],
    highlightArea: null,
  },
];

// ─── Provider ────────────────────────────────────────────────────────────────
export const TutorialProvider = ({ children }) => {
  const { userInfo } = useAuth();

  // Phase + step tracking
  const [tutorialPhase, setTutorialPhase] = useState(TUTORIAL_PHASE.IDLE);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [koinState, setKoinState] = useState(KOIN_STATE.SPEAKING);
  const [dialoguePage, setDialoguePage] = useState(0);

  // Completion conditions for in-game tutorial
  const [completedConditions, setCompletedConditions] = useState(new Set());

  // Whether the full onboarding tutorial has been completed (persisted)
  const [onboardingComplete, setOnboardingComplete] = useState(null); // null = loading

  // Navigation ref setter — will be called from App.js to allow programmatic tab switching
  const navigationRef = useRef(null);
  const setNavigationRef = useCallback((ref) => {
    navigationRef.current = ref;
  }, []);

  // ─── Persistence ─────────────────────────────────────────────────────
  useEffect(() => {
    if (userInfo?.id) {
      AsyncStorage.getItem(`gafi_onboarding_complete_${userInfo.id}`).then(val => {
        setOnboardingComplete(val === 'true');
      });
    }
  }, [userInfo?.id]);

  const markOnboardingComplete = useCallback(async () => {
    setOnboardingComplete(true);
    setTutorialPhase(TUTORIAL_PHASE.COMPLETE);
    if (userInfo?.id) {
      await AsyncStorage.setItem(`gafi_onboarding_complete_${userInfo.id}`, 'true');
    }
  }, [userInfo?.id]);

  // ─── Phase control ───────────────────────────────────────────────────
  const startGameTutorial = useCallback(() => {
    setTutorialPhase(TUTORIAL_PHASE.GAME_TUTORIAL);
    setCurrentStepIndex(0);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
    setCompletedConditions(new Set());
  }, []);

  const startAppTour = useCallback(() => {
    setTutorialPhase(TUTORIAL_PHASE.APP_TOUR);
    setCurrentStepIndex(0);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
  }, []);

  const skipTutorial = useCallback(async () => {
    setTutorialPhase(TUTORIAL_PHASE.COMPLETE);
    await markOnboardingComplete();
  }, [markOnboardingComplete]);

  // ─── Step navigation ─────────────────────────────────────────────────
  const getCurrentSteps = useCallback(() => {
    if (tutorialPhase === TUTORIAL_PHASE.GAME_TUTORIAL) {
      return GAME_TUTORIAL_STEPS;
    }
    if (tutorialPhase === TUTORIAL_PHASE.APP_TOUR) {
      return APP_TOUR_STEPS;
    }
    return [];
  }, [tutorialPhase]);

  const getCurrentStep = useCallback(() => {
    const steps = getCurrentSteps();
    return steps[currentStepIndex] || null;
  }, [getCurrentSteps, currentStepIndex]);

  // Advance dialogue page within the current step, or advance to next step
  const advanceDialogue = useCallback(() => {
    const step = getCurrentStep();
    if (!step) return;

    const maxPage = step.koinDialogue.length - 1;
    if (dialoguePage < maxPage) {
      // Still more dialogue pages
      setDialoguePage(prev => prev + 1);
      return;
    }

    // All dialogue done for this step
    if (step.conditionKey && !step.nextAlwaysEnabled) {
      // Need to wait for user action — minimize Koin
      setKoinState(KOIN_STATE.WAITING);
      return;
    }

    // No condition needed — can advance to next step
    advanceToNextStep();
  }, [getCurrentStep, dialoguePage]);

  const advanceToNextStep = useCallback(() => {
    const steps = getCurrentSteps();
    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= steps.length) {
      // All steps in current phase are done
      if (tutorialPhase === TUTORIAL_PHASE.GAME_TUTORIAL) {
        // Game tutorial finished — transition to App Tour
        startAppTour();
        return;
      } else if (tutorialPhase === TUTORIAL_PHASE.APP_TOUR) {
        // App tour finished — mark complete
        markOnboardingComplete();
        return;
      }
      return; // Safety fallback
    }

    setCurrentStepIndex(nextIndex);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
  }, [getCurrentSteps, currentStepIndex, tutorialPhase, startAppTour, markOnboardingComplete]);

  // Mark a condition as complete (called from GameScreen)
  const markConditionComplete = useCallback((conditionKey) => {
    setCompletedConditions(prev => {
      const next = new Set(prev);
      next.add(conditionKey);
      return next;
    });

    // If the current step was waiting for this condition, celebrate and advance
    const step = getCurrentStep();
    if (step && step.conditionKey === conditionKey && koinState === KOIN_STATE.WAITING) {
      setKoinState(KOIN_STATE.CELEBRATING);
      // After brief celebration, advance to next step
      setTimeout(() => {
        advanceToNextStep();
      }, 1500);
    }
  }, [getCurrentStep, koinState, advanceToNextStep]);

  // Check if current step's condition is met
  const isCurrentStepConditionMet = useCallback(() => {
    const step = getCurrentStep();
    if (!step) return false;
    if (step.nextAlwaysEnabled) return true;
    if (step.conditionKey && completedConditions.has(step.conditionKey)) return true;
    return false;
  }, [getCurrentStep, completedConditions]);

  // Navigate to a specific tab (used during App Tour)
  const navigateToTab = useCallback((tabName) => {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.navigate('Main', {
        screen: 'MainTabs',
        params: { screen: tabName }
      });
    }
  }, []);

  // ─── Cancel (exit tutorial without clearing onboarding persistence) ──
  const cancelTutorial = useCallback(() => {
    setTutorialPhase(TUTORIAL_PHASE.IDLE);
    setCurrentStepIndex(0);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
    setCompletedConditions(new Set());
  }, []);

  // ─── Reset (for testing / re-running) ────────────────────────────────
  const resetTutorial = useCallback(async () => {
    setTutorialPhase(TUTORIAL_PHASE.IDLE);
    setCurrentStepIndex(0);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
    setCompletedConditions(new Set());
    setOnboardingComplete(false);
    if (userInfo?.id) {
      await AsyncStorage.removeItem(`gafi_onboarding_complete_${userInfo.id}`);
    }
  }, [userInfo?.id]);

  const value = {
    // State
    tutorialPhase,
    currentStepIndex,
    koinState,
    dialoguePage,
    completedConditions,
    onboardingComplete,

    // Getters
    getCurrentStep,
    getCurrentSteps,
    isCurrentStepConditionMet,

    // Actions
    startGameTutorial,
    startAppTour,
    skipTutorial,
    advanceDialogue,
    advanceToNextStep,
    markConditionComplete,
    markOnboardingComplete,
    navigateToTab,
    setNavigationRef,
    cancelTutorial,
    resetTutorial,

    // Low-level setters (for GameScreen integration)
    setTutorialPhase,
    setKoinState,
    setCurrentStepIndex,
    setDialoguePage,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

export default TutorialContext;
