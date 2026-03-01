// src/screens/main/NotificationTestScreen.js
// Test screen to verify all notification types using OneSignal + local notifications
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OneSignal } from 'react-native-onesignal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import notificationService from '../../services/OneSignalNotificationService';

const TEST_BUTTONS = [
  {
    type: 'budget_warning',
    label: '⚠️ Budget Warning',
    description: '"Low Health" — 85% of budget used',
    color: '#FF3B30',
  },
  {
    type: 'budget_critical',
    label: '🔴 Budget Critical',
    description: '95% of budget used — almost at the limit',
    color: '#FF6B6B',
  },
  {
    type: 'level_up',
    label: '🎉 Level Up!',
    description: 'Milestone celebration push notification',
    color: '#FFD700',
  },
  {
    type: 'weekly_checkin',
    label: '🤖 Koin AI Check-In',
    description: 'Weekly spending analysis from Koin AI',
    color: '#5856D6',
  },
  {
    type: 'budget_reset',
    label: '💰 Budget Reset',
    description: 'New cycle begins notification',
    color: '#34C759',
  },
  {
    type: 'daily_reminder',
    label: '📝 Daily Reminder',
    description: 'Expense logging nudge',
    color: '#FF9500',
  },
];

const NotificationTestScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [sending, setSending] = useState(null);
  const [subscriptionId, setSubscriptionId] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const permission = OneSignal.Notifications.hasPermission();
      setPermissionGranted(permission);

      const id = OneSignal.User.pushSubscription.getPushSubscriptionId();
      setSubscriptionId(id || null);
    } catch (error) {
      console.warn('Error checking notification status:', error);
    }
  };

  const handleTest = async (type) => {
    setSending(type);
    try {
      await notificationService.sendTestNotification(type);
      Alert.alert('Sent!', `Test "${type}" notification fired. Check your notification tray.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to send: ' + error.message);
    } finally {
      setSending(null);
    }
  };

  const handleRequestPermission = async () => {
    try {
      OneSignal.Notifications.requestPermission(true);
      setTimeout(checkStatus, 1000);
    } catch (error) {
      Alert.alert('Error', 'Failed to request permission');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.text,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    statusCard: {
      backgroundColor: isDarkMode ? theme.colors.surface : theme.colors.card,
      borderRadius: 14,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDarkMode ? theme.colors.border : '#E8E8E8',
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    statusLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      flex: 1,
    },
    statusValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
    },
    testButton: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      gap: 12,
    },
    testButtonLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    testButtonDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    permButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 20,
    },
    permButtonText: {
      color: '#FFF',
      fontWeight: '700',
      fontSize: 15,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 8,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🧪 Notification Lab</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>📊 System Status</Text>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Permission</Text>
            <Text style={[styles.statusValue, { color: permissionGranted ? theme.colors.success : theme.colors.error }]}>
              {permissionGranted === null ? '...' : permissionGranted ? '✅ Granted' : '❌ Denied'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>OneSignal ID</Text>
            <Text style={[styles.statusValue, { color: subscriptionId ? theme.colors.success : theme.colors.warning }]} numberOfLines={1}>
              {subscriptionId ? `${subscriptionId.substring(0, 16)}…` : '❌ Not registered'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>User ID</Text>
            <Text style={[styles.statusValue, { color: user?.id ? theme.colors.success : theme.colors.error }]} numberOfLines={1}>
              {user?.id ? `${user.id.substring(0, 16)}…` : 'Not logged in'}
            </Text>
          </View>
        </View>

        {/* Permission Button */}
        {permissionGranted === false && (
          <TouchableOpacity style={styles.permButton} onPress={handleRequestPermission}>
            <Text style={styles.permButtonText}>🔓 Grant Notification Permission</Text>
          </TouchableOpacity>
        )}

        {/* Test Buttons */}
        <Text style={styles.sectionTitle}>Send Test Notifications</Text>
        {TEST_BUTTONS.map((btn) => (
          <TouchableOpacity
            key={btn.type}
            style={[
              styles.testButton,
              {
                backgroundColor: `${btn.color}10`,
                borderColor: `${btn.color}30`,
                opacity: sending && sending !== btn.type ? 0.5 : 1,
              },
            ]}
            onPress={() => handleTest(btn.type)}
            disabled={!!sending}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.testButtonLabel}>{btn.label}</Text>
              <Text style={styles.testButtonDesc}>{btn.description}</Text>
            </View>
            {sending === btn.type ? (
              <ActivityIndicator size="small" color={btn.color} />
            ) : (
              <Ionicons name="send" size={18} color={btn.color} />
            )}
          </TouchableOpacity>
        ))}

        {/* Refresh */}
        <TouchableOpacity style={styles.refreshButton} onPress={checkStatus}>
          <Ionicons name="refresh-outline" size={18} color={theme.colors.text} />
          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Refresh Status</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationTestScreen;
