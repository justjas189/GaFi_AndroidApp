// src/components/NotificationSettings.js
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '../MonT/services/NotificationService';
import { useTheme } from '../context/ThemeContext';

const NotificationSettings = () => {
  const { theme } = useTheme();
  const [expenseReminder, setExpenseReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [goalReminders, setGoalReminders] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load saved settings from AsyncStorage
      const savedTime = await AsyncStorage.getItem('expense_reminder_time');
      if (savedTime) {
        const { hour, minute } = JSON.parse(savedTime);
        const time = new Date();
        time.setHours(hour, minute);
        setReminderTime(time);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const handleExpenseReminderToggle = async (value) => {
    setExpenseReminder(value);
    
    if (value) {
      await NotificationService.scheduleDailyExpenseReminder(
        reminderTime.getHours(),
        reminderTime.getMinutes()
      );
      Alert.alert('MonT Reminder Set! 🔔', 'I\'ll remind you daily to track your expenses!');
    } else {
      await NotificationService.cancelNotification('daily-expense-reminder');
      Alert.alert('Reminder Disabled', 'MonT will no longer send daily expense reminders.');
    }
  };

  const handleTimeChange = async (event, selectedTime) => {
    setShowTimePicker(false);
    
    if (selectedTime) {
      setReminderTime(selectedTime);
      
      if (expenseReminder) {
        await NotificationService.scheduleDailyExpenseReminder(
          selectedTime.getHours(),
          selectedTime.getMinutes()
        );
        Alert.alert('Time Updated! ⏰', `MonT will remind you at ${selectedTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text }]}>
        Notifications
      </Text>
      
      {/* Daily Expense Reminder */}
      <View style={[styles.setting, { backgroundColor: theme.colors.card }]}>
        <View style={styles.settingHeader}>
          <Ionicons name="alarm-outline" size={24} color={theme.colors.primary} />
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
              Daily Expense Reminder
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              MonT will remind you to track expenses
            </Text>
          </View>
          <Switch
            value={expenseReminder}
            onValueChange={handleExpenseReminderToggle}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={expenseReminder ? '#fff' : theme.colors.textSecondary}
          />
        </View>
        
        {expenseReminder && (
          <TouchableOpacity
            style={[styles.timeSelector, { borderColor: theme.colors.border }]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={[styles.timeText, { color: theme.colors.text }]}>
              Reminder Time: {reminderTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Budget Alerts */}
      <View style={[styles.setting, { backgroundColor: theme.colors.card }]}>
        <View style={styles.settingHeader}>
          <Ionicons name="warning-outline" size={24} color={theme.colors.warning} />
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
              Budget Alerts
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              Get notified when approaching budget limits
            </Text>
          </View>
          <Switch
            value={budgetAlerts}
            onValueChange={setBudgetAlerts}
            trackColor={{ false: theme.colors.border, true: theme.colors.warning }}
            thumbColor={budgetAlerts ? '#fff' : theme.colors.textSecondary}
          />
        </View>
      </View>

      {/* Goal Reminders */}
      <View style={[styles.setting, { backgroundColor: theme.colors.card }]}>
        <View style={styles.settingHeader}>
          <Ionicons name="trophy-outline" size={24} color={theme.colors.success} />
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: theme.colors.text }]}>
              Goal Reminders
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              Reminders for upcoming goal deadlines
            </Text>
          </View>
          <Switch
            value={goalReminders}
            onValueChange={setGoalReminders}
            trackColor={{ false: theme.colors.border, true: theme.colors.success }}
            thumbColor={goalReminders ? '#fff' : theme.colors.textSecondary}
          />
        </View>
      </View>

      {showTimePicker && (
        <DateTimePicker
          value={reminderTime}
          mode="time"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  setting: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  timeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default NotificationSettings;