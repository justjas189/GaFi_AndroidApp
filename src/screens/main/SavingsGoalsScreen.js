import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';

const SavingsGoalsScreen = () => {
  const { budget, expenses } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [achievements, setAchievements] = useState([]);
  const [progressAnimation] = useState(new Animated.Value(0));
  // Calculate savings progress with safety checks
  const totalExpenses = expenses ? expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0) : 0;
  const currentSavings = (budget?.monthly || 0) - totalExpenses;
  const savingsProgress = budget?.savingsGoal ? Math.min(100, (currentSavings / budget.savingsGoal) * 100) : 0;

  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: savingsProgress,
      duration: 1000,
      useNativeDriver: false
    }).start();
  }, [savingsProgress]);
  // Achievement definitions with safety checks
  const achievementsList = [
    {
      id: 'first-save',
      title: 'First Save',
      description: 'Save your first ₱1,000',
      icon: 'star-outline',
      threshold: 1000,
      points: 10
    },
    {
      id: 'consistent-saver',
      title: 'Consistent Saver',
      description: 'Stay under budget for 3 consecutive months',
      icon: 'trending-up-outline',
      points: 20,
      threshold: 0 // Will be checked separately
    },
    {
      id: 'super-saver',
      title: 'Super Saver',
      description: 'Save 50% of your monthly budget',
      icon: 'trophy-outline',
      threshold: (budget?.monthly || 0) * 0.5,
      points: 30
    },
    {
      id: 'goal-master',
      title: 'Goal Master',
      description: 'Reach your savings goal',
      icon: 'flag-outline',
      threshold: budget?.savingsGoal || 0,
      points: 50
    }
  ];

  // Check for new achievements
  useEffect(() => {
    const checkAchievements = () => {
      const newAchievements = [];

      if (currentSavings >= 1000 && !achievements.includes('first-save')) {
        newAchievements.push('first-save');
      }

      if (currentSavings >= budget.monthly * 0.5 && !achievements.includes('super-saver')) {
        newAchievements.push('super-saver');
      }

      if (currentSavings >= budget.savingsGoal && !achievements.includes('goal-master')) {
        newAchievements.push('goal-master');
      }

      if (newAchievements.length > 0) {
        setAchievements(prev => [...prev, ...newAchievements]);
        Alert.alert(
          '🎉 New Achievement!',
          'You\'ve unlocked new achievements! Check them out!'
        );
      }
    };

    checkAchievements();
  }, [currentSavings, budget]);

  const renderAchievement = (achievement) => {
    const isUnlocked = achievements.includes(achievement.id);
    return (
      <View
        key={achievement.id}
        style={[
          styles.achievementCard,
          { backgroundColor: theme.colors.card },
          isUnlocked && { borderColor: theme.colors.primary }
        ]}
      >
        <View style={[styles.achievementIcon, { backgroundColor: theme.colors.background }]}>
          <Ionicons
            name={achievement.icon}
            size={24}
            color={isUnlocked ? theme.colors.primary : theme.colors.text}
            style={{ opacity: isUnlocked ? 1 : 0.5 }}
          />
        </View>
        <View style={styles.achievementInfo}>
          <Text style={[styles.achievementTitle, { color: theme.colors.text }]}>
            {achievement.title}
          </Text>
          <Text style={[styles.achievementDescription, { color: theme.colors.text, opacity: 0.7 }]}>
            {achievement.description}
          </Text>
          <Text style={[styles.points, { color: isUnlocked ? theme.colors.primary : theme.colors.text, opacity: isUnlocked ? 1 : 0.5 }]}>
            {achievement.points} points
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>Savings Goals</Text>
      
      <ScrollView style={styles.content}>
        {/* Progress Circle */}
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressCircle,
              {
                width: progressAnimation.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%']
                })
              }
            ]}
          />
          <Text style={[styles.progressText, { color: theme.colors.text }]}>
            {savingsProgress.toFixed(1)}%
          </Text>
          <Text style={[styles.savingsText, { color: theme.colors.text }]}>
            ₱{currentSavings.toFixed(2)} / ₱{budget.savingsGoal.toFixed(2)}
          </Text>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsContainer}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Achievements
          </Text>
          {achievementsList.map(renderAchievement)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
  },
  content: {
    flex: 1,
  },
  progressContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 20,
  },
  progressCircle: {
    height: 200,
    backgroundColor: '#FF6B00',
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  savingsText: {
    fontSize: 18,
  },
  achievementsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  achievementCard: {
    flexDirection: 'row',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  achievementDescription: {
    fontSize: 14,
    marginBottom: 5,
  },
  points: {
    fontSize: 12,
    fontWeight: 'bold',
  }
});

export default SavingsGoalsScreen;
