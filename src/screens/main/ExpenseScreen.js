import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  processColor,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { analyzeExpenses, getRecommendations } from '../../config/nvidia';

const screenWidth = Dimensions.get('window').width;

const ExpenseScreen = ({ navigation, route }) => {
  const { expenses, addExpense, deleteExpense, budget } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // 'week' or 'month'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [predictions, setPredictions] = useState({
    nextMonthExpense: 0,
    recommendations: []
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Check if we should show the form based on navigation params
  useEffect(() => {
    if (route?.params?.showForm) {
      setShowForm(true);
      // Clear the navigation param to prevent showing form again on re-render
      navigation.setParams({ showForm: false });
    }
  }, [route?.params?.showForm, navigation]);
  
  // Format dates for display
  const formatSelectedDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatSelectedTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
  const formattedTime = currentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const categories = [
    'Food',
    'Transportation',
    'Entertainment',
    'Shopping',
    'Utilities',
    'Others'
  ];

  // Process expenses data for charts
  const charts = useMemo(() => {
    const categoryTotals = {};
    const dailyTotals = {};
    let totalExpenses = 0;

    // Initialize category totals
    categories.forEach(cat => {
      categoryTotals[cat.toLowerCase()] = 0;
    });

    // Process each expense
    expenses.forEach(expense => {
      // Update category totals
      const cat = expense.category.toLowerCase();
      categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
      totalExpenses += expense.amount;

      // Update daily totals
      const date = new Date(expense.date).toISOString().split('T')[0];
      dailyTotals[date] = (dailyTotals[date] || 0) + expense.amount;
    });

    const categoryColors = {
      food: '#FF6B6B',           // Coral red
      transportation: '#4ECDC4', // Teal
      entertainment: '#45B7D1',  // Blue
      shopping: '#96CEB4',       // Mint green
      utilities: '#FFEAA7',      // Light yellow
      others: '#DDA0DD'          // Plum
    };

    // Prepare pie chart data and sort by amount
    const pieChartData = Object.entries(categoryTotals)
      .filter(([_, value]) => value > 0)
      .sort(([_, a], [__, b]) => b - a) // Sort by amount descending
      .map(([category, amount]) => ({
        name: category.charAt(0).toUpperCase() + category.slice(1),
        amount,
        percentage: (amount / totalExpenses) * 100,
        color: categoryColors[category.toLowerCase()] || categoryColors.others,
        legendFontColor: theme.colors.text,
        legendFontSize: 12,
      }));

    // Prepare line chart data
    const today = new Date();
    const dates = [];
    const amounts = [];
    
    if (selectedPeriod === 'week') {
      // Daily data for week view
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dates.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        amounts.push(dailyTotals[dateStr] || 0);
      }
    } else {
      // Weekly data for month view
      const weeksToShow = 4;
      for (let i = weeksToShow - 1; i >= 0; i--) {
        const endDate = new Date(today);
        endDate.setDate(today.getDate() - (i * 7));
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        
        // Calculate weekly total
        let weeklyTotal = 0;
        for (let j = 0; j < 7; j++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + j);
          const dateStr = date.toISOString().split('T')[0];
          weeklyTotal += dailyTotals[dateStr] || 0;
        }
        
        // Format date range for label (e.g., "Jun 1-7")
        const label = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endDate.getDate()}`;
        dates.push(label);
        amounts.push(weeklyTotal);
      }
    }

    return {
      pieChart: pieChartData,
      lineChart: {
        labels: dates,
        datasets: [{
          data: amounts,
        }]
      }
    };
  }, [expenses, selectedPeriod, theme.colors.text]);

  const chartConfig = {
    backgroundColor: theme.colors.background,
    backgroundGradientFrom: theme.colors.background,
    backgroundGradientTo: theme.colors.background,
    color: (opacity = 1) => theme.colors.primary + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    labelColor: (opacity = 1) => theme.colors.text + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    strokeWidth: 2,
    barPercentage: 0.7,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForBackgroundLines: {
      strokeDasharray: "", // solid background lines
      stroke: theme.colors.text + '20',
      strokeWidth: 1
    },
    propsForLabels: {
      fontSize: 12,
      fontWeight: '500'
    }
  };

  const handleSave = () => {
    if (!amount || !category) {
      Alert.alert('Error', 'Please fill in amount and category');
      return;
    }

    const newExpense = {
      amount: parseFloat(amount),
      category,
      note,
      description,
      date: selectedDate.toISOString() // Use the selected date instead of current date
    };

    addExpense(newExpense);
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDescription('');
    setSelectedDate(new Date()); // Reset to current date
  };

  // Date picker handlers
  const onDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
    if (date) {
      // Preserve the time when changing date
      const newDate = new Date(selectedDate);
      newDate.setFullYear(date.getFullYear());
      newDate.setMonth(date.getMonth());
      newDate.setDate(date.getDate());
      setSelectedDate(newDate);
    }
  };

  const onTimeChange = (event, time) => {
    setShowTimePicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
    if (time) {
      // Preserve the date when changing time
      const newDate = new Date(selectedDate);
      newDate.setHours(time.getHours());
      newDate.setMinutes(time.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteExpense(id)
        }
      ]
    );
  };

  const renderExpenseItem = ({ item }) => {
    const expenseDate = new Date(item.date);
    const dateString = expenseDate.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
    const timeString = expenseDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <TouchableOpacity 
        style={[styles.expenseItem, { backgroundColor: theme.colors.card }]}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.expenseLeft}>
          <View style={[styles.expenseIcon, { backgroundColor: theme.colors.primary + '20' }]}>
            <Ionicons name={getCategoryIcon(item.category)} size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.expenseInfo}>
            <Text style={[styles.category, { color: theme.colors.text }]}>{item.category}</Text>
            {item.note && (
              <Text style={[styles.note, { color: theme.colors.text, opacity: 0.7 }]}>{item.note}</Text>
            )}
            <Text style={[styles.date, { color: theme.colors.text, opacity: 0.5 }]}>{dateString} • {timeString}</Text>
          </View>
        </View>
        <View style={styles.expenseRight}>
          <Text style={[styles.amount, { color: '#FF4444' }]}>-₱{item.amount.toFixed(2)}</Text>
          <View style={[styles.deleteHint, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.deleteHintText, { color: theme.colors.text, opacity: 0.5 }]}>Hold to delete</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
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

  // Validate icon names to prevent warnings
  const validateIconName = (iconName) => {
    if (!iconName || typeof iconName !== 'string') {
      return 'bulb-outline';
    }
    
    // List of known valid Ionicons (modern format)
    const validIcons = [
      'bulb-outline', 'warning-outline', 'checkmark-circle-outline', 'trending-up-outline', 'trending-down-outline',
      'wallet-outline', 'restaurant-outline', 'car-outline', 'film-outline', 'bag-outline', 'build-outline',
      'analytics-outline', 'rocket-outline', 'school-outline', 'happy-outline', 'list-outline',
      'information-circle-outline', 'alert-circle-outline', 'close-circle-outline', 'fast-food-outline',
      'bus-outline', 'cart-outline', 'apps-outline', 'ellipsis-horizontal-outline'
    ];
    
    // If it's valid, return it
    if (validIcons.includes(iconName)) {
      return iconName;
    }
    
    // Convert common old formats
    const iconMappings = {
      'ion-ios-list': 'list-outline',
      'ion-ios-pie': 'analytics-outline', 
      'ion-ios-warning': 'warning-outline',
      'ion-md-cash': 'wallet-outline',
      'ion-md-close': 'close-circle-outline'
    };
    
    return iconMappings[iconName] || 'bulb-outline';
  };

  // Enhanced AI predictions and recommendations using NVIDIA API
  useEffect(() => {
    const generateAIInsights = async () => {
      if (!expenses || expenses.length === 0) {
        // Show welcome message for new users
        setPredictions({
          nextMonthExpense: 0,
          recommendations: [{
            type: 'info',
            category: 'welcome',
            message: 'Start tracking your expenses to receive AI-powered insights and recommendations!',
            icon: 'rocket-outline',
            color: '#2196F3'
          }]
        });
        return;
      }

      setAiLoading(true);
      setAiError(null);

      try {
        // Calculate basic stats for display
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthExpenses = expenses.filter(exp => new Date(exp.date) >= monthStart);
        const dailyRate = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0) / 
          (new Date().getDate());

        // Predict next month's expenses (basic calculation for display)
        const daysInNextMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 2,
          0
        ).getDate();
        const predictedExpense = dailyRate * daysInNextMonth;

        // Get AI-powered insights and recommendations
        const [aiInsights, aiRecommendations] = await Promise.all([
          analyzeExpenses(expenses, budget),
          getRecommendations(
            { id: 'user-1' }, // User profile - you can enhance this
            expenses,
            budget
          )
        ]);

        // Combine AI insights and recommendations
        const allRecommendations = [
          ...aiInsights.map(insight => ({
            type: insight.type,
            category: insight.category || 'general',
            message: insight.message,
            icon: insight.icon,
            color: insight.color
          })),
          ...aiRecommendations.map(rec => ({
            type: rec.type,
            category: rec.category || 'general',
            message: rec.message,
            icon: rec.icon,
            color: rec.color
          }))
        ];

        setPredictions({
          nextMonthExpense: predictedExpense,
          recommendations: allRecommendations.slice(0, 6) // Limit to 6 items for UI
        });

        setAiLoading(false);

      } catch (error) {
        console.error('Error generating AI insights:', error);
        setAiError(error.message);
        setAiLoading(false);
        
        // Fallback to basic recommendations if AI fails
        const basicRecommendations = [
          {
            type: 'warning',
            category: 'system',
            message: 'AI insights temporarily unavailable. Using basic recommendations.',
            icon: 'warning-outline',
            color: '#FF9800'
          },
          {
            type: 'info',
            category: 'general',
            message: 'Track your expenses daily to identify spending patterns',
            icon: 'analytics-outline',
            color: '#2196F3'
          },
          {
            type: 'success',
            category: 'savings',
            message: 'Set aside 20% of your income for savings',
            icon: 'wallet-outline',
            color: '#4CAF50'
          }
        ];

        const monthStart = new Date();
        monthStart.setDate(1);
        const monthExpenses = expenses.filter(exp => new Date(exp.date) >= monthStart);
        const dailyRate = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0) / 
          (new Date().getDate());
        const daysInNextMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 2,
          0
        ).getDate();

        setPredictions({
          nextMonthExpense: dailyRate * daysInNextMonth,
          recommendations: basicRecommendations
        });
      }
    };

    generateAIInsights();
  }, [expenses, budget]);

  const renderPredictions = () => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
        <Text style={[styles.cardTitle, { color: theme.colors.text, flex: 1 }]}>AI Insights</Text>
        {aiLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[{ color: theme.colors.text, opacity: 0.6, fontSize: 12, marginRight: 8 }]}>
              Analyzing...
            </Text>
            <Ionicons name="refresh-outline" size={16} color={theme.colors.primary} />
          </View>
        )}
        {aiError && (
          <Ionicons name="warning-outline" size={16} color="#FF9800" />
        )}
      </View>

      {/* Category Rankings */}
      <View style={styles.rankingsContainer}>
        <Text style={[styles.rankingsTitle, { color: theme.colors.text }]}>
          Category Rankings
        </Text>
        {charts.pieChart.map((category, index) => (
          <View key={category.name} style={styles.rankingItem}>
            <View style={styles.rankingLeft}>
              <Text style={[styles.rankingNumber, { color: theme.colors.text }]}>
                {index + 1}.
              </Text>
              <View style={[styles.colorDot, { backgroundColor: category.color }]} />
              <Text style={[styles.rankingName, { color: theme.colors.text }]}>
                {category.name}
              </Text>
            </View>
            <View>
              <Text style={[styles.rankingAmount, { color: theme.colors.primary }]}>
                ₱{category.amount.toFixed(2)}
              </Text>
              <Text style={[styles.rankingPercentage, { color: theme.colors.text, opacity: 0.6 }]}>
                {category.percentage.toFixed(1)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.predictionContainer}>
        <Text style={[styles.predictionLabel, { color: theme.colors.text }]}>
          Predicted Next Month Expenses
        </Text>
        <Text style={[styles.predictionAmount, { color: theme.colors.primary }]}>
          ₱{predictions.nextMonthExpense.toFixed(2)}
        </Text>
        
        {predictions.nextMonthExpense > budget.monthly && (
          <View style={styles.warningContainer}>
            <Ionicons name="warning-outline" size={20} color="#FF3B30" />
            <Text style={styles.warningText}>
              This exceeds your monthly budget by ₱{(predictions.nextMonthExpense - budget.monthly).toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.recommendationsContainer}>
        <Text style={[styles.recommendationsTitle, { color: theme.colors.text }]}>
          AI-Powered Insights & Recommendations
        </Text>
        {predictions.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Ionicons
              name={validateIconName(rec.icon) || (
                rec.type === 'warning' ? 'alert-circle-outline' :
                rec.type === 'error' ? 'close-circle-outline' :
                rec.type === 'success' ? 'checkmark-circle-outline' :
                rec.type === 'info' ? 'information-circle-outline' :
                rec.type === 'optimization' ? 'trending-up-outline' :
                'bulb-outline'
              )}
              size={24}
              color={rec.color || (
                rec.type === 'warning' ? '#FF9800' :
                rec.type === 'error' ? '#FF3B30' :
                rec.type === 'success' ? '#4CAF50' :
                rec.type === 'info' ? '#2196F3' :
                rec.type === 'optimization' ? '#4CD964' :
                theme.colors.primary
              )}
            />
            <Text style={[styles.recommendationText, { color: theme.colors.text }]}>
              {rec.message}
            </Text>
          </View>
        ))}
        {predictions.recommendations.length === 0 && (
          <View style={styles.recommendationItem}>
            <Ionicons name="bulb-outline" size={24} color={theme.colors.primary} />
            <Text style={[styles.recommendationText, { color: theme.colors.text, fontStyle: 'italic' }]}>
              Add more expenses to get personalized AI insights!
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (showForm) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView>
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setShowForm(false)}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.colors.text }]}>Add Expense</Text>
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>New</Text>
            </View>
          </View>

        <View style={[styles.dateTime, { borderBottomColor: theme.colors.border }]}>
          <Text style={[styles.label, { color: theme.colors.text, opacity: 0.6 }]}>Date & Time</Text>
          <View style={styles.dateTimeContent}>
            <TouchableOpacity 
              style={[styles.dateTimeButton, { backgroundColor: theme.colors.background }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.dateText, { color: theme.colors.text }]}>
                {formatSelectedDate(selectedDate)}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.dateTimeButton, { backgroundColor: theme.colors.background }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
              <Text style={[styles.timeText, { color: theme.colors.text }]}>
                {formatSelectedTime(selectedDate)}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
              maximumDate={new Date()} // Don't allow future dates
            />
          )}
          
          {/* Time Picker */}
          {showTimePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text, opacity: 0.6 }]}>Amount</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
                borderColor: theme.colors.border 
              }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholderTextColor={theme.colors.text + '80'}
              placeholder="0.00"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text, opacity: 0.6 }]}>Category</Text>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    { backgroundColor: theme.colors.card },
                    category === cat && { backgroundColor: theme.colors.primary }
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[
                    styles.categoryButtonText,
                    { color: theme.colors.text, opacity: 0.6 },
                    category === cat && { color: '#FFF', opacity: 1 }
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text, opacity: 0.6 }]}>Note</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
                borderColor: theme.colors.border 
              }]}
              value={note}
              onChangeText={setNote}
              placeholderTextColor={theme.colors.text + '80'}
              placeholder="Add a short note"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text, opacity: 0.6 }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput, { 
                backgroundColor: theme.colors.card,
                color: theme.colors.text,
                borderColor: theme.colors.border 
              }]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholderTextColor={theme.colors.text + '80'}
              placeholder="Add details (optional)"
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.cancelButton, { backgroundColor: theme.colors.card }]}
            onPress={() => {
              setShowForm(false);
              resetForm();
            }}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text, opacity: 0.6 }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.mainContainer}>
        <View style={[styles.headerContainer, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Expenses</Text>
            <View style={[styles.expensesBadge, { backgroundColor: theme.colors.primary + '15' }]}>
              <Text style={[styles.expensesBadgeText, { color: theme.colors.primary }]}>
                {expenses.length} total
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          nestedScrollEnabled={true}
        >
          {/* Charts Section */}
          <View style={[styles.chartsSection, { backgroundColor: theme.colors.card }]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Expense Analytics</Text>
              <View style={[styles.periodSelector, { backgroundColor: theme.colors.background }]}>
                <TouchableOpacity
                  style={[
                    styles.periodButton,
                    selectedPeriod === 'week' && { backgroundColor: theme.colors.primary }
                  ]}
                  onPress={() => setSelectedPeriod('week')}
                >
                  <Text style={[
                    styles.periodButtonText,
                    { color: theme.colors.text },
                    selectedPeriod === 'week' && { color: '#FFF' }
                  ]}>Week</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.periodButton,
                    selectedPeriod === 'month' && { backgroundColor: theme.colors.primary }
                  ]}
                  onPress={() => setSelectedPeriod('month')}
                >
                  <Text style={[
                    styles.periodButtonText,
                    { color: theme.colors.text },
                    selectedPeriod === 'month' && { color: '#FFF' }
                  ]}>Month</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Charts */}
            <View style={styles.chartContainer}>
              {/* Pie Chart */}
              {charts.pieChart.length > 0 ? (
                <View style={styles.chartWrapper}>
                  <Text style={[styles.chartSubtitle, { color: theme.colors.text }]}>Expenses by Category</Text>
                  <PieChart
                    data={charts.pieChart}
                    width={screenWidth - 50}
                    height={220}
                    chartConfig={{
                      ...chartConfig,
                      color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    }}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    center={[10, 0]}
                    absolute
                    hasLegend={true}
                    style={styles.pieChart}
                  />
                </View>
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="pie-chart-outline" size={40} color={theme.colors.text} opacity={0.3} />
                  <Text style={[styles.noDataText, { color: theme.colors.text }]}>No expense data available</Text>
                </View>
              )}

              {/* Bar Chart */}
              <View style={styles.chartWrapper}>
                <Text style={[styles.chartSubtitle, { color: theme.colors.text }]}>
                  {selectedPeriod === 'week' ? 'Daily' : 'Weekly'} Trends
                </Text>
                <BarChart
                  data={charts.lineChart}
                  width={screenWidth - 80}
                  height={220}
                  chartConfig={{
                    ...chartConfig,
                    fillShadowGradient: theme.colors.primary,
                    fillShadowGradientOpacity: 0.8,
                    barRadius: 4,
                    propsForBackgroundLines: {
                      strokeDasharray: "3,3",
                      stroke: theme.colors.text + '15',
                      strokeWidth: 1
                    }
                  }}
                  style={styles.barChart}
                  fromZero
                  showBarTops={false}
                  showValuesOnTopOfBars={true}
                />
              </View>
            </View>
          </View>

          {/* AI Predictions */}
          {renderPredictions()}

          {/* Expense List */}
          <View style={styles.expenseListContainer}>
            <View style={styles.expenseListHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
              {expenses.length > 0 && (
                <View style={[styles.totalBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Text style={[styles.totalBadgeText, { color: theme.colors.primary }]}>
                    Total: {formatCurrency(expenses.reduce((sum, exp) => sum + exp.amount, 0))}
                  </Text>
                </View>
              )}
            </View>
            {expenses.length > 0 ? (
              <FlatList
                data={expenses.slice()}
                renderItem={renderExpenseItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <View style={[styles.emptyStateIcon, { backgroundColor: theme.colors.background }]}>
                  <Ionicons name="receipt-outline" size={40} color={theme.colors.text} opacity={0.3} />
                </View>
                <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                  No expenses recorded yet
                </Text>
                <Text style={[styles.emptyStateSubtext, { color: theme.colors.text, opacity: 0.6 }]}>
                  Start tracking your expenses to see insights
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.addButton, { 
          backgroundColor: theme.colors.primary,
          shadowColor: theme.colors.text,
        }]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    position: 'relative',
  },
  rankingsContainer: {
    marginBottom: 20,
    paddingTop: 10,
  },
  rankingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankingNumber: {
    width: 25,
    fontSize: 14,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  rankingName: {
    fontSize: 14,
    fontWeight: '500',
  },
  rankingAmount: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  rankingPercentage: {
    fontSize: 12,
    textAlign: 'right',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expensesBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expensesBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding for FAB
  },
  chartsSection: {
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
  chartContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  chartWrapper: {
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  expenseListContainer: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  expenseListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  backButton: {
    padding: 5,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateTime: {
    padding: 20,
    borderBottomWidth: 1,
  },
  dateTimeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    marginLeft: 8,
  },
  timeText: {
    fontSize: 16,
    marginLeft: 8,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#808080',
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 15,
    color: '#FFF',
    fontSize: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  categoryButton: {
    backgroundColor: '#2C2C2C',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    margin: 5,
  },
  categoryButtonActive: {
    backgroundColor: '#FF6B00',
  },
  categoryButtonText: {
    color: '#808080',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: '#FFF',
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    padding: 20,
    marginTop: 'auto',
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#2C2C2C',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#808080',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  category: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  note: {
    fontSize: 14,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  deleteHint: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deleteHintText: {
    fontSize: 10,
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  chartsSection: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2C',
    borderRadius: 20,
    padding: 4,
  },
  periodButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  periodButtonText: {
    color: '#808080',
    fontSize: 14,
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  chartSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  pieChart: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
  barChart: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: 'center',
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  card: {
    margin: 15,
    padding: 15,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  predictionContainer: {
    marginBottom: 20,
  },
  predictionLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  predictionAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3B3020',
    padding: 10,
    borderRadius: 8,
  },
  warningText: {
    color: '#FF3B30',
    marginLeft: 8,
    fontSize: 14,
  },
  recommendationsContainer: {
    marginTop: 10,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  recommendationText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ExpenseScreen;
