import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Alert,
  Modal,
  TextInput,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import SavingsGoalsDatabaseService from '../../services/SavingsGoalsDatabaseService';

const { width, height } = Dimensions.get('window');

// Sample goals data for students
const predefinedGoals = [
  {
    id: 'laptop',
    title: 'New Laptop',
    description: 'Save for a new laptop for school',
    targetAmount: 45000,
    icon: 'laptop-outline',
    color: '#4CAF50',
    category: 'Education',
    timeline: '8 months'
  },
  {
    id: 'emergency',
    title: 'Emergency Fund',
    description: 'Build a safety net for unexpected expenses',
    targetAmount: 15000,
    icon: 'shield-checkmark-outline',
    color: '#FF9800',
    category: 'Security',
    timeline: '6 months'
  },
  {
    id: 'vacation',
    title: 'Summer Vacation',
    description: 'Save for a trip with friends',
    targetAmount: 20000,
    icon: 'airplane-outline',
    color: '#2196F3',
    category: 'Lifestyle',
    timeline: '10 months'
  },
  {
    id: 'graduation',
    title: 'Graduation Fund',
    description: 'Save for graduation expenses and celebration',
    targetAmount: 12000,
    icon: 'school-outline',
    color: '#9C27B0',
    category: 'Education',
    timeline: '12 months'
  }
];

const SavingsGoalsScreen = () => {
  const { budget, expenses } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const { userInfo } = useContext(AuthContext);
  const [achievements, setAchievements] = useState([]);
  const [progressAnimation] = useState(new Animated.Value(0));
  const [goals, setGoals] = useState([]);
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showGoalDetailModal, setShowGoalDetailModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetAmount: '',
    timeline: '',
    icon: 'flag-outline',
    color: '#4CAF50'
  });
  const [totalSaved, setTotalSaved] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Add Money Modal States
  const [showAddMoneyModal, setShowAddMoneyModal] = useState(false);
  const [selectedGoalForMoney, setSelectedGoalForMoney] = useState(null);
  const [moneyAmount, setMoneyAmount] = useState('');
  const [moneyNote, setMoneyNote] = useState('');

  useEffect(() => {
    if (userInfo) {
      loadGoals();
      loadAchievements();
    }
  }, [userInfo]);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const userGoals = await SavingsGoalsDatabaseService.getUserSavingsGoals();
      setGoals(userGoals);
      console.log('Loaded user-specific goals:', userGoals.length);
    } catch (error) {
      console.error('Error loading goals:', error);
      Alert.alert('Error', 'Failed to load your savings goals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAchievements = async () => {
    try {
      const userAchievements = await SavingsGoalsDatabaseService.getUserAchievements();
      setAchievements(userAchievements);
      console.log('Loaded user achievements:', userAchievements.length);
    } catch (error) {
      console.error('Error loading achievements:', error);
    }
  };

  const saveGoals = async (newGoals) => {
    // This function is no longer needed as goals are saved directly to database
    // Keeping for compatibility with existing code
    console.log('Goals are now automatically saved to database');
  };

  const saveAchievements = async (newAchievements) => {
    // This function is no longer needed as achievements are saved directly to database
    // Keeping for compatibility with existing code
    console.log('Achievements are now automatically saved to database');
  };
  
  // Calculate total progress and savings
  useEffect(() => {
    const total = goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0);
    setTotalSaved(total);
    
    const overallProgress = goals.length > 0 
      ? goals.reduce((sum, goal) => sum + Math.min(100, (goal.currentAmount / goal.targetAmount) * 100), 0) / goals.length
      : 0;

    Animated.timing(progressAnimation, {
      toValue: overallProgress,
      duration: 1000,
      useNativeDriver: false
    }).start();
  }, [goals]);

  const addNewGoal = async () => {
    if (!newGoal.title || !newGoal.targetAmount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const goalData = {
        ...newGoal,
        targetAmount: parseFloat(newGoal.targetAmount),
        category: newGoal.category || 'General'
      };

      const createdGoal = await SavingsGoalsDatabaseService.createSavingsGoal(goalData);
      
      // Add to local state
      setGoals(prevGoals => [...prevGoals, createdGoal]);
      
      // Reset form
      setNewGoal({
        title: '',
        description: '',
        targetAmount: '',
        timeline: '',
        icon: 'flag-outline',
        color: '#4CAF50'
      });
      setShowAddGoalModal(false);
      
      Alert.alert('Success', `"${createdGoal.title}" goal created successfully!`);
      
      // Check for first goal achievement
      checkAchievements([...goals, createdGoal]);
      
    } catch (error) {
      console.error('Error creating goal:', error);
      Alert.alert('Error', 'Failed to create your savings goal. Please try again.');
    }
  };

  const addMoneyToGoal = async (goalId, amount) => {
    // This function is now handled by handleAddMoney through the database service
    // Keeping for backward compatibility
    console.log('Use handleAddMoney instead for database operations');
  };

  // Open add money modal
  const openAddMoneyModal = (goal) => {
    setSelectedGoalForMoney(goal);
    setMoneyAmount('');
    setMoneyNote('');
    setShowAddMoneyModal(true);
  };

  // Handle adding money through the modal
  const handleAddMoney = async () => {
    const amount = parseFloat(moneyAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    if (!selectedGoalForMoney) {
      Alert.alert('Error', 'No goal selected');
      return;
    }

    try {
      // Add money to the goal via database service
      const updatedGoal = await SavingsGoalsDatabaseService.addMoneyToGoal(
        selectedGoalForMoney.id, 
        amount, 
        moneyNote
      );
      
      // Update local state
      setGoals(prevGoals => 
        prevGoals.map(goal => 
          goal.id === selectedGoalForMoney.id ? updatedGoal : goal
        )
      );
      
      // Close modal and reset
      setShowAddMoneyModal(false);
      setSelectedGoalForMoney(null);
      setMoneyAmount('');
      setMoneyNote('');
      
      // Check if goal was completed
      if (updatedGoal.currentAmount >= updatedGoal.targetAmount && 
          selectedGoalForMoney.currentAmount < selectedGoalForMoney.targetAmount) {
        Alert.alert(
          '🎉 Goal Completed!',
          `Congratulations! You've reached your savings goal for "${updatedGoal.title}"!`,
          [{ text: 'Awesome!', style: 'default' }]
        );
        checkAchievements(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      } else {
        // Show success message
        Alert.alert(
          'Money Added!',
          `₱${amount.toLocaleString()} has been added to "${updatedGoal.title}"`,
          [{ text: 'Great!', style: 'default' }]
        );
      }
      
      // Check for achievements
      checkAchievements(goals.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      
    } catch (error) {
      console.error('Error adding money to goal:', error);
      Alert.alert('Error', 'Failed to add money to your goal. Please try again.');
    }
  };

  const deleteGoal = async (goalId) => {
    Alert.alert(
      'Delete Goal',
      'Are you sure you want to delete this savings goal? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await SavingsGoalsDatabaseService.deleteSavingsGoal(goalId);
              setGoals(prevGoals => prevGoals.filter(goal => goal.id !== goalId));
              Alert.alert('Success', 'Savings goal deleted successfully');
            } catch (error) {
              console.error('Error deleting goal:', error);
              Alert.alert('Error', 'Failed to delete the goal. Please try again.');
            }
          }
        }
      ]
    );
  };
  // Enhanced achievement system
  const achievementsList = [
    {
      id: 'first-goal',
      title: 'Goal Setter',
      description: 'Create your first savings goal',
      icon: 'flag-outline',
      threshold: 1,
      points: 10
    },
    {
      id: 'first-save',
      title: 'First Deposit',
      description: 'Make your first deposit of ₱500',
      icon: 'cash-outline',
      threshold: 500,
      points: 15
    },
    {
      id: 'consistent-saver',
      title: 'Consistent Saver',
      description: 'Save money for 7 consecutive days',
      icon: 'trending-up-outline',
      points: 25,
      threshold: 0
    },
    {
      id: 'milestone-5k',
      title: '5K Milestone',
      description: 'Save a total of ₱5,000',
      icon: 'medal-outline',
      threshold: 5000,
      points: 30
    },
    {
      id: 'goal-achiever',
      title: 'Goal Achiever',
      description: 'Complete your first savings goal',
      icon: 'trophy-outline',
      threshold: 0,
      points: 50
    },
    {
      id: 'super-saver',
      title: 'Super Saver',
      description: 'Save a total of ₱25,000',
      icon: 'diamond-outline',
      threshold: 25000,
      points: 100
    }
  ];

  const checkAchievements = async (currentGoals = goals) => {
    try {
      const newAchievements = [];
      const completedGoals = currentGoals.filter(goal => goal.currentAmount >= goal.targetAmount);
      
      // Check goal-based achievements
      if (currentGoals.length >= 1 && !achievements.includes('first-goal')) {
        newAchievements.push({ id: 'first-goal', ...achievementsList.find(a => a.id === 'first-goal') });
      }
      
      if (totalSaved >= 500 && !achievements.includes('first-save')) {
        newAchievements.push({ id: 'first-save', ...achievementsList.find(a => a.id === 'first-save') });
      }
      
      if (totalSaved >= 5000 && !achievements.includes('milestone-5k')) {
        newAchievements.push({ id: 'milestone-5k', ...achievementsList.find(a => a.id === 'milestone-5k') });
      }
      
      if (totalSaved >= 25000 && !achievements.includes('super-saver')) {
        newAchievements.push({ id: 'super-saver', ...achievementsList.find(a => a.id === 'super-saver') });
      }
      
      if (completedGoals.length >= 1 && !achievements.includes('goal-achiever')) {
        newAchievements.push({ id: 'goal-achiever', ...achievementsList.find(a => a.id === 'goal-achiever') });
      }

      // Add new achievements to database
      if (newAchievements.length > 0) {
        for (const achievement of newAchievements) {
          await SavingsGoalsDatabaseService.addUserAchievement(achievement.id, achievement);
        }
        
        // Update local state
        const newAchievementIds = newAchievements.map(a => a.id);
        setAchievements(prev => [...prev, ...newAchievementIds]);
        
        Alert.alert(
          '🏆 Achievement Unlocked!',
          `You've earned ${newAchievements.length} new achievement${newAchievements.length > 1 ? 's' : ''}!`
        );
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  };

  // Check achievements when goals or total saved changes
  useEffect(() => {
    checkAchievements();
  }, [goals, totalSaved]);

  const renderGoalCard = (goal) => {
    const progress = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
    const isCompleted = goal.currentAmount >= goal.targetAmount;
    
    return (
      <TouchableOpacity
        key={goal.id}
        style={[
          styles.goalCard,
          { backgroundColor: theme.colors.card },
          isCompleted && { borderColor: goal.color, borderWidth: 2 }
        ]}
        onPress={() => {
          setSelectedGoal(goal);
          setShowGoalDetailModal(true);
        }}
      >
        <View style={styles.goalHeader}>
          <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
            <Ionicons name={goal.icon} size={24} color={goal.color} />
          </View>
          <View style={styles.goalInfo}>
            <Text style={[styles.goalTitle, { color: theme.colors.text }]}>
              {goal.title}
            </Text>
            <Text style={[styles.goalCategory, { color: theme.colors.text + 'CC' }]}>
              {goal.category} • {goal.timeline}
            </Text>
          </View>
          {isCompleted && (
            <Ionicons name="checkmark-circle" size={24} color={goal.color} />
          )}
        </View>
        
        <Text style={[styles.goalDescription, { color: theme.colors.text + 'CC' }]}>
          {goal.description}
        </Text>
        
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, { color: theme.colors.text }]}>
              ₱{goal.currentAmount.toLocaleString()} / ₱{goal.targetAmount.toLocaleString()}
            </Text>
            <Text style={[styles.progressPercent, { color: goal.color }]}>
              {progress.toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: goal.color,
                  width: `${progress}%`
                }
              ]}
            />
          </View>
        </View>
        
        <View style={styles.goalActions}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: goal.color }]}
            onPress={() => openAddMoneyModal(goal)}
          >
            <Ionicons name="add" size={16} color="white" />
            <Text style={styles.addButtonText}>Add Money</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAchievement = (achievement) => {
    const isUnlocked = achievements.includes(achievement.id);
    return (
      <TouchableOpacity
        key={achievement.id}
        style={[
          styles.achievementCard,
          { backgroundColor: theme.colors.card },
          isUnlocked && { borderColor: theme.colors.primary, borderWidth: 2 }
        ]}
      >
        <View style={[styles.achievementIcon, { backgroundColor: isUnlocked ? theme.colors.primary + '20' : theme.colors.background }]}>
          <Ionicons
            name={achievement.icon}
            size={24}
            color={isUnlocked ? theme.colors.primary : theme.colors.text + '80'}
          />
        </View>
        <View style={styles.achievementInfo}>
          <View style={styles.achievementHeader}>
            <Text style={[styles.achievementTitle, { color: theme.colors.text }]}>
              {achievement.title}
            </Text>
            {isUnlocked && (
              <View style={[styles.pointsBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.pointsText}>+{achievement.points}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.achievementDescription, { color: theme.colors.text + 'CC' }]}>
            {achievement.description}
          </Text>
          {!isUnlocked && (
            <Text style={[styles.lockedText, { color: theme.colors.text + '80' }]}>
              🔒 {achievement.points} points when unlocked
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const totalPoints = achievements.reduce((sum, achievementId) => {
    const achievement = achievementsList.find(a => a.id === achievementId);
    return sum + (achievement ? achievement.points : 0);
  }, 0);

  const overallProgress = goals.length > 0 
    ? goals.reduce((sum, goal) => sum + Math.min(100, (goal.currentAmount / goal.targetAmount) * 100), 0) / goals.length
    : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Savings Goals</Text>
        <TouchableOpacity
          style={[styles.addGoalButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowAddGoalModal(true)}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Overview Card */}
        <View style={[styles.overviewCard, { backgroundColor: theme.colors.card }]}>
          <View style={styles.overviewHeader}>
            <Text style={[styles.overviewTitle, { color: theme.colors.text }]}>
              Your Progress
            </Text>
            <View style={[styles.pointsBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.pointsText}>{totalPoints} pts</Text>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                ₱{totalSaved.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text + 'CC' }]}>
                Total Saved
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                {goals.filter(g => g.currentAmount >= g.targetAmount).length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text + 'CC' }]}>
                Goals Completed
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                {overallProgress.toFixed(0)}%
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.text + 'CC' }]}>
                Overall Progress
              </Text>
            </View>
          </View>
          
          <View style={[styles.overallProgressBar, { backgroundColor: theme.colors.border }]}>
            <Animated.View
              style={[
                styles.overallProgressFill,
                {
                  backgroundColor: theme.colors.primary,
                  width: progressAnimation.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%']
                  })
                }
              ]}
            />
          </View>
        </View>

        {/* Goals Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Your Goals ({goals.length})
          </Text>
          {goals.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.card }]}>
              <Ionicons name="flag-outline" size={48} color={theme.colors.text + '40'} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No Goals Yet
              </Text>
              <Text style={[styles.emptyDescription, { color: theme.colors.text + 'CC' }]}>
                Create your first savings goal to start your journey!
              </Text>
            </View>
          ) : (
            goals.map(renderGoalCard)
          )}
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Achievements ({achievements.length}/{achievementsList.length})
          </Text>
          {achievementsList.map(renderAchievement)}
        </View>
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal
        visible={showAddGoalModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddGoalModal(false)}>
              <Text style={[styles.modalCancel, { color: theme.colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>New Goal</Text>
            <TouchableOpacity onPress={addNewGoal}>
              <Text style={[styles.modalSave, { color: theme.colors.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Goal Title *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={newGoal.title}
                onChangeText={(text) => setNewGoal({...newGoal, title: text})}
                placeholder="e.g., New Laptop"
                placeholderTextColor={theme.colors.text + '80'}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.card, color: theme.colors.text, height: 80 }]}
                value={newGoal.description}
                onChangeText={(text) => setNewGoal({...newGoal, description: text})}
                placeholder="What are you saving for?"
                placeholderTextColor={theme.colors.text + '80'}
                multiline
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Target Amount *</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={newGoal.targetAmount}
                onChangeText={(text) => setNewGoal({...newGoal, targetAmount: text})}
                placeholder="25000"
                placeholderTextColor={theme.colors.text + '80'}
                keyboardType="numeric"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Timeline</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                value={newGoal.timeline}
                onChangeText={(text) => setNewGoal({...newGoal, timeline: text})}
                placeholder="6 months"
                placeholderTextColor={theme.colors.text + '80'}
              />
            </View>
            
            {/* Quick Goals */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Quick Templates</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickGoals}>
                {predefinedGoals.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[styles.quickGoalCard, { backgroundColor: template.color + '20' }]}
                    onPress={() => setNewGoal({
                      title: template.title,
                      description: template.description,
                      targetAmount: template.targetAmount.toString(),
                      timeline: template.timeline,
                      icon: template.icon,
                      color: template.color
                    })}
                  >
                    <Ionicons name={template.icon} size={24} color={template.color} />
                    <Text style={[styles.quickGoalTitle, { color: theme.colors.text }]}>
                      {template.title}
                    </Text>
                    <Text style={[styles.quickGoalAmount, { color: template.color }]}>
                      ₱{template.targetAmount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Goal Detail Modal */}
      <Modal
        visible={showGoalDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowGoalDetailModal(false)}>
              <Text style={[styles.modalCancel, { color: theme.colors.primary }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Goal Details</Text>
            <TouchableOpacity onPress={() => deleteGoal(selectedGoal?.id)}>
              <Ionicons name="trash-outline" size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
          
          {selectedGoal && (
            <ScrollView style={styles.modalContent}>
              <View style={[styles.goalDetailCard, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.goalDetailIcon, { backgroundColor: selectedGoal.color + '20' }]}>
                  <Ionicons name={selectedGoal.icon} size={32} color={selectedGoal.color} />
                </View>
                <Text style={[styles.goalDetailTitle, { color: theme.colors.text }]}>
                  {selectedGoal.title}
                </Text>
                <Text style={[styles.goalDetailDescription, { color: theme.colors.text + 'CC' }]}>
                  {selectedGoal.description}
                </Text>
                
                <View style={styles.goalDetailStats}>
                  <View style={styles.goalDetailStat}>
                    <Text style={[styles.goalDetailStatValue, { color: selectedGoal.color }]}>
                      ₱{selectedGoal.currentAmount.toLocaleString()}
                    </Text>
                    <Text style={[styles.goalDetailStatLabel, { color: theme.colors.text + 'CC' }]}>
                      Current Amount
                    </Text>
                  </View>
                  <View style={styles.goalDetailStat}>
                    <Text style={[styles.goalDetailStatValue, { color: selectedGoal.color }]}>
                      ₱{(selectedGoal.targetAmount - selectedGoal.currentAmount).toLocaleString()}
                    </Text>
                    <Text style={[styles.goalDetailStatLabel, { color: theme.colors.text + 'CC' }]}>
                      Remaining
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.progressBar, { backgroundColor: theme.colors.border, marginVertical: 16 }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: selectedGoal.color,
                        width: `${Math.min(100, (selectedGoal.currentAmount / selectedGoal.targetAmount) * 100)}%`
                      }
                    ]}
                  />
                </View>
                
                <TouchableOpacity
                  style={[styles.addMoneyButton, { backgroundColor: selectedGoal.color }]}
                  onPress={() => {
                    setShowGoalDetailModal(false);
                    openAddMoneyModal(selectedGoal);
                  }}
                >
                  <Ionicons name="add-circle" size={20} color="white" />
                  <Text style={styles.addMoneyButtonText}>Add Money to Goal</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Add Money Modal */}
      <Modal
        visible={showAddMoneyModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddMoneyModal(false)}>
              <Text style={[styles.modalCancel, { color: theme.colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Money</Text>
            <TouchableOpacity onPress={handleAddMoney}>
              <Text style={[styles.modalSave, { color: theme.colors.primary }]}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {selectedGoalForMoney && (
            <ScrollView style={styles.modalContent}>
              {/* Goal Summary */}
              <View style={[styles.goalSummaryCard, { backgroundColor: theme.colors.card }]}>
                <View style={[styles.goalSummaryIcon, { backgroundColor: selectedGoalForMoney.color + '20' }]}>
                  <Ionicons name={selectedGoalForMoney.icon} size={24} color={selectedGoalForMoney.color} />
                </View>
                <View style={styles.goalSummaryInfo}>
                  <Text style={[styles.goalSummaryTitle, { color: theme.colors.text }]}>
                    {selectedGoalForMoney.title}
                  </Text>
                  <Text style={[styles.goalSummaryProgress, { color: theme.colors.text + 'CC' }]}>
                    ₱{selectedGoalForMoney.currentAmount.toLocaleString()} / ₱{selectedGoalForMoney.targetAmount.toLocaleString()}
                  </Text>
                  <View style={[styles.progressBar, { backgroundColor: theme.colors.border, marginTop: 8 }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: selectedGoalForMoney.color,
                          width: `${Math.min(100, (selectedGoalForMoney.currentAmount / selectedGoalForMoney.targetAmount) * 100)}%`
                        }
                      ]}
                    />
                  </View>
                </View>
              </View>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Amount to Add *</Text>
                <View style={[styles.currencyInput, { backgroundColor: theme.colors.card }]}>
                  <Text style={[styles.currencySymbol, { color: theme.colors.text }]}>₱</Text>
                  <TextInput
                    style={[styles.amountInput, { color: theme.colors.text }]}
                    value={moneyAmount}
                    onChangeText={setMoneyAmount}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.text + '80'}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Note Input (Optional) */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Note (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
                  value={moneyNote}
                  onChangeText={setMoneyNote}
                  placeholder="e.g., Birthday money, part-time job earnings"
                  placeholderTextColor={theme.colors.text + '80'}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Quick Amount Buttons */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Quick Add</Text>
                <View style={styles.quickAmountContainer}>
                  {[100, 500, 1000, 2000, 5000].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[styles.quickAmountButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                      onPress={() => setMoneyAmount(amount.toString())}
                    >
                      <Text style={[styles.quickAmountText, { color: theme.colors.text }]}>
                        ₱{amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Prediction */}
              {moneyAmount && parseFloat(moneyAmount) > 0 && (
                <View style={[styles.predictionCard, { backgroundColor: selectedGoalForMoney.color + '10' }]}>
                  <Text style={[styles.predictionTitle, { color: selectedGoalForMoney.color }]}>
                    After adding ₱{parseFloat(moneyAmount).toLocaleString()}:
                  </Text>
                  <Text style={[styles.predictionText, { color: theme.colors.text }]}>
                    New total: ₱{(selectedGoalForMoney.currentAmount + parseFloat(moneyAmount)).toLocaleString()}
                  </Text>
                  <Text style={[styles.predictionText, { color: theme.colors.text }]}>
                    Remaining: ₱{Math.max(0, selectedGoalForMoney.targetAmount - selectedGoalForMoney.currentAmount - parseFloat(moneyAmount)).toLocaleString()}
                  </Text>
                  {(selectedGoalForMoney.currentAmount + parseFloat(moneyAmount)) >= selectedGoalForMoney.targetAmount && (
                    <Text style={[styles.completionText, { color: selectedGoalForMoney.color }]}>
                      🎉 You'll complete this goal!
                    </Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addGoalButton: {
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
  overviewCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  overallProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  goalCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  goalCategory: {
    fontSize: 12,
  },
  goalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  achievementCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  achievementDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lockedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCancel: {
    fontSize: 16,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickGoals: {
    marginTop: 8,
  },
  quickGoalCard: {
    width: 120,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  quickGoalTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  quickGoalAmount: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  goalDetailCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  goalDetailIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalDetailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  goalDetailDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  goalDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  goalDetailStat: {
    alignItems: 'center',
  },
  goalDetailStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  goalDetailStatLabel: {
    fontSize: 12,
  },
  addMoneyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
  },
  addMoneyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Add Money Modal Styles
  goalSummaryCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
  },
  goalSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  goalSummaryInfo: {
    flex: 1,
  },
  goalSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  goalSummaryProgress: {
    fontSize: 14,
    marginBottom: 4,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 16,
  },
  quickAmountContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  quickAmountButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  predictionCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  predictionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  predictionText: {
    fontSize: 14,
    marginBottom: 4,
  },
  completionText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default SavingsGoalsScreen;
