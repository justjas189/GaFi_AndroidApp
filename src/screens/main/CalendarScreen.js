import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';

const CalendarScreen = ({ navigation }) => {
 
  const [selected, setSelected] = useState('');
  const { expenses } = useContext(DataContext);
  const { theme, isDarkMode } = useContext(ThemeContext);
  const currentDate = new Date().toISOString().split('T')[0];
  
  // Get expenses for selected date
  const selectedDateExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    const selectedDate = new Date(selected);
    return (
      expenseDate.getFullYear() === selectedDate.getFullYear() &&
      expenseDate.getMonth() === selectedDate.getMonth() &&
      expenseDate.getDate() === selectedDate.getDate()
    );
  });

  // Create marked dates object for calendar
  const markedDates = expenses.reduce((acc, expense) => {
    const date = expense.date.split('T')[0];
    acc[date] = { marked: true, dotColor: theme.colors.primary };
    return acc;
  }, {});

  // Add selected date marking
  if (selected) {
    markedDates[selected] = {
      ...(markedDates[selected] || {}),
      selected: true,
      selectedColor: theme.colors.primary
    };
  }

  const renderExpenseItem = ({ item }) => (
    <TouchableOpacity 
      key={item.id} 
      style={[styles.expenseItem, { 
        backgroundColor: theme.colors.card,
        shadowColor: theme.colors.text,
      }]}
    >
      <View style={styles.expenseLeft}>
        <View style={[styles.expenseIcon, { backgroundColor: getCategoryColor(item.category) }]}>
          <Ionicons name={getCategoryIcon(item.category)} size={20} color="white" />
        </View>
        <View style={styles.expenseDetails}>
          <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>{item.category}</Text>
          <Text style={[styles.expenseNote, { color: theme.colors.text }]} numberOfLines={2}>{item.note}</Text>
          <Text style={[styles.expenseTime, { color: theme.colors.text }]}>
            {new Date(item.date).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
      <View style={styles.expenseRight}>
        <Text style={[styles.expenseAmount, { color: theme.colors.primary }]}>₱{item.amount.toFixed(2)}</Text>
        <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(item.category) }]}>
          <Text style={styles.categoryTagText}>{item.category.charAt(0).toUpperCase()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getCategoryIcon = (category) => {
    const categoryMap = {
      food: 'restaurant-outline',
      transportation: 'car-outline',
      entertainment: 'game-controller-outline',
      shopping: 'bag-outline',
      utilities: 'flash-outline',
      others: 'ellipsis-horizontal-outline'
    };
    return categoryMap[category.toLowerCase()] || 'ellipsis-horizontal-outline';
  };

  const getCategoryColor = (category) => {
    const colorMap = {
      food: '#FF6B6B',
      transportation: '#4ECDC4',
      entertainment: '#45B7D1',
      shopping: '#96CEB4',
      utilities: '#FFEAA7',
      others: '#DDA0DD'
    };
    return colorMap[category.toLowerCase()] || '#DDA0DD';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Expense Calendar</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>Track your daily spending</Text>
      </View>
      
      <View style={[styles.calendarContainer, { backgroundColor: theme.colors.card }]}>
        <Calendar
          key={isDarkMode ? 'dark' : 'light'} // Force re-render on theme change
          onDayPress={day => {
            setSelected(day.dateString);
          }}
          markedDates={markedDates}
          theme={{
            backgroundColor: theme.colors.card,
            calendarBackground: theme.colors.card,
            textSectionTitleColor: theme.colors.text,
            selectedDayBackgroundColor: theme.colors.primary,
            selectedDayTextColor: theme.colors.card,
            todayTextColor: theme.colors.primary,
            dayTextColor: theme.colors.text,
            textDisabledColor: theme.colors.secondaryText,
            dotColor: theme.colors.primary,
            selectedDotColor: theme.colors.card,
            arrowColor: theme.colors.primary,
            monthTextColor: theme.colors.text,
            textMonthFontWeight: 'bold',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 14
          }}
        />
      </View>

      {selected ? (
        <View style={[styles.selectedDateContainer, { backgroundColor: theme.colors.background }]}>
          <View style={[styles.selectedDateHeader, { backgroundColor: theme.colors.card }]}>
            <View style={styles.selectedDateInfo}>
              <Ionicons name="calendar" size={24} color={theme.colors.primary} />
              <View style={styles.selectedDateTextContainer}>
                <Text style={[styles.selectedDateTitle, { color: theme.colors.text }]}>
                  {new Date(selected).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Text>
                <Text style={[styles.expenseCount, { color: theme.colors.text }]}>
                  {selectedDateExpenses.length} {selectedDateExpenses.length === 1 ? 'expense' : 'expenses'}
                </Text>
              </View>
            </View>
            {selectedDateExpenses.length > 0 && (
              <View style={[styles.totalAmount, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.totalAmountText, { color: theme.colors.background }]}>
                  ₱{selectedDateExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
          {selectedDateExpenses.length > 0 ? (
            <FlatList
              data={selectedDateExpenses}
              renderItem={renderExpenseItem}
              keyExtractor={item => item.id}
              style={styles.expensesList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.expensesListContent}
            />
          ) : (
            <View style={styles.emptyState}>
              <View style={[styles.emptyStateIcon, { backgroundColor: theme.colors.background }]}>
                <Ionicons name="receipt-outline" size={40} color={theme.colors.text} opacity={0.3} />
              </View>
              <Text style={[styles.noExpensesTitle, { color: theme.colors.text }]}>No expenses yet</Text>
              <Text style={[styles.noExpensesText, { color: theme.colors.text }]}>Start tracking your daily expenses</Text>
              <TouchableOpacity 
                style={[styles.addExpenseButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('Expenses', { showForm: true })}
              >
                <Ionicons name="add" size={20} color={theme.colors.background} />
                <Text style={[styles.addExpenseButtonText, { color: theme.colors.background }]}>Add Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      <TouchableOpacity 
        style={[styles.addButton, { 
          backgroundColor: theme.colors.primary,
          shadowColor: theme.colors.text,
        }]}
        onPress={() => navigation.navigate('Expenses', { showForm: true })}
      >
        <Ionicons name="add" size={24} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 15,
    borderRadius: 0,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  calendarContainer: {
    margin: 15,
    borderRadius: 16,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedDateContainer: {
    flex: 1,
    padding: 15,
  },
  selectedDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
    zIndex: 5,
  },
  selectedDateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Prevents flex overflow issues
  },
  selectedDateTextContainer: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0, // Prevents text overflow
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseCount: {
    fontSize: 14,
    opacity: 0.7,
  },
  totalAmount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  totalAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expensesList: {
    flex: 1,
  },
  expensesListContent: {
    paddingBottom: 120, // Increased to account for tab bar + floating button
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
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
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  expenseNote: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  expenseTime: {
    fontSize: 12,
    opacity: 0.5,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  categoryTag: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100, // Account for tab bar navigation
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noExpensesTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  noExpensesText: {
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 30,
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addExpenseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
});

export default CalendarScreen;
