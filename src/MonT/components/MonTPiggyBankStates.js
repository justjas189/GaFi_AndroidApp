import React from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { MASCOT_STATES } from '../constants/MascotStates';

// MonT Piggy Bank Emotional States System
// Creates different emotional variations of the base piggy bank
export const MonTPiggyBankStates = ({ 
  currentState = MASCOT_STATES.IDLE,
  size = 'medium',
  showAnimation = true,
  baseImageSource,
  style = {}
}) => {
  const animatedValue = new Animated.Value(0);
  const pulseValue = new Animated.Value(1);
  const rotateValue = new Animated.Value(0);

  React.useEffect(() => {
    // Main animation loop
    if (showAnimation) {
      Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        })
      ).start();
    }

    // State-specific animations
    startStateAnimation();
  }, [currentState, showAnimation]);

  const startStateAnimation = () => {
    switch (currentState) {
      case MASCOT_STATES.EXCITED:
      case MASCOT_STATES.CELEBRATING:
        // Excited bouncing
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseValue, {
              toValue: 1.2,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(pulseValue, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case MASCOT_STATES.THINKING:
        // Gentle rocking
        Animated.loop(
          Animated.sequence([
            Animated.timing(rotateValue, {
              toValue: 1,
              duration: 1500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(rotateValue, {
              toValue: 0,
              duration: 1500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;

      case MASCOT_STATES.WORRIED:
        // Nervous shaking
        Animated.loop(
          Animated.sequence([
            Animated.timing(rotateValue, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(rotateValue, {
              toValue: -1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(rotateValue, {
              toValue: 0,
              duration: 100,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;
    }
  };

  // Size configurations
  const sizeConfig = {
    small: { width: 60, height: 60, fontSize: 14 },
    medium: { width: 100, height: 100, fontSize: 18 },
    large: { width: 150, height: 150, fontSize: 24 },
    xlarge: { width: 200, height: 200, fontSize: 32 }
  };

  const currentSize = sizeConfig[size] || sizeConfig.medium;

  // Get the piggy bank representation for each emotional state
  const getPiggyStateRepresentation = () => {
    switch (currentState) {
      case MASCOT_STATES.HAPPY:
        return {
          piggy: '🐷',
          eyes: '😊',
          accent: '💖',
          color: '#FFB6C1',
          glow: '#FF69B4',
          message: "I'm feeling great about your savings!"
        };

      case MASCOT_STATES.EXCITED:
        return {
          piggy: '🐷',
          eyes: '🤩',
          accent: '✨',
          color: '#FFD700',
          glow: '#FFA500',
          message: "WOW! You're doing amazing!"
        };

      case MASCOT_STATES.CELEBRATING:
        return {
          piggy: '🐷',
          eyes: '🥳',
          accent: '🎉',
          color: '#FF69B4',
          glow: '#FFD700',
          message: "CELEBRATION TIME! Goal achieved!"
        };

      case MASCOT_STATES.THINKING:
        return {
          piggy: '🐷',
          eyes: '🤔',
          accent: '💭',
          color: '#87CEEB',
          glow: '#4682B4',
          message: "Let me think about your finances..."
        };

      case MASCOT_STATES.FOCUSED:
        return {
          piggy: '🐷',
          eyes: '🧐',
          accent: '🎯',
          color: '#98FB98',
          glow: '#32CD32',
          message: "Analyzing your spending patterns..."
        };

      case MASCOT_STATES.WORRIED:
        return {
          piggy: '🐷',
          eyes: '😰',
          accent: '💸',
          color: '#FFA07A',
          glow: '#FF6347',
          message: "I'm concerned about your budget..."
        };

      case MASCOT_STATES.BUDGET_ALERT:
        return {
          piggy: '🐷',
          eyes: '😬',
          accent: '⚠️',
          color: '#FFB347',
          glow: '#FF8C00',
          message: "Budget alert! Let's review your spending!"
        };

      case MASCOT_STATES.GOAL_ACHIEVED:
        return {
          piggy: '🐷',
          eyes: '🏆',
          accent: '👑',
          color: '#FFD700',
          glow: '#FFA500',
          message: "GOAL ACHIEVED! You're a savings champion!"
        };

      case MASCOT_STATES.SLEEPING:
        return {
          piggy: '🐷',
          eyes: '😴',
          accent: '💤',
          color: '#E6E6FA',
          glow: '#9370DB',
          message: "Zzz... I'm resting but still watching your money..."
        };

      case MASCOT_STATES.ENCOURAGING:
        return {
          piggy: '🐷',
          eyes: '💪',
          accent: '🌟',
          color: '#90EE90',
          glow: '#32CD32',
          message: "You've got this! Keep saving!"
        };

      default: // IDLE
        return {
          piggy: '🐷',
          eyes: '😌',
          accent: '💰',
          color: '#FFB6C1',
          glow: '#FF91A4',
          message: "Hi there! I'm MonT, your savings buddy!"
        };
    }
  };

  const stateData = getPiggyStateRepresentation();

  const getAnimatedStyle = () => {
    const bounce = animatedValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, -8, 0],
    });

    const rotate = rotateValue.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: ['-5deg', '0deg', '5deg'],
    });

    return {
      transform: [
        { translateY: bounce },
        { scale: pulseValue },
        { rotate: rotate }
      ]
    };
  };

  const getGlowStyle = () => ({
    shadowColor: stateData.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
  });

  return (
    <View style={[styles.container, style]}>
      {/* Main Piggy Container */}
      <Animated.View
        style={[
          styles.piggyContainer,
          currentSize,
          getAnimatedStyle(),
          getGlowStyle(),
          { backgroundColor: stateData.color + '20' } // Semi-transparent background
        ]}
      >
        {/* Base Piggy Bank */}
        <Text style={[styles.basePiggy, { fontSize: currentSize.fontSize * 2 }]}>
          {stateData.piggy}
        </Text>

        {/* Eyes Overlay */}
        <View style={styles.eyesOverlay}>
          <Text style={[styles.eyes, { fontSize: currentSize.fontSize }]}>
            {stateData.eyes}
          </Text>
        </View>

        {/* Accent/Mood Indicator */}
        <Animated.View
          style={[
            styles.accentOverlay,
            {
              opacity: animatedValue.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.7, 1, 0.7]
              })
            }
          ]}
        >
          <Text style={[styles.accent, { fontSize: currentSize.fontSize * 0.8 }]}>
            {stateData.accent}
          </Text>
        </Animated.View>

        {/* Celebration Particles */}
        {(currentState === MASCOT_STATES.CELEBRATING || 
          currentState === MASCOT_STATES.GOAL_ACHIEVED) && (
          <CelebrationParticles size={currentSize} />
        )}
      </Animated.View>

      {/* State Message (Optional) */}
      {/* Uncomment if you want to show messages */}
      {/* <Text style={styles.stateMessage}>{stateData.message}</Text> */}
    </View>
  );
};

// Celebration particle effect component
const CelebrationParticles = ({ size }) => {
  const particles = ['💰', '✨', '🌟', '💎', '🎯', '💵', '🎉', '🏆'];
  
  return (
    <View style={styles.particleContainer}>
      {particles.map((particle, index) => {
        const animatedValue = new Animated.Value(0);
        
        React.useEffect(() => {
          Animated.loop(
            Animated.timing(animatedValue, {
              toValue: 1,
              duration: 2000 + (index * 200), // Stagger animations
              useNativeDriver: true,
            })
          ).start();
        }, []);

        return (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                left: (Math.sin(index) * size.width * 0.3) + size.width * 0.5,
                top: (Math.cos(index) * size.height * 0.3) + size.height * 0.5,
                opacity: animatedValue.interpolate({
                  inputRange: [0, 0.3, 0.7, 1],
                  outputRange: [0, 1, 1, 0]
                }),
                transform: [{
                  scale: animatedValue.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1.2, 0]
                  })
                }, {
                  rotate: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }
            ]}
          >
            <Text style={styles.particleText}>{particle}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = {
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 10,
  },
  piggyContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    padding: 10,
  },
  basePiggy: {
    textAlign: 'center',
  },
  eyesOverlay: {
    position: 'absolute',
    top: '30%',
    alignItems: 'center',
  },
  eyes: {
    textAlign: 'center',
  },
  accentOverlay: {
    position: 'absolute',
    top: -15,
    right: -10,
  },
  accent: {
    textAlign: 'center',
  },
  particleContainer: {
    position: 'absolute',
    width: '200%',
    height: '200%',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
  },
  particleText: {
    fontSize: 16,
  },
  stateMessage: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    maxWidth: 200,
  },
};

export default MonTPiggyBankStates;
