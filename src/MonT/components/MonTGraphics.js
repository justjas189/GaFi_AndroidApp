// MonT Graphics Engine - Game-style mascot graphics system
import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// MonT Character States with corresponding graphics
export const MONT_GRAPHICS = {
  // Basic emotions
  IDLE: {
    emoji: '🤖',
    description: 'Default calm state',
    fallbackIcon: 'android',
    animation: 'subtle-breathing'
  },
  HAPPY: {
    emoji: '😊',
    description: 'Pleased and content',
    fallbackIcon: 'sentiment-satisfied',
    animation: 'bounce'
  },
  EXCITED: {
    emoji: '🤩',
    description: 'Very enthusiastic',
    fallbackIcon: 'star',
    animation: 'shake-excitement'
  },
  CELEBRATING: {
    emoji: '🎉',
    description: 'Major celebration mode',
    fallbackIcon: 'celebration',
    animation: 'victory-dance'
  },
  THINKING: {
    emoji: '🤔',
    description: 'Processing information',
    fallbackIcon: 'psychology',
    animation: 'head-tilt'
  },
  ENCOURAGING: {
    emoji: '💪',
    description: 'Motivational support',
    fallbackIcon: 'fitness-center',
    animation: 'cheer'
  },
  WORRIED: {
    emoji: '😟',
    description: 'Concerned about user',
    fallbackIcon: 'sentiment-dissatisfied',
    animation: 'subtle-worry'
  },
  SLEEPING: {
    emoji: '😴',
    description: 'User inactive',
    fallbackIcon: 'bedtime',
    animation: 'sleep-breathing'
  },
  SURPRISED: {
    emoji: '😲',
    description: 'Shocked reaction',
    fallbackIcon: 'sentiment-very-satisfied',
    animation: 'surprise-jump'
  },
  FOCUSED: {
    emoji: '🎯',
    description: 'Goal-oriented mode',
    fallbackIcon: 'gps-fixed',
    animation: 'focus-intensity'
  }
};

// MonT Graphics Component with multiple rendering modes
export const MonTGraphics = ({ 
  state = 'IDLE', 
  size = 60, 
  useImages = false, 
  imageSource = null,
  style = {},
  animating = false 
}) => {
  const graphicInfo = MONT_GRAPHICS[state] || MONT_GRAPHICS.IDLE;

  // Priority order: Custom Image > Generated Image > Vector Icon > Emoji
  if (useImages && imageSource) {
    return (
      <View style={[styles.graphicsContainer, { width: size, height: size }, style]}>
        <Image 
          source={imageSource}
          style={[styles.mascotImage, { width: size, height: size }]}
          resizeMode="contain"
        />
        {animating && <View style={styles.animationOverlay} />}
      </View>
    );
  }

  // Fallback to Material Icons (better than emoji for consistency)
  return (
    <View style={[styles.graphicsContainer, { width: size, height: size }, style]}>
      <MaterialIcons 
        name={graphicInfo.fallbackIcon} 
        size={size * 0.7} 
        color="#2196F3"
        style={styles.iconGraphic}
      />
      {animating && <View style={styles.animationOverlay} />}
    </View>
  );
};

// Game-style MonT with customizable appearance
export const GameStyleMonT = ({ 
  state = 'IDLE', 
  size = 80, 
  color = '#2196F3',
  accessories = [],
  showExpression = true,
  style = {} 
}) => {
  const graphicInfo = MONT_GRAPHICS[state] || MONT_GRAPHICS.IDLE;

  return (
    <View style={[styles.gameCharacter, { width: size, height: size }, style]}>
      {/* Main Body */}
      <View style={[styles.mascotBody, { 
        width: size * 0.8, 
        height: size * 0.8, 
        backgroundColor: color,
        borderRadius: size * 0.4 
      }]}>
        {/* Face/Expression */}
        {showExpression && (
          <View style={styles.faceContainer}>
            <MaterialIcons 
              name={graphicInfo.fallbackIcon} 
              size={size * 0.4} 
              color="white"
            />
          </View>
        )}
      </View>

      {/* Accessories (could be coins, badges, etc.) */}
      {accessories.map((accessory, index) => (
        <View 
          key={index} 
          style={[styles.accessory, accessory.position]}
        >
          <MaterialIcons 
            name={accessory.icon} 
            size={size * 0.2} 
            color={accessory.color || '#FFD700'}
          />
        </View>
      ))}
    </View>
  );
};

// Advanced MonT with Lottie-style animation placeholders
export const AdvancedMonT = ({ 
  state = 'IDLE', 
  size = 100, 
  theme = 'modern',
  showParticles = false,
  style = {} 
}) => {
  const graphicInfo = MONT_GRAPHICS[state] || MONT_GRAPHICS.IDLE;

  return (
    <View style={[styles.advancedContainer, { width: size, height: size }, style]}>
      {/* Background Glow Effect */}
      <View style={[styles.glowEffect, { 
        width: size * 1.2, 
        height: size * 1.2,
        borderRadius: size * 0.6 
      }]} />

      {/* Main Character */}
      <View style={[styles.mainCharacter, { 
        width: size, 
        height: size,
        borderRadius: size * 0.5 
      }]}>
        <MaterialIcons 
          name={graphicInfo.fallbackIcon} 
          size={size * 0.6} 
          color="white"
        />
      </View>

      {/* Particle Effects for Celebrations */}
      {showParticles && state === 'CELEBRATING' && (
        <View style={styles.particleContainer}>
          {[...Array(6)].map((_, i) => (
            <View 
              key={i} 
              style={[styles.particle, { 
                top: Math.random() * size,
                left: Math.random() * size 
              }]}
            >
              <Text style={styles.particleEmoji}>✨</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  graphicsContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mascotImage: {
    borderRadius: 8,
  },
  iconGraphic: {
    textAlign: 'center',
  },
  animationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  gameCharacter: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mascotBody: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  faceContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessory: {
    position: 'absolute',
  },
  advancedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  glowEffect: {
    position: 'absolute',
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  mainCharacter: {
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  particleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particleEmoji: {
    fontSize: 16,
  },
});

export default MonTGraphics;
