import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MascotService } from '../services/MascotService';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const GamificationDashboard = ({ userStats, onStatsUpdate }) => {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [achievements, setAchievements] = useState([]);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [streakBonus, setStreakBonus] = useState(0);

  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    loadGamificationData();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadGamificationData = async () => {
    try {
      // Load achievements based on user stats
      const newAchievements = calculateAchievements(userStats);
      setAchievements(newAchievements);

      // Load daily challenge
      const tip = await MascotService.getDailyTip('savings');
      setDailyChallenge({
        title: "Daily Savings Challenge",
        description: tip.tip,
        reward: "10 XP",
        completed: false
      });

      // Calculate streak bonus
      const bonus = Math.min(userStats?.currentStreak * 5, 50);
      setStreakBonus(bonus);
    } catch (error) {
      console.warn('Error loading gamification data:', error);
    }
  };

  const calculateAchievements = (stats) => {
    const achievements = [
      {
        id: 'first_save',
        title: 'First Save',
        description: 'Made your first savings deposit',
        icon: '🌱',
        unlocked: stats?.totalSavings > 0,
        xp: 10
      },
      {
        id: 'streak_warrior',
        title: 'Streak Warrior',
        description: 'Maintained a 7-day saving streak',
        icon: '🔥',
        unlocked: stats?.currentStreak >= 7,
        xp: 50
      },
      {
        id: 'goal_crusher',
        title: 'Goal Crusher',
        description: 'Achieved your first savings goal',
        icon: '🏆',
        unlocked: stats?.goalsAchieved > 0,
        xp: 100
      },
      {
        id: 'savings_master',
        title: 'Savings Master',
        description: 'Saved over ₱50,000',
        icon: '💰',
        unlocked: stats?.totalSavings >= 50000,
        xp: 200
      },
      {
        id: 'consistency_king',
        title: 'Consistency King',
        description: 'Maintained a 30-day streak',
        icon: '👑',
        unlocked: stats?.currentStreak >= 30,
        xp: 300
      }
    ];

    return achievements;
  };

  const calculateLevel = () => {
    const totalXP = achievements
      .filter(a => a.unlocked)
      .reduce((sum, a) => sum + a.xp, 0) + streakBonus;
    
    return Math.floor(totalXP / 100) + 1;
  };

  const calculateXPProgress = () => {
    const totalXP = achievements
      .filter(a => a.unlocked)
      .reduce((sum, a) => sum + a.xp, 0) + streakBonus;
    
    const currentLevelXP = totalXP % 100;
    return (currentLevelXP / 100) * 100;
  };

  const renderAchievement = (achievement) => (
    <View
      key={achievement.id}
      style={[
        styles.achievementCard,
        {
          backgroundColor: achievement.unlocked ? colors.success + '20' : colors.surface,
          borderColor: achievement.unlocked ? colors.success : colors.border
        }
      ]}
    >
      <Text style={styles.achievementIcon}>{achievement.icon}</Text>
      <View style={styles.achievementContent}>
        <Text style={[
          styles.achievementTitle,
          { 
            color: achievement.unlocked ? colors.text : colors.textSecondary,
            opacity: achievement.unlocked ? 1 : 0.6
          }
        ]}>
          {achievement.title}
        </Text>
        <Text style={[
          styles.achievementDescription,
          { 
            color: colors.textSecondary,
            opacity: achievement.unlocked ? 1 : 0.6
          }
        ]}>
          {achievement.description}
        </Text>
        <Text style={[styles.achievementXP, { color: colors.primary }]}>
          +{achievement.xp} XP
        </Text>
      </View>
      {achievement.unlocked && (
        <View style={[styles.unlockedBadge, { backgroundColor: colors.success }]}>
          <Text style={styles.unlockedText}>✓</Text>
        </View>
      )}
    </View>
  );

  const renderDailyChallenge = () => (
    <View style={[styles.challengeCard, { backgroundColor: colors.primary + '10' }]}>
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeIcon}>⚡</Text>
        <Text style={[styles.challengeTitle, { color: colors.text }]}>
          {dailyChallenge?.title}
        </Text>
      </View>
      <Text style={[styles.challengeDescription, { color: colors.textSecondary }]}>
        {dailyChallenge?.description}
      </Text>
      <View style={styles.challengeReward}>
        <Text style={[styles.rewardText, { color: colors.primary }]}>
          Reward: {dailyChallenge?.reward}
        </Text>
      </View>
    </View>
  );

  const level = calculateLevel();
  const xpProgress = calculateXPProgress();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Level Progress */}
        <View style={[styles.levelCard, { backgroundColor: colors.surface }]}>
          <View style={styles.levelHeader}>
            <Text style={[styles.levelTitle, { color: colors.text }]}>
              Level {level}
            </Text>
            <Text style={[styles.streakText, { color: colors.primary }]}>
              🔥 {userStats?.currentStreak || 0} day streak
            </Text>
          </View>
          
          <View style={styles.xpContainer}>
            <View style={[styles.xpTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.xpFill,
                  {
                    width: `${xpProgress}%`,
                    backgroundColor: colors.primary
                  }
                ]}
              />
            </View>
            <Text style={[styles.xpText, { color: colors.textSecondary }]}>
              {Math.round(xpProgress)}% to next level
            </Text>
          </View>

          {streakBonus > 0 && (
            <View style={[styles.bonusContainer, { backgroundColor: colors.accent + '20' }]}>
              <Text style={[styles.bonusText, { color: colors.accent }]}>
                🎉 Streak Bonus: +{streakBonus} XP
              </Text>
            </View>
          )}
        </View>

        {/* Daily Challenge */}
        {dailyChallenge && renderDailyChallenge()}

        {/* Achievements Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Achievements
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            {achievements.filter(a => a.unlocked).length} of {achievements.length} unlocked
          </Text>
        </View>

        {/* Achievement List */}
        <View style={styles.achievementsList}>
          {achievements.map(renderAchievement)}
        </View>

        {/* Stats Summary */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.statsTitle, { color: colors.text }]}>
            Your Progress
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                ₱{(userStats?.totalSavings || 0).toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Saved
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {userStats?.goalsAchieved || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Goals Achieved
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.accent }]}>
                {userStats?.currentStreak || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Day Streak
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  levelCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
  },
  xpContainer: {
    marginBottom: 12,
  },
  xpTrack: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  xpFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpText: {
    fontSize: 14,
    textAlign: 'center',
  },
  bonusContainer: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bonusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  challengeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  challengeDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  challengeReward: {
    alignItems: 'flex-end',
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  achievementsList: {
    marginBottom: 16,
  },
  achievementCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  achievementIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  achievementXP: {
    fontSize: 12,
    fontWeight: '600',
  },
  unlockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default GamificationDashboard;
