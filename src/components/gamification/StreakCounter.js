import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const StreakCounter = ({ currentStreak = 0, maxStreak = 30 }) => {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
    ]).start();
  }, []);

  const getStreakMessage = () => {
    if (currentStreak === 0) return "Start your streak today! 🚀";
    if (currentStreak < 7) return "Building momentum! 💪";
    if (currentStreak < 14) return "Great consistency! 🔥";
    if (currentStreak < 30) return "You're on fire! 🌟";
    return "Legendary streak! 👑";
  };

  const getStreakColor = () => {
    if (currentStreak === 0) return '#9CA3AF';
    if (currentStreak < 7) return '#F59E0B';
    if (currentStreak < 14) return '#EF4444';
    if (currentStreak < 30) return '#10B981';
    return '#8B5CF6';
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          backgroundColor: colors.surface,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Daily Streak
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {getStreakMessage()}
        </Text>
      </View>

      <View style={styles.streakDisplay}>
        <View style={[styles.streakBadge, { backgroundColor: getStreakColor() + '20', borderColor: getStreakColor() }]}>
          <Text style={styles.fireEmoji}>🔥</Text>
          <Text style={[styles.streakNumber, { color: getStreakColor() }]}>
            {currentStreak}
          </Text>
          <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>
            {currentStreak === 1 ? 'day' : 'days'}
          </Text>
        </View>
      </View>

      {/* Progress indicators for the week */}
      <View style={styles.weekProgress}>
        <Text style={[styles.weekLabel, { color: colors.textSecondary }]}>
          This Week
        </Text>
        <View style={styles.dotsContainer}>
          {[...Array(7)].map((_, i) => {
            const isActive = i < (currentStreak % 7);
            const isCompleted = currentStreak >= 7 && i < 7;
            return (
              <View
                key={i}
                style={[
                  styles.dayDot,
                  {
                    backgroundColor: isActive || isCompleted ? getStreakColor() : colors.border,
                    transform: [{ scale: isActive ? 1.2 : 1 }]
                  }
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* Monthly progress bar */}
      <View style={styles.monthlyProgress}>
        <Text style={[styles.monthLabel, { color: colors.textSecondary }]}>
          Monthly Progress
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: getStreakColor(),
                width: `${Math.min((currentStreak / maxStreak) * 100, 100)}%`,
              }
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {currentStreak} / {maxStreak} days
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
  },
  streakDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  streakBadge: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 120,
  },
  fireEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  weekProgress: {
    marginBottom: 20,
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  monthlyProgress: {
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    width: width - 72,
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
  },
});

export default StreakCounter;
