import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const financialTips = [
  {
    id: '1',
    title: 'Student Budget Hack',
    description: 'Follow the 70/20/10 rule: 70% for monthly expenses, 20% for savings, and 10% for personal enjoyment.',
    icon: 'school-outline',
    category: 'Student Life',
  },
  {
    id: '2',
    title: 'Side Hustle',
    description: 'Explore part-time work or freelancing opportunities that fit around your class schedule.',
    icon: 'briefcase-outline',
    category: 'Income',
  },
  {
    id: '3',
    title: 'Textbook Savings',
    description: 'Save money by buying used books, renting, or using digital versions. Compare prices online!',
    icon: 'book-outline',
    category: 'Education',
  },
  {
    id: '4',
    title: 'Food Budget',
    description: 'Learn to cook simple meals and use student discounts. Meal prep can save both time and money!',
    icon: 'restaurant-outline',
    category: 'Daily Life',
  },
  {
    id: '5',
    title: 'Smart Shopping',
    description: 'Use student discounts, buy during sales, and always compare prices before making big purchases.',
    icon: 'cart-outline',
    category: 'Shopping',
  },
  {
    id: '6',
    title: 'Emergency Fund',
    description: 'Start small! Even saving ₱500 per month can build a safety net for unexpected expenses.',
    icon: 'umbrella-outline',
    category: 'Savings',
  }
];

const modules = [
  {
    id: '1',
    title: 'College Finance 101',
    lessons: [
      'Managing Your Allowance',
      'Student Discounts & Benefits',
      'Balancing Studies & Part-time Work'
    ],
    progress: 0,
    icon: 'school-outline',
  },
  {
    id: '2',
    title: 'Daily Money Management',
    lessons: [
      'Smart Food Budgeting',
      'Transportation Savings',
      'Entertainment on a Budget'
    ],
    progress: 0,
    icon: 'wallet-outline',
  },
  {
    id: '3',
    title: 'Digital Money Skills',
    lessons: [
      'Mobile Banking Basics',
      'Online Shopping Tips',
      'Avoiding Online Scams'
    ],
    progress: 0,
    icon: 'phone-portrait-outline',
  },
  {
    id: '4',
    title: 'Future Planning',
    lessons: [
      'Starting to Invest Early',
      'Building Credit Wisely',
      'Planning for Graduation'
    ],
    progress: 0,
    icon: 'trending-up-outline',
  }
];

const LearnScreen = () => {
  const { theme } = useContext(ThemeContext);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Student Life', 'Daily Life', 'Education', 'Income', 'Shopping', 'Savings'];

  const renderTipCard = (tip) => (
    <TouchableOpacity
      key={tip.id}
      style={[styles.tipCard, { backgroundColor: theme.colors.card }]}
    >
      <View style={styles.tipHeader}>
        <View style={[styles.tipIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name={tip.icon} size={24} color={theme.colors.primary} />
        </View>
        <Text style={[styles.tipCategory, { color: theme.colors.primary }]}>
          {tip.category}
        </Text>
      </View>
      <Text style={[styles.tipTitle, { color: theme.colors.text }]}>{tip.title}</Text>
      <Text style={[styles.tipDescription, { color: theme.colors.text + 'CC' }]}>
        {tip.description}
      </Text>
    </TouchableOpacity>
  );

  const renderModuleCard = (module) => (
    <TouchableOpacity
      key={module.id}
      style={[styles.moduleCard, { backgroundColor: theme.colors.card }]}
    >
      <View style={styles.moduleHeader}>
        <View style={[styles.moduleIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name={module.icon} size={32} color={theme.colors.primary} />
        </View>
        <View style={styles.moduleProgress}>
          <Text style={[styles.moduleTitle, { color: theme.colors.text }]}>{module.title}</Text>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { 
                  width: `${module.progress}%`,
                  backgroundColor: theme.colors.primary 
                }
              ]}
            />
          </View>
        </View>
      </View>
      <View style={styles.lessonList}>
        {module.lessons.map((lesson, index) => (
          <View key={index} style={styles.lessonItem}>
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color={theme.colors.text + '80'}
            />
            <Text style={[styles.lessonText, { color: theme.colors.text + 'CC' }]}>
              {lesson}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Learn</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Quick Financial Tips
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tipsContainer}
          >
            {financialTips.map(renderTipCard)}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Learning Modules
          </Text>
          <View style={styles.modulesContainer}>
            {modules.map(renderModuleCard)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  tipsContainer: {
    paddingHorizontal: 20,
  },
  tipCard: {
    width: width * 0.7,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipCategory: {
    fontSize: 14,
    fontWeight: '600',
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tipDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  modulesContainer: {
    paddingHorizontal: 20,
  },
  moduleCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  moduleHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  moduleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  moduleProgress: {
    flex: 1,
    justifyContent: 'center',
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  lessonList: {
    marginTop: 8,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lessonText: {
    marginLeft: 8,
    fontSize: 14,
  },
});

export default LearnScreen;
