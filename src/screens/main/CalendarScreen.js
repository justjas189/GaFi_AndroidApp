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
      style={[styles.expenseItem, { backgroundColor: theme.colors.card }]}
    >
      <View style={styles.expenseLeft}>
        <View style={[styles.expenseIcon, { backgroundColor: theme.colors.background }]}>
          <Ionicons name={getCategoryIcon(item.category)} size={20} color={theme.colors.primary} />
        </View>
        <View>
          <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>{item.category}</Text>
          <Text style={[styles.expenseNote, { color: theme.colors.text, opacity: 0.6 }]}>{item.note}</Text>
        </View>
      </View>
      <Text style={[styles.expenseAmount, { color: theme.colors.primary }]}>₱{item.amount.toFixed(2)}</Text>
    </TouchableOpacity>
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Calendar</Text>
      </View>
      
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

      {selected ? (
        <View style={[styles.selectedDateContainer, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.selectedDateTitle, { color: theme.colors.text }]}>Expenses for {selected}</Text>
          {selectedDateExpenses.length > 0 ? (
            <FlatList
              data={selectedDateExpenses}
              renderItem={renderExpenseItem}
              keyExtractor={item => item.id}
              style={styles.expensesList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={50} color={theme.colors.text} opacity={0.3} />
              <Text style={[styles.noExpensesText, { color: theme.colors.text, opacity: 0.6 }]}>No expenses recorded</Text>
            </View>
          )}
        </View>
      ) : null}

      <TouchableOpacity 
        style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('Expenses')}
      >
        <Ionicons name="add" size={24} color={theme.colors.background} />
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
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  selectedDateContainer: {
    flex: 1,
    padding: 20,
    borderTopWidth: 1,
  },
  selectedDateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  expensesList: {
    flex: 1,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  expenseCategory: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  expenseNote: {
    fontSize: 14,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noExpensesText: {
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
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default CalendarScreen;
