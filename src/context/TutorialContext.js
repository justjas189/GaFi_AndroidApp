// TutorialContext.js — Central state for the onboarding tutorial system
// Manages both the in-game Story Mode tutorial and the global App Tour

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const TutorialContext = createContext();

// ─── Tutorial Phases ─────────────────────────────────────────────────────────
// 1. CONTEXTUAL — Free-roam in-game tutorial: Koin pops up the first time the
//    player visits each location (no forced step order, no action gates).
// 2. APP_TOUR   — Koin walks through each tab (Expenses, Predictions, Explore, Profile)
// 3. COMPLETE   — All tutorials done
export const TUTORIAL_PHASE = {
  IDLE: 'IDLE',
  CONTEXTUAL: 'CONTEXTUAL',
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

// The old linear GAME_TUTORIAL_STEPS rail was removed (UX revision): the
// in-game tutorial is now free-roam. GameScreen owns the per-location intro
// content (TUTORIAL_INTROS) and pushes intros here via showKoinIntro().

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

  // CONTEXTUAL phase: the single Koin intro currently on screen (free-roam
  // tutorial). Shaped like a step ({ id, koinDialogue: [...] }); null = none.
  const [activeIntro, setActiveIntro] = useState(null);

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
  // Enter the free-roam in-game tutorial. Intros are pushed one at a time by
  // GameScreen (showKoinIntro) as the player discovers locations.
  const enterTutorialMode = useCallback(() => {
    setTutorialPhase(TUTORIAL_PHASE.CONTEXTUAL);
    setActiveIntro(null);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
  }, []);

  // Show one contextual Koin intro (first visit to a location). Never
  // action-gated: the player reads it and taps "Got it!" to keep roaming.
  const showKoinIntro = useCallback((intro) => {
    if (!intro?.koinDialogue?.length) return;
    setActiveIntro({ ...intro, conditionKey: null, nextAlwaysEnabled: true });
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
  }, []);

  const dismissIntro = useCallback(() => {
    setActiveIntro(null);
    setDialoguePage(0);
  }, []);

  const exitTutorialMode = useCallback(() => {
    setActiveIntro(null);
    setDialoguePage(0);
    setTutorialPhase(TUTORIAL_PHASE.IDLE);
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
    if (tutorialPhase === TUTORIAL_PHASE.APP_TOUR) {
      return APP_TOUR_STEPS;
    }
    return []; // CONTEXTUAL has no step list — one intro at a time
  }, [tutorialPhase]);

  const getCurrentStep = useCallback(() => {
    if (tutorialPhase === TUTORIAL_PHASE.CONTEXTUAL) {
      return activeIntro;
    }
    const steps = getCurrentSteps();
    return steps[currentStepIndex] || null;
  }, [tutorialPhase, activeIntro, getCurrentSteps, currentStepIndex]);

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
    // CONTEXTUAL: "advancing" past a one-off intro just closes it.
    if (tutorialPhase === TUTORIAL_PHASE.CONTEXTUAL) {
      dismissIntro();
      return;
    }

    const steps = getCurrentSteps();
    const nextIndex = currentStepIndex + 1;

    if (nextIndex >= steps.length) {
      if (tutorialPhase === TUTORIAL_PHASE.APP_TOUR) {
        // App tour finished — mark complete
        markOnboardingComplete();
        return;
      }
      return; // Safety fallback
    }

    setCurrentStepIndex(nextIndex);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
  }, [tutorialPhase, dismissIntro, getCurrentSteps, currentStepIndex, markOnboardingComplete]);

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
    setActiveIntro(null);
  }, []);

  // ─── Reset (for testing / re-running) ────────────────────────────────
  const resetTutorial = useCallback(async () => {
    setTutorialPhase(TUTORIAL_PHASE.IDLE);
    setCurrentStepIndex(0);
    setDialoguePage(0);
    setKoinState(KOIN_STATE.SPEAKING);
    setActiveIntro(null);
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
    activeIntro,
    onboardingComplete,

    // Getters
    getCurrentStep,
    getCurrentSteps,

    // Actions
    enterTutorialMode,
    showKoinIntro,
    dismissIntro,
    exitTutorialMode,
    startAppTour,
    skipTutorial,
    advanceDialogue,
    advanceToNextStep,
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
