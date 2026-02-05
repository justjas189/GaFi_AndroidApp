import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Alert
} from 'react-native';
import { MonTMascot } from '../MonT/components/MascotSystem';
import { MASCOT_STATES } from '../MonT/constants/MascotStates';

const { width, height } = Dimensions.get('window');

// Enhanced MonT Notification Toast System
export const MonTNotificationToast = ({ 
  visible = false,
  type = 'info', // 'success', 'warning', 'error', 'celebration', 'info'
  title = '',
  message = '',
  duration = 4000,
  onPress,
  onDismiss,
  showMascot = true,
  autoHide = true
}) => {
  const [isVisible, setIsVisible] = useState(visible);
  const slideAnim = new Animated.Value(-100);
  const scaleAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      showToast();
      
      if (autoHide) {
        const timer = setTimeout(() => {
          hideToast();
        }, duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      hideToast();
    }
  }, [visible, duration, autoHide]);

  const showToast = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 150,
        friction: 8,
      })
    ]).start();
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setIsVisible(false);
      onDismiss && onDismiss();
    });
  };

  const getNotificationConfig = () => {
    switch (type) {
      case 'success':
        return {
          mascotState: MASCOT_STATES.CELEBRATING,
          backgroundColor: '#4CAF50',
          borderColor: '#388E3C',
          textColor: '#fff',
          bubbleText: 'Success! 🎉'
        };
      case 'warning':
        return {
          mascotState: MASCOT_STATES.WORRIED,
          backgroundColor: '#FF9800',
          borderColor: '#F57C00',
          textColor: '#fff',
          bubbleText: 'Warning! ⚠️'
        };
      case 'error':
        return {
          mascotState: MASCOT_STATES.BUDGET_ALERT,
          backgroundColor: '#F44336',
          borderColor: '#D32F2F',
          textColor: '#fff',
          bubbleText: 'Oops! 😰'
        };
      case 'celebration':
        return {
          mascotState: MASCOT_STATES.GOAL_ACHIEVED,
          backgroundColor: '#9C27B0',
          borderColor: '#7B1FA2',
          textColor: '#fff',
          bubbleText: 'Amazing! 🏆'
        };
      default: // 'info'
        return {
          mascotState: MASCOT_STATES.HAPPY,
          backgroundColor: '#2196F3',
          borderColor: '#1976D2',
          textColor: '#fff',
          bubbleText: 'Hey there! 💡'
        };
    }
  };

  const config = getNotificationConfig();

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={onPress || hideToast}
        activeOpacity={0.9}
      >
        {showMascot && (
          <View style={styles.mascotContainer}>
            <MonTMascot
              graphicsMode="piggy-emoji"
              currentState={config.mascotState}
              size="small"
              showBubble={false}
            />
          </View>
        )}
        
        <View style={styles.textContainer}>
          {title && (
            <Text style={[styles.title, { color: config.textColor }]}>
              {title}
            </Text>
          )}
          <Text style={[styles.message, { color: config.textColor }]}>
            {message}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={hideToast}
        >
          <Text style={[styles.closeText, { color: config.textColor }]}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

// MonT Daily Message Component
export const MonTDailyMessage = ({ visible = false, onDismiss }) => {
  const dailyMessages = [
    {
      title: "Good Morning!",
      message: "Ready to save some money today? 🐷💰",
      type: "info"
    },
    {
      title: "Budget Check!",
      message: "You're doing great with your spending! Keep it up! 📊✨",
      type: "success"
    },
    {
      title: "Savings Reminder",
      message: "Your goal is 89 days away - let's add some money! 🎯",
      type: "info"
    },
    {
      title: "Streak Alert!",
      message: "Save today to keep your streak alive! 🔥",
      type: "warning"
    }
  ];

  const randomMessage = dailyMessages[Math.floor(Math.random() * dailyMessages.length)];

  return (
    <MonTNotificationToast
      visible={visible}
      type={randomMessage.type}
      title={randomMessage.title}
      message={randomMessage.message}
      duration={5000}
      onDismiss={onDismiss}
      showMascot={true}
    />
  );
};

// Budget Alert Component
export const MonTBudgetAlert = ({ 
  visible = false, 
  category = "Food", 
  exceeded = 4610, 
  budget = 10000,
  onDismiss 
}) => {
  const percentageOver = ((exceeded / budget) * 100).toFixed(0);
  
  return (
    <MonTNotificationToast
      visible={visible}
      type="warning"
      title="Budget Alert!"
      message={`${category} budget exceeded by ₱${exceeded.toLocaleString()}! That's ${percentageOver}% over budget! 😰`}
      duration={6000}
      onDismiss={onDismiss}
      onPress={() => {
        Alert.alert(
          'MonT Says',
          `Don't worry! Everyone overspends sometimes. Let's review your ${category} expenses and get back on track! 🐷💪`,
          [
            { text: 'Review Budget', onPress: () => {} },
            { text: 'OK', style: 'default' }
          ]
        );
      }}
    />
  );
};

// Goal Achievement Component
export const MonTGoalAchievement = ({ 
  visible = false, 
  goalName = "Emergency Fund",
  amount = 5000,
  onDismiss 
}) => {
  return (
    <MonTNotificationToast
      visible={visible}
      type="celebration"
      title="Goal Achieved!"
      message={`🎉 You reached your ${goalName} goal of ₱${amount.toLocaleString()}! I'm so proud! 🏆`}
      duration={8000}
      onDismiss={onDismiss}
      onPress={() => {
        Alert.alert(
          'MonT Celebrates',
          `🎉 AMAZING! You saved ₱${amount.toLocaleString()} for your ${goalName}! You're a savings superstar! Ready to set your next goal? 🐷👑`,
          [
            { text: 'Set Next Goal', onPress: () => {} },
            { text: 'Celebrate More!', style: 'default' }
          ]
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 9999,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  mascotContainer: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    lineHeight: 18,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MonTNotificationToast;
