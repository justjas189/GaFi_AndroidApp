// Mascot System — Simplified for current project structure
// Provides MonTMascot (animated character), MascotModal, and CompactMascot
// Uses MascotImage (piggy bank asset) instead of deleted MonT graphics modules

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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import MascotImage from './MascotImage';

const { width, height } = Dimensions.get('window');

// Mascot states (inlined — original was in deleted constants/MascotStates)
export const MASCOT_STATES = {
  IDLE: 'idle',
  HAPPY: 'happy',
  EXCITED: 'excited',
  CELEBRATING: 'celebrating',
  THINKING: 'thinking',
  SLEEPING: 'sleeping',
  ENCOURAGING: 'encouraging',
};

// MonTMascot Component
export const MonTMascot = ({
  onTap,
  currentState = MASCOT_STATES.IDLE,
  showBubble = false,
  bubbleText = '',
  position = 'floating', // 'floating' | 'header' | 'corner' | 'center'
  size = 'medium',        // 'small' | 'medium' | 'large'
  notificationCount = 0,
  style = {},
}) => {
  const { colors } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);

  // Animation values
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;

  const sizeConfig = {
    small: { container: 40, image: 28, bubble: 120 },
    medium: { container: 60, image: 42, bubble: 160 },
    large: { container: 80, image: 56, bubble: 200 },
  };
  const s = sizeConfig[size] || sizeConfig.medium;

  // State-driven animations
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAnimating) return;
      switch (currentState) {
        case MASCOT_STATES.HAPPY:
          bounce();
          break;
        case MASCOT_STATES.EXCITED:
          excited();
          break;
        case MASCOT_STATES.CELEBRATING:
          celebrate();
          break;
        case MASCOT_STATES.THINKING:
          think();
          break;
        case MASCOT_STATES.SLEEPING:
          sleep();
          break;
        case MASCOT_STATES.ENCOURAGING:
          encourage();
          break;
        default:
          idle();
      }
    }, 16);
    return () => clearTimeout(timer);
  }, [currentState]);

  // Show / hide speech bubble
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showBubble && bubbleText) {
        Animated.spring(bubbleAnim, { toValue: 1, useNativeDriver: true, tension: 150, friction: 8 }).start();
      } else {
        Animated.timing(bubbleAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    }, 16);
    return () => clearTimeout(timer);
  }, [showBubble, bubbleText]);

  // Animation helpers
  const done = ({ finished }) => { if (finished) setIsAnimating(false); };

  const bounce = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    Animated.sequence([
      Animated.timing(bounceAnim, { toValue: -10, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0, duration: 300, easing: Easing.bounce, useNativeDriver: true }),
    ]).start(done);
  };

  const excited = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.timing(rotateAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) { setIsAnimating(false); rotateAnim.setValue(0); } });
  };

  const celebrate = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    ).start(done);
  };

  const think = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    a.start();
    setTimeout(() => { a.stop(); setIsAnimating(false); }, 10000);
  };

  const sleep = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.9, duration: 2000, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    );
    a.start();
    setTimeout(() => { a.stop(); setIsAnimating(false); }, 10000);
  };

  const encourage = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 250, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: -5, duration: 150, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0, duration: 150, easing: Easing.bounce, useNativeDriver: true }),
    ]).start(done);
  };

  const idle = () => {
    setIsAnimating(false);
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(bounceAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = () => {
    requestAnimationFrame(() => {
      if (!isAnimating) bounce();
      if (onTap) onTap();
    });
  };

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '10deg'] });

  const containerStyle = [
    styles.mascotContainer,
    position === 'floating' && styles.floatingPosition,
    position === 'corner' && styles.cornerPosition,
    position === 'center' && styles.centerPosition,
    {
      width: s.container,
      height: s.container,
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary + '40',
    },
    style,
  ];

  return (
    <View style={styles.mascotWrapper}>
      {/* Speech Bubble */}
      {showBubble && bubbleText ? (
        <Animated.View
          style={[
            styles.speechBubble,
            {
              backgroundColor: colors.surface || colors.card,
              borderColor: colors.border,
              width: s.bubble,
              transform: [{ scale: bubbleAnim }],
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: colors.text }]}>{bubbleText}</Text>
          <View style={[styles.bubbleTail, { borderTopColor: colors.surface || colors.card }]} />
        </Animated.View>
      ) : null}

      {/* Mascot */}
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={containerStyle}>
        <Animated.View
          style={[
            styles.mascotInner,
            {
              transform: [
                { translateY: bounceAnim },
                { scale: Animated.multiply(scaleAnim, pulseAnim) },
                { rotate: rotation },
              ],
            },
          ]}
        >
          <MascotImage size={s.image} />
        </Animated.View>

        {/* Notification badge */}
        {notificationCount > 0 && (
          <View style={[styles.notifBadge, { backgroundColor: colors.accent || '#FF6B6B' }]}>
            <Text style={styles.notifText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

// MascotModal
export const MascotModal = ({ visible, onClose, mascotState, onAction, userStats = null }) => {
  const { colors } = useTheme();
  const stats = userStats || { totalSavings: 0, currentStreak: 0, goalsAchieved: 0 };

  const actions = [
    { id: 'daily_tip', icon: '\u{1F4A1}', title: 'Daily Tip', subtitle: 'Get financial wisdom', key: 'tip' },
    { id: 'check_progress', icon: '\u{1F4CA}', title: 'Check Progress', subtitle: 'See your savings journey', key: 'progress' },
    { id: 'set_goal', icon: '\u{1F3AF}', title: 'Set Goal', subtitle: 'Create new savings target', key: 'goal' },
    { id: 'motivate', icon: '\u{2B50}', title: 'Motivate Me', subtitle: 'Get encouragement', key: 'encouragement' },
    { id: 'learn', icon: '\u{1F4DA}', title: 'Learn', subtitle: 'Financial education', key: 'learn' },
    { id: 'celebrate', icon: '\u{1F389}', title: 'Celebrate', subtitle: 'Share achievements', key: 'celebrate' },
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning! \u{1F305}';
    if (h < 17) return 'Good afternoon! \u{2600}\u{FE0F}';
    return 'Good evening! \u{1F319}';
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface || colors.card }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Large mascot display */}
            <View style={styles.modalMascot}>
              <MonTMascot currentState={mascotState} size="large" position="center" />
              <Text style={[styles.mascotName, { color: colors.text }]}>Koin</Text>
              <Text style={[styles.mascotGreeting, { color: colors.textSecondary || colors.text + '80' }]}>Your Financial Buddy \u{F916}</Text>
              <Text style={[styles.mascotWelcome, { color: colors.primary }]}>{greeting}</Text>

              {stats.totalSavings !== undefined && (
                <View style={[styles.quickStats, { backgroundColor: colors.card }]}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{'\u20B1'}{(stats.totalSavings || 0).toLocaleString()}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary || colors.text + '80' }]}>Total Saved</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.accent || '#FF8C42' }]}>{stats.currentStreak || 0}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary || colors.text + '80' }]}>Day Streak</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.success || '#4CAF50' }]}>{stats.goalsAchieved || 0}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary || colors.text + '80' }]}>Goals Done</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Action buttons */}
            <View style={styles.actionsGrid}>
              {actions.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => { onAction && onAction(a.key); onClose(); }}
                >
                  <Text style={styles.actionIcon}>{a.icon}</Text>
                  <Text style={[styles.actionTitle, { color: colors.text }]}>{a.title}</Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary || colors.text + '80' }]}>{a.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.primary }]} onPress={onClose}>
              <Text style={styles.closeButtonText}>Start Chatting \u{F4AC}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// CompactMascot
export const CompactMascot = ({
  currentState = MASCOT_STATES.IDLE,
  onTap,
  showBubble = false,
  bubbleText = '',
  notificationCount = 0,
}) => (
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

// Styles
const styles = StyleSheet.create({
  mascotWrapper: { position: 'relative', alignItems: 'center' },
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
  floatingPosition: { position: 'absolute', bottom: 100, right: 20, zIndex: 1000 },
  cornerPosition: { position: 'absolute', top: 20, right: 20, zIndex: 1000 },
  centerPosition: { alignSelf: 'center' },
  mascotInner: { alignItems: 'center', justifyContent: 'center' },
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
  bubbleText: { fontSize: 12, textAlign: 'center', fontWeight: '500', lineHeight: 16 },
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
  notifBadge: {
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
  notifText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
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
  modalMascot: { alignItems: 'center', marginBottom: 24 },
  mascotName: { fontSize: 28, fontWeight: 'bold', marginTop: 12 },
  mascotGreeting: { fontSize: 16, marginTop: 4 },
  mascotWelcome: { fontSize: 14, marginTop: 8, fontWeight: '600' },
  quickStats: {
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E0E0E0', marginHorizontal: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginBottom: 24 },
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
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  actionSubtitle: { fontSize: 12, textAlign: 'center', lineHeight: 16 },
  closeButton: { paddingHorizontal: 32, paddingVertical: 16, borderRadius: 25, width: '100%', alignItems: 'center' },
  closeButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});

export default MonTMascot;
