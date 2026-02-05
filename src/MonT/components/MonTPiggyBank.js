import React from 'react';
import { View, Image, Animated, Easing } from 'react-native';
import { MASCOT_STATES } from '../constants/MascotStates';

// MonT Piggy Bank Avatar Component
// Uses the cute pink piggy bank as the base avatar for MonT
export const MonTPiggyBank = ({ 
  currentState = MASCOT_STATES.IDLE,
  size = 'medium',
  showAnimation = true,
  style = {}
}) => {
  const animatedValue = new Animated.Value(0);

  React.useEffect(() => {
    if (showAnimation) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [showAnimation]);

  // Size configurations
  const sizeConfig = {
    small: { width: 60, height: 60 },
    medium: { width: 100, height: 100 },
    large: { width: 150, height: 150 },
    xlarge: { width: 200, height: 200 }
  };

  const currentSize = sizeConfig[size] || sizeConfig.medium;

  // Animation transforms based on emotional state
  const getStateAnimation = () => {
    const bounce = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -10],
    });

    const scale = animatedValue.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [1, 1.1, 1],
    });

    const rotate = animatedValue.interpolate({
      inputRange: [0, 0.25, 0.75, 1],
      outputRange: ['0deg', '5deg', '-5deg', '0deg'],
    });

    switch (currentState) {
      case MASCOT_STATES.EXCITED:
      case MASCOT_STATES.CELEBRATING:
        return {
          transform: [
            { translateY: bounce },
            { scale: scale },
            { rotate: rotate }
          ]
        };
      
      case MASCOT_STATES.HAPPY:
      case MASCOT_STATES.GOAL_ACHIEVED:
        return {
          transform: [
            { scale: scale }
          ]
        };
      
      case MASCOT_STATES.THINKING:
      case MASCOT_STATES.FOCUSED:
        return {
          transform: [
            { rotate: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '3deg']
            })}
          ]
        };
      
      case MASCOT_STATES.WORRIED:
      case MASCOT_STATES.BUDGET_ALERT:
        return {
          transform: [
            { translateY: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 5]
            })},
            { rotate: animatedValue.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: ['-2deg', '2deg', '-2deg']
            })}
          ]
        };
      
      default:
        return {
          transform: [
            { scale: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.02]
            })}
          ]
        };
    }
  };

  // State-based visual effects
  const getStateEffects = () => {
    switch (currentState) {
      case MASCOT_STATES.CELEBRATING:
      case MASCOT_STATES.GOAL_ACHIEVED:
        return {
          shadowColor: '#FFD700',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 20,
          elevation: 10,
        };
      
      case MASCOT_STATES.EXCITED:
      case MASCOT_STATES.HAPPY:
        return {
          shadowColor: '#FF69B4',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 8,
        };
      
      case MASCOT_STATES.WORRIED:
      case MASCOT_STATES.BUDGET_ALERT:
        return {
          shadowColor: '#FF6B6B',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 5,
        };
      
      case MASCOT_STATES.THINKING:
      case MASCOT_STATES.FOCUSED:
        return {
          shadowColor: '#4ECDC4',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 6,
        };
      
      default:
        return {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        };
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.piggyContainer,
          currentSize,
          getStateAnimation(),
          getStateEffects()
        ]}
      >
        {/* Main Piggy Bank Image */}
        <Image
          source={{ uri: 'data:image/png;base64,YOUR_PIGGY_BANK_BASE64_HERE' }}
          style={[styles.piggyImage, currentSize]}
          resizeMode="contain"
        />
        
        {/* State-based overlay effects */}
        {renderStateOverlay()}
      </Animated.View>
      
      {/* Particle effects for celebrations */}
      {(currentState === MASCOT_STATES.CELEBRATING || 
        currentState === MASCOT_STATES.GOAL_ACHIEVED) && (
        <ParticleEffect />
      )}
    </View>
  );

  function renderStateOverlay() {
    switch (currentState) {
      case MASCOT_STATES.CELEBRATING:
      case MASCOT_STATES.GOAL_ACHIEVED:
        return (
          <View style={styles.celebrationOverlay}>
            <Animated.Text style={[
              styles.celebrationEmoji,
              { 
                opacity: animatedValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.5, 1, 0.5]
                })
              }
            ]}>
              ✨🎉✨
            </Animated.Text>
          </View>
        );
      
      case MASCOT_STATES.THINKING:
      case MASCOT_STATES.FOCUSED:
        return (
          <View style={styles.thoughtOverlay}>
            <Animated.Text style={[
              styles.thoughtEmoji,
              {
                opacity: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8]
                })
              }
            ]}>
              💭
            </Animated.Text>
          </View>
        );
      
      case MASCOT_STATES.WORRIED:
      case MASCOT_STATES.BUDGET_ALERT:
        return (
          <View style={styles.worriedOverlay}>
            <Animated.Text style={[
              styles.worriedEmoji,
              {
                opacity: animatedValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.4, 0.8, 0.4]
                })
              }
            ]}>
              😰
            </Animated.Text>
          </View>
        );
      
      case MASCOT_STATES.SLEEPING:
        return (
          <View style={styles.sleepingOverlay}>
            <Animated.Text style={[
              styles.sleepingEmoji,
              {
                opacity: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1]
                })
              }
            ]}>
              💤
            </Animated.Text>
          </View>
        );
      
      default:
        return null;
    }
  }

  function ParticleEffect() {
    return (
      <View style={styles.particleContainer}>
        {[...Array(6)].map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                left: Math.random() * currentSize.width,
                top: Math.random() * currentSize.height,
                opacity: animatedValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 1, 0]
                }),
                transform: [{
                  translateY: animatedValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -30]
                  })
                }]
              }
            ]}
          >
            <Text style={styles.particleText}>
              {['✨', '💰', '🌟', '💎', '🎯', '💵'][index]}
            </Text>
          </Animated.View>
        ))}
      </View>
    );
  }
};

const styles = {
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  piggyContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  piggyImage: {
    borderRadius: 10,
  },
  celebrationOverlay: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  thoughtOverlay: {
    position: 'absolute',
    top: -15,
    right: -15,
  },
  thoughtEmoji: {
    fontSize: 20,
  },
  worriedOverlay: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  worriedEmoji: {
    fontSize: 18,
  },
  sleepingOverlay: {
    position: 'absolute',
    top: -15,
    right: -5,
  },
  sleepingEmoji: {
    fontSize: 16,
  },
  particleContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
  },
  particleText: {
    fontSize: 16,
  },
};

export default MonTPiggyBank;
