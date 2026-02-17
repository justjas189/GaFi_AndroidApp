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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { useMascot } from '../../MonT/context/MascotContext';
import { MonTMascot } from '../../MonT/components/MascotSystem';
import { MascotIntegrationHelpers } from '../../MonT/utils/IntegrationHelpers';
import { MonTNotificationToast, MonTDailyMessage, MonTBudgetAlert } from '../../components/MonTNotificationToast';
import { useMonTNotifications } from '../../utils/MonTNotificationManager';

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
  const mascot = useMascot();
  const montNotifications = useMonTNotifications();
  
  const [refreshing, setRefreshing] = useState(false);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [insights, setInsights] = useState([]);
  
  // MonT notification states
  const [showDailyMessage, setShowDailyMessage] = useState(false);
  const [showBudgetAlert, setShowBudgetAlert] = useState(false);
  const [budgetAlertData, setBudgetAlertData] = useState(null);

  // Test function to reset onboarding status for testing
  const resetOnboardingForTesting = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        Alert.alert('Error', 'No active session found.');
        return;
      }

      const userId = session.user.id;
      
      Alert.alert(
        '🧪 Test Onboarding Reset',
        'This will reset your onboarding status and take you back to the onboarding flow to test budget creation.',
        [
          {
            text: 'Reset & Test Onboarding',
            style: 'destructive',
            onPress: async () => {
              try {
                // Reset onboarding_completed to false in profiles table
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ onboarding_completed: false })
                  .eq('id', userId);

                if (updateError) {
                  console.error('Error resetting onboarding:', updateError);
                  Alert.alert('Error', 'Could not reset onboarding status: ' + updateError.message);
                  return;
                }

                // Clear local storage
                await AsyncStorage.removeItem('onboardingComplete');
                await AsyncStorage.removeItem(`hasOnboarded_${userId}`);

                Alert.alert(
                  'Onboarding Reset Complete',
                  'You will now be taken to the onboarding flow to test budget creation.',
                  [
                    {
                      text: 'Start Onboarding',
                      onPress: () => {
                        navigation.reset({
                          index: 0,
                          routes: [{ 
                            name: 'Onboarding',
                            state: {
                              routes: [{ name: 'GetStarted' }]
                            }
                          }]
                        });
                      }
                    }
                  ]
                );
              } catch (error) {
                console.error('Error resetting onboarding:', error);
                Alert.alert('Error', 'Failed to reset onboarding: ' + error.message);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('Error in resetOnboardingForTesting:', error);
      Alert.alert('Error', 'Failed to check session: ' + error.message);
    }
  };

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

  // Trigger mascot welcome reaction when home screen loads
  useEffect(() => {
    const timer = setTimeout(() => {
      if (monthlyRemaining <= 0) {
        // Use new global notification system
        montNotifications.budgetWarning(Math.abs(monthlyRemaining));
        
        MascotIntegrationHelpers.onBudgetExceeded(mascot, Math.abs(monthlyRemaining));
        // Show budget alert notification
        setBudgetAlertData({
          category: 'Monthly Budget',
          exceeded: Math.abs(monthlyRemaining),
          budget: budget.monthly
        });
        setShowBudgetAlert(true);
      } else if (monthlySpent < budget.monthly * 0.5) {
        // Show encouraging message for good spending
        montNotifications.budgetOnTrack(monthlyRemaining, daysLeft);
        
        MascotIntegrationHelpers.onGoodSpendingDay(mascot, monthlyRemaining);
        // Show encouraging daily message
        setTimeout(() => setShowDailyMessage(true), 3000);
      } else {
        // Welcome back message
        montNotifications.welcomeBack(userInfo?.name || 'User');
        
        MascotIntegrationHelpers.onHomeScreenOpen(mascot, {
          currentStreak: 1, // You can get this from your user data
          totalSaved: Math.max(0, budget.monthly - monthlySpent)
        });
        // Show daily message after a delay
        setTimeout(() => setShowDailyMessage(true), 4000);
      }
    }, 2000); // Delay to let the screen load

    return () => clearTimeout(timer);
  }, [monthlyRemaining, monthlySpent, budget.monthly, mascot, montNotifications, daysLeft, userInfo]);
  
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
      title: 'AI Insights',
      data: insights,
      renderItem: ({ item: insight }) => (
        <TouchableOpacity
          style={[
            styles.insightCard, 
            { 
              backgroundColor: theme.colors.card,
              borderLeftColor: insight.color || theme.colors.primary,
              shadowColor: insight.color || theme.colors.primary,
            }
          ]}
          onPress={() => Alert.alert(insight.title, insight.message, [
            { text: 'Got it!', style: 'default' }
          ])}
        >
          <View style={styles.insightHeader}>
            <View style={[styles.insightIconContainer, { backgroundColor: insight.color + '20' || theme.colors.primary + '20' }]}>
              <Ionicons name={insight.icon} size={22} color={insight.color || theme.colors.primary} />
            </View>
            <View style={[styles.insightBadge, { backgroundColor: insight.color + '15' || theme.colors.primary + '15' }]}>
              <Text style={[styles.insightType, { 
                color: insight.color || theme.colors.primary,
                textTransform: 'uppercase',
                fontSize: 10,
                fontWeight: '600'
              }]}>
                {insight.type}
              </Text>
            </View>
          </View>
          <Text style={[styles.insightTitle, { color: theme.colors.text }]}>{insight.title}</Text>
          <Text style={[styles.insightMessage, { color: theme.colors.text }]}>{insight.message}</Text>
          <View style={styles.insightFooter}>
            <View style={styles.aiPoweredContainer}>
              <Text style={[styles.aiPowered, { color: theme.colors.text }]}>🤖 AI Powered</Text>
            </View>
            <View style={[styles.insightAction, { backgroundColor: insight.color + '10' || theme.colors.primary + '10' }]}>
              <Ionicons 
                name="chevron-forward-outline" 
                size={16} 
                color={insight.color || theme.colors.primary}
              />
            </View>
          </View>
        </TouchableOpacity>
      ),
      horizontal: false
    },
    {
      title: 'Recent Expenses',
      data: recentExpenses,
      renderItem: ({ item: expense }) => (
        <TouchableOpacity key={expense.id} style={[styles.expenseItem, { backgroundColor: theme.colors.card }]}>
          <View style={styles.expenseLeft}>
            <View style={[styles.expenseIcon, { backgroundColor: theme.colors.primary + '15' }]}>
              <Ionicons name={getCategoryIcon(expense.category)} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.expenseDetails}>
              <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>{expense.category}</Text>
              <Text style={[styles.expenseDescription, { color: theme.colors.text, opacity: 0.7 }]}>
                {expense.note || 'No description'}
              </Text>
              <Text style={[styles.expenseDate, { color: theme.colors.text, opacity: 0.5 }]}>
                {new Date(expense.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: '2-digit'
                })}
              </Text>
            </View>
          </View>
          <View style={styles.expenseRight}>
            <Text style={[styles.expenseAmount, { color: '#FF4444' }]}>
              -{formatCurrency(expense.amount)}
            </Text>
            <Text style={[styles.expenseTime, { color: theme.colors.text, opacity: 0.5 }]}>
              {new Date(expense.date).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        </TouchableOpacity>
      ),
      horizontal: false
    }
  ], [insights, recentExpenses, theme]);

  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
      <View style={styles.sectionTitleContainer}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{section.title}</Text>
        {section.title === 'AI Insights' && (
          <View style={[styles.aiIndicator, { backgroundColor: theme.colors.primary + '20' }]}>
            <Text style={[styles.aiIndicatorText, { color: theme.colors.primary }]}>✨ NVIDIA AI</Text>
          </View>
        )}
      </View>
      {section.title === 'Recent Expenses' && (
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={() => navigation.navigate('Expenses')}
        >
          <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See All</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.userInfoContainer}>
          <Text style={[styles.greeting, { color: theme.colors.text, opacity: 0.6 }]}>Hello,</Text>
          <Text 
            style={[styles.name, { color: theme.colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {userInfo?.name || 'User'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.chatHeaderButton, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={() => navigation.navigate('Notes')}
          >
            <Ionicons name="document-text" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
          
          {/*
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.primary }]}
              onPress={resetOnboardingForTesting}
            >
              <Text style={[styles.testButtonText, { color: theme.colors.primary }]}>🧪</Text>
            </TouchableOpacity>
          )}
          
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: theme.colors.card, borderColor: '#FF6B00' }]}
              onPress={() => navigation.navigate('MonTBubbleTest')}
            >
              <Text style={[styles.testButtonText, { color: '#FF6B00' }]}>🎯</Text>
            </TouchableOpacity>
          )} */}
          
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.budgetCard, { backgroundColor: theme.colors.card }]}>
        <View style={styles.budgetHeader}>
          <Text style={[styles.budgetTitle, { color: theme.colors.text, opacity: 0.6 }]}>Monthly Budget</Text>
          <View style={[styles.budgetProgress, { backgroundColor: theme.colors.background }]}>
            <View 
              style={[
                styles.budgetProgressBar, 
                { 
                  backgroundColor: monthlySpent > budget.monthly ? '#FF4444' : theme.colors.primary,
                  width: `${Math.min((monthlySpent / budget.monthly) * 100, 100)}%`
                }
              ]} 
            />
          </View>
        </View>
        
        <View style={styles.budgetAmountContainer}>
          <Text style={[styles.budgetAmount, { color: theme.colors.text }]}>
            {formatCurrency(budget.monthly)}
          </Text>
          <Text style={[styles.budgetPercentage, { 
            color: monthlySpent > budget.monthly ? '#FF4444' : theme.colors.primary 
          }]}>
            {((monthlySpent / budget.monthly) * 100).toFixed(1)}% used
          </Text>
        </View>

        <View style={styles.budgetInfo}>
          <View style={styles.budgetInfoItem}>
            <View style={[styles.budgetIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="trending-down-outline" size={16} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.budgetLabel, { color: theme.colors.text, opacity: 0.6 }]}>Spent</Text>
              <Text style={[styles.budgetValue, { color: theme.colors.text }]}>
                {formatCurrency(monthlySpent)}
              </Text>
              <Text style={[styles.budgetSubtext, { color: theme.colors.text, opacity: 0.6 }]}>
                ~{formatCurrency(averageDailySpent)}/day
              </Text>
            </View>
          </View>
          
          <View style={styles.budgetInfoItem}>
            <View style={[styles.budgetIcon, { backgroundColor: '#4CAF50' + '20' }]}>
              <Ionicons name="wallet-outline" size={16} color="#4CAF50" />
            </View>
            <View>
              <Text style={[styles.budgetLabel, { color: theme.colors.text, opacity: 0.6 }]}>Remaining</Text>
              <Text style={[styles.budgetValue, { 
                color: monthlyRemaining >= 0 ? '#4CAF50' : '#FF4444' 
              }]}>
                {formatCurrency(monthlyRemaining)}
              </Text>
              <Text style={[styles.budgetSubtext, { color: theme.colors.text, opacity: 0.6 }]}>
                {daysLeft} days left
              </Text>
            </View>
          </View>
          
          <View style={styles.budgetInfoItem}>
            <View style={[styles.budgetIcon, { backgroundColor: '#FF9800' + '20' }]}>
              <Ionicons name="calendar-outline" size={16} color="#FF9800" />
            </View>
            <View>
              <Text style={[styles.budgetLabel, { color: theme.colors.text, opacity: 0.6 }]}>Daily Target</Text>
              <Text style={[styles.budgetValue, { color: theme.colors.text }]}>
                {formatCurrency(dailyBudget)}
              </Text>
              <Text style={[styles.budgetSubtext, { color: theme.colors.text, opacity: 0.6 }]}>
                Ideal: {formatCurrency(idealDailyBudget)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Access Feature Cards 
      <View style={styles.quickAccessContainer}>
        <Text style={[styles.quickAccessTitle, { color: theme.colors.text }]}>Quick Access</Text>
        <View style={styles.featureCardsRow}>
          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('Achievements')}
          >
            <View style={[styles.featureIcon, { backgroundColor: '#FFD700' + '20' }]}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
            </View>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Achievements</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('FriendRequests')}
          >
            <View style={[styles.featureIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="people" size={24} color={theme.colors.primary} />
            </View>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Friends</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.featureCard, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('Calendar')}
          >
            <View style={[styles.featureIcon, { backgroundColor: '#4CAF50' + '20' }]}>
              <Ionicons name="calendar" size={24} color="#4CAF50" />
            </View>
            <Text style={[styles.featureTitle, { color: theme.colors.text }]}>Calendar</Text>
          </TouchableOpacity>
        </View>
      </View>*/}

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderSectionHeader={renderSectionHeader}
        renderItem={({ item, section }) => section.renderItem({ item })}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.sectionListContent}
        directionalLockEnabled={true}
        showsVerticalScrollIndicator={false}
      />

      {/* MonT Global Draggable Chat Bubble replaces the floating mascot */}
      
      {/* MonT Notification Toasts */}
      <MonTDailyMessage 
        visible={showDailyMessage}
        onDismiss={() => setShowDailyMessage(false)}
      />
      
      {budgetAlertData && (
        <MonTBudgetAlert
          visible={showBudgetAlert}
          category={budgetAlertData.category}
          exceeded={budgetAlertData.exceeded}
          budget={budgetAlertData.budget}
          onDismiss={() => {
            setShowBudgetAlert(false);
            setBudgetAlertData(null);
          }}
        />
      )}
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
  userInfoContainer: {
    flex: 1,
    marginRight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  chatHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    color: '#808080',
    fontSize: 16,
  },
  name: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2C2C2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  budgetCard: {
    margin: 20,
    padding: 24,
    backgroundColor: '#2C2C2C',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  budgetHeader: {
    marginBottom: 20,
  },
  budgetTitle: {
    color: '#808080',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  budgetProgress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#404040',
    overflow: 'hidden',
  },
  budgetProgressBar: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#FF6B00',
  },
  budgetAmountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  budgetAmount: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  budgetPercentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B00',
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  budgetInfoItem: {
    flex: 1,
    alignItems: 'center',
  },
  budgetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  budgetLabel: {
    color: '#808080',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  budgetSubtext: {
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.7,
  },
  insightsContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 24,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  aiIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  insightCard: {
    alignSelf: 'center',
    marginHorizontal: 10,
    padding: 20,
    borderRadius: 16,
    width: 300,
    marginVertical: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  insightType: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 20,
  },
  insightMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    opacity: 0.8,
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiPoweredContainer: {
    flex: 1,
  },
  aiPowered: {
    fontSize: 11,
    opacity: 0.7,
    fontWeight: '500',
  },
  insightAction: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentExpenses: {
    flex: 1,
    marginBottom: 80,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  expenseDescription: {
    fontSize: 14,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  expenseDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  expenseTime: {
    fontSize: 11,
    fontWeight: '500',
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
  quickAccessContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  quickAccessTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  featureCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  featureCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
});

export default HomeScreen;
