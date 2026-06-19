import React, { useState, useContext, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { getCategoryIcon } from '../../utils/categoryIcons';
import { normalizeCategory } from '../../utils/categoryUtils';
import { FONTS } from '../../theme/typography';

// Canonical names mirror ExpenseScreen's categoryColors — single source of truth.
const CATEGORY_COLORS = {
  'Food & Dining':  '#FF9800',
  'Transport':      '#2196F3',
  'Shopping':       '#E91E63',
  'Groceries':      '#8BC34A',
  'Entertainment':  '#9C27B0',
  'Electronics':    '#00BCD4',
  'School Supplies':'#3F51B5',
  'Utilities':      '#607D8B',
  'Health':         '#4CAF50',
  'Education':      '#673AB7',
  'Other':          '#795548',
  'No Spend Day':   '#2ECC71',
};

const getCategoryColor = (category) => CATEGORY_COLORS[normalizeCategory(category)] || '#795548';

// DB stores `date` as a full ISO timestamp (UTC). Format it to the LOCAL
// calendar day (YYYY-MM-DD) so dots, filtering, and the day picker all agree.
// Splitting the raw ISO string on 'T' would key dots by the UTC day, which
// drifts a day off the local day near midnight (and always in west-of-UTC zones).
const toLocalYMD = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// react-native-calendars hands back a 'YYYY-MM-DD' string. new Date(thatString)
// parses as UTC midnight, so display can land on the wrong day — rebuild it as a
// LOCAL date instead.
const parseLocalYMD = (ymd) => {
  if (!ymd) return new Date(NaN);
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const CalendarScreen = ({ navigation }) => {
 
  const [selected, setSelected] = useState('');
  const { expenses } = useContext(DataContext);
  const { theme, isDarkMode } = useContext(ThemeContext);
  const primaryColor = theme.colors.primary;

  // Expenses logged on the selected LOCAL day. Compare local-day strings on both
  // sides so a tap on June 12 shows exactly June 12's expenses.
  const selectedDateExpenses = useMemo(() => {
    if (!selected) return [];
    return expenses.filter(expense => toLocalYMD(expense.date) === selected);
  }, [expenses, selected]);

  // Total for the selected day (amount is a string from the DB).
  const selectedDateTotal = useMemo(
    () => selectedDateExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    [selectedDateExpenses]
  );

  // One orange dot per local day that has expenses, plus the selected-day highlight.
  // Rebuilt whenever expenses change, so adding an expense anywhere re-marks the
  // calendar automatically.
  const markedDates = useMemo(() => {
    const marks = {};
    for (const expense of expenses) {
      const day = toLocalYMD(expense.date);
      if (day) marks[day] = { marked: true, dotColor: primaryColor };
    }
    if (selected) {
      marks[selected] = {
        ...(marks[selected] || {}),
        selected: true,
        selectedColor: primaryColor,
      };
    }
    return marks;
  }, [expenses, selected, primaryColor]);

  const renderExpenseItem = useCallback(({ item }) => (
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
        <Text style={[styles.expenseAmount, { color: theme.colors.primary }]}>₱{(parseFloat(item.amount) || 0).toFixed(2)}</Text>
        <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(item.category) }]}>
          <Text style={styles.categoryTagText}>{item.category.charAt(0).toUpperCase()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [theme]);

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
            // Trailing/leading days (prev/next month) get a very faint color.
            // The library's Date logic determines which days are out-of-month —
            // no manual day-count hardcoding needed.
            textDisabledColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.13)',
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
                  {parseLocalYMD(selected).toLocaleDateString('en-US', {
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
                  ₱{selectedDateTotal.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
          {selectedDateExpenses.length > 0 ? (
            <FlatList
              data={selectedDateExpenses}
              renderItem={renderExpenseItem}
              keyExtractor={item => String(item.id)}
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
            </View>
          )}
        </View>
      ) : null}

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
    fontFamily: FONTS.headingBold,
    fontSize: 26,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.bodyRegular,
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
    fontFamily: FONTS.headingSemiBold,
    fontSize: 16,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  expenseCount: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
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
    fontFamily: FONTS.numberBold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
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
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  expenseNote: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  expenseTime: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    opacity: 0.5,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontFamily: FONTS.numberBold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
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
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: 'white',
  },
  emptyState: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100, // Account for tab bar navigation
  },
  emptyStateIcon: {
    flexDirection: 'column',
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  noExpensesTitle: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 20,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  noExpensesText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
    marginBottom: 20,
  },

});

export default CalendarScreen;
