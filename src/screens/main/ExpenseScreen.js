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
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { LineChart, PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

const ExpenseScreen = ({ navigation }) => {
  const { expenses, addExpense, deleteExpense, budget } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // 'week' or 'month'
  const [predictions, setPredictions] = useState({
    nextMonthExpense: 0,
    recommendations: []
  });
  
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
      food: '#FFF0DC',
      transportation: '#F0BB78',
      entertainment: '#543A14',
      shopping: '#FF885B',
      utilities: '#A04747',
      others: '#EEDF7A'
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
    barPercentage: 0.5,
    useShadowColorFromDataset: false
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
      date: currentDate.toISOString()
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

    return (
      <TouchableOpacity 
        style={[styles.expenseItem, { backgroundColor: theme.colors.card }]}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.expenseInfo}>
          <Text style={[styles.category, { color: theme.colors.text }]}>{item.category}</Text>
          <Text style={[styles.note, { color: theme.colors.text, opacity: 0.6 }]}>{item.note}</Text>
          <Text style={[styles.date, { color: theme.colors.text, opacity: 0.6 }]}>{dateString}</Text>
        </View>
        <Text style={[styles.amount, { color: theme.colors.primary }]}>₱{item.amount.toFixed(2)}</Text>
      </TouchableOpacity>
    );
  };

  // Calculate AI predictions and recommendations
  useEffect(() => {
    const calculatePredictions = () => {
      // Calculate average daily spending rate
      const monthStart = new Date();
      monthStart.setDate(1);
      const monthExpenses = expenses.filter(exp => new Date(exp.date) >= monthStart);
      const dailyRate = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0) / 
        (new Date().getDate());

      // Predict next month's expenses
      const daysInNextMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 2,
        0
      ).getDate();
      const predictedExpense = dailyRate * daysInNextMonth;

      // Generate smart recommendations
      const recommendations = [];
      
      // Check for frequent small expenses
      const frequentCategories = {};
      monthExpenses.forEach(exp => {
        if (exp.amount < 100) { // Small expense threshold
          frequentCategories[exp.category] = (frequentCategories[exp.category] || 0) + 1;
        }
      });

      Object.entries(frequentCategories).forEach(([category, count]) => {
        if (count > 5) { // Threshold for "frequent" expenses
          recommendations.push({
            type: 'consolidation',
            category,
            message: `Consider buying ${category} items in bulk to save money on frequent small purchases.`
          });
        }
      });

      // Check for category overspending
      Object.entries(budget.categories).forEach(([category, data]) => {
        if (data.spent > data.limit * 0.9) { // 90% of budget
          recommendations.push({
            type: 'warning',
            category,
            message: `You're close to your ${category} budget. Consider limiting these expenses.`
          });
        }
      });

      // Suggest optimal timing for expenses
      const expensesByDay = {};
      expenses.forEach(exp => {
        const day = new Date(exp.date).getDay();
        expensesByDay[day] = (expensesByDay[day] || 0) + exp.amount;
      });

      const mostExpensiveDay = Object.entries(expensesByDay)
        .sort(([, a], [, b]) => b - a)[0];

      if (mostExpensiveDay) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        recommendations.push({
          type: 'optimization',
          message: `You tend to spend more on ${days[mostExpensiveDay[0]]}s. Consider planning your expenses on other days.`
        });
      }

      setPredictions({
        nextMonthExpense: predictedExpense,
        recommendations
      });
    };

    calculatePredictions();
  }, [expenses, budget]);

  const renderPredictions = () => (
    <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>AI Insights</Text>

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
          Smart Recommendations
        </Text>
        {predictions.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationItem}>
            <Ionicons
              name={
                rec.type === 'warning' ? 'alert-circle-outline' :
                rec.type === 'optimization' ? 'trending-up-outline' :
                'cart-outline'
              }
              size={24}
              color={
                rec.type === 'warning' ? '#FF3B30' :
                rec.type === 'optimization' ? '#4CD964' :
                theme.colors.primary
              }
            />
            <Text style={[styles.recommendationText, { color: theme.colors.text }]}>
              {rec.message}
            </Text>
          </View>
        ))}
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
            <Text style={[styles.dateText, { color: theme.colors.text }]}>{formattedDate}</Text>
            <Text style={[styles.timeText, { color: theme.colors.text, opacity: 0.6 }]}>{formattedTime}</Text>
          </View>
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
        <View style={styles.headerContainer}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Expenses</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          nestedScrollEnabled={true}
        >
          {/* Charts Section */}
          <View style={styles.chartsSection}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Expense Summary</Text>
              <View style={[styles.periodSelector, { backgroundColor: theme.colors.card }]}>
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
                <>
                  <Text style={[styles.chartSubtitle, { color: theme.colors.text }]}>Expenses by Category</Text>
                  <PieChart
                    data={charts.pieChart}
                    width={screenWidth - 40}
                    height={200}
                    chartConfig={chartConfig}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="0"
                    absolute
                  />
                </>
              ) : (
                <Text style={[styles.noDataText, { color: theme.colors.text }]}>No expense data available</Text>
              )}

              {/* Line Chart */}
              <Text style={[styles.chartSubtitle, { color: theme.colors.text }]}>
                {selectedPeriod === 'week' ? 'Daily' : 'Weekly'} Expenses
              </Text>
              <LineChart
                data={charts.lineChart}
                width={screenWidth - 40}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.lineChart}
                fromZero
              />
            </View>
          </View>

          {/* AI Predictions */}
          {renderPredictions()}

          {/* Expense List */}
          <View style={styles.expenseListContainer}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recent Expenses</Text>
            {expenses.length > 0 ? (
              <FlatList
                data={expenses.slice().reverse()}
                renderItem={renderExpenseItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={50} color={theme.colors.text} opacity={0.3} />
                <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>
                  No expenses recorded yet
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
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
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Extra padding for FAB
  },
  chartsSection: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  expenseListContainer: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 15,
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
    marginTop: 5,
  },
  dateText: {
    fontSize: 16,
  },
  timeText: {
    fontSize: 16,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    color: '#808080',
    fontSize: 16,
    marginTop: 10,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  expenseInfo: {
    flex: 1,
  },
  category: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  note: {
    fontSize: 14,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
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
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  lineChart: {
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
