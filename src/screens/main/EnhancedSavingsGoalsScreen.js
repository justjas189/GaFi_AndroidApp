import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Dimensions,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

// Safe service imports with fallbacks
let GamifiedSavingsService, AchievementService;
try {
  GamifiedSavingsService = require('../../services/GamifiedSavingsService').GamifiedSavingsService;
  AchievementService = require('../../services/AchievementService').AchievementService;
} catch (error) {
  console.error('Error loading services:', error);
  // Create mock services to prevent crashes
  GamifiedSavingsService = {
    getCurrentGamifiedGoal: () => Promise.resolve(null),
    getUserSavingsStats: () => Promise.resolve({}),
    getLevelConfigurations: () => Promise.resolve([]),
    getCompletedGoals: () => Promise.resolve([]),
    createGamifiedGoal: () => Promise.resolve({}),
    addToGamifiedGoal: () => Promise.resolve({})
  };
  AchievementService = {
    checkAndAwardAchievements: () => Promise.resolve([])
  };
}

const { width } = Dimensions.get('window');

const EnhancedSavingsGoalsScreen = () => {
  const { theme } = useTheme();
  const [currentGoal, setCurrentGoal] = useState(null);
  const [userStats, setUserStats] = useState({});
  const [levelConfigs, setLevelConfigs] = useState([]);
  const [completedGoals, setCompletedGoals] = useState([]);
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progressAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    loadSavingsData();
  }, []);

  const loadSavingsData = async () => {
    try {
      setLoading(true);
      const [goal, stats, configs, completed] = await Promise.all([
        GamifiedSavingsService.getCurrentGamifiedGoal(),
        GamifiedSavingsService.getUserSavingsStats(),
        GamifiedSavingsService.getLevelConfigurations(),
        GamifiedSavingsService.getCompletedGoals()
      ]);

      setCurrentGoal(goal);
      setUserStats(stats);
      setLevelConfigs(configs);
      setCompletedGoals(completed);

      // Animate progress bar
      if (goal) {
        const progress = goal.current_amount / goal.target_amount;
        Animated.timing(progressAnimation, {
          toValue: progress,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      }
    } catch (error) {
      console.error('Error loading savings data:', error);
      Alert.alert('Error', 'Failed to load savings data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavingsData();
    setRefreshing(false);
  };

  const startNewGoal = async (level, timelineDays = 90) => {
    try {
      const config = levelConfigs.find(c => c.level === level);
      if (!config) {
        Alert.alert('Error', 'Level configuration not found');
        return;
      }

      const goal = await GamifiedSavingsService.createGamifiedGoal(
        level,
        config.target_amount,
        timelineDays
      );

      setCurrentGoal(goal);
      setShowLevelSelector(false);
      
      // Check for achievements
      const achievements = await AchievementService.checkAndAwardAchievements(
        goal.user_id,
        'first_save'
      );
      
      if (achievements.length > 0) {
        showAchievementAlert(achievements);
      }

      Alert.alert('Success', `Started Level ${level} savings goal!`);
    } catch (error) {
      console.error('Error starting new goal:', error);
      Alert.alert('Error', 'Failed to start new goal');
    }
  };

  const addMoney = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const result = await GamifiedSavingsService.addToGamifiedGoal(
        parseFloat(amount),
        'Savings deposit'
      );

      setCurrentGoal(result.updatedGoal);
      setAmount('');
      setShowAddMoneyModal(false);

      // Update user stats
      const updatedStats = await GamifiedSavingsService.getUserSavingsStats();
      setUserStats(updatedStats);

      // Check for achievements
      const achievements = await AchievementService.checkAndAwardAchievements(
        result.updatedGoal.user_id,
        'savings_streak',
        { streakDays: updatedStats.streakDays }
      );

      if (result.isCompleted) {
        // Show celebration
        setCelebrationData(result.celebration);
        setShowCelebration(true);

        // Check level completion achievement
        const levelAchievements = await AchievementService.checkAndAwardAchievements(
          result.updatedGoal.user_id,
          'level_complete',
          { level: result.updatedGoal.level }
        );

        achievements.push(...levelAchievements);

        // Reload completed goals
        const completed = await GamifiedSavingsService.getCompletedGoals();
        setCompletedGoals(completed);
      }

      if (achievements.length > 0) {
        setTimeout(() => showAchievementAlert(achievements), result.isCompleted ? 2000 : 0);
      }

      Alert.alert('Success', `Added ₱${amount} to your savings!`);
    } catch (error) {
      console.error('Error adding money:', error);
      Alert.alert('Error', error.message || 'Failed to add money');
    }
  };

  const showAchievementAlert = (achievements) => {
    const achievement = achievements[0];
    Alert.alert(
      '🏆 Achievement Unlocked!',
      `${achievement.icon} ${achievement.title}\n${achievement.description}\n\n+${achievement.points} points!`,
      [{ text: 'Awesome!', style: 'default' }]
    );
  };

  const getLevelConfig = (level) => {
    return levelConfigs.find(config => config.level === level) || {
      title: `Level ${level}`,
      color: theme.colors.primary,
      icon: 'star',
      target_amount: 1000 * level
    };
  };

  const renderGamifiedProgress = () => {
    if (!currentGoal) return null;

    const config = getLevelConfig(currentGoal.level);
    const progress = currentGoal.current_amount / currentGoal.target_amount;
    const daysRemaining = Math.max(0, Math.ceil(
      (new Date(currentGoal.end_date) - new Date()) / (1000 * 60 * 60 * 24)
    ));

    return (
      <View style={[styles.gamifiedCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Gamified Progress
        </Text>
        
        <View style={[styles.levelCard, { backgroundColor: config.color }]}>
          <Text style={styles.levelTitle}>
            Level {currentGoal.level} - {config.title}
          </Text>
          <Text style={styles.levelAmount}>
            ₱{currentGoal.current_amount.toLocaleString()} / ₱{currentGoal.target_amount.toLocaleString()}
          </Text>
          
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                }
              ]}
            />
          </View>
          
          <Text style={styles.progressText}>
            {(progress * 100).toFixed(1)}% Complete
          </Text>
          
          <Text style={styles.daysRemaining}>
            {daysRemaining} days remaining
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {userStats.currentLevel}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>Level</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {userStats.goalsCompleted}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>Completed</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {userStats.streakDays}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.text }]}>Streak</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderUserProgress = () => {
    const totalPoints = userStats.goalsCompleted * 100 + userStats.currentLevel * 50;
    
    return (
      <View style={[styles.progressCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Progress</Text>
        
        <View style={styles.userProgressContent}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.avatarText}>
                {userStats.currentLevel}
              </Text>
            </View>
            <Text style={[styles.pointsText, { color: theme.colors.primary }]}>
              {totalPoints} pts
            </Text>
          </View>
          
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <Text style={[styles.progressNumber, { color: theme.colors.text }]}>
                ₱{userStats.totalSaved.toLocaleString()}
              </Text>
              <Text style={[styles.progressLabel, { color: theme.colors.text }]}>
                Total Saved
              </Text>
            </View>
            
            <View style={styles.progressStat}>
              <Text style={[styles.progressNumber, { color: theme.colors.text }]}>
                {userStats.goalsCompleted}
              </Text>
              <Text style={[styles.progressLabel, { color: theme.colors.text }]}>
                Goals Completed
              </Text>
            </View>
            
            <View style={styles.progressStat}>
              <Text style={[styles.progressNumber, { color: theme.colors.text }]}>
                {Math.round((userStats.totalSaved / (userStats.currentLevel * 2500)) * 100)}%
              </Text>
              <Text style={[styles.progressLabel, { color: theme.colors.text }]}>
                Overall Progress
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderLevelSelector = () => {
    return (
      <Modal
        visible={showLevelSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLevelSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Choose Your Level
            </Text>
            
            <ScrollView style={styles.levelOptions}>
              {levelConfigs.map((config) => (
                <TouchableOpacity
                  key={config.level}
                  style={[styles.levelOption, { backgroundColor: config.color }]}
                  onPress={() => startNewGoal(config.level)}
                >
                  <View style={styles.levelOptionContent}>
                    <Ionicons name={config.icon || 'star'} size={32} color="white" />
                    <View style={styles.levelInfo}>
                      <Text style={styles.levelOptionTitle}>
                        Level {config.level} - {config.title}
                      </Text>
                      <Text style={styles.levelOptionTarget}>
                        Target: ₱{config.target_amount.toLocaleString()}
                      </Text>
                      <Text style={styles.levelOptionDescription}>
                        {config.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.colors.border }]}
              onPress={() => setShowLevelSelector(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderAddMoneyModal = () => {
    return (
      <Modal
        visible={showAddMoneyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddMoneyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Add Money to Goal
            </Text>
            
            <TextInput
              style={[styles.amountInput, { 
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: theme.colors.border
              }]}
              placeholder="Enter amount (₱)"
              placeholderTextColor={theme.colors.text + '60'}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              autoFocus={true}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={addMoney}
              >
                <Text style={styles.modalButtonText}>Add Money</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => {
                  setShowAddMoneyModal(false);
                  setAmount('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderCelebrationModal = () => {
    return (
      <Modal
        visible={showCelebration}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCelebration(false)}
      >
        <View style={styles.celebrationOverlay}>
          <View style={[styles.celebrationContent, { backgroundColor: theme.colors.card }]}>
            <Text style={styles.celebrationEmoji}>
              {celebrationData?.emoji || '🎉'}
            </Text>
            <Text style={[styles.celebrationTitle, { color: theme.colors.text }]}>
              {celebrationData?.title || 'Level Completed!'}
            </Text>
            <Text style={[styles.celebrationMessage, { color: theme.colors.text }]}>
              {celebrationData?.message || 'Congratulations on completing your savings goal!'}
            </Text>
            
            <TouchableOpacity
              style={[styles.celebrationButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setShowCelebration(false);
                setCelebrationData(null);
              }}
            >
              <Text style={styles.celebrationButtonText}>AMAZING!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading savings goals...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Savings Goals</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {/* Navigate to leaderboard */}}
          >
            <Ionicons name="trophy" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowLevelSelector(true)}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {currentGoal ? renderGamifiedProgress() : (
          <View style={[styles.noGoalCard, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="trophy" size={48} color={theme.colors.primary} />
            <Text style={[styles.noGoalTitle, { color: theme.colors.text }]}>
              No active gamified goal
            </Text>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowLevelSelector(true)}
            >
              <Text style={styles.startButtonText}>Start Level 1</Text>
            </TouchableOpacity>
          </View>
        )}

        {renderUserProgress()}

        {currentGoal && (
          <TouchableOpacity
            style={[styles.addMoneyButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowAddMoneyModal(true)}
          >
            <Ionicons name="add-circle" size={24} color="white" />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>
        )}

        {completedGoals.length > 0 && (
          <View style={[styles.completedSection, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Your Goals ({completedGoals.length})
            </Text>
            {completedGoals.map((goal, index) => (
              <View key={goal.id} style={styles.completedGoal}>
                <Text style={[styles.completedGoalTitle, { color: theme.colors.text }]}>
                  Level {goal.level} - ₱{goal.target_amount.toLocaleString()}
                </Text>
                <Text style={[styles.completedGoalDate, { color: theme.colors.text + '80' }]}>
                  Completed {new Date(goal.completed_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {renderLevelSelector()}
      {renderAddMoneyModal()}
      {renderCelebrationModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  gamifiedCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  levelCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  levelTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  levelAmount: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 4,
  },
  progressText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  daysRemaining: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  progressCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  userProgressContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginRight: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressNumber: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  noGoalCard: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  noGoalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 16,
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  addMoneyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  completedSection: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  completedGoal: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  completedGoalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  completedGoalDate: {
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  levelOptions: {
    maxHeight: 400,
  },
  levelOption: {
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
  },
  levelOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelInfo: {
    marginLeft: 16,
    flex: 1,
  },
  levelOptionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  levelOptionTarget: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 4,
  },
  levelOptionDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  celebrationContent: {
    width: '80%',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
  },
  celebrationEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  celebrationMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  celebrationButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  celebrationButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EnhancedSavingsGoalsScreen;
