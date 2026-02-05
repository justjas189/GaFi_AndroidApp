import React, { useState, useEffect } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Learning Levels Configuration
const LEARNING_LEVELS = {
  1: {
    level: 1,
    title: 'Budgeting Basics',
    description: 'Master budget management while saving ₱500',
    savingsGoal: 500,
    badge: '🎓',
    color: '#4CAF50',
    topics: [
      {
        id: 'division',
        title: 'Budget Division',
        icon: 'pie-chart',
        description: 'Learn the 50/30/20 rule',
        practicalTip: 'Save ₱100 by dividing your money: ₱50 for needs, ₱30 for wants, ₱20 for savings.',
      },
      {
        id: 'diversification',
        title: 'Diversification',
        icon: 'scatter-plot',
        description: 'Spread your budget wisely',
        practicalTip: 'Save ₱100 by not spending all money in one category. Keep emergency reserves.',
      },
    ],
  },
  2: {
    level: 2,
    title: 'Goal Setting',
    description: 'Set financial goals while saving ₱1,000',
    savingsGoal: 1000,
    badge: '🎯',
    color: '#2196F3',
    topics: [
      {
        id: 'inflation',
        title: 'Understanding Inflation',
        icon: 'trending-up',
        description: 'How inflation affects your money',
        practicalTip: 'Save ₱200 by buying essentials now before prices increase.',
      },
      {
        id: 'risk-return',
        title: 'Risk-Return Tradeoff',
        icon: 'balance-scale',
        description: 'Balance risk and reward',
        practicalTip: 'Save ₱300 by choosing stable savings over risky spending.',
      },
    ],
  },
  3: {
    level: 3,
    title: 'Savings Mastery',
    description: 'Grow your wealth while saving ₱2,000',
    savingsGoal: 2000,
    badge: '💰',
    color: '#FF9800',
    topics: [
      {
        id: 'simple-interest',
        title: 'Simple Interest',
        icon: 'attach-money',
        description: 'Calculate your earnings',
        practicalTip: 'Save ₱500 and learn how it grows with simple interest.',
      },
      {
        id: 'compound-interest',
        title: 'Compound Interest',
        icon: 'layers',
        description: 'The power of compound growth',
        practicalTip: 'Save ₱700 and see how compound interest multiplies your money.',
      },
    ],
  },
};

// Topic Content with Practical Lessons
const TOPIC_LESSONS = {
  division: {
    title: 'Budget Division: The 50/30/20 Rule',
    sections: [
      {
        heading: '💡 What is Budget Division?',
        content: 'Budget division helps you allocate your income wisely using the 50/30/20 rule:',
      },
      {
        heading: '50% for Needs',
        content: 'Essential expenses like food, rent, utilities, transportation. These are things you MUST have to survive.',
        examples: ['Rice and groceries', 'Rent/Housing', 'Electricity and water', 'School fees'],
      },
      {
        heading: '30% for Wants',
        content: 'Things that make life enjoyable but aren\'t essential. You can live without these.',
        examples: ['Eating out', 'Entertainment/Movies', 'Shopping for clothes', 'Gaming/Hobbies'],
      },
      {
        heading: '20% for Savings',
        content: 'Money set aside for future goals, emergencies, and investments.',
        examples: ['Emergency fund', 'Future goals', 'Investments', 'Debt repayment'],
      },
      {
        heading: '🎯 Your Challenge',
        content: 'Save ₱100 this week by following the 50/30/20 rule. Track where every peso goes!',
        action: 'Start by listing your income and dividing it into these three categories.',
      },
    ],
  },
  diversification: {
    title: 'Diversification: Don\'t Put All Eggs in One Basket',
    sections: [
      {
        heading: '🥚 What is Diversification?',
        content: 'Spreading your money across different categories to reduce risk and stay balanced.',
      },
      {
        heading: 'Why It Matters',
        content: 'If you spend all your money on one thing and something goes wrong, you\'re in trouble. Diversification protects you.',
        examples: [
          'Don\'t spend all food budget on fast food',
          'Keep some cash, some in digital wallet',
          'Split savings between goals',
          'Have backup emergency money',
        ],
      },
      {
        heading: '📊 Practical Example',
        content: 'Instead of spending ₱500 all on entertainment in one weekend:\n• ₱200 for movies this week\n• ₱150 for next week\'s outing\n• ₱100 for unexpected fun\n• ₱50 emergency reserve',
      },
      {
        heading: '🎯 Your Challenge',
        content: 'Save ₱100 by diversifying your spending this week. Don\'t spend more than 40% of any category in one day!',
        action: 'Create mini-budgets for each category and stick to them.',
      },
    ],
  },
  inflation: {
    title: 'Understanding Inflation',
    sections: [
      {
        heading: '📈 What is Inflation?',
        content: 'Inflation is when prices increase over time, making your money worth less.',
      },
      {
        heading: 'Real-Life Example',
        content: 'Remember when a bag of chips was ₱10? Now it\'s ₱15. That\'s inflation!',
        examples: [
          'Rice: Was ₱40/kg, now ₱55/kg',
          'Jeepney fare: Was ₱8, now ₱13',
          'Soft drinks: Was ₱15, now ₱25',
        ],
      },
      {
        heading: '💪 How to Beat Inflation',
        content: 'Your savings need to grow faster than inflation. Here\'s how:',
        examples: [
          'Invest, don\'t just save cash',
          'Buy essentials when prices are low',
          'Learn to budget for price increases',
          'Find ways to earn more',
        ],
      },
      {
        heading: '🎯 Your Challenge',
        content: 'Save ₱200 by buying wisely. Compare prices and stock up on essentials when they\'re on sale!',
      },
    ],
  },
  'risk-return': {
    title: 'Risk-Return Tradeoff',
    sections: [
      {
        heading: '⚖️ What is Risk-Return?',
        content: 'The balance between how much risk you take and how much reward you expect.',
      },
      {
        heading: 'Low Risk, Low Return',
        content: 'Safe but slow growth.',
        examples: ['Piggy bank: Very safe, no growth', 'Savings account: Safe, small interest', 'Lending to friends: Some risk, some return'],
      },
      {
        heading: 'High Risk, High Return',
        content: 'Potentially great rewards but you could lose money.',
        examples: ['Starting a business: High risk, high reward', 'Stocks: Can gain or lose', 'Gambling: Very high risk, usually lose'],
      },
      {
        heading: '🎯 Your Challenge',
        content: 'Save ₱300 by choosing low-risk options. Don\'t gamble or lend money you need. Keep your savings safe!',
        action: 'Put your money in a safe place where you won\'t be tempted to spend it.',
      },
    ],
  },
  'simple-interest': {
    title: 'Simple Interest',
    sections: [
      {
        heading: '💵 What is Simple Interest?',
        content: 'Money you earn (or pay) based on your original amount, calculated over time.',
      },
      {
        heading: 'The Formula',
        content: 'Interest = Principal × Rate × Time\n\nExample: ₱1,000 at 5% for 1 year\nInterest = ₱1,000 × 0.05 × 1 = ₱50',
      },
      {
        heading: 'Real-Life Example',
        content: 'If you save ₱500 in a bank with 3% annual interest:\n• After 1 year: ₱500 + ₱15 = ₱515\n• After 2 years: ₱500 + ₱30 = ₱530',
      },
      {
        heading: '🎯 Your Challenge',
        content: 'Save ₱500 and find a safe place that earns interest. Even small interest adds up!',
      },
    ],
  },
  'compound-interest': {
    title: 'Compound Interest: Money Makes Money',
    sections: [
      {
        heading: '🚀 What is Compound Interest?',
        content: 'Interest earned on both your original money AND the interest you already earned. Your money grows faster!',
      },
      {
        heading: 'The Power of Compounding',
        content: 'Example: ₱1,000 at 10% annual compound interest\n• Year 1: ₱1,000 + ₱100 = ₱1,100\n• Year 2: ₱1,100 + ₱110 = ₱1,210\n• Year 3: ₱1,210 + ₱121 = ₱1,331',
      },
      {
        heading: 'Simple vs Compound',
        content: 'Simple Interest (₱1,000 at 10% for 3 years): ₱1,300\nCompound Interest (₱1,000 at 10% for 3 years): ₱1,331\n\nExtra ₱31 just by compounding!',
      },
      {
        heading: '🎯 Your Challenge',
        content: 'Save ₱700 and let it grow with compound interest. Start early, save regularly!',
        action: 'Find savings accounts or investments that offer compound interest.',
      },
    ],
  },
};

export default function GamificationScreen({ navigation }) {
  const { theme } = useTheme();
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentSavings, setCurrentSavings] = useState(0);
  const [completedTopics, setCompletedTopics] = useState([]);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [showAddSavingsModal, setShowAddSavingsModal] = useState(false);
  const [savingsAmount, setSavingsAmount] = useState('');
  const [savingsNote, setSavingsNote] = useState('');

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const progress = await AsyncStorage.getItem('gamificationProgress');
      if (progress) {
        const data = JSON.parse(progress);
        setCurrentLevel(data.level || 1);
        setCurrentSavings(data.savings || 0);
        setCompletedTopics(data.completedTopics || []);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const saveProgress = async (level, savings, topics) => {
    try {
      await AsyncStorage.setItem('gamificationProgress', JSON.stringify({
        level,
        savings,
        completedTopics: topics,
        lastUpdated: new Date().toISOString(),
      }));
      setCurrentLevel(level);
      setCurrentSavings(savings);
      setCompletedTopics(topics);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleAddSavings = () => {
    const amount = parseFloat(savingsAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid savings amount.');
      return;
    }

    const newSavings = currentSavings + amount;
    const levelData = LEARNING_LEVELS[currentLevel];

    // Check if level completed
    if (newSavings >= levelData.savingsGoal && currentSavings < levelData.savingsGoal) {
      Alert.alert(
        '🎉 Level Complete!',
        `Congratulations! You've saved ₱${levelData.savingsGoal} and completed Level ${currentLevel}: ${levelData.title}!\n\nYou're ready for the next level!`,
        [
          {
            text: 'Continue',
            onPress: () => {
              const nextLevel = currentLevel + 1 <= 3 ? currentLevel + 1 : currentLevel;
              saveProgress(nextLevel, newSavings, completedTopics);
            },
          },
        ]
      );
    } else {
      saveProgress(currentLevel, newSavings, completedTopics);
      Alert.alert('Great Job! 💰', `You've added ₱${amount} to your savings!\n\nTotal saved: ₱${newSavings.toFixed(2)}`);
    }

    setSavingsAmount('');
    setSavingsNote('');
    setShowAddSavingsModal(false);
  };

  const handleTopicComplete = (topicId) => {
    if (completedTopics.includes(topicId)) {
      Alert.alert('Already Completed', 'You\'ve already completed this topic! Great job! 🎉');
      return;
    }

    Alert.alert(
      'Topic Complete! ✅',
      'You\'ve learned this topic! Now apply it to reach your savings goal.',
      [
        {
          text: 'Add Savings',
          onPress: () => {
            setShowLessonModal(false);
            setTimeout(() => setShowAddSavingsModal(true), 300);
          },
        },
        { text: 'Continue Learning', style: 'cancel' },
      ]
    );

    const newCompleted = [...completedTopics, topicId];
    saveProgress(currentLevel, currentSavings, newCompleted);
  };

  const renderLevelCard = () => {
    const levelData = LEARNING_LEVELS[currentLevel];
    const progress = (currentSavings / levelData.savingsGoal) * 100;

    return (
      <View style={[styles.levelCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.levelHeader}>
          <View style={[styles.levelBadge, { backgroundColor: levelData.color + '20' }]}>
            <Text style={styles.levelBadgeEmoji}>{levelData.badge}</Text>
          </View>
          <View style={styles.levelHeaderText}>
            <Text style={[styles.levelTitle, { color: theme.colors.text }]}>
              Level {levelData.level}: {levelData.title}
            </Text>
            <Text style={[styles.levelDescription, { color: theme.colors.textSecondary }]}>
              {levelData.description}
            </Text>
          </View>
        </View>

        {/* Savings Progress */}
        <View style={styles.savingsProgress}>
          <View style={styles.savingsHeader}>
            <Text style={[styles.savingsLabel, { color: theme.colors.text }]}>
              Your Savings Goal
            </Text>
            <Text style={[styles.savingsAmount, { color: levelData.color }]}>
              ₱{currentSavings.toFixed(2)} / ₱{levelData.savingsGoal}
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: levelData.color,
                  width: `${Math.min(progress, 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>
            {progress.toFixed(1)}% Complete
          </Text>
        </View>

        {/* Add Savings Button */}
        <TouchableOpacity
          style={[styles.addSavingsButton, { backgroundColor: levelData.color }]}
          onPress={() => setShowAddSavingsModal(true)}
        >
          <Ionicons name="add-circle" size={20} color="white" />
          <Text style={styles.addSavingsText}>Add Savings</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTopics = () => {
    const levelData = LEARNING_LEVELS[currentLevel];

    return (
      <View style={styles.topicsSection}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Learning Topics
        </Text>
        {levelData.topics.map((topic, index) => {
          const isCompleted = completedTopics.includes(topic.id);

          return (
            <TouchableOpacity
              key={topic.id}
              style={[styles.topicCard, { backgroundColor: theme.colors.card }]}
              onPress={() => {
                setSelectedTopic(topic);
                setShowLessonModal(true);
              }}
            >
              <View style={[styles.topicIcon, { backgroundColor: levelData.color + '20' }]}>
                <MaterialIcons name={topic.icon} size={28} color={levelData.color} />
              </View>

              <View style={styles.topicContent}>
                <View style={styles.topicHeader}>
                  <Text style={[styles.topicTitle, { color: theme.colors.text }]}>
                    {topic.title}
                  </Text>
                  {isCompleted && (
                    <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  )}
                </View>
                <Text style={[styles.topicDescription, { color: theme.colors.textSecondary }]}>
                  {topic.description}
                </Text>
                <View style={[styles.practicalTip, { backgroundColor: levelData.color + '10' }]}>
                  <Ionicons name="bulb" size={16} color={levelData.color} />
                  <Text style={[styles.practicalTipText, { color: theme.colors.text }]}>
                    {topic.practicalTip}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderLessonModal = () => {
    if (!selectedTopic) return null;

    const lessonContent = TOPIC_LESSONS[selectedTopic.id];
    const levelData = LEARNING_LEVELS[currentLevel];
    const isCompleted = completedTopics.includes(selectedTopic.id);

    return (
      <Modal
        visible={showLessonModal}
        animationType="slide"
        onRequestClose={() => setShowLessonModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.card }]}>
            <TouchableOpacity onPress={() => setShowLessonModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {lessonContent.title}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Content */}
          <ScrollView style={styles.lessonContent} showsVerticalScrollIndicator={false}>
            {lessonContent.sections.map((section, index) => (
              <View key={index} style={styles.lessonSection}>
                <Text style={[styles.lessonHeading, { color: levelData.color }]}>
                  {section.heading}
                </Text>
                <Text style={[styles.lessonText, { color: theme.colors.text }]}>
                  {section.content}
                </Text>

                {section.examples && (
                  <View style={styles.examplesList}>
                    {section.examples.map((example, idx) => (
                      <View key={idx} style={styles.exampleItem}>
                        <Text style={[styles.bullet, { color: levelData.color }]}>•</Text>
                        <Text style={[styles.exampleText, { color: theme.colors.textSecondary }]}>
                          {example}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {section.action && (
                  <View style={[styles.actionBox, { backgroundColor: levelData.color + '10' }]}>
                    <Ionicons name="rocket" size={20} color={levelData.color} />
                    <Text style={[styles.actionText, { color: theme.colors.text }]}>
                      {section.action}
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {/* Complete Topic Button */}
            <TouchableOpacity
              style={[
                styles.completeButton,
                {
                  backgroundColor: isCompleted ? '#4CAF50' : levelData.color,
                },
              ]}
              onPress={() => handleTopicComplete(selectedTopic.id)}
              disabled={isCompleted}
            >
              <Ionicons
                name={isCompleted ? 'checkmark-circle' : 'bookmark'}
                size={20}
                color="white"
              />
              <Text style={styles.completeButtonText}>
                {isCompleted ? 'Completed!' : 'Mark as Complete'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderAddSavingsModal = () => {
    const levelData = LEARNING_LEVELS[currentLevel];

    return (
      <Modal
        visible={showAddSavingsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddSavingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.savingsModalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.savingsModalTitle, { color: theme.colors.text }]}>
              Add Savings 💰
            </Text>

            <Text style={[styles.savingsModalSubtitle, { color: theme.colors.textSecondary }]}>
              Track your progress toward ₱{levelData.savingsGoal}
            </Text>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>Amount</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="Enter amount (e.g., 50)"
                placeholderTextColor={theme.colors.textSecondary + '80'}
                keyboardType="numeric"
                value={savingsAmount}
                onChangeText={setSavingsAmount}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
                Note (Optional)
              </Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
                placeholder="What did you save from?"
                placeholderTextColor={theme.colors.textSecondary + '80'}
                value={savingsNote}
                onChangeText={setSavingsNote}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: theme.colors.border }]}
                onPress={() => {
                  setShowAddSavingsModal(false);
                  setSavingsAmount('');
                  setSavingsNote('');
                }}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: levelData.color }]}
                onPress={handleAddSavings}
              >
                <Text style={styles.saveButtonText}>Add Savings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          Financial Literacy
        </Text>
        <TouchableOpacity
          style={[styles.infoButton, { backgroundColor: theme.colors.primary + '20' }]}
          onPress={() => {
            Alert.alert(
              'How It Works',
              'Learn financial concepts while saving real money!\n\n' +
              '1. Study each topic\n' +
              '2. Apply what you learn\n' +
              '3. Save money toward your goal\n' +
              '4. Complete the level!\n\n' +
              'Each level teaches you while building good money habits.',
              [{ text: 'Got It!' }]
            );
          }}
        >
          <Ionicons name="help-circle" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderLevelCard()}
        {renderTopics()}

        {/* Encouragement Section */}
        <View style={[styles.encouragementCard, { backgroundColor: theme.colors.card }]}>
          <Text style={styles.encouragementEmoji}>🐷</Text>
          <Text style={[styles.encouragementTitle, { color: theme.colors.text }]}>
            Koin's Wisdom
          </Text>
          <Text style={[styles.encouragementText, { color: theme.colors.textSecondary }]}>
            {currentSavings === 0
              ? "Every financial journey starts with the first peso saved. You've got this!"
              : currentSavings >= LEARNING_LEVELS[currentLevel].savingsGoal
              ? "Amazing! You've reached your goal! Ready for the next challenge?"
              : "Great progress! Every small saving brings you closer to your goal. Keep going!"}
          </Text>
        </View>
      </ScrollView>

      {renderLessonModal()}
      {renderAddSavingsModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 45,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  levelCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  levelBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  levelBadgeEmoji: {
    fontSize: 32,
  },
  levelHeaderText: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  levelDescription: {
    fontSize: 14,
  },
  savingsProgress: {
    marginBottom: 16,
  },
  savingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savingsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  savingsAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  addSavingsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  addSavingsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  topicsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  topicCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  topicIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  topicContent: {
    flex: 1,
  },
  topicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  topicDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  practicalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  practicalTipText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  encouragementCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  encouragementEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  encouragementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  encouragementText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  lessonContent: {
    flex: 1,
    padding: 20,
  },
  lessonSection: {
    marginBottom: 24,
  },
  lessonHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  lessonText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 12,
  },
  examplesList: {
    marginTop: 8,
  },
  exampleItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 18,
    marginRight: 8,
    fontWeight: 'bold',
  },
  exampleText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  actionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 10,
  },
  actionText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
    lineHeight: 20,
  },
  completeButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 32,
    gap: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Add Savings Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  savingsModalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  savingsModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  savingsModalSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
