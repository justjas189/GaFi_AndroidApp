// Duo-inspired Celebration Overlay Component
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../src/context/ThemeContext';

const { width, height } = Dimensions.get('window');

const DuoCelebrationOverlay = ({ 
  visible, 
  type = 'goal_achieved', 
  message = 'Amazing!', 
  onComplete,
  duration = 3000 
}) => {
  const { colors } = useTheme();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0));
  const [confettiAnims] = useState([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0)
  ]);

  useEffect(() => {
    if (visible) {
      // Main celebration animation
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 3,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(duration - 800),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onComplete && onComplete();
      });

      // Confetti animation
      confettiAnims.forEach((anim, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 200),
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 }
        ).start();
      });
    }
  }, [visible]);

  const getCelebrationConfig = () => {
    switch (type) {
      case 'goal_achieved':
        return {
          icon: 'emoji-events',
          iconColor: '#FFD700',
          title: 'GOAL ACHIEVED!',
          subtitle: message,
          backgroundColor: colors.success || '#4CAF50',
          emoji: '🏆'
        };
      case 'streak_milestone':
        return {
          icon: 'local-fire-department',
          iconColor: '#FF4500',
          title: 'STREAK LEGEND!',
          subtitle: message,
          backgroundColor: '#FF6B35',
          emoji: '🔥'
        };
      case 'level_up':
        return {
          icon: 'star',
          iconColor: '#FFD700',
          title: 'LEVEL UP!',
          subtitle: message,
          backgroundColor: '#9C27B0',
          emoji: '⭐'
        };
      case 'savings_milestone':
        return {
          icon: 'savings',
          iconColor: '#4CAF50',
          title: 'SAVINGS HERO!',
          subtitle: message,
          backgroundColor: '#4CAF50',
          emoji: '💰'
        };
      default:
        return {
          icon: 'celebration',
          iconColor: '#FFD700',
          title: 'AMAZING!',
          subtitle: message,
          backgroundColor: colors.primary || '#2196F3',
          emoji: '🎉'
        };
    }
  };

  const config = getCelebrationConfig();

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.overlay,
        { 
          opacity: fadeAnim,
          backgroundColor: `${config.backgroundColor}CC` // Add transparency
        }
      ]}
    >
      {/* Confetti Effect */}
      {confettiAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confettiPiece,
            {
              left: (index * width / 5) + Math.random() * 50,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, height + 100],
                  }),
                },
                {
                  rotate: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.confettiEmoji}>{config.emoji}</Text>
        </Animated.View>
      ))}

      {/* Main Celebration Content */}
      <Animated.View 
        style={[
          styles.celebrationContainer,
          {
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        {/* Large Icon */}
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name={config.icon} 
            size={120} 
            color={config.iconColor}
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.onPrimary || '#FFFFFF' }]}>
          {config.title}
        </Text>

        {/* Subtitle/Message */}
        <Text style={[styles.subtitle, { color: colors.onPrimary || '#FFFFFF' }]}>
          {config.subtitle}
        </Text>

        {/* Duo-inspired motivational tag */}
        <View style={styles.tagContainer}>
          <Text style={[styles.tag, { color: colors.onPrimary || '#FFFFFF' }]}>
            MonT: You're INCREDIBLE! 🚀
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confettiPiece: {
    position: 'absolute',
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confettiEmoji: {
    fontSize: 24,
  },
  celebrationContainer: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
    lineHeight: 24,
  },
  tagContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tag: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default DuoCelebrationOverlay;
