import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
  SectionList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { AchievementService } from '../../services/AchievementService';
import { normalizeCategory } from '../../utils/categoryUtils';

const screenWidth = Dimensions.get('window').width;

const ExpenseScreen = ({ navigation, route }) => {
  const { expenses, addExpense, deleteExpense, budget } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  
  // View states
  const [viewMode, setViewMode] = useState('statistics'); // 'statistics' or 'detailed'
  const [showForm, setShowForm] = useState(false);
  
  // Form states
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  // Statistics view states
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // 'all', 'week', 'month', 'year', 'custom'
  
  // Date navigation states
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);
  const [showRangeStartPicker, setShowRangeStartPicker] = useState(false);
  const [showRangeEndPicker, setShowRangeEndPicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());

  // Detailed view states
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' or specific category

  const categories = [
    'Food & Dining',
    'Transport',
    'Shopping',
    'Groceries',
    'Entertainment',
    'Electronics',
    'School Supplies',
    'Utilities',
    'Health',
    'Education',
    'Other',
  ];

  const categoryColors = {
    'Food & Dining': '#FF9800',
    'Transport': '#2196F3',
    'Shopping': '#E91E63',
    'Groceries': '#8BC34A',
    'Entertainment': '#9C27B0',
    'Electronics': '#00BCD4',
    'School Supplies': '#3F51B5',
    'Utilities': '#607D8B',
    'Health': '#4CAF50',
    'Education': '#673AB7',
    'Other': '#795548',
    'No Spend Day': '#2ECC71',
  };

  // Check if we should show the form based on navigation params
  useEffect(() => {
    if (route?.params?.showForm) {
      setShowForm(true);
      if (route?.params?.preselectedDate) {
        setSelectedDate(new Date(route.params.preselectedDate));
      }
      navigation.setParams({ showForm: false, preselectedDate: undefined });
    }
  }, [route?.params?.showForm, route?.params?.preselectedDate, navigation]);

  // Process expenses data for charts
  const charts = useMemo(() => {
    const categoryTotals = {};
    const dailyTotals = {};
    let totalExpenses = 0;

    categories.forEach(cat => {
      categoryTotals[cat] = 0;
    });

    let filteredExpenses = [];
    let periodStart, periodEnd;

    if (selectedPeriod === 'week') {
      periodStart = new Date(selectedWeekStart);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
    } else if (selectedPeriod === 'month') {
      periodStart = new Date(selectedYear, selectedMonth, 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
    } else if (selectedPeriod === 'year') {
      periodStart = new Date(selectedYear, 0, 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    } else if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      periodStart = new Date(customStartDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(customEndDate);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      periodStart = null;
      periodEnd = null;
    }

    if (periodStart && periodEnd) {
      filteredExpenses = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= periodStart && expDate <= periodEnd;
      });
    } else {
      filteredExpenses = [...expenses];
    }

    filteredExpenses.forEach(expense => {
      const cat = normalizeCategory(expense.category);
      categoryTotals[cat] = (categoryTotals[cat] || 0) + expense.amount;
      totalExpenses += expense.amount;

      const date = new Date(expense.date).toISOString().split('T')[0];
      dailyTotals[date] = (dailyTotals[date] || 0) + expense.amount;
    });

    const pieChartData = Object.entries(categoryTotals)
      .filter(([_, value]) => value > 0)
      .sort(([_, a], [__, b]) => b - a)
      .map(([category, amount]) => ({
        name: category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        color: categoryColors[category] || categoryColors['Other'],
        legendFontColor: theme.colors.text,
        legendFontSize: 12,
      }));

    const dates = [];
    const amounts = [];
    
    if (selectedPeriod === 'week') {
      for (let i = 0; i < 7; i++) {
        const date = new Date(selectedWeekStart);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        dates.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
        amounts.push(dailyTotals[dateStr] || 0);
      }
    } else if (selectedPeriod === 'month') {
      const monthStart = new Date(selectedYear, selectedMonth, 1);
      const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);
      const totalDaysInMonth = monthEnd.getDate();
      const weeksInMonth = Math.ceil(totalDaysInMonth / 7);
      
      for (let weekNum = 0; weekNum < weeksInMonth; weekNum++) {
        const weekStart = new Date(monthStart);
        weekStart.setDate(1 + (weekNum * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());
        
        let weeklyTotal = 0;
        const currentDate = new Date(weekStart);
        while (currentDate <= weekEnd) {
          const dateStr = currentDate.toISOString().split('T')[0];
          weeklyTotal += dailyTotals[dateStr] || 0;
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        dates.push(`${weekStart.getDate()}-${weekEnd.getDate()}`);
        amounts.push(weeklyTotal);
      }
    } else if (selectedPeriod === 'year') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(selectedYear, m, 1);
        const mEnd = new Date(selectedYear, m + 1, 0);
        let monthTotal = 0;
        const currentDate = new Date(mStart);
        while (currentDate <= mEnd) {
          const dateStr = currentDate.toISOString().split('T')[0];
          monthTotal += dailyTotals[dateStr] || 0;
          currentDate.setDate(currentDate.getDate() + 1);
        }
        dates.push(monthNames[m]);
        amounts.push(monthTotal);
      }
    } else if (selectedPeriod === 'custom' && periodStart && periodEnd) {
      const diffDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays <= 14) {
        const currentDate = new Date(periodStart);
        while (currentDate <= periodEnd) {
          const dateStr = currentDate.toISOString().split('T')[0];
          dates.push(currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
          amounts.push(dailyTotals[dateStr] || 0);
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else if (diffDays <= 90) {
        const currentDate = new Date(periodStart);
        while (currentDate <= periodEnd) {
          const weekEndDate = new Date(currentDate);
          weekEndDate.setDate(weekEndDate.getDate() + 6);
          if (weekEndDate > periodEnd) weekEndDate.setTime(periodEnd.getTime());
          let weekTotal = 0;
          const d = new Date(currentDate);
          while (d <= weekEndDate) {
            const dateStr = d.toISOString().split('T')[0];
            weekTotal += dailyTotals[dateStr] || 0;
            d.setDate(d.getDate() + 1);
          }
          dates.push(`${currentDate.getDate()}/${currentDate.getMonth()+1}`);
          amounts.push(weekTotal);
          currentDate.setDate(currentDate.getDate() + 7);
        }
      } else {
        const currentDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
        while (currentDate <= periodEnd) {
          const mEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          let monthTotal = 0;
          const d = new Date(Math.max(currentDate.getTime(), periodStart.getTime()));
          const endLimit = new Date(Math.min(mEnd.getTime(), periodEnd.getTime()));
          while (d <= endLimit) {
            const dateStr = d.toISOString().split('T')[0];
            monthTotal += dailyTotals[dateStr] || 0;
            d.setDate(d.getDate() + 1);
          }
          dates.push(currentDate.toLocaleDateString('en-US', { month: 'short' }));
          amounts.push(monthTotal);
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    } else {
      // 'all' - show monthly buckets for last 6 months
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
        let monthTotal = 0;
        const currentDate = new Date(mStart);
        while (currentDate <= mEnd) {
          const dateStr = currentDate.toISOString().split('T')[0];
          monthTotal += dailyTotals[dateStr] || 0;
          currentDate.setDate(currentDate.getDate() + 1);
        }
        dates.push(mStart.toLocaleDateString('en-US', { month: 'short' }));
        amounts.push(monthTotal);
      }
    }

    return {
      pieChart: pieChartData,
      barChart: {
        labels: dates,
        datasets: [{ data: amounts.length > 0 ? amounts : [0] }]
      },
      totalExpenses,
      filteredCount: filteredExpenses.length
    };
  }, [expenses, selectedPeriod, selectedWeekStart, selectedMonth, selectedYear, customStartDate, customEndDate, theme.colors.text]);

  // Group expenses by date for detailed view
  const groupedExpenses = useMemo(() => {
    let filtered = [...expenses];

    // Apply time filter based on selectedPeriod and navigation states
    if (selectedPeriod === 'week') {
      const weekStart = new Date(selectedWeekStart);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter(exp => {
        const d = new Date(exp.date);
        return d >= weekStart && d <= weekEnd;
      });
    } else if (selectedPeriod === 'month') {
      const monthStart = new Date(selectedYear, selectedMonth, 1);
      const monthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      filtered = filtered.filter(exp => {
        const d = new Date(exp.date);
        return d >= monthStart && d <= monthEnd;
      });
    } else if (selectedPeriod === 'year') {
      const yearStart = new Date(selectedYear, 0, 1);
      const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
      filtered = filtered.filter(exp => {
        const d = new Date(exp.date);
        return d >= yearStart && d <= yearEnd;
      });
    } else if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(exp => {
        const d = new Date(exp.date);
        return d >= start && d <= end;
      });
    }
    // 'all' - no date filter

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(exp => normalizeCategory(exp.category) === categoryFilter);
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group by date
    const groups = {};
    filtered.forEach(expense => {
      const dateKey = new Date(expense.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[dateKey]) {
        groups[dateKey] = { title: dateKey, data: [], total: 0 };
      }
      groups[dateKey].data.push(expense);
      groups[dateKey].total += expense.amount;
    });

    return Object.values(groups);
  }, [expenses, selectedPeriod, categoryFilter, selectedWeekStart, selectedMonth, selectedYear, customStartDate, customEndDate]);

  const chartConfig = {
    backgroundColor: theme.colors.background,
    backgroundGradientFrom: theme.colors.background,
    backgroundGradientTo: theme.colors.background,
    color: (opacity = 1) => theme.colors.primary + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    labelColor: (opacity = 1) => theme.colors.text + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    strokeWidth: 2,
    barPercentage: 0.7,
    decimalPlaces: 0,
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: theme.colors.text + '20',
      strokeWidth: 1
    },
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const formatSelectedDate = (date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const formatSelectedTime = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getCategoryIcon = (category) => {
    const canonical = normalizeCategory(category);
    const categoryMap = {
      'Food & Dining': 'fast-food-outline',
      'Transport': 'bus-outline',
      'Shopping': 'cart-outline',
      'Groceries': 'nutrition-outline',
      'Entertainment': 'film-outline',
      'Electronics': 'phone-portrait-outline',
      'School Supplies': 'book-outline',
      'Utilities': 'build-outline',
      'Health': 'medkit-outline',
      'Education': 'school-outline',
      'Other': 'apps-outline',
      'No Spend Day': 'checkmark-circle-outline',
    };
    return categoryMap[canonical] || 'apps-outline';
  };

  // ========== PERIOD NAVIGATION ==========
  const navigatePeriod = (direction) => {
    const delta = direction === 'prev' ? -1 : 1;
    if (selectedPeriod === 'week') {
      const newStart = new Date(selectedWeekStart);
      newStart.setDate(newStart.getDate() + (delta * 7));
      setSelectedWeekStart(newStart);
    } else if (selectedPeriod === 'month') {
      let newMonth = selectedMonth + delta;
      let newYear = selectedYear;
      if (newMonth > 11) { newMonth = 0; newYear++; }
      if (newMonth < 0) { newMonth = 11; newYear--; }
      setSelectedMonth(newMonth);
      setSelectedYear(newYear);
    } else if (selectedPeriod === 'year') {
      setSelectedYear(prev => prev + delta);
    }
  };

  const canNavigateForward = () => {
    const now = new Date();
    if (selectedPeriod === 'week') {
      const weekEnd = new Date(selectedWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return weekEnd < now;
    } else if (selectedPeriod === 'month') {
      return selectedYear < now.getFullYear() || 
        (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
    } else if (selectedPeriod === 'year') {
      return selectedYear < now.getFullYear();
    }
    return false;
  };

  const getPeriodLabel = () => {
    if (selectedPeriod === 'week') {
      const start = new Date(selectedWeekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    } else if (selectedPeriod === 'month') {
      return new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (selectedPeriod === 'year') {
      return `${selectedYear}`;
    } else if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      const startStr = customStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = customEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${startStr} - ${endStr}`;
    }
    return 'All Time';
  };

  const resetToCurrentPeriod = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setSelectedWeekStart(monday);
  };

  const openCustomRange = () => {
    setTempStartDate(customStartDate || new Date());
    setTempEndDate(customEndDate || new Date());
    setShowCustomRangeModal(true);
  };

  const applyCustomRange = () => {
    if (tempStartDate > tempEndDate) {
      Alert.alert('Invalid Range', 'Start date must be before end date');
      return;
    }
    setCustomStartDate(new Date(tempStartDate));
    setCustomEndDate(new Date(tempEndDate));
    setSelectedPeriod('custom');
    setShowCustomRangeModal(false);
  };

  const getBarChartTitle = () => {
    if (selectedPeriod === 'week') return 'Daily Spending';
    if (selectedPeriod === 'month') return 'Weekly Spending';
    if (selectedPeriod === 'year') return 'Monthly Spending';
    if (selectedPeriod === 'custom') return 'Spending Breakdown';
    return 'Monthly Spending (Last 6 Months)';
  };

  const handleSave = async () => {
    if (!amount || !category) {
      Alert.alert('Error', 'Please fill in amount and category');
      return;
    }

    const newExpense = {
      amount: parseFloat(amount),
      category,
      note,
      description,
      date: selectedDate.toISOString()
    };

    addExpense(newExpense);
    
    try {
      const achievements = await AchievementService.checkAndAwardAchievements(null, 'expense_track');
      if (achievements.length > 0) {
        const achievement = achievements[0];
        setTimeout(() => {
          Alert.alert(
            '🏆 Achievement Unlocked!',
            `${achievement.icon} ${achievement.title}\n${achievement.description}\n\n+${achievement.points} points!`,
            [{ text: 'Awesome!', style: 'default' }]
          );
        }, 500);
      }
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
    
    setShowForm(false);
    resetForm();
  };

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDescription('');
    setSelectedDate(new Date());
  };

  const onDateChange = (event, date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      const newDate = new Date(selectedDate);
      newDate.setFullYear(date.getFullYear());
      newDate.setMonth(date.getMonth());
      newDate.setDate(date.getDate());
      setSelectedDate(newDate);
    }
  };

  const onTimeChange = (event, time) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (time) {
      const newDate = new Date(selectedDate);
      newDate.setHours(time.getHours());
      newDate.setMinutes(time.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteExpense(id) }
      ]
    );
  };

  // Render expense item for detailed view
  const renderExpenseItem = ({ item }) => {
    const expenseDate = new Date(item.date);
    const timeString = expenseDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity 
        style={[styles.expenseItem, { backgroundColor: theme.colors.card }]}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.expenseLeft}>
          <View style={[styles.expenseIcon, { backgroundColor: (categoryColors[normalizeCategory(item.category)] || '#795548') + '20' }]}>
            <Ionicons name={getCategoryIcon(item.category)} size={20} color={categoryColors[normalizeCategory(item.category)] || '#795548'} />
          </View>
          <View style={styles.expenseInfo}>
            <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>{normalizeCategory(item.category)}</Text>
            {item.note && (
              <Text style={[styles.expenseNote, { color: theme.colors.text }]} numberOfLines={1}>{item.note}</Text>
            )}
            <Text style={[styles.expenseTime, { color: theme.colors.text }]}>{timeString}</Text>
          </View>
        </View>
        <Text style={[styles.expenseAmount, { color: '#FF4444' }]}>-₱{item.amount.toFixed(2)}</Text>
      </TouchableOpacity>
    );
  };

  // Render section header for grouped expenses
  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{section.title}</Text>
      <Text style={[styles.sectionTotal, { color: theme.colors.primary }]}>
        {formatCurrency(section.total)}
      </Text>
    </View>
  );

  // ========== CUSTOM DATE RANGE MODAL ==========
  const renderCustomRangeModal = () => (
    <Modal
      visible={showCustomRangeModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowCustomRangeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Custom Date Range</Text>
          
          <View style={styles.rangeDateRow}>
            <Text style={[styles.rangeDateLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>From</Text>
            <TouchableOpacity
              style={[styles.rangeDateButton, { backgroundColor: theme.colors.background }]}
              onPress={() => setShowRangeStartPicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.rangeDateText, { color: theme.colors.text }]}>
                {tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
          </View>

          {showRangeStartPicker && (
            <DateTimePicker
              value={tempStartDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(e, date) => {
                setShowRangeStartPicker(Platform.OS === 'ios');
                if (date) setTempStartDate(date);
              }}
            />
          )}

          <View style={styles.rangeDateRow}>
            <Text style={[styles.rangeDateLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>To</Text>
            <TouchableOpacity
              style={[styles.rangeDateButton, { backgroundColor: theme.colors.background }]}
              onPress={() => setShowRangeEndPicker(true)}
            >
              <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.rangeDateText, { color: theme.colors.text }]}>
                {tempEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </TouchableOpacity>
          </View>

          {showRangeEndPicker && (
            <DateTimePicker
              value={tempEndDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={(e, date) => {
                setShowRangeEndPicker(Platform.OS === 'ios');
                if (date) setTempEndDate(date);
              }}
            />
          )}

          <View style={styles.rangeButtonRow}>
            <TouchableOpacity
              style={[styles.rangeApplyButton, { backgroundColor: theme.colors.primary }]}
              onPress={applyCustomRange}
            >
              <Text style={styles.rangeApplyText}>Apply Range</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rangeCancelButton, { backgroundColor: theme.colors.background }]}
              onPress={() => setShowCustomRangeModal(false)}
            >
              <Text style={[styles.rangeCancelText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // ========== ADD EXPENSE FORM ==========
  if (showForm) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView>
          <View style={[styles.formHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowForm(false)}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.formTitle, { color: theme.colors.text }]}>Add Expense</Text>
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.badgeText}>New</Text>
            </View>
          </View>

          <View style={[styles.dateTimeSection, { borderBottomColor: theme.colors.border }]}>
            <Text style={[styles.label, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Date & Time</Text>
            <View style={styles.dateTimeContent}>
              <TouchableOpacity 
                style={[styles.dateTimeButton, { backgroundColor: theme.colors.card }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>
                  {formatSelectedDate(selectedDate)}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.dateTimeButton, { backgroundColor: theme.colors.card }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>
                  {formatSelectedTime(selectedDate)}
                </Text>
              </TouchableOpacity>
            </View>
            
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
            
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
              <Text style={[styles.label, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Amount</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholderTextColor={theme.colors.text + '80'}
                placeholder="0.00"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Category</Text>
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
                      { color: theme.colors.textSecondary || theme.colors.text + '80' },
                      category === cat && { color: '#FFF' }
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Note</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
                value={note}
                onChangeText={setNote}
                placeholderTextColor={theme.colors.text + '80'}
                placeholder="Add a short note"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput, { backgroundColor: theme.colors.card, color: theme.colors.text, borderColor: theme.colors.border }]}
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
              onPress={() => { setShowForm(false); resetForm(); }}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ========== STATISTICS VIEW ==========
  if (viewMode === 'statistics') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Expenses</Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
                {getPeriodLabel()} Overview
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={[styles.calendarIconButton, { backgroundColor: theme.colors.card }]}
                onPress={() => navigation.navigate('Calendar')}
              >
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.detailedButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setViewMode('detailed')}
              >
                <Ionicons name="list" size={16} color="#FFF" />
                <Text style={styles.detailedButtonText}>Detailed</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: theme.colors.card }]}>
                <Ionicons name="wallet-outline" size={24} color={theme.colors.primary} />
                <Text style={[styles.summaryAmount, { color: theme.colors.text }]}>
                  {formatCurrency(charts.totalExpenses)}
                </Text>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Total Spent</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: theme.colors.card }]}>
                <Ionicons name="receipt-outline" size={24} color="#4ECDC4" />
                <Text style={[styles.summaryAmount, { color: theme.colors.text }]}>{charts.filteredCount}</Text>
                <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Transactions</Text>
              </View>
            </View>

            {/* Period Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScrollContainer}>
              {[
                { key: 'all', label: 'All' },
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
                { key: 'year', label: 'Year' },
                { key: 'custom', label: 'Custom' },
              ].map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.periodChip, { backgroundColor: theme.colors.card }, selectedPeriod === key && { backgroundColor: theme.colors.primary }]}
                  onPress={() => {
                    if (key === 'custom') {
                      openCustomRange();
                    } else {
                      setSelectedPeriod(key);
                      if (key !== 'all') resetToCurrentPeriod();
                    }
                  }}
                >
                  <Text style={[styles.periodChipText, { color: selectedPeriod === key ? '#FFF' : theme.colors.text }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Period Navigation */}
            {(selectedPeriod === 'week' || selectedPeriod === 'month' || selectedPeriod === 'year') && (
              <View style={[styles.periodNavRow, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity
                  style={styles.periodNavButton}
                  onPress={() => navigatePeriod('prev')}
                >
                  <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={resetToCurrentPeriod}>
                  <Text style={[styles.periodNavLabel, { color: theme.colors.text }]}>{getPeriodLabel()}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodNavButton, !canNavigateForward() && { opacity: 0.3 }]}
                  onPress={() => canNavigateForward() && navigatePeriod('next')}
                  disabled={!canNavigateForward()}
                >
                  <Ionicons name="chevron-forward" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {selectedPeriod === 'custom' && customStartDate && customEndDate && (
              <View style={[styles.periodNavRow, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.periodNavLabel, { color: theme.colors.text }]}>{getPeriodLabel()}</Text>
                <TouchableOpacity onPress={openCustomRange}>
                  <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Spending by Category - Pie Chart */}
            <View style={[styles.chartCard, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>Spending by Category</Text>
              
              {charts.pieChart.length > 0 ? (
                <>
                  <PieChart
                    data={charts.pieChart}
                    width={screenWidth - 64}
                    height={200}
                    chartConfig={chartConfig}
                    accessor="amount"
                    backgroundColor="transparent"
                    paddingLeft="15"
                    center={[10, 0]}
                    absolute
                    hasLegend={false}
                  />
                  
                  {/* Category Rankings */}
                  <View style={styles.rankingsContainer}>
                    <Text style={[styles.rankingsTitle, { color: theme.colors.text }]}>
                      Category Rankings
                    </Text>
                    {charts.pieChart.map((item, index) => (
                      <View key={item.name} style={styles.rankingItem}>
                        <View style={styles.rankingLeft}>
                          <View style={[styles.rankBadge, { backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : theme.colors.border }]}>
                            <Text style={[styles.rankNumber, { color: index < 3 ? '#000' : theme.colors.text }]}>{index + 1}</Text>
                          </View>
                          <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                          <Text style={[styles.rankingName, { color: theme.colors.text }]}>{item.name}</Text>
                        </View>
                        <View style={styles.rankingRight}>
                          <Text style={[styles.rankingAmount, { color: theme.colors.primary }]}>
                            {formatCurrency(item.amount)}
                          </Text>
                          <Text style={[styles.rankingPercent, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
                            {item.percentage.toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="pie-chart-outline" size={48} color={theme.colors.textSecondary || theme.colors.text + '80'} />
                  <Text style={[styles.noDataText, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>No expenses yet</Text>
                </View>
              )}
            </View>

            {/* Spending Trends - Bar Chart */}
            <View style={[styles.chartCard, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.chartTitle, { color: theme.colors.text }]}>
                {getBarChartTitle()}
              </Text>
              
              <BarChart
                data={charts.barChart}
                width={screenWidth - 64}
                height={220}
                chartConfig={{
                  ...chartConfig,
                  fillShadowGradient: theme.colors.primary,
                  fillShadowGradientOpacity: 0.8,
                  barRadius: 6,
                }}
                style={styles.chart}
                fromZero
                showBarTops={false}
                showValuesOnTopOfBars={true}
              />
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* FAB 
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowForm(true)}
          >
            <Ionicons name="add" size={28} color="#FFF" />
          </TouchableOpacity>*/}
        </View>
        {renderCustomRangeModal()}
      </SafeAreaView>
    );
  }

  // ========== DETAILED VIEW ==========
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.mainContainer}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={[styles.backButtonSmall, { backgroundColor: theme.colors.card }]}
              onPress={() => setViewMode('statistics')}
            >
              <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
            </TouchableOpacity>
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Detailed Expenses</Text>
              <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
                {groupedExpenses.reduce((sum, g) => sum + g.data.length, 0)} transactions
              </Text>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={[styles.filtersContainer, { backgroundColor: theme.colors.card }]}>
          {/* Time Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Period:</Text>
            {[
              { key: 'all', label: 'All Time' },
              { key: 'week', label: 'Week' },
              { key: 'month', label: 'Month' },
              { key: 'year', label: 'Year' },
              { key: 'custom', label: 'Custom' },
            ].map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, selectedPeriod === key && { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  if (key === 'custom') {
                    openCustomRange();
                  } else {
                    setSelectedPeriod(key);
                    if (key !== 'all') resetToCurrentPeriod();
                  }
                }}
              >
                <Text style={[styles.filterChipText, { color: selectedPeriod === key ? '#FFF' : theme.colors.text }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Navigation for navigable periods */}
          {(selectedPeriod === 'week' || selectedPeriod === 'month' || selectedPeriod === 'year') && (
            <View style={styles.detailNavRow}>
              <TouchableOpacity onPress={() => navigatePeriod('prev')}>
                <Ionicons name="chevron-back" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={resetToCurrentPeriod}>
                <Text style={[styles.detailNavLabel, { color: theme.colors.text }]}>{getPeriodLabel()}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[!canNavigateForward() && { opacity: 0.3 }]}
                onPress={() => canNavigateForward() && navigatePeriod('next')}
                disabled={!canNavigateForward()}
              >
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {selectedPeriod === 'custom' && customStartDate && customEndDate && (
            <View style={styles.detailNavRow}>
              <Text style={[styles.detailNavLabel, { color: theme.colors.text }]}>{getPeriodLabel()}</Text>
              <TouchableOpacity onPress={openCustomRange}>
                <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Category Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>Category:</Text>
            <TouchableOpacity
              style={[styles.filterChip, categoryFilter === 'all' && { backgroundColor: theme.colors.primary }]}
              onPress={() => setCategoryFilter('all')}
            >
              <Text style={[styles.filterChipText, { color: categoryFilter === 'all' ? '#FFF' : theme.colors.text }]}>
                All
              </Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterChip, 
                  categoryFilter === cat && { backgroundColor: categoryColors[cat] }
                ]}
                onPress={() => setCategoryFilter(cat)}
              >
                <Text style={[
                  styles.filterChipText, 
                  { color: categoryFilter === cat ? '#FFF' : theme.colors.text }
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Expense List Grouped by Date */}
        {groupedExpenses.length > 0 ? (
          <SectionList
            sections={groupedExpenses}
            keyExtractor={(item) => item.id}
            renderItem={renderExpenseItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={true}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={theme.colors.textSecondary || theme.colors.text + '80'} />
            <Text style={[styles.emptyStateText, { color: theme.colors.text }]}>No expenses found</Text>
            <Text style={[styles.emptyStateSubtext, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
              Try adjusting your filters
            </Text>
          </View>
        )}

        {/* FAB 
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>*/}
      </View>
      {renderCustomRangeModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  detailedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  detailedButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },

  // Period Selector
  periodContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Charts
  chartCard: {
    margin: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -16,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
  },

  // Rankings
  rankingsContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  rankingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  rankingName: {
    fontSize: 14,
    fontWeight: '500',
  },
  rankingRight: {
    alignItems: 'flex-end',
  },
  rankingAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  rankingPercent: {
    fontSize: 12,
    marginTop: 2,
  },

  // Highlight Card
  highlightCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  highlightIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  highlightContent: {
    flex: 1,
  },
  highlightLabel: {
    fontSize: 12,
  },
  highlightCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  highlightAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },

  // Filters
  filtersContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    marginRight: 10,
    alignSelf: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTotal: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Expense Item
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: 15,
    fontWeight: '600',
  },
  expenseNote: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  expenseTime: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  // List
  listContent: {
    paddingBottom: 100,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    marginTop: 8,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Form Styles
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 5,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateTimeSection: {
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
    paddingVertical: 10,
    borderRadius: 8,
    flex: 0.48,
    justifyContent: 'center',
  },
  dateTimeText: {
    fontSize: 14,
    marginLeft: 8,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    margin: 5,
  },
  categoryButtonText: {
    fontSize: 14,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    padding: 20,
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
  },

  // Period Chips (scrollable)
  periodScrollContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  periodChipText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Period Navigation Row
  periodNavRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 16,
  },
  periodNavButton: {
    padding: 4,
  },
  periodNavLabel: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Detail View Navigation
  detailNavRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 16,
  },
  detailNavLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Custom Range Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  rangeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rangeDateLabel: {
    fontSize: 14,
    fontWeight: '600',
    width: 50,
  },
  rangeDateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  rangeDateText: {
    fontSize: 15,
  },
  rangeButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  rangeApplyButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  rangeApplyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rangeCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  rangeCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExpenseScreen;