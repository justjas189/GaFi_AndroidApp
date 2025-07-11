import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const ExpenseGraphScreen = () => {
  const { budget, expenses, getExpensesByDateRange } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [categoryStats, setCategoryStats] = useState(null);

  const calculateStats = () => {
    // Get current date info
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    startOfMonth.setHours(0, 0, 0, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // Calculate start and end of week
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get expenses for different periods
    const monthExpenses = getExpensesByDateRange ? getExpensesByDateRange(startOfMonth, endOfMonth) : [];
    const weekExpenses = getExpensesByDateRange ? getExpensesByDateRange(startOfWeek, endOfWeek) : [];

    // Calculate monthly statistics
    const monthTotal = monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const monthlyStats = {
      total: monthTotal,
      average: monthTotal / endOfMonth.getDate(),
      count: monthExpenses.length,
      budget: budget.monthly,
      remaining: budget.monthly - monthTotal
    };

    // Calculate weekly statistics
    const weekTotal = weekExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const weeklyStats = {
      total: weekTotal,
      average: weekTotal / 7,
      count: weekExpenses.length
    };

    // Calculate category statistics
    const categoryStats = Object.entries(budget.categories || {}).map(([category, data]) => ({
      category,
      spent: data.spent || 0,
      limit: data.limit || 0,
      percentage: data.limit > 0 ? ((data.spent || 0) / data.limit) * 100 : 0
    })).sort((a, b) => b.spent - a.spent);

    setMonthlyStats(monthlyStats);
    setWeeklyStats(weeklyStats);
    setCategoryStats(categoryStats);
  };

  const getCurrentTrend = () => {
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);

    const thisMonthExpenses = getExpensesByDateRange(
      new Date(now.getFullYear(), now.getMonth(), 1),
      now
    );
    const lastMonthExpenses = getExpensesByDateRange(
      new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
      new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
    );

    const thisMonthTotal = thisMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const lastMonthTotal = lastMonthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    
    const percentageChange = lastMonthTotal === 0 ? 100 : 
      ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;

    return {
      trend: percentageChange > 0 ? 'increase' : 'decrease',
      percentage: Math.abs(percentageChange).toFixed(1)
    };
  };

  // Update stats when expenses or budget changes
  useEffect(() => {
    if (getExpensesByDateRange) {
      calculateStats();
    }
  }, [expenses, budget, getExpensesByDateRange]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Expense Analytics</Text>
      
      <ScrollView>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Overview</Text>
          {monthlyStats && (
            <View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Total Spent</Text>
                  <Text style={styles.statValue}>{formatCurrency(monthlyStats.total)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>vs Last Month</Text>
                  {getCurrentTrend().trend === 'increase' ? (
                    <Text style={[styles.statValue, styles.negativeValue]}>
                      +{getCurrentTrend().percentage}%
                    </Text>
                  ) : (
                    <Text style={[styles.statValue, styles.positiveValue]}>
                      -{getCurrentTrend().percentage}%
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Remaining</Text>
                  <Text style={[styles.statValue, monthlyStats.remaining < 0 && styles.negativeValue]}>
                    {formatCurrency(monthlyStats.remaining)}
                  </Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Daily Average</Text>
                  <Text style={styles.statValue}>{formatCurrency(monthlyStats.average)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Transactions</Text>
                  <Text style={styles.statValue}>{monthlyStats.count}</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min((monthlyStats.total / monthlyStats.budget) * 100, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressLabel}>
                {Math.round((monthlyStats.total / monthlyStats.budget) * 100)}% of budget used
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Summary</Text>
          {weeklyStats && (
            <View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Total Spent</Text>
                  <Text style={styles.statValue}>{formatCurrency(weeklyStats.total)}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Daily Average</Text>
                  <Text style={styles.statValue}>{formatCurrency(weeklyStats.average)}</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Transactions</Text>
                  <Text style={styles.statValue}>{weeklyStats.count}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Breakdown</Text>
          {categoryStats && categoryStats.map(stat => (
            <View key={stat.category} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{stat.category}</Text>
                <Text style={styles.categoryAmount}>{formatCurrency(stat.spent)}</Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min(stat.percentage, 100)}%` },
                    stat.percentage > 90 && styles.warningProgress
                  ]} 
                />
              </View>
              <Text style={styles.progressLabel}>{Math.round(stat.percentage)}% of limit used</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    paddingBottom: 10,
    color: '#FFFFFF',
  },
  card: {
    margin: 10,
    padding: 15,
    backgroundColor: '#2C2C2C',
    borderRadius: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#FFFFFF',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  stat: {
    flex: 1,
    paddingHorizontal: 10,
  },
  statLabel: {
    color: '#808080',
    fontSize: 14,
    marginBottom: 5,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  positiveValue: {
    color: '#4CD964',
  },
  negativeValue: {
    color: '#FF3B30',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#3C3C3C',
    borderRadius: 4,
    marginVertical: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 4,
  },
  warningProgress: {
    backgroundColor: '#FF3B30',
  },
  progressLabel: {
    color: '#808080',
    fontSize: 12,
    marginTop: 5,
  },
  categoryItem: {
    marginBottom: 15,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  categoryName: {
    color: '#FFFFFF',
    fontSize: 16,
    textTransform: 'capitalize',
  },
  categoryAmount: {
    color: '#FF6B00',
    fontSize: 16,
    fontWeight: 'bold',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  insightText: {
    color: '#808080',
    fontSize: 14,
    flex: 1,
  },
  insightIcon: {
    marginRight: 10,
  },
});

export default ExpenseGraphScreen;
