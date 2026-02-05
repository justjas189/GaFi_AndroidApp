import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MonTMascot } from '../../MonT/components/MascotSystem';
import { MASCOT_STATES } from '../../MonT/constants/MascotStates';

const { width } = Dimensions.get('window');

const SavingsGoal = ({ 
  goal = {
    id: 1,
    title: "Emergency Fund",
    target_amount: 50000,
    current_amount: 35000,
    category: "safety",
    target_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
  },
  onAddMoney,
  onGoalComplete 
}) => {
  const { colors } = useTheme();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [previousProgress, setPreviousProgress] = useState(0);
  
  // Animation refs
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Calculate progress
  const progress = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  const isCompleted = progress >= 100;
  const progressLevel = Math.floor(progress / 20) + 1; // 5 levels total
  
  // Calculate days left
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.target_date) - new Date()) / (1000 * 60 * 60 * 24)));
  
  // Gamification colors based on progress
  const getProgressColor = () => {
    if (progress < 20) return '#FF6B6B'; // Red - Just started
    if (progress < 40) return '#FF9F43'; // Orange - Getting there
    if (progress < 60) return '#FFA726'; // Yellow - Halfway
    if (progress < 80) return '#66BB6A'; // Light green - Almost there
    return '#4CAF50'; // Green - Almost complete/Complete
  };

  // Badge system
  const getBadgeForLevel = (level) => {
    const badges = {
      1: { emoji: '🌱', title: 'Starter', color: '#FF6B6B' },
      2: { emoji: '🌿', title: 'Grower', color: '#FF9F43' },
      3: { emoji: '🌳', title: 'Saver', color: '#FFA726' },
      4: { emoji: '🏆', title: 'Achiever', color: '#66BB6A' },
      5: { emoji: '💎', title: 'Master', color: '#4CAF50' }
    };
    return badges[level] || badges[1];
  };

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Trigger level up animation
  useEffect(() => {
    const currentLevel = Math.floor(progress / 20) + 1;
    const prevLevel = Math.floor(previousProgress / 20) + 1;
    
    if (currentLevel > prevLevel && progress > 0) {
      triggerLevelUpAnimation();
    }
    setPreviousProgress(progress);
  }, [progress]);

  // Pulse animation for active elements
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
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
    pulse.start();
    return () => pulse.stop();
  }, []);

  const triggerLevelUpAnimation = () => {
    setShowLevelUp(true);
    
    // Scale animation for level up
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Hide after animation completes
    setTimeout(() => {
      setShowLevelUp(false);
    }, 3000);
  };

  const handleAddMoney = () => {
    // Trigger scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    // If goal would be completed, show celebration
    const newAmount = goal.current_amount + 1000; // Example increment
    if (newAmount >= goal.target_amount) {
      Alert.alert(
        "🎉 Goal Achieved!",
        `Congratulations! You've reached your ${goal.title} goal!`,
        [{ text: "Awesome!", onPress: () => onGoalComplete && onGoalComplete(goal) }]
      );
    }
    
    if (onAddMoney) onAddMoney(1000);
  };

  const badge = getBadgeForLevel(progressLevel);

  return (
    <Animated.View style={[
      styles.container, 
      { 
        backgroundColor: colors.surface,
        transform: [{ scale: scaleAnim }]
      }
    ]}>
      {/* Header with Mascot */}
      <View style={styles.header}>
        <MonTMascot
          currentState={isCompleted ? MASCOT_STATES.CELEBRATING : MASCOT_STATES.HAPPY}
          size="medium"
          position="header"
          showBubble={isCompleted}
          bubbleText={isCompleted ? "Goal achieved! 🎉" : "Keep going! 💪"}
        />
        <View style={styles.goalInfo}>
          <Text style={[styles.goalTitle, { color: colors.text }]}>
            {goal.title}
          </Text>
          <Text style={[styles.goalCategory, { color: colors.textSecondary }]}>
            {goal.category} • {daysLeft} days left
          </Text>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        {/* Current Badge */}
        <Animated.View 
          style={[
            styles.badgeContainer,
            { 
              backgroundColor: badge.color + '20',
              borderColor: badge.color,
              transform: [{ scale: pulseAnim }]
            }
          ]}
        >
          <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
          <Text style={[styles.badgeTitle, { color: badge.color }]}>
            {badge.title}
          </Text>
          <Text style={[styles.badgeLevel, { color: colors.textSecondary }]}>
            Level {progressLevel}
          </Text>
        </Animated.View>

        {/* Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={[styles.currentAmount, { color: colors.primary }]}>
            ₱{goal.current_amount.toLocaleString()}
          </Text>
          <Text style={[styles.targetAmount, { color: colors.textSecondary }]}>
            of ₱{goal.target_amount.toLocaleString()}
          </Text>
          <Text style={[styles.progressPercent, { color: getProgressColor() }]}>
            {progress.toFixed(1)}% Complete
          </Text>
        </View>

        {/* Animated Progress Bar */}
        <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: getProgressColor(),
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
              }
            ]}
          />
          
          {/* Progress milestones */}
          {[20, 40, 60, 80].map((milestone, index) => (
            <View
              key={milestone}
              style={[
                styles.milestone,
                {
                  left: `${milestone}%`,
                  backgroundColor: progress >= milestone ? '#4CAF50' : colors.border,
                }
              ]}
            />
          ))}
        </View>

        {/* Level Progress Indicators */}
        <View style={styles.levelsContainer}>
          {[1, 2, 3, 4, 5].map((level) => {
            const levelBadge = getBadgeForLevel(level);
            const isActive = progressLevel >= level;
            return (
              <View
                key={level}
                style={[
                  styles.levelIndicator,
                  {
                    backgroundColor: isActive ? levelBadge.color : colors.border,
                    opacity: isActive ? 1 : 0.3,
                  }
                ]}
              >
                <Text style={styles.levelEmoji}>
                  {isActive ? levelBadge.emoji : '⭕'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Action Button */}
      <TouchableOpacity
        style={[
          styles.addMoneyButton,
          { backgroundColor: colors.primary }
        ]}
        onPress={handleAddMoney}
        activeOpacity={0.8}
      >
        <Text style={styles.addMoneyText}>Add ₱1,000 💰</Text>
      </TouchableOpacity>

      {/* Level Up Animation Overlay */}
      {showLevelUp && (
        <View style={styles.levelUpOverlay}>
          <View style={styles.levelUpContainer}>
            <Text style={styles.levelUpEmoji}>🎉</Text>
            <Text style={styles.levelUpText}>Level Up!</Text>
            <Text style={styles.levelUpSubtext}>
              You've reached {badge.title} level!
            </Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  goalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  goalCategory: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  progressSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badgeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 16,
    minWidth: 100,
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeLevel: {
    fontSize: 12,
  },
  amountContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  currentAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  targetAmount: {
    fontSize: 16,
    marginBottom: 8,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '600',
  },
  progressBarContainer: {
    width: width - 72,
    height: 12,
    borderRadius: 6,
    position: 'relative',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  milestone: {
    position: 'absolute',
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  levelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: width - 72,
  },
  levelIndicator: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  levelEmoji: {
    fontSize: 20,
  },
  addMoneyButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  addMoneyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  levelUpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  levelUpContainer: {
    alignItems: 'center',
    padding: 20,
  },
  levelUpEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  levelUpText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  levelUpSubtext: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
});

export default SavingsGoal;
