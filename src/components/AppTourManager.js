// AppTourManager.js — Handles programmatic navigation during the App Tour phase.
// Auto-navigates between tabs and coordinates with KoinTutorialOverlay.

import React, { useEffect, useRef } from 'react';
import { useTutorial, TUTORIAL_PHASE, KOIN_STATE, APP_TOUR_STEPS } from '../context/TutorialContext';
import { navigationRef } from '../navigation/navigationRef';

const AppTourManager = () => {
  const {
    tutorialPhase,
    currentStepIndex,
    koinState,
  } = useTutorial();

  const prevStepRef = useRef(null);

  // When entering a new App Tour step, navigate to the target tab
  useEffect(() => {
    if (tutorialPhase !== TUTORIAL_PHASE.APP_TOUR) return;
    if (koinState !== KOIN_STATE.SPEAKING) return;

    const step = APP_TOUR_STEPS[currentStepIndex];
    if (!step) return;

    // Only navigate when the step index actually changes
    const stepKey = `${step.id}_${currentStepIndex}`;
    if (prevStepRef.current === stepKey) return;
    prevStepRef.current = stepKey;

    // Navigate to the target tab with a small delay for smooth transition
    const timeout = setTimeout(() => {
      if (navigationRef.isReady() && step.tabName) {
        navigationRef.navigate('Main', {
          screen: 'MainTabs',
          params: { screen: step.tabName },
        });
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [tutorialPhase, currentStepIndex, koinState]);

  // Reset when tour ends
  useEffect(() => {
    if (tutorialPhase !== TUTORIAL_PHASE.APP_TOUR) {
      prevStepRef.current = null;
    }
  }, [tutorialPhase]);

  // This is a logic-only component, no UI
  return null;
};

export default AppTourManager;
