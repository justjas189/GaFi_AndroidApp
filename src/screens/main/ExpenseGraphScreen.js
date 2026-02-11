import React, { useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { analyzeExpenses, getRecommendations } from '../../config/nvidia';

const ExpenseGraphScreen = () => {
  const { budget, expenses, getExpensesByDateRange } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [categoryStats, setCategoryStats] = useState(null);
  const [aiInsights, setAiInsights] = useState([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Month/Year navigation
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const navigateMonth = (direction) => {
    const delta = direction === 'prev' ? -1 : 1;
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth > 11) { newMonth = 0; newYear++; }
    if (newMonth < 0) { newMonth = 11; newYear--; }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const canGoForward = () => {
    const now = new Date();
    return viewYear < now.getFullYear() || 
      (viewYear === now.getFullYear() && viewMonth < now.getMonth());
  };

  const getMonthLabel = () => {
    return new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const resetToCurrentMonth = () => {
    const now = new Date();
    setViewMonth(now.getMonth());
    setViewYear(now.getFullYear());
  };

  const calculateStats = () => {
    // Use navigable month
    const startOfMonth = new Date(viewYear, viewMonth, 1);
    const endOfMonth = new Date(viewYear, viewMonth + 1, 0);
    startOfMonth.setHours(0, 0, 0, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // Calculate start and end of current week (always current for weekly)
    const now = new Date();
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
    // Compare selected month with the month before it
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;

    const thisMonthExpenses = getExpensesByDateRange(
      new Date(viewYear, viewMonth, 1),
      new Date(viewYear, viewMonth + 1, 0)
    );
    const lastMonthExpenses = getExpensesByDateRange(
      new Date(prevYear, prevMonth, 1),
      new Date(prevYear, prevMonth + 1, 0)
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

  const generateAIInsights = async () => {
    if (!expenses || expenses.length === 0) {
      setAiInsights([{
        id: 'no-data',
        type: 'info',
        title: 'No Data Yet',
        message: 'Start tracking expenses to get AI-powered insights!',
        icon: 'bulb-outline',
        color: '#2196F3'
      }]);
      return;
    }

    setIsLoadingInsights(true);
    try {
      // Get recent expenses for analysis
      const recentExpenses = expenses.slice(0, 20);
      
      // Generate insights using NVIDIA AI
      const insights = await analyzeExpenses(recentExpenses, budget);
      const recommendations = await getRecommendations({ id: 'user' }, recentExpenses, budget);
      
      // Combine and limit to most relevant insights
      const combinedInsights = [...insights, ...recommendations].slice(0, 4);
      setAiInsights(combinedInsights);
      
    } catch (error) {
      console.error('Error generating AI insights:', error);
      // Fallback to basic insights
      setAiInsights(generateBasicInsights());
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const generateBasicInsights = () => {
    const insights = [];
    
    if (monthlyStats && categoryStats) {
      // Budget analysis
      if (monthlyStats.budget > 0) {
        const budgetUsed = (monthlyStats.total / monthlyStats.budget) * 100;
        if (budgetUsed > 90) {
          insights.push({
            id: 'budget-warning',
            type: 'warning',
            title: 'Budget Alert',
            message: `You've used ${budgetUsed.toFixed(0)}% of your monthly budget`,
            icon: 'warning-outline',
            color: '#FF9800'
          });
        } else if (budgetUsed < 50) {
          insights.push({
            id: 'budget-good',
            type: 'success',
            title: 'Great Progress',
            message: `You're on track! ${(100-budgetUsed).toFixed(0)}% budget remaining`,
            icon: 'checkmark-circle-outline',
            color: '#4CAF50'
          });
        }
      }

      // Top spending category
      const topCategory = categoryStats.find(cat => cat.spent > 0);
      if (topCategory) {
        insights.push({
          id: 'top-category',
          type: 'info',
          title: 'Top Spending',
          message: `${topCategory.category} is your biggest expense category`,
          icon: 'trending-up-outline',
          color: '#2196F3'
        });
      }

      // Savings tip
      insights.push({
        id: 'savings-tip',
        type: 'info',
        title: 'Savings Tip',
        message: 'Try cooking at home to save ₱300+ per week on food',
        icon: 'bulb-outline',
        color: '#FF6B00'
      });
    }

    return insights;
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
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

  // Update stats when expenses or budget changes
  useEffect(() => {
    if (getExpensesByDateRange) {
      calculateStats();
      generateAIInsights();
    }
  }, [expenses, budget, getExpensesByDateRange, viewMonth, viewYear]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Expense Analytics</Text>
        <View style={[styles.analyticsIndicator, { backgroundColor: theme.colors.primary + '20' }]}>
          <Text style={[styles.analyticsIndicatorText, { color: theme.colors.primary }]}>📊 AI Powered</Text>
        </View>
      </View>

      {/* Month Navigation */}
      <View style={[styles.monthNavRow, { backgroundColor: theme.colors.card }]}>
        <TouchableOpacity
          style={styles.monthNavButton}
          onPress={() => navigateMonth('prev')}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={resetToCurrentMonth}>
          <Text style={[styles.monthNavLabel, { color: theme.colors.text }]}>{getMonthLabel()}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.monthNavButton, !canGoForward() && { opacity: 0.3 }]}
          onPress={() => canGoForward() && navigateMonth('next')}
          disabled={!canGoForward()}
        >
          <Ionicons name="chevron-forward" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Monthly Overview</Text>
            <View style={[styles.monthBadge, { backgroundColor: theme.colors.primary + '15' }]}>
              <Text style={[styles.monthBadgeText, { color: theme.colors.primary }]}>
                {new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
              </Text>
            </View>
          </View>
          {monthlyStats && (
            <View>
              <View style={styles.primaryStats}>
                <View style={styles.primaryStat}>
                  <Text style={[styles.primaryStatLabel, { color: theme.colors.text, opacity: 0.7 }]}>Total Spent</Text>
                  <Text style={[styles.primaryStatValue, { color: theme.colors.text }]}>{formatCurrency(monthlyStats.total)}</Text>
                </View>
                <View style={styles.primaryStat}>
                  <Text style={[styles.primaryStatLabel, { color: theme.colors.text, opacity: 0.7 }]}>vs Last Month</Text>
                  {getCurrentTrend().trend === 'increase' ? (
                    <View style={styles.trendContainer}>
                      <Ionicons name="trending-up" size={16} color="#FF4444" />
                      <Text style={[styles.primaryStatValue, styles.negativeValue]}>
                        +{getCurrentTrend().percentage}%
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.trendContainer}>
                      <Ionicons name="trending-down" size={16} color="#4CAF50" />
                      <Text style={[styles.primaryStatValue, styles.positiveValue]}>
                        -{getCurrentTrend().percentage}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: monthlyStats.remaining >= 0 ? '#4CAF50' + '20' : '#FF4444' + '20' }]}>
                    <Ionicons 
                      name={monthlyStats.remaining >= 0 ? "wallet-outline" : "alert-circle-outline"} 
                      size={20} 
                      color={monthlyStats.remaining >= 0 ? "#4CAF50" : "#FF4444"} 
                    />
                  </View>
                  <Text style={[styles.statLabel, { color: theme.colors.text, opacity: 0.7 }]}>Remaining</Text>
                  <Text style={[styles.statValue, { color: monthlyStats.remaining < 0 ? '#FF4444' : '#4CAF50' }]}>
                    {formatCurrency(monthlyStats.remaining)}
                  </Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.statLabel, { color: theme.colors.text, opacity: 0.7 }]}>Daily Average</Text>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{formatCurrency(monthlyStats.average)}</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={[styles.statIcon, { backgroundColor: '#FF9800' + '20' }]}>
                    <Ionicons name="receipt-outline" size={20} color="#FF9800" />
                  </View>
                  <Text style={[styles.statLabel, { color: theme.colors.text, opacity: 0.7 }]}>Transactions</Text>
                  <Text style={[styles.statValue, { color: theme.colors.text }]}>{monthlyStats.count}</Text>
                </View>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.colors.background }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${Math.min((monthlyStats.total / monthlyStats.budget) * 100, 100)}%`,
                        backgroundColor: monthlyStats.total > monthlyStats.budget ? '#FF4444' : theme.colors.primary
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.progressLabel, { color: theme.colors.text, opacity: 0.7 }]}>
                  {Math.round((monthlyStats.total / monthlyStats.budget) * 100)}% of budget used
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Weekly Summary</Text>
            <View style={[styles.weekBadge, { backgroundColor: '#4CAF50' + '15' }]}>
              <Text style={[styles.weekBadgeText, { color: '#4CAF50' }]}>This Week</Text>
            </View>
          </View>
          {weeklyStats && (
            <View style={styles.weeklyContainer}>
              <View style={styles.weeklyStats}>
                <View style={styles.weeklyStat}>
                  <View style={[styles.weeklyStatIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons name="cash-outline" size={24} color={theme.colors.primary} />
                  </View>
                  <View style={styles.weeklyStatInfo}>
                    <Text style={[styles.weeklyStatLabel, { color: theme.colors.text, opacity: 0.7 }]}>Total Spent</Text>
                    <Text style={[styles.weeklyStatValue, { color: theme.colors.text }]}>{formatCurrency(weeklyStats.total)}</Text>
                  </View>
                </View>
                
                <View style={styles.weeklyStat}>
                  <View style={[styles.weeklyStatIcon, { backgroundColor: '#FF9800' + '20' }]}>
                    <Ionicons name="trending-up-outline" size={24} color="#FF9800" />
                  </View>
                  <View style={styles.weeklyStatInfo}>
                    <Text style={[styles.weeklyStatLabel, { color: theme.colors.text, opacity: 0.7 }]}>Daily Average</Text>
                    <Text style={[styles.weeklyStatValue, { color: theme.colors.text }]}>{formatCurrency(weeklyStats.average)}</Text>
                  </View>
                </View>
                
                <View style={styles.weeklyStat}>
                  <View style={[styles.weeklyStatIcon, { backgroundColor: '#9C27B0' + '20' }]}>
                    <Ionicons name="list-outline" size={24} color="#9C27B0" />
                  </View>
                  <View style={styles.weeklyStatInfo}>
                    <Text style={[styles.weeklyStatLabel, { color: theme.colors.text, opacity: 0.7 }]}>Transactions</Text>
                    <Text style={[styles.weeklyStatValue, { color: theme.colors.text }]}>{weeklyStats.count}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* AI Insights Section */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>AI Insights</Text>
            <View style={styles.insightsHeaderRight}>
              {isLoadingInsights && (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              )}
              <View style={[styles.aiPoweredBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                <Text style={[styles.aiPoweredText, { color: theme.colors.primary }]}>🤖 AI</Text>
              </View>
            </View>
          </View>
          
          {aiInsights && aiInsights.length > 0 ? (
            <View style={styles.insightsContainer}>
              {aiInsights.map((insight, index) => (
                <View key={insight.id || index} style={[styles.insightCard, { backgroundColor: theme.colors.background }]}>
                  <View style={styles.insightHeader}>
                    <View style={[styles.insightIconContainer, { backgroundColor: insight.color + '20' || theme.colors.primary + '20' }]}>
                      <Ionicons 
                        name={insight.icon || 'bulb-outline'} 
                        size={20} 
                        color={insight.color || theme.colors.primary} 
                      />
                    </View>
                    <View style={styles.insightContent}>
                      <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                        {insight.title}
                      </Text>
                      <Text style={[styles.insightMessage, { color: theme.colors.text, opacity: 0.8 }]}>{insight.message}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noInsightsContainer}>
              <View style={[styles.noInsightsIcon, { backgroundColor: theme.colors.background }]}>
                <Ionicons name="bulb-outline" size={32} color={theme.colors.text} opacity={0.3} />
              </View>
              <Text style={[styles.noInsightsText, { color: theme.colors.text, opacity: 0.6 }]}>No insights available yet</Text>
              <Text style={[styles.noInsightsSubtext, { color: theme.colors.text, opacity: 0.4 }]}>Track more expenses to get AI insights</Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Category Breakdown</Text>
          {categoryStats && categoryStats.map(stat => (
            <View key={stat.category} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons 
                      name={getCategoryIcon(stat.category)} 
                      size={18} 
                      color={theme.colors.primary} 
                    />
                  </View>
                  <Text style={[styles.categoryName, { color: theme.colors.text }]}>{stat.category}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={[styles.categoryAmount, { color: theme.colors.primary }]}>{formatCurrency(stat.spent)}</Text>
                  <Text style={[styles.categoryPercentage, { color: theme.colors.text, opacity: 0.6 }]}>
                    {Math.round(stat.percentage)}%
                  </Text>
                </View>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.colors.background }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${Math.min(stat.percentage, 100)}%`,
                      backgroundColor: stat.percentage > 90 ? '#FF4444' : theme.colors.primary
                    }
                  ]} 
                />
              </View>
              <Text style={[styles.progressLabel, { color: theme.colors.text, opacity: 0.6 }]}>
                of {formatCurrency(stat.limit)} limit
              </Text>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  analyticsIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  analyticsIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  card: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  monthBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  monthBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  weekBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weekBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  primaryStat: {
    flex: 1,
  },
  primaryStatLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  primaryStatValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  weeklyContainer: {
    marginTop: 8,
  },
  weeklyStats: {
    gap: 16,
  },
  weeklyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  weeklyStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  weeklyStatInfo: {
    flex: 1,
  },
  weeklyStatLabel: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '500',
  },
  weeklyStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  insightsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiPoweredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiPoweredText: {
    fontSize: 10,
    fontWeight: '600',
  },
  insightsContainer: {
    gap: 12,
  },
  insightCard: {
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  insightIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  noInsightsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noInsightsIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noInsightsText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  noInsightsSubtext: {
    fontSize: 14,
  },
  categoryItem: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 12,
    fontWeight: '500',
  },
  positiveValue: {
    color: '#4CAF50',
  },
  negativeValue: {
    color: '#FF4444',
  },

  // Month Navigation
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 16,
  },
  monthNavButton: {
    padding: 4,
  },
  monthNavLabel: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ExpenseGraphScreen;
