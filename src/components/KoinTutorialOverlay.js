// KoinTutorialOverlay.js — Koin's dialogue overlay with typewriter effect,
// minimize/maximize animation, and spotlight highlighting.
// Renders as a full-screen overlay on top of everything.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Image,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTutorial, KOIN_STATE, TUTORIAL_PHASE } from '../context/TutorialContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const KOIN_IMAGE = require('../../assets/mascot/koin_tutorial.png');

// Duration after which Koin minimizes and user gets spotlight on the action
const MINIMIZE_DELAY = 3000; // 3 seconds after dialogue finishes

const KoinTutorialOverlay = () => {
  const {
    tutorialPhase,
    koinState,
    dialoguePage,
    getCurrentStep,
    advanceDialogue,
    advanceToNextStep,
    skipTutorial,
    setKoinState,
    currentStepIndex,
    getCurrentSteps,
  } = useTutorial();

  // Typewriter state
  const [displayedText, setDisplayedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const timerRef = useRef(null);

  // Animations
  const koinScale = useRef(new Animated.Value(1)).current;
  const koinTranslateY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dialogueOpacity = useRef(new Animated.Value(1)).current;
  const celebrateScale = useRef(new Animated.Value(1)).current;
  const minimizedY = useRef(new Animated.Value(0)).current;

  const step = getCurrentStep();
  const steps = getCurrentSteps();
  const isActive = tutorialPhase === TUTORIAL_PHASE.GAME_TUTORIAL ||
                   tutorialPhase === TUTORIAL_PHASE.APP_TOUR;

  // ─── Typewriter Effect ───────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !step) return;
    if (koinState !== KOIN_STATE.SPEAKING) return;

    const dialogue = step.koinDialogue;
    if (!dialogue || dialoguePage >= dialogue.length) return;

    const fullText = dialogue[dialoguePage];
    let charIndex = 0;
    setDisplayedText('');
    setTypingDone(false);

    timerRef.current = setInterval(() => {
      charIndex++;
      setDisplayedText(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setTypingDone(true);
      }
    }, 30);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, step?.id, dialoguePage, koinState]);

  // ─── Auto-minimize after dialogue finishes (for action-gated steps) ──
  useEffect(() => {
    if (!isActive || !step) return;
    if (koinState !== KOIN_STATE.SPEAKING) return;
    if (!typingDone) return;

    const isLastDialoguePage = dialoguePage >= (step.koinDialogue?.length || 1) - 1;
    if (!isLastDialoguePage) return;

    // Only auto-minimize if this step requires a user action
    if (step.conditionKey && !step.nextAlwaysEnabled) {
      const timeout = setTimeout(() => {
        setKoinState(KOIN_STATE.WAITING);
      }, MINIMIZE_DELAY);
      return () => clearTimeout(timeout);
    }
  }, [isActive, step?.id, typingDone, dialoguePage, koinState]);

  // ─── Koin minimize/maximize animations ───────────────────────────────
  useEffect(() => {
    if (koinState === KOIN_STATE.WAITING) {
      // Minimize: shrink and slide up
      Animated.parallel([
        Animated.timing(koinScale, {
          toValue: 0.4,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(koinTranslateY, {
          toValue: -SCREEN_HEIGHT * 0.3,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dialogueOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (koinState === KOIN_STATE.SPEAKING) {
      // Maximize: restore full size
      Animated.parallel([
        Animated.spring(koinScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(koinTranslateY, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(dialogueOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (koinState === KOIN_STATE.CELEBRATING) {
      // Celebration bounce
      Animated.sequence([
        Animated.parallel([
          Animated.spring(koinScale, {
            toValue: 1.2,
            tension: 100,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.spring(koinTranslateY, {
            toValue: 0,
            tension: 80,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(dialogueOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(overlayOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.spring(koinScale, {
          toValue: 1,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [koinState]);

  // ─── Entrance animation ──────────────────────────────────────────────
  useEffect(() => {
    if (isActive) {
      overlayOpacity.setValue(0);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  // ─── Tap handler ─────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (koinState === KOIN_STATE.WAITING) {
      // In waiting state, taps pass through to the app below
      return;
    }

    if (koinState === KOIN_STATE.CELEBRATING) {
      return; // Don't interrupt celebration
    }

    // If typing, skip to full text
    if (!typingDone) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const dialogue = step?.koinDialogue;
      if (dialogue && dialoguePage < dialogue.length) {
        setDisplayedText(dialogue[dialoguePage]);
        setTypingDone(true);
      }
      return;
    }

    // Advance dialogue
    advanceDialogue();
  }, [koinState, typingDone, step, dialoguePage, advanceDialogue]);

  // ─── Don't render when not active or in WAITING state ────────────────
  if (!isActive || !step) return null;

  // When waiting (Koin minimized), only show the mini Koin bubble
  if (koinState === KOIN_STATE.WAITING) {
    return (
      <View style={styles.minimizedContainer} pointerEvents="box-none">
        <Animated.View style={[
          styles.minimizedKoin,
          {
            transform: [{ scale: koinScale }],
          }
        ]}>
          <Image source={KOIN_IMAGE} style={styles.minimizedKoinImage} resizeMode="contain" />
          <View style={styles.waitingBadge}>
            <Ionicons name="hourglass" size={10} color="#FFF" />
          </View>
        </Animated.View>
        {/* Hint text */}
        <View style={styles.waitingHintContainer}>
          <Text style={styles.waitingHintText}>
            ⏳ Complete the action to continue
          </Text>
        </View>
      </View>
    );
  }

  const isLastDialoguePage = dialoguePage >= (step.koinDialogue?.length || 1) - 1;
  const isLastStep = currentStepIndex >= steps.length - 1;
  const shouldShowNextHint = typingDone && !isLastDialoguePage;
  const shouldShowAdvanceButton = typingDone && isLastDialoguePage;

  return (
    <Animated.View
      style={[styles.overlay, { opacity: overlayOpacity }]}
      pointerEvents={koinState === KOIN_STATE.SPEAKING ? 'auto' : 'box-none'}
    >
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={styles.overlayTouchable}>
          {/* Semi-transparent background */}
          <View style={styles.darkOverlay} />

          {/* Skip button */}
          <TouchableOpacity style={styles.skipButton} onPress={skipTutorial}>
            <Text style={styles.skipButtonText}>Skip Tutorial</Text>
            <Ionicons name="play-skip-forward" size={14} color="#AAA" />
          </TouchableOpacity>

          {/* Koin Character */}
          <Animated.View style={[
            styles.koinContainer,
            {
              transform: [
                { scale: koinState === KOIN_STATE.CELEBRATING ? celebrateScale : koinScale },
                { translateY: koinTranslateY },
              ],
            }
          ]}>
            <Image source={KOIN_IMAGE} style={styles.koinImage} resizeMode="contain" />
          </Animated.View>

          {/* Dialogue Box */}
          <Animated.View style={[styles.dialogueContainer, { opacity: dialogueOpacity }]}>
            <View style={styles.dialogueBox}>
              {/* Speaker name */}
              <View style={styles.speakerTag}>
                <Text style={styles.speakerName}>🪙 Koin</Text>
              </View>

              {/* Dialogue text with typewriter */}
              <Text style={styles.dialogueText}>
                {displayedText}
                {!typingDone && <Text style={styles.cursor}>▌</Text>}
              </Text>

              {/* Footer */}
              <View style={styles.dialogueFooter}>
                {/* Page dots */}
                <View style={styles.dotsContainer}>
                  {step.koinDialogue.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === dialoguePage && styles.dotActive,
                        i < dialoguePage && styles.dotCompleted,
                      ]}
                    />
                  ))}
                </View>

                {/* Tap hint or advance button */}
                {shouldShowNextHint && (
                  <View style={styles.tapHint}>
                    <Text style={styles.tapHintText}>Tap to continue</Text>
                    <Ionicons name="chevron-forward" size={14} color="#F5DEB3" />
                  </View>
                )}
                {shouldShowAdvanceButton && (
                  <TouchableOpacity
                    style={styles.advanceButton}
                    onPress={() => advanceDialogue()}
                  >
                    <Text style={styles.advanceButtonText}>
                      {step.conditionKey && !step.nextAlwaysEnabled
                        ? "Got it!"
                        : isLastStep
                          ? "Finish! 🎉"
                          : "Next"}
                    </Text>
                    <Ionicons
                      name={isLastStep ? "checkmark" : "arrow-forward"}
                      size={14}
                      color="#1a1a2e"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Step progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[
                styles.progressFill,
                { width: `${((currentStepIndex + 1) / steps.length) * 100}%` }
              ]} />
            </View>
            <Text style={styles.progressText}>
              {currentStepIndex + 1} / {steps.length}
            </Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  overlayTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },

  // Skip button
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 50, 50, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    zIndex: 10,
  },
  skipButtonText: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '600',
  },

  // Koin character
  koinContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  koinImage: {
    width: 120,
    height: 120,
  },

  // Dialogue box
  dialogueContainer: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 420,
  },
  dialogueBox: {
    backgroundColor: 'rgba(30, 30, 50, 0.95)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#5A5A7A',
    padding: 18,
    minHeight: 120,
  },
  speakerTag: {
    position: 'absolute',
    top: -14,
    left: 16,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 10,
  },
  speakerName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dialogueText: {
    color: '#E8D5B5',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  cursor: {
    color: '#FF6B00',
    fontWeight: 'bold',
  },

  // Footer
  dialogueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#444',
  },
  dotActive: {
    backgroundColor: '#FF6B00',
    width: 16,
  },
  dotCompleted: {
    backgroundColor: '#4CAF50',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tapHintText: {
    color: '#F5DEB3',
    fontSize: 12,
    opacity: 0.8,
  },
  advanceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 4,
  },
  advanceButtonText: {
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: 'bold',
  },

  // Progress bar
  progressContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.6,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 2,
  },
  progressText: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },

  // Minimized (waiting) state
  minimizedContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    elevation: 9998,
  },
  minimizedKoin: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizedKoinImage: {
    width: 45,
    height: 45,
  },
  waitingBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingHintContainer: {
    position: 'absolute',
    top: 105,
    right: 10,
    backgroundColor: 'rgba(30, 30, 50, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF6B00',
  },
  waitingHintText: {
    color: '#F5DEB3',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default KoinTutorialOverlay;
