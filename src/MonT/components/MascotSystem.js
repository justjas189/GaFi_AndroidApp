// Complete Mascot System Implementation
// This creates a Duolingo-style mascot with animations, reactions, and personality

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
  Dimensions,
  Easing,
  ScrollView,
  Image
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MASCOT_STATES, MASCOT_EXPRESSIONS, ANIMATION_CONFIGS } from '../constants/MascotStates';
import DuoCelebrationOverlay from './DuoCelebrationOverlay';
import { MonTGraphics, GameStyleMonT, AdvancedMonT } from './MonTGraphics';
import MonTAssetManager from '../utils/MonTAssetManager';
import MonTCustomPiggyBank from './MonTCustomPiggyBank';
import MonTPiggyBankStates from './MonTPiggyBankStates';

const { width, height } = Dimensions.get('window');

// MonT Mascot Component (Enhanced with Duo-inspired celebrations and game-style graphics)
export const MonTMascot = ({ 
  onTap, 
  currentState = MASCOT_STATES.IDLE,
  showBubble = false,
  bubbleText = '',
  position = 'floating', // 'floating', 'header', 'corner', 'center'
  size = 'medium', // 'small', 'medium', 'large'
  notificationCount = 0,
  style = {},
  showCelebration = false,
  celebrationType = 'goal_achieved',
  celebrationMessage = 'Amazing!',
  onCelebrationComplete,
  // New graphics options
  graphicsMode = 'piggy', // 'emoji', 'icon', 'generated', 'custom', 'enhanced', 'piggy', 'piggy-emoji'
  customImageSource = null,
  useWebGraphics = false,
  showAccessories = false,
  piggyBankImageUri = null // Will be set from imported image
}) => {
  const { colors } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCelebrationOverlay, setShowCelebrationOverlay] = useState(false);
  
  // Animation values
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  // Mascot size configurations
  const sizeConfig = {
    small: { container: 40, emoji: 20, bubble: 120 },
    medium: { container: 60, emoji: 30, bubble: 160 },
    large: { container: 80, emoji: 40, bubble: 200 }
  };

  const currentSize = sizeConfig[size];

  // Auto-animation based on state - use setTimeout to avoid useInsertionEffect warning
  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if component is still mounted before starting animations
      if (!isAnimating) {
        switch (currentState) {
          case MASCOT_STATES.HAPPY:
            startBounceAnimation();
            break;
          case MASCOT_STATES.EXCITED:
            startExcitedAnimation();
            break;
          case MASCOT_STATES.CELEBRATING:
            startCelebrationAnimation();
            break;
          case MASCOT_STATES.THINKING:
            startThinkingAnimation();
            break;
          case MASCOT_STATES.SLEEPING:
            startSleepAnimation();
            break;
          case MASCOT_STATES.ENCOURAGING:
            startEncouragingAnimation();
            break;
          default:
            startIdleAnimation();
        }
      }
    }, 16); // Use 16ms delay (1 frame) instead of 0 to ensure proper scheduling

    return () => clearTimeout(timer);
  }, [currentState]);

  // Handle celebration overlays - use setTimeout to avoid useInsertionEffect warning
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showCelebration && !showCelebrationOverlay) {
        setShowCelebrationOverlay(true);
      }
    }, 16); // Use 16ms delay (1 frame) instead of 0 to ensure proper scheduling

    return () => clearTimeout(timer);
  }, [showCelebration]);

  // Show speech bubble - use setTimeout to avoid useInsertionEffect warning
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showBubble && bubbleText) {
        showSpeechBubble();
      } else {
        hideSpeechBubble();
      }
    }, 16); // Use 16ms delay (1 frame) instead of 0 to ensure proper scheduling

    return () => clearTimeout(timer);
  }, [showBubble, bubbleText]);

  const startBounceAnimation = () => {
    if (isAnimating) return; // Prevent overlapping animations
    setIsAnimating(true);
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: -10,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsAnimating(false);
      }
    });
  };

  const startExcitedAnimation = () => {
    if (isAnimating) return; // Prevent overlapping animations
    setIsAnimating(true);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsAnimating(false);
        rotateAnim.setValue(0);
      }
    });
  };

  const startCelebrationAnimation = () => {
    if (isAnimating) return; // Prevent overlapping animations
    setIsAnimating(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 }
    ).start(({ finished }) => {
      if (finished) {
        setIsAnimating(false);
      }
    });
  };

  const startThinkingAnimation = () => {
    if (isAnimating) return; // Prevent multiple animations
    setIsAnimating(true);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    
    // Clean up animation after some time to prevent memory leaks
    setTimeout(() => {
      animation.stop();
      setIsAnimating(false);
    }, 10000);
  };

  const startSleepAnimation = () => {
    if (isAnimating) return; // Prevent multiple animations
    setIsAnimating(true);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    
    // Clean up animation after some time to prevent memory leaks
    setTimeout(() => {
      animation.stop();
      setIsAnimating(false);
    }, 10000);
  };

  const startEncouragingAnimation = () => {
    if (isAnimating) return; // Prevent overlapping animations
    setIsAnimating(true);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.15,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: -5,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsAnimating(false);
      }
    });
  };

  const startIdleAnimation = () => {
    setIsAnimating(false);
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const showSpeechBubble = () => {
    Animated.spring(bubbleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start();
  };

  const hideSpeechBubble = () => {
    Animated.timing(bubbleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleMascotPress = () => {
    // Use requestAnimationFrame to prevent scheduling updates during render
    requestAnimationFrame(() => {
      if (!isAnimating) {
        startBounceAnimation();
      }
      if (onTap) {
        onTap();
      }
    });
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '10deg'],
  });

  const containerStyle = [
    styles.mascotContainer,
    position === 'floating' && styles.floatingPosition,
    position === 'corner' && styles.cornerPosition,
    position === 'center' && styles.centerPosition,
    {
      width: currentSize.container,
      height: currentSize.container,
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary + '40',
    },
    style
  ];

  return (
    <View style={styles.mascotWrapper}>
      {/* Speech Bubble */}
      {showBubble && bubbleText && (
        <Animated.View
          style={[
            styles.speechBubble,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              width: currentSize.bubble,
              transform: [{ scale: bubbleAnim }],
            }
          ]}
        >
          <Text style={[styles.bubbleText, { color: colors.text }]}>
            {bubbleText}
          </Text>
          <View style={[styles.bubbleTail, { borderTopColor: colors.surface }]} />
        </Animated.View>
      )}

      {/* Mascot Character */}
      <TouchableOpacity
        onPress={handleMascotPress}
        activeOpacity={0.8}
        style={containerStyle}
      >
        <Animated.View
          style={[
            styles.mascotInner,
            {
              transform: [
                { translateY: bounceAnim },
                { scale: Animated.multiply(scaleAnim, pulseAnim) },
                { rotate: rotation },
              ],
            }
          ]}
        >
          {/* Enhanced Graphics System */}
          {(() => {
            switch (graphicsMode) {
              case 'enhanced':
                return (
                  <AdvancedMonT
                    state={currentState}
                    size={currentSize.container * 0.8}
                    showParticles={currentState === MASCOT_STATES.CELEBRATING}
                  />
                );
              case 'game':
                return (
                  <GameStyleMonT
                    state={currentState}
                    size={currentSize.container * 0.8}
                    color={colors.primary || '#2196F3'}
                    accessories={showAccessories ? [
                      { icon: 'star', position: { top: 5, right: 5 }, color: '#FFD700' }
                    ] : []}
                  />
                );
              case 'generated':
                return (
                  <Image
                    source={MonTAssetManager.generateDiceBearAvatar('MonT', currentState)}
                    style={{
                      width: currentSize.container * 0.8,
                      height: currentSize.container * 0.8,
                      borderRadius: currentSize.container * 0.4
                    }}
                  />
                );
              case 'custom':
                return customImageSource ? (
                  <Image
                    source={customImageSource}
                    style={{
                      width: currentSize.container * 0.8,
                      height: currentSize.container * 0.8,
                      borderRadius: currentSize.container * 0.4
                    }}
                  />
                ) : (
                  <MonTGraphics
                    state={currentState}
                    size={currentSize.container * 0.8}
                    useImages={false}
                  />
                );
              case 'piggy':
                return piggyBankImageUri ? (
                  <MonTCustomPiggyBank
                    currentState={currentState}
                    size={size}
                    showAnimation={true}
                    piggyBankImageUri={piggyBankImageUri}
                    onTap={onTap}
                    style={{ width: currentSize.container, height: currentSize.container }}
                  />
                ) : (
                  <MonTPiggyBankStates
                    currentState={currentState}
                    size={size}
                    showAnimation={true}
                  />
                );
              case 'piggy-emoji':
                return (
                  <MonTPiggyBankStates
                    currentState={currentState}
                    size={size}
                    showAnimation={true}
                  />
                );
              case 'web':
                return (
                  <Image
                    source={MonTAssetManager.getWebAsset('icons8', 'robot_advisor')}
                    style={{
                      width: currentSize.container * 0.8,
                      height: currentSize.container * 0.8,
                      borderRadius: currentSize.container * 0.4
                    }}
                  />
                );
              case 'emoji':
              default:
                return (
                  <Text style={[styles.mascotEmoji, { fontSize: currentSize.emoji }]}>
                    {MASCOT_EXPRESSIONS[currentState]}
                  </Text>
                );
            }
          })()}
        </Animated.View>

        {/* Notification Badge */}
        {notificationCount > 0 && (
          <View style={[styles.notificationBadge, { backgroundColor: colors.accent || '#FF6B6B' }]}>
            <Text style={styles.notificationText}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Duo-inspired Celebration Overlay */}
      <DuoCelebrationOverlay
        visible={showCelebration || showCelebrationOverlay}
        type={celebrationType}
        message={celebrationMessage}
        onComplete={() => {
          setShowCelebrationOverlay(false);
          onCelebrationComplete && onCelebrationComplete();
        }}
      />
    </View>
  );
};

// Mascot Interaction Modal (like Duolingo's character interactions)
export const MascotModal = ({ visible, onClose, mascotState, onAction, userStats = null }) => {
  const { colors } = useTheme();
  
  // Provide safe defaults for userStats
  const safeUserStats = userStats || {
    totalSavings: 0,
    currentStreak: 0,
    goalsAchieved: 0
  };
  
  const mascotActions = [
    {
      id: 'daily_tip',
      icon: '💡',
      title: 'Daily Tip',
      subtitle: 'Get financial wisdom',
      action: () => onAction && onAction('tip')
    },
    {
      id: 'check_progress',
      icon: '📊',
      title: 'Check Progress',
      subtitle: 'See your savings journey',
      action: () => onAction && onAction('progress')
    },
    {
      id: 'set_goal',
      icon: '🎯',
      title: 'Set Goal',
      subtitle: 'Create new savings target',
      action: () => onAction && onAction('goal')
    },
    {
      id: 'motivate',
      icon: '⭐',
      title: 'Motivate Me',
      subtitle: 'Get encouragement',
      action: () => onAction && onAction('encouragement')
    },
    {
      id: 'learn',
      icon: '📚',
      title: 'Learn',
      subtitle: 'Financial education',
      action: () => onAction && onAction('learn')
    },
    {
      id: 'celebrate',
      icon: '🎉',
      title: 'Celebrate',
      subtitle: 'Share achievements',
      action: () => onAction && onAction('celebrate')
    }
  ];

  const getGreetingMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning! 🌅";
    if (hour < 17) return "Good afternoon! ☀️";
    return "Good evening! 🌙";
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Large Mascot Display */}
            <View style={styles.modalMascot}>
              <MonTMascot
                currentState={mascotState}
                size="large"
                position="center"
              />
              <Text style={[styles.mascotName, { color: colors.text }]}>
                MonT
              </Text>
              <Text style={[styles.mascotGreeting, { color: colors.textSecondary }]}>
                Your Financial Buddy 🤖
              </Text>
              <Text style={[styles.mascotWelcome, { color: colors.primary }]}>
                {getGreetingMessage()}
              </Text>
              
              {/* Quick Stats */}
              {safeUserStats && safeUserStats.totalSavings !== undefined && (
                <View style={[styles.quickStats, { backgroundColor: colors.card }]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                      ₱{(safeUserStats.totalSavings || 0).toLocaleString()}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Total Saved
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.accent }]}>
                      {safeUserStats.currentStreak || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Day Streak
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.success || '#4CAF50' }]}>
                      {safeUserStats.goalsAchieved || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Goals Done
                    </Text>
                  </View>
                </View>
              )}
            </View>
            
            {/* Action Buttons */}
            <View style={styles.actionsGrid}>
              {mascotActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => {
                    action.action();
                    onClose();
                  }}
                >
                  <Text style={styles.actionIcon}>{action.icon}</Text>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>
                    {action.title}
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    {action.subtitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.primary }]}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Start Chatting 💬</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Compact Mascot for headers/toolbars
export const CompactMascot = ({ 
  currentState = MASCOT_STATES.IDLE, 
  onTap, 
  showBubble = false,
  bubbleText = '',
  notificationCount = 0 
}) => {
  return (
    <MonTMascot
      currentState={currentState}
      onTap={onTap}
      showBubble={showBubble}
      bubbleText={bubbleText}
      position="header"
      size="small"
      notificationCount={notificationCount}
    />
  );
};

const styles = StyleSheet.create({
  mascotWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  mascotContainer: {
    borderRadius: 50,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingPosition: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 1000,
  },
  cornerPosition: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1000,
  },
  centerPosition: {
    alignSelf: 'center',
  },
  mascotInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotEmoji: {
    textAlign: 'center',
  },
  speechBubble: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 200,
    minHeight: 40,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  bubbleText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.85,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalMascot: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mascotName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 12,
  },
  mascotGreeting: {
    fontSize: 16,
    marginTop: 4,
  },
  mascotWelcome: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  quickStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  actionButton: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MonTMascot;
