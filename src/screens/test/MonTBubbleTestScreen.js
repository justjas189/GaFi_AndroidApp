// MonT Draggable Bubble Test Guide
// Testing instructions for the new global draggable MonT chat bubble

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useMonTNotifications } from '../../utils/MonTNotificationManager';
import { useMascot } from '../../MonT/context/MascotContext';
import { useTheme } from '../../context/ThemeContext';

const MonTBubbleTestScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const montNotifications = useMonTNotifications();
  const mascot = useMascot();

  const testFeatures = [
    {
      title: 'Budget Warning',
      description: 'Test budget exceeded notification',
      action: () => montNotifications.budgetWarning(250.50, 'Food Category'),
      color: '#FF4444'
    },
    {
      title: 'Budget On Track',
      description: 'Test positive budget message',
      action: () => montNotifications.budgetOnTrack(1250.75, 15),
      color: '#4CAF50'
    },
    {
      title: 'Goal Achieved',
      description: 'Test goal achievement celebration',
      action: () => montNotifications.goalAchieved('Emergency Fund', 5000),
      color: '#FFD700'
    },
    {
      title: 'Savings Added',
      description: 'Test savings notification',
      action: () => montNotifications.savingsAdded(100, 2500),
      color: '#2196F3'
    },
    {
      title: 'Streak Milestone',
      description: 'Test streak achievement',
      action: () => montNotifications.streakMilestone(7),
      color: '#FF6B00'
    },
    {
      title: 'Daily Reminder',
      description: 'Test daily reminder message',
      action: () => montNotifications.dailyReminder(),
      color: '#9C27B0'
    },
    {
      title: 'Motivational Boost',
      description: 'Test encouragement message',
      action: () => montNotifications.motivationalBoost(),
      color: '#795548'
    },
    {
      title: 'Lesson Completed',
      description: 'Test learning notification',
      action: () => montNotifications.lessonCompleted('Budgeting Basics'),
      color: '#607D8B'
    }
  ];

  const handleFeatureTest = (feature) => {
    Alert.alert(
      'Test MonT Bubble',
      `Testing: ${feature.title}\n\n${feature.description}\n\nThe MonT bubble should show this notification and pulse if it's an important message.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Test It!', 
          onPress: feature.action,
          style: 'default'
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          🧪 MonT Bubble Test Lab
        </Text>
        <Text style={[styles.subtitle, { color: colors.text, opacity: 0.7 }]}>
          Test the global draggable MonT chat bubble system
        </Text>
      </View>

      <View style={[styles.instructionsCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.instructionsTitle, { color: colors.primary }]}>
          How to Test:
        </Text>
        <Text style={[styles.instructionsText, { color: colors.text }]}>
          1. Look for the MonT bubble on the right side of your screen{'\n'}
          2. Try dragging it around - it should snap to edges{'\n'}
          3. Tap any test button below to trigger notifications{'\n'}
          4. Watch the bubble pulse and show messages{'\n'}
          5. Tap the bubble to open MonT AI chat{'\n'}
          6. The bubble should appear on ALL screens when you navigate
        </Text>
      </View>

      <View style={styles.testGrid}>
        {testFeatures.map((feature, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.testCard,
              { 
                backgroundColor: colors.card,
                borderLeftColor: feature.color
              }
            ]}
            onPress={() => handleFeatureTest(feature)}
          >
            <View style={[styles.colorBadge, { backgroundColor: feature.color }]} />
            <View style={styles.testContent}>
              <Text style={[styles.testTitle, { color: colors.text }]}>
                {feature.title}
              </Text>
              <Text style={[styles.testDescription, { color: colors.text, opacity: 0.7 }]}>
                {feature.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.navigationCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.navigationTitle, { color: colors.primary }]}>
          Navigation Test:
        </Text>
        <Text style={[styles.navigationText, { color: colors.text }]}>
          Navigate to different screens to see if the MonT bubble persists:
        </Text>
        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.navButtonText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Progress')}
          >
            <Text style={styles.navButtonText}>Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Learn')}
          >
            <Text style={styles.navButtonText}>Learn</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.customTestCard, { backgroundColor: colors.card }]}>
        <Text style={[styles.customTestTitle, { color: colors.primary }]}>
          Custom Message Test:
        </Text>
        <TouchableOpacity
          style={[styles.customButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            const customMessage = "🎉 This is a custom test message! The bubble system is working perfectly! 🚀";
            montNotifications.custom(customMessage, 5000, true);
          }}
        >
          <Text style={styles.customButtonText}>Send Custom Message</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  instructionsCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  testGrid: {
    marginBottom: 24,
  },
  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  colorBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  testContent: {
    flex: 1,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  testDescription: {
    fontSize: 14,
  },
  navigationCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  navigationText: {
    fontSize: 14,
    marginBottom: 16,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  navButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  customTestCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  customTestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  customButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  customButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MonTBubbleTestScreen;
