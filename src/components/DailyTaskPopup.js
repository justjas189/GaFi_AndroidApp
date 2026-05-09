import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const KOIN_IMAGE = require('../../assets/mascot/koin_tutorial.png');

const DailyTaskPopup = ({ visible, title, subtitle, dialogueText, onDismiss }) => {
  const dialoguePages = useMemo(() => {
    if (Array.isArray(dialogueText)) {
      return dialogueText.filter((item) => typeof item === 'string' && item.trim().length > 0);
    }
    if (typeof dialogueText === 'string' && dialogueText.trim().length > 0) {
      return [dialogueText];
    }
    return [];
  }, [dialogueText]);

  const [dialoguePage, setDialoguePage] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);

  const timerRef = useRef(null);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dialogueOpacity = useRef(new Animated.Value(0)).current;
  const koinScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible) return;
    setDialoguePage(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || dialoguePages.length === 0) return;

    const fullText = dialoguePages[dialoguePage] || '';
    let charIndex = 0;
    setDisplayedText('');
    setTypingDone(false);

    timerRef.current = setInterval(() => {
      charIndex += 1;
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
  }, [visible, dialoguePages, dialoguePage]);

  useEffect(() => {
    if (!visible) return;

    overlayOpacity.setValue(0);
    dialogueOpacity.setValue(0);
    koinScale.setValue(0.92);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dialogueOpacity, {
        toValue: 1,
        duration: 300,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(koinScale, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, overlayOpacity, dialogueOpacity, koinScale]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleAdvance = useCallback(() => {
    if (!visible) return;

    if (!typingDone) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDisplayedText(dialoguePages[dialoguePage] || '');
      setTypingDone(true);
      return;
    }

    const lastPage = dialoguePage >= dialoguePages.length - 1;
    if (!lastPage) {
      setDialoguePage((prev) => prev + 1);
      return;
    }

    if (typeof onDismiss === 'function') {
      onDismiss();
    }
  }, [visible, typingDone, dialoguePages, dialoguePage, onDismiss]);

  if (!visible || dialoguePages.length === 0) {
    return null;
  }

  const isLastDialoguePage = dialoguePage >= dialoguePages.length - 1;
  const showTapHint = typingDone && !isLastDialoguePage;
  const showAdvanceButton = typingDone;

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      <TouchableWithoutFeedback onPress={handleAdvance}>
        <View style={styles.overlayTouchable}>
          <View style={styles.darkOverlay} />

          <TouchableOpacity style={styles.skipButton} onPress={onDismiss}>
            <Text style={styles.skipButtonText}>Dismiss</Text>
            <Ionicons name="close" size={14} color="#AAA" />
          </TouchableOpacity>

          <Animated.View style={[styles.koinContainer, { transform: [{ scale: koinScale }] }]}>
            <Image source={KOIN_IMAGE} style={styles.koinImage} resizeMode="contain" />
          </Animated.View>

          <Animated.View style={[styles.dialogueContainer, { opacity: dialogueOpacity }]}>
            <View style={styles.dialogueBox}>
              <View style={styles.speakerTag}>
                <Text style={styles.speakerName}>Koin</Text>
              </View>

              {!!title && <Text style={styles.titleText}>{title}</Text>}
              {!!subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}

              <Text style={styles.dialogueText}>
                {displayedText}
                {!typingDone && <Text style={styles.cursor}>|</Text>}
              </Text>

              <View style={styles.dialogueFooter}>
                <View style={styles.dotsContainer}>
                  {dialoguePages.map((_, i) => (
                    <View
                      key={`page-${i}`}
                      style={[
                        styles.dot,
                        i === dialoguePage && styles.dotActive,
                        i < dialoguePage && styles.dotCompleted,
                      ]}
                    />
                  ))}
                </View>

                {showTapHint && (
                  <View style={styles.tapHint}>
                    <Text style={styles.tapHintText}>Tap to continue</Text>
                    <Ionicons name="chevron-forward" size={14} color="#F5DEB3" />
                  </View>
                )}

                {showAdvanceButton && (
                  <TouchableOpacity style={styles.advanceButton} onPress={handleAdvance}>
                    <Text style={styles.advanceButtonText}>{isLastDialoguePage ? 'Got it!' : 'Next'}</Text>
                    <Ionicons name={isLastDialoguePage ? 'checkmark' : 'arrow-forward'} size={14} color="#1a1a2e" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${((dialoguePage + 1) / dialoguePages.length) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {dialoguePage + 1} / {dialoguePages.length}
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
  koinContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  koinImage: {
    width: 120,
    height: 120,
  },
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
  titleText: {
    color: '#F5DEB3',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitleText: {
    color: '#AAA',
    fontSize: 12,
    marginTop: 4,
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
});

export default DailyTaskPopup;
