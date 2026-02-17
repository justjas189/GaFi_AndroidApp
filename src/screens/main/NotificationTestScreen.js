// src/screens/main/NotificationTestScreen.js
// Test screen to verify notification functionality
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BudgetAlertManager } from '../../services/BudgetAlertManager';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const NotificationTestScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [notificationStatus, setNotificationStatus] = useState(null);
  const [pushToken, setPushToken] = useState(null);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      setNotificationStatus({ status: 'not-configured' });
      
      // Check if daily reminder is set
      const savedReminder = await AsyncStorage.getItem('expense_reminder_id');
      setDailyReminderEnabled(!!savedReminder);
      
    } catch (error) {
      console.error('Error checking notification status:', error);
      Alert.alert('Error', 'Failed to check notification status');
    }
  };

  const testInstantNotification = async () => {
    try {
      Alert.alert('Info', 'Notification service is not currently configured.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification: ' + error.message);
    }
  };

  const testBudgetAlert = async () => {
    try {
      const alertManager = new BudgetAlertManager();
      await alertManager.triggerTestAlert(user?.id, 'warning');
      Alert.alert('Budget Alert Sent! 💰', 'Check your notifications for the budget warning alert.');
    } catch (error) {
      console.error('Error sending budget alert:', error);
      Alert.alert('Error', 'Failed to send budget alert: ' + error.message);
    }
  };

  const toggleDailyReminder = async (enabled) => {
    try {
      if (enabled) {
        setDailyReminderEnabled(true);
        Alert.alert(
          'Daily Reminder Set! \uD83D\uDCC5', 
          'You will be reminded daily at 6:00 PM to track your expenses!'
        );
      } else {
        setDailyReminderEnabled(false);
        Alert.alert('Reminder Disabled', 'Daily expense reminders have been turned off.');
      }
    } catch (error) {
      console.error('Error toggling daily reminder:', error);
      Alert.alert('Error', 'Failed to toggle daily reminder: ' + error.message);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.primary,
      padding: 20,
      paddingTop: 40,
    },
    headerText: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    statusCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 20,
      marginBottom: 20,
      elevation: 2,
    },
    statusTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 10,
    },
    statusText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: 5,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 15,
      marginBottom: 15,
      alignItems: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    toggleContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 15,
      marginBottom: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleText: {
      fontSize: 16,
      color: theme.colors.text,
      flex: 1,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>🔔 Notification Test Center</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>📊 Notification Status</Text>
          <Text style={styles.statusText}>
            Permissions: {notificationStatus ? '✅ Granted' : '❌ Denied'}
          </Text>
          <Text style={styles.statusText}>
            Daily Reminder: {dailyReminderEnabled ? '✅ Active' : '❌ Inactive'}
          </Text>
          <Text style={styles.statusText}>
            User ID: {user?.id || 'Not logged in'}
          </Text>
        </View>

        {/* Test Buttons */}
        <TouchableOpacity style={styles.button} onPress={testInstantNotification}>
          <Text style={styles.buttonText}>🔔 Send Test Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testBudgetAlert}>
          <Text style={styles.buttonText}>💰 Send Budget Alert Test</Text>
        </TouchableOpacity>

        {/* Daily Reminder Toggle */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>📅 Daily Expense Reminder (6:00 PM)</Text>
          <Switch
            value={dailyReminderEnabled}
            onValueChange={toggleDailyReminder}
            trackColor={{ false: '#767577', true: theme.colors.primary }}
          />
        </View>

        {/* Refresh Status Button */}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.secondary }]} 
          onPress={checkNotificationStatus}
        >
          <Text style={styles.buttonText}>🔄 Refresh Status</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default NotificationTestScreen;
