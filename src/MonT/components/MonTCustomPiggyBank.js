import React from 'react';
import { View, Image, Text, Animated, Easing, StyleSheet } from 'react-native';
import { MASCOT_STATES } from '../constants/MascotStates';

// MonT Custom Piggy Bank Avatar
// Uses your actual piggy bank image with emotional overlays
export const MonTCustomPiggyBank = ({ 
  currentState = MASCOT_STATES.IDLE,
  size = 'medium',
  showAnimation = true,
  piggyBankImageUri, // Your actual piggy bank image
  onTap,
  style = {}
}) => {
  const animatedValue = new Animated.Value(0);
  const scaleValue = new Animated.Value(1);
  const rotateValue = new Animated.Value(0);

  React.useEffect(() => {
    if (showAnimation) {
      // Main breathing animation
      Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        })
      ).start();

      // State-specific animations
      startStateAnimation();
    }
  }, [currentState, showAnimation]);

  const startStateAnimation = () => {
    scaleValue.setValue(1);
    rotateValue.setValue(0);

    switch (currentState) {
      case MASCOT_STATES.EXCITED:
      case MASCOT_STATES.CELEBRATING:
        // Bouncy excitement
        Animated.loop(
          Animated.sequence([
            Animated.timing(scaleValue, {
              toValue: 1.15,
              duration: 400,
              easing: Easing.out(Easing.back(1.5)),
              useNativeDriver: true,
            }),
            Animated.timing(scaleValue, {
              toValue: 1,
              duration: 400,
              easing: Easing.in(Easing.back(1.5)),
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case MASCOT_STATES.THINKING:
        // Gentle side-to-side thinking
        Animated.loop(
          Animated.sequence([
            Animated.timing(rotateValue, {
              toValue: 1,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(rotateValue, {
              toValue: -1,
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case MASCOT_STATES.WORRIED:
      case MASCOT_STATES.BUDGET_ALERT:
        // Nervous shaking
        Animated.loop(
          Animated.sequence([
            Animated.timing(rotateValue, {
              toValue: 0.5,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(rotateValue, {
              toValue: -0.5,
              duration: 150,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case MASCOT_STATES.SLEEPING:
        // Slow, deep breathing
        Animated.loop(
          Animated.timing(scaleValue, {
            toValue: 1.05,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          })
        ).start();
        break;
    }
  };

  // Size configurations
  const sizeConfig = {
    small: { width: 80, height: 80 },
    medium: { width: 120, height: 120 },
    large: { width: 180, height: 180 },
    xlarge: { width: 240, height: 240 }
  };

  const currentSize = sizeConfig[size] || sizeConfig.medium;

  // Get emotional state styling
  const getEmotionalStyling = () => {
    switch (currentState) {
      case MASCOT_STATES.HAPPY:
        return {
          tint: '#FFB6C1',
          glow: '#FF69B4',
          overlay: '😊',
          particles: ['💖', '✨', '🌟']
        };

      case MASCOT_STATES.EXCITED:
        return {
          tint: '#FFD700',
          glow: '#FFA500',
          overlay: '🤩',
          particles: ['✨', '🌟', '⚡', '💫']
        };

      case MASCOT_STATES.CELEBRATING:
        return {
          tint: '#FF69B4',
          glow: '#FFD700',
          overlay: '🥳',
          particles: ['🎉', '🎊', '🏆', '👑', '💎', '✨']
        };

      case MASCOT_STATES.THINKING:
        return {
          tint: '#87CEEB',
          glow: '#4682B4',
          overlay: '🤔',
          particles: ['💭', '🧠', '💡']
        };

      case MASCOT_STATES.FOCUSED:
        return {
          tint: '#98FB98',
          glow: '#32CD32',
          overlay: '🧐',
          particles: ['🎯', '📊', '💡']
        };

      case MASCOT_STATES.WORRIED:
        return {
          tint: '#FFA07A',
          glow: '#FF6347',
          overlay: '😰',
          particles: ['💸', '⚠️', '😟']
        };

      case MASCOT_STATES.BUDGET_ALERT:
        return {
          tint: '#FFB347',
          glow: '#FF8C00',
          overlay: '🚨',
          particles: ['⚠️', '🚫', '💸']
        };

      case MASCOT_STATES.GOAL_ACHIEVED:
        return {
          tint: '#FFD700',
          glow: '#FFA500',
          overlay: '🏆',
          particles: ['🏆', '👑', '💎', '🌟', '✨', '🎯']
        };

      case MASCOT_STATES.SLEEPING:
        return {
          tint: '#E6E6FA',
          glow: '#9370DB',
          overlay: '😴',
          particles: ['💤', '😴', '🌙']
        };

      case MASCOT_STATES.ENCOURAGING:
        return {
          tint: '#90EE90',
          glow: '#32CD32',
          overlay: '💪',
          particles: ['💪', '🌟', '🔥', '⭐']
        };

      default: // IDLE
        return {
          tint: '#FFB6C1',
          glow: '#FF91A4',
          overlay: '😌',
          particles: ['💰', '🐷', '✨']
        };
    }
  };

  const emotionalStyle = getEmotionalStyling();

  const getAnimatedStyle = () => {
    const breathe = animatedValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, -3, 0],
    });

    const rotate = rotateValue.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: ['-8deg', '0deg', '8deg'],
    });

    return {
      transform: [
        { translateY: breathe },
        { scale: scaleValue },
        { rotate: rotate }
      ]
    };
  };

  const getGlowStyle = () => ({
    shadowColor: emotionalStyle.glow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 15,
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.piggyContainer,
          currentSize,
          getAnimatedStyle(),
          getGlowStyle()
        ]}
        onTouchEnd={onTap}
      >
        {/* Your actual piggy bank image */}
        {piggyBankImageUri ? (
          <Image
            source={{ uri: piggyBankImageUri }}
            style={[
              styles.piggyImage,
              currentSize,
              { tintColor: emotionalStyle.tint + '40' } // Subtle tint overlay
            ]}
            resizeMode="contain"
            onError={(error) => {
              console.log('Piggy bank image failed to load:', error);
            }}
          />
        ) : (
          // Fallback to emoji piggy bank if no image provided
          <Text style={[
            styles.fallbackPiggy,
            { fontSize: currentSize.width * 0.6 }
          ]}>
            🐷
          </Text>
        )}

        {/* Emotional overlay (eyes/expression) */}
        <View style={styles.emotionalOverlay}>
          <Animated.Text
            style={[
              styles.overlayEmoji,
              {
                fontSize: currentSize.width * 0.25,
                opacity: animatedValue.interpolate({
                  inputRange: [0, 0.3, 0.7, 1],
                  outputRange: [0.7, 1, 1, 0.7]
                })
              }
            ]}
          >
            {emotionalStyle.overlay}
          </Animated.Text>
        </View>

        {/* Particle effects */}
        {(currentState === MASCOT_STATES.CELEBRATING || 
          currentState === MASCOT_STATES.GOAL_ACHIEVED ||
          currentState === MASCOT_STATES.EXCITED) && (
          <ParticleSystem 
            particles={emotionalStyle.particles}
            size={currentSize}
            animationValue={animatedValue}
          />
        )}

        {/* State indicator badge */}
        <StateIndicatorBadge 
          state={currentState}
          color={emotionalStyle.glow}
          size={currentSize.width * 0.15}
        />
      </Animated.View>
    </View>
  );
};

// Particle system for celebrations
const ParticleSystem = ({ particles, size, animationValue }) => {
  return (
    <View style={styles.particleContainer}>
      {particles.slice(0, 8).map((particle, index) => {
        const angle = (index / particles.length) * 2 * Math.PI;
        const radius = size.width * 0.4;
        
        return (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                left: Math.cos(angle) * radius + size.width * 0.5,
                top: Math.sin(angle) * radius + size.height * 0.5,
                opacity: animationValue.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 1, 1, 0]
                }),
                transform: [{
                  scale: animationValue.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1.5, 0]
                  })
                }, {
                  rotate: animationValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }
            ]}
          >
            <Text style={[styles.particleText, { fontSize: size.width * 0.12 }]}>
              {particle}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

// State indicator badge
const StateIndicatorBadge = ({ state, color, size }) => {
  const getBadgeInfo = () => {
    switch (state) {
      case MASCOT_STATES.BUDGET_ALERT:
        return { icon: '⚠️', text: 'Alert' };
      case MASCOT_STATES.GOAL_ACHIEVED:
        return { icon: '🏆', text: 'Goal!' };
      case MASCOT_STATES.CELEBRATING:
        return { icon: '🎉', text: 'Yay!' };
      case MASCOT_STATES.THINKING:
        return { icon: '💭', text: 'Thinking' };
      default:
        return null;
    }
  };

  const badgeInfo = getBadgeInfo();
  if (!badgeInfo) return null;

  return (
    <View style={[
      styles.stateBadge,
      { 
        backgroundColor: color + '20',
        borderColor: color,
        width: size * 2,
        height: size
      }
    ]}>
      <Text style={[styles.badgeIcon, { fontSize: size * 0.6 }]}>
        {badgeInfo.icon}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
  piggyContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  piggyImage: {
    borderRadius: 15,
  },
  fallbackPiggy: {
    textAlign: 'center',
  },
  emotionalOverlay: {
    position: 'absolute',
    top: '15%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayEmoji: {
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  particleContainer: {
    position: 'absolute',
    width: '300%',
    height: '300%',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
  },
  particleText: {
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  stateBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeIcon: {
    textAlign: 'center',
  },
});

export default MonTCustomPiggyBank;
