// screens/main/HomeScreen.js
import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  SectionList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';

const HomeScreen = ({ navigation }) => {
  const { userInfo } = useContext(AuthContext);
  const { 
    budget, 
    expenses, 
    calculateTotalExpenses, 
    getExpensesByDateRange,
    generateInsights,
    insights: contextInsights
  } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  
  const [refreshing, setRefreshing] = useState(false);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [insights, setInsights] = useState([]);

  // Get current date information
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysLeft = lastDayOfMonth - currentDay + 1; // +1 to include current day
  const daysInMonth = lastDayOfMonth;
  
  // Get expenses for different periods
  const getThisWeekExpenses = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    return getExpensesByDateRange(startOfWeek, endOfWeek);
  };
  
  const getThisMonthExpenses = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return getExpensesByDateRange(startOfMonth, endOfMonth);
  };
  
  // Calculate spending metrics
  const monthlyExpenses = getThisMonthExpenses();
  const monthlySpent = calculateTotalExpenses(monthlyExpenses);
  const monthlyRemaining = budget.monthly - monthlySpent;
  
  // Calculate daily budgets
  const idealDailyBudget = budget.monthly / daysInMonth; // What you should spend per day
  const actualDailyBudget = monthlyRemaining / daysLeft; // What you can spend per day to stay within budget
  const dailyBudget = monthlyRemaining > 0 ? actualDailyBudget : 0;
  
  const averageDailySpent = monthlySpent / currentDay; // How much you've been spending per day
  
  // Add this to insights if needed
  useEffect(() => {
    if (monthlyRemaining > 0 && actualDailyBudget < idealDailyBudget) {
      const newInsight = {
        message: `Your daily spending limit (₱${actualDailyBudget.toFixed(2)}) is below your ideal daily budget (₱${idealDailyBudget.toFixed(2)}). Try to reduce expenses to stay on track.`,
        icon: 'alert-circle-outline',
        color: '#FFA500'
      };
      // Add this insight to your insights array if not already present
      if (!insights.some(insight => insight.message === newInsight.message)) {
        setInsights(prev => [newInsight, ...prev]);
      }
    }
  }, [monthlyRemaining, actualDailyBudget, idealDailyBudget]);

  useEffect(() => {
    const sortedExpenses = [...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    setRecentExpenses(sortedExpenses);
    
    // Update insights from context
    setInsights(contextInsights || []);
  }, [expenses, contextInsights]);
  
  const onRefresh = () => {
    setRefreshing(true);
    const sortedExpenses = [...expenses]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    setRecentExpenses(sortedExpenses);
    const newInsights = generateInsights();
    setInsights(newInsights);
    setRefreshing(false);
  };
  
  const formatCurrency = (amount) => {
    return '₱' + parseFloat(amount).toFixed(2);
  };
  
  const getCategoryIcon = (category) => {
    const categoryMap = {
      food: 'fast-food-outline',
      transportation: 'bus-outline',
      entertainment: 'film-outline',
      shopping: 'cart-outline',
      utilities: 'build-outline',
      others: 'apps-outline'
    };
    return categoryMap[category.toLowerCase()] || 'apps-outline';
  };

  const sections = useMemo(() => [
    {
      title: 'Insights',
      data: insights,
      renderItem: ({ item: insight }) => (
        <TouchableOpacity
          style={[styles.insightCard, { backgroundColor: theme.colors.card }]}
          onPress={() => Alert.alert('Financial Insight', insight.message)}
        >
          <View style={styles.insightContent}>
            <Ionicons name={insight.icon} size={20} color={insight.color || theme.colors.primary} />
            <Text style={[styles.insightText, { color: theme.colors.text }]}>{insight.message}</Text>
            <Ionicons 
              name="chevron-forward-outline" 
              size={16} 
              color={theme.colors.text}
              style={[styles.insightArrow, { opacity: 0.6 }]} 
            />
          </View>
        </TouchableOpacity>
      ),
      horizontal: true
    },
    {
      title: 'Recent Expenses',
      data: recentExpenses,
      renderItem: ({ item: expense }) => (
        <TouchableOpacity key={expense.id} style={[styles.expenseItem, { backgroundColor: theme.colors.background }]}>
          <View style={styles.expenseLeft}>
            <View style={[styles.expenseIcon, { backgroundColor: theme.colors.card }]}>
              <Ionicons name={getCategoryIcon(expense.category)} size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>{expense.category}</Text>
              <Text style={[styles.expenseDate, { color: theme.colors.text, opacity: 0.6 }]}>
                {new Date(expense.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit'
                })}
              </Text>
            </View>
          </View>
          <Text style={[styles.expenseAmount, { color: theme.colors.primary }]}>
            {formatCurrency(expense.amount)}
          </Text>
        </TouchableOpacity>
      )
    }
  ], [insights, recentExpenses, theme]);

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>{section.title}</Text>
      {section.title === 'Recent Expenses' && (
        <TouchableOpacity onPress={() => navigation.navigate('Expenses')}>
          <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.colors.text, opacity: 0.6 }]}>Hello,</Text>
          <Text style={[styles.name, { color: theme.colors.text }]}>{userInfo?.name || 'User'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.settingsButton, { backgroundColor: theme.colors.card }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.budgetCard, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.budgetTitle, { color: theme.colors.text, opacity: 0.6 }]}>Monthly Budget</Text>
        <Text style={[styles.budgetAmount, { color: theme.colors.text }]}>{formatCurrency(budget.monthly)}</Text>
        <View style={styles.budgetInfo}>
          <View>
            <Text style={[styles.budgetLabel, { color: theme.colors.text, opacity: 0.6 }]}>Spent</Text>
            <Text style={[styles.budgetValue, { color: theme.colors.text }]}>{formatCurrency(monthlySpent)}</Text>
            <Text style={[styles.budgetSubtext, { color: theme.colors.text, opacity: 0.6 }]}>
              ~{formatCurrency(averageDailySpent)}/day
            </Text>
          </View>
          <View>
            <Text style={[styles.budgetLabel, { color: theme.colors.text, opacity: 0.6 }]}>Remaining</Text>
            <Text style={[styles.budgetValue, { color: theme.colors.text }]}>{formatCurrency(monthlyRemaining)}</Text>
            <Text style={[styles.budgetSubtext, { color: theme.colors.text, opacity: 0.6 }]}>
              {daysLeft} days left
            </Text>
          </View>
          <View>
            <Text style={[styles.budgetLabel, { color: theme.colors.text, opacity: 0.6 }]}>Daily Target</Text>
            <Text style={[styles.budgetValue, { color: theme.colors.text }]}>{formatCurrency(dailyBudget)}</Text>
            <Text style={[styles.budgetSubtext, { color: theme.colors.text, opacity: 0.6 }]}>
              Ideal: {formatCurrency(idealDailyBudget)}
            </Text>
          </View>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderSectionHeader={renderSectionHeader}
        renderItem={({ item, section }) => section.renderItem({ item })}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={styles.sectionListContent}
        directionalLockEnabled={true}
        showsVerticalScrollIndicator={false}
      />
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
  greeting: {
    color: '#808080',
    fontSize: 16,
  },
  name: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#2C2C2C',
    borderRadius: 15,
  },
  budgetTitle: {
    color: '#808080',
    fontSize: 14,
    marginBottom: 5,
  },
  budgetAmount: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  budgetLabel: {
    color: '#808080',
    fontSize: 12,
    marginBottom: 5,
  },
  budgetValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  budgetSubtext: {
    fontSize: 12,
  },
  insightsContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  seeAllText: {
    color: '#FF6B00',
    fontSize: 14,
  },
  sectionTitle: {
    color: '#FF6B00',
    fontSize: 14,
  },
  insightCard: {
    marginRight: 10,
    marginLeft: 5,
    padding: 15,
    borderRadius: 12,
    minWidth: 250,
    maxWidth: 300,
    marginVertical: 5,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    marginRight: 10,
  },
  insightArrow: {
    marginLeft: 'auto',
  },
  recentExpenses: {
    flex: 1,
    marginBottom: 80,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  expenseCategory: {
    color: '#FFF',
    fontSize: 16,
    marginBottom: 4,
  },
  expenseDate: {
    color: '#808080',
    fontSize: 12,
  },
  expenseAmount: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#808080',
    fontSize: 16,
    marginTop: 10,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalMessage: {
    color: '#FFF',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  modalCloseButton: {
    backgroundColor: '#FF6B00',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionListContent: {
    paddingBottom: 20,
  },
});

export default HomeScreen;
