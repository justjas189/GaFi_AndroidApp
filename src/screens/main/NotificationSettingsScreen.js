// src/screens/main/NotificationSettingsScreen.js
// Modern, gamified notification settings with OneSignal integration

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import notificationService, { PREF_KEYS } from '../../services/OneSignalNotificationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Notification Channel Definitions ────────────────────────────────────────
const NOTIFICATION_CHANNELS = [
  {
    id: 'budget_alerts',
    prefKey: PREF_KEYS.BUDGET_ALERTS,
    icon: 'shield-outline',
    activeIcon: 'shield',
    title: 'Budget Guardian',
    subtitle: 'Low Health Alerts',
    description: 'Get warned when you\'ve used 85%+ of a budget category — like a health bar flashing red.',
    color: '#FF3B30',
    gradientColors: ['#FF3B30', '#FF6B6B'],
    emoji: '⚠️',
    testType: 'budget_warning',
  },
  {
    id: 'level_up',
    prefKey: PREF_KEYS.LEVEL_UP,
    icon: 'trophy-outline',
    activeIcon: 'trophy',
    title: 'Level Up!',
    subtitle: 'Milestone Celebrations',
    description: 'Celebrate when you complete a level, reach a savings goal, or unlock an achievement.',
    color: '#FFD700',
    gradientColors: ['#FFD700', '#FFA500'],
    emoji: '🎉',
    testType: 'level_up',
  },
  {
    id: 'weekly_checkin',
    prefKey: PREF_KEYS.WEEKLY_CHECKIN,
    icon: 'chatbubble-ellipses-outline',
    activeIcon: 'chatbubble-ellipses',
    title: 'Koin AI Check-In',
    subtitle: 'Weekly Spending Insights',
    description: 'Every Sunday, Koin AI sends you a personalized spending summary and saving tip.',
    color: '#5856D6',
    gradientColors: ['#5856D6', '#8B5CF6'],
    emoji: '🤖',
    testType: 'weekly_checkin',
  },
  {
    id: 'budget_reset',
    prefKey: PREF_KEYS.BUDGET_RESET,
    icon: 'refresh-circle-outline',
    activeIcon: 'refresh-circle',
    title: 'New Cycle',
    subtitle: 'Budget Reset Reminders',
    description: 'Know exactly when your budget resets so you can start each cycle with a plan.',
    color: '#34C759',
    gradientColors: ['#34C759', '#30D158'],
    emoji: '💰',
    testType: 'budget_reset',
  },
  {
    id: 'daily_reminder',
    prefKey: PREF_KEYS.DAILY_REMINDER,
    icon: 'alarm-outline',
    activeIcon: 'alarm',
    title: 'Daily Tracker',
    subtitle: 'Expense Logging Reminder',
    description: 'A daily nudge to log your expenses and stay on top of your spending game.',
    color: '#FF9500',
    gradientColors: ['#FF9500', '#FFB340'],
    emoji: '📝',
    testType: 'daily_reminder',
    hasTimePicker: true,
  },
];

// ─── Animated Notification Card ──────────────────────────────────────────────
const NotificationCard = ({
  channel,
  enabled,
  onToggle,
  onTest,
  theme,
  isDarkMode,
  reminderTime,
  onTimeChange,
  index,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: index * 80,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (enabled) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [enabled]);

  const cardBg = isDarkMode
    ? enabled
      ? `${channel.color}18`
      : theme.colors.surface
    : enabled
      ? `${channel.color}08`
      : theme.colors.card;

  const borderColor = enabled ? `${channel.color}40` : isDarkMode ? theme.colors.border : '#E8E8E8';

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor,
          transform: [{ scale: Animated.multiply(scaleAnim, pulseAnim) }],
        },
      ]}
    >
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: enabled ? `${channel.color}20` : isDarkMode ? '#3C3C3C' : '#F0F0F0',
              },
            ]}
          >
            <Ionicons
              name={enabled ? channel.activeIcon : channel.icon}
              size={24}
              color={enabled ? channel.color : theme.colors.textSecondary}
            />
          </View>
          <View style={styles.cardTitleContainer}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                {channel.emoji} {channel.title}
              </Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: enabled ? channel.color : theme.colors.textSecondary }]}>
              {channel.subtitle}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: isDarkMode ? '#4C4C4C' : '#D1D1D6', true: `${channel.color}80` }}
          thumbColor={enabled ? channel.color : isDarkMode ? '#B0B0B0' : '#F4F3F4'}
          ios_backgroundColor={isDarkMode ? '#4C4C4C' : '#D1D1D6'}
          style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] } : {}}
        />
      </View>

      {/* Description */}
      <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
        {channel.description}
      </Text>

      {/* Daily Reminder Time Picker */}
      {channel.hasTimePicker && enabled && (
        <TouchableOpacity
          style={[styles.timePicker, { borderColor: `${channel.color}30`, backgroundColor: `${channel.color}08` }]}
          onPress={() => setShowTimePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="time-outline" size={18} color={channel.color} />
          <Text style={[styles.timeText, { color: theme.colors.text }]}>
            Remind at{' '}
            <Text style={{ color: channel.color, fontWeight: '700' }}>
              {reminderTime
                ? new Date(0, 0, 0, reminderTime.hour, reminderTime.minute).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '6:00 PM'}
            </Text>
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}

      {showTimePicker && (
        <DateTimePicker
          value={
            reminderTime
              ? new Date(0, 0, 0, reminderTime.hour, reminderTime.minute)
              : new Date(0, 0, 0, 18, 0)
          }
          mode="time"
          is24Hour={false}
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime && onTimeChange) {
              onTimeChange({
                hour: selectedTime.getHours(),
                minute: selectedTime.getMinutes(),
              });
            }
          }}
        />
      )}

      {/* Test Button */}
      {enabled && (
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: `${channel.color}15`, borderColor: `${channel.color}30` }]}
          onPress={onTest}
          activeOpacity={0.7}
        >
          <Ionicons name="flash-outline" size={16} color={channel.color} />
          <Text style={[styles.testButtonText, { color: channel.color }]}>Send Test</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
const NotificationSettingsScreen = ({ navigation }) => {
  const { theme, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadPreferences();
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await notificationService.getAllPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = useCallback(async (channel, newValue) => {
    // Optimistic UI update
    setPreferences(prev => ({ ...prev, [channel.id.toUpperCase()]: newValue }));

    await notificationService.setPreference(channel.prefKey, newValue);

    // Handle side effects
    if (channel.id === 'daily_reminder') {
      if (newValue) {
        const time = preferences.DAILY_REMINDER_TIME || { hour: 18, minute: 0 };
        await notificationService.scheduleDailyReminder(time.hour, time.minute);
      } else {
        await notificationService.cancelDailyReminder();
      }
    }

    if (channel.id === 'budget_reset') {
      if (newValue) {
        await notificationService.scheduleBudgetResetNotification('monthly');
      } else {
        await notificationService.cancelBudgetResetNotification();
      }
    }

    if (channel.id === 'weekly_checkin') {
      await notificationService.updateActiveUserTag();
    }
  }, [preferences]);

  const handleTest = useCallback(async (channel) => {
    try {
      await notificationService.sendTestNotification(channel.testType);
      Alert.alert(
        `${channel.emoji} Test Sent!`,
        `A test "${channel.title}" notification has been fired. Check your notification tray!`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification: ' + error.message);
    }
  }, []);

  const handleTimeChange = useCallback(async (time) => {
    setPreferences(prev => ({ ...prev, DAILY_REMINDER_TIME: time }));
    await notificationService.scheduleDailyReminder(time.hour, time.minute);
    Alert.alert(
      '⏰ Time Updated!',
      `Daily reminder set for ${new Date(0, 0, 0, time.hour, time.minute).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    );
  }, []);

  const enabledCount = NOTIFICATION_CHANNELS.filter(
    ch => preferences[ch.id.toUpperCase()] !== false
  ).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {enabledCount} of {NOTIFICATION_CHANNELS.length} active
          </Text>
        </View>

        <View style={{ width: 24 }} />
      </Animated.View>

      {/* ── Hero Banner ── */}
      <View style={[styles.heroBanner, { backgroundColor: isDarkMode ? '#2C2C2C' : '#FFF5EB' }]}>
        <View style={styles.heroContent}>
          <Text style={styles.heroEmoji}>🔔</Text>
          <View style={styles.heroTextContainer}>
            <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Stay in the game!</Text>
            <Text style={[styles.heroDescription, { color: theme.colors.textSecondary }]}>
              Choose which alerts Koin AI sends to keep your finances on track.
            </Text>
          </View>
        </View>

        {/* Active Indicator Dots */}
        <View style={styles.dotsRow}>
          {NOTIFICATION_CHANNELS.map((ch, i) => (
            <View
              key={ch.id}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    preferences[ch.id.toUpperCase()] !== false
                      ? ch.color
                      : isDarkMode
                        ? '#4C4C4C'
                        : '#D1D1D6',
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* ── Cards ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {NOTIFICATION_CHANNELS.map((channel, index) => (
          <NotificationCard
            key={channel.id}
            channel={channel}
            enabled={preferences[channel.id.toUpperCase()] !== false}
            onToggle={(val) => handleToggle(channel, val)}
            onTest={() => handleTest(channel)}
            theme={theme}
            isDarkMode={isDarkMode}
            reminderTime={preferences.DAILY_REMINDER_TIME}
            onTimeChange={handleTimeChange}
            index={index}
          />
        ))}

        {/* ── Footer Info ── */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Notifications use OneSignal push and local scheduling. You can change your device notification permissions in Settings → App → GaFI.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  // Hero Banner
  heroBanner: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 36,
    marginRight: 14,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },

  // Time Picker
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  timeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },

  // Test Button
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 4,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});

export default NotificationSettingsScreen;
