// Enhanced Chat Screen with MonT Mascot Integration
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatbot } from '../../context/EnhancedChatbotContext';
import { useTheme } from '../../context/ThemeContext';
import { useMascot, MASCOT_TRIGGERS } from '../context/MascotContext';
import { MonTMascot, MascotModal, CompactMascot } from '../components/MascotSystem';
import { MASCOT_STATES } from '../constants/MascotStates';
import { MascotService } from '../services/MascotService';

const { width } = Dimensions.get('window');

export default function EnhancedChatScreen({ navigation }) {
  const { colors } = useTheme();
  const mascot = useMascot();
  const { 
    messages, 
    isLoading, 
    isLoadingHistory,
    historyEnabled,
    sendMessage: originalSendMessage, 
    getQuickActions,
    loadMoreHistory,
    clearMessages
  } = useChatbot();
  
  const [inputText, setInputText] = useState('');
  const [mascotLoading, setMascotLoading] = useState(false);
  const [userStats, setUserStats] = useState(null);
  const [dailyTip, setDailyTip] = useState(null);
  const [showMascotModal, setShowMascotModal] = useState(false);
  const flatListRef = useRef(null);

  // Enhanced quick actions that trigger mascot reactions
  const [quickActions] = useState([
    {
      id: 'savings',
      icon: '💰',
      text: 'Log Savings',
      action: () => {
        setInputText('I saved ₱');
        mascot.triggerMascotReaction(MASCOT_TRIGGERS.CHAT_STARTED, {
          customMessage: "Great! Tell me how much you saved! 💰"
        });
      }
    },
    {
      id: 'goal',
      icon: '🎯',
      text: 'Check Goal',
      action: () => {
        setInputText('How am I doing with my savings goal?');
        mascot.triggerMascotReaction(MASCOT_TRIGGERS.CHAT_STARTED, {
          customMessage: "Let's check your progress! 📊"
        });
      }
    },
    {
      id: 'tip',
      icon: '💡',
      text: 'Get Tip',
      action: () => handleGetTip()
    },
    {
      id: 'budget',
      icon: '📊',
      text: 'Budget Help',
      action: () => {
        setInputText('Help me with budgeting');
        mascot.triggerMascotReaction(MASCOT_TRIGGERS.CHAT_STARTED, {
          customMessage: "Budgeting time! Let's get organized! 📋"
        });
      }
    },
    {
      id: 'motivation',
      icon: '⭐',
      text: 'Motivate Me',
      action: () => {
        setInputText('I need some motivation');
        mascot.triggerMascotReaction(MASCOT_TRIGGERS.ENCOURAGEMENT_NEEDED);
      }
    }
  ]);

  // Load user data and trigger welcome reaction
  useEffect(() => {
    loadUserData();
    // Trigger mascot welcome reaction after a short delay
    const welcomeTimer = setTimeout(() => {
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.APP_OPENED, {
        customMessage: "Ready to chat about your finances? 💬",
        duration: 3000
      });
    }, 1500);

    return () => clearTimeout(welcomeTimer);
  }, []);

  // Update mascot state based on stats changes
  useEffect(() => {
    if (userStats) {
      mascot.updateUserStats({
        totalSavings: userStats.total_saved || 0,
        currentStreak: userStats.savings_streak_days || 0,
        goalsAchieved: userStats.goals_completed || 0,
        savingsThisMonth: userStats.this_month_saved || 0,
        lastLogin: new Date().toISOString()
      });
    }
  }, [userStats]);

  const loadUserData = async () => {
    try {
      const [stats, tip] = await Promise.all([
        MascotService.getUserStats(),
        MascotService.getDailyTip('savings')
      ]);
      
      setUserStats(stats.success !== false ? stats : stats.fallback);
      setDailyTip(tip.success !== false ? tip : tip.fallback);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleGetTip = async () => {
    try {
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.TIP_REQUESTED, {
        customMessage: "Here's a helpful tip for you! 💡"
      });
      
      const tip = await MascotService.getDailyTip('savings');
      const tipData = tip.success !== false ? tip : tip.fallback;
      
      if (tipData) {
        setDailyTip(tipData);
        
        // Add tip as a message
        const tipMessage = {
          id: Date.now().toString(),
          text: `💡 **${tipData.tip.title}**\n\n${tipData.tip.content}`,
          isBot: true,
          timestamp: new Date().toISOString(),
          type: 'tip',
          data: { tip: tipData.tip, category: tipData.category }
        };
        
        // Trigger happy mascot state for tip delivery
        setTimeout(() => {
          mascot.triggerMascotReaction(MASCOT_TRIGGERS.DAILY_LOGIN, {
            customMessage: "Hope that helps! Ask me anything else! 😊"
          });
        }, 2000);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get tip. Please try again.');
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.BUDGET_WARNING, {
        customMessage: "Oops! Let me try that again... 😅"
      });
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading || mascotLoading) return;

    const message = inputText.trim();
    setInputText('');
    setMascotLoading(true);

    // Trigger thinking state
    mascot.triggerMascotReaction(MASCOT_TRIGGERS.CHAT_STARTED, {
      customMessage: "Let me think about that... 🤔",
      duration: 1500
    });

    try {
      // Send to mascot backend
      const mascotResponse = await MascotService.sendMessage(message);
      
      // Handle response (success or fallback)
      const responseData = mascotResponse.success !== false ? mascotResponse : mascotResponse.fallback;
      
      // Create bot response message
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: responseData.response || responseData.message,
        isBot: true,
        timestamp: new Date().toISOString(),
        type: responseData.type || 'general',
        data: responseData
      };

      // Add financial tip if provided
      if (responseData.tip) {
        botMessage.text += `\n\n💡 ${responseData.tip}`;
      }

      // Trigger appropriate mascot reactions based on response type
      if (responseData.type === 'savings_update') {
        setTimeout(() => {
          mascot.triggerMascotReaction(MASCOT_TRIGGERS.SAVINGS_ADDED, {
            amount: responseData.savings_data?.amount || 0,
            customMessage: `Awesome! You saved ₱${responseData.savings_data?.amount?.toLocaleString()}! 🎉`
          });
        }, 1000);
        
        botMessage.data.savings = {
          amount_added: responseData.savings_data?.amount,
          total_saved: responseData.savings_data?.new_total,
          progress: responseData.savings_data?.progress,
          goal_name: responseData.goal_name
        };
      } else if (responseData.type === 'goal_achieved') {
        setTimeout(() => {
          mascot.triggerMascotReaction(MASCOT_TRIGGERS.GOAL_ACHIEVED, {
            customMessage: "🏆 GOAL ACHIEVED! You're incredible! 🎉"
          });
        }, 1000);
      } else if (responseData.type === 'tip') {
        setTimeout(() => {
          mascot.triggerMascotReaction(MASCOT_TRIGGERS.TIP_REQUESTED, {
            customMessage: "Hope this tip helps you! 💡"
          });
        }, 1000);
      } else {
        // Default happy reaction for general conversation
        setTimeout(() => {
          mascot.triggerMascotReaction(MASCOT_TRIGGERS.DAILY_LOGIN, {
            customMessage: "Happy to help! What else can we discuss? 😊"
          });
        }, 1500);
      }

      // Use the original sendMessage or add messages directly to context
      await originalSendMessage(message);
      
      // Refresh user stats if it was a savings update
      if (responseData.type === 'savings_update') {
        await loadUserData();
      }

    } catch (error) {
      console.error('Error communicating with mascot:', error);
      Alert.alert('Error', 'MonT is taking a break. Please try again in a moment! 🤖');
      mascot.triggerMascotReaction(MASCOT_TRIGGERS.BUDGET_WARNING, {
        customMessage: "Sorry, I'm having trouble right now! 😅"
      });
    } finally {
      setMascotLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    action.action();
  };

  const handleMascotTap = () => {
    setShowMascotModal(true);
    mascot.clearNotifications();
    mascot.triggerMascotReaction(MASCOT_TRIGGERS.CHAT_STARTED, {
      customMessage: "Hi there! How can I help you today? 😊",
      duration: 2000
    });
  };

  const handleMascotAction = (actionType) => {
    switch (actionType) {
      case 'tip':
        handleGetTip();
        break;
      case 'progress':
        setInputText('Show me my savings progress');
        break;
      case 'goal':
        setInputText('Help me set a new savings goal');
        break;
      case 'encouragement':
        mascot.triggerMascotReaction(MASCOT_TRIGGERS.ENCOURAGEMENT_NEEDED);
        break;
      case 'learn':
        setInputText('Teach me about personal finance');
        break;
      case 'celebrate':
        mascot.triggerMascotReaction(MASCOT_TRIGGERS.GOAL_ACHIEVED, {
          customMessage: "🎉 Let's celebrate your achievements! You're doing amazing! 🏆"
        });
        break;
      default:
        break;
    }
  };

  // Your existing renderMessage function here (keeping the same implementation)
  const renderMessage = ({ item }) => {
    // ... your existing message rendering logic
    const isBot = item.isBot;
    const isAlert = item.isAlert;
    const isError = item.isError;
    const isSavingsUpdate = item.type === 'savings_update';
    const isTip = item.type === 'tip';
    const hasRecovery = item.recovery && item.recovery.suggestions;
    const messageTime = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    }) : '';

    // Determine message bubble colors based on type
    let bubbleColor = isBot ? colors.surface : colors.primary;
    let textColor = isBot ? colors.text : colors.background;
    
    if (isAlert) {
      bubbleColor = '#FFF3CD';
      textColor = '#856404';
    } else if (isError) {
      bubbleColor = '#F8D7DA';
      textColor = '#721C24';
    } else if (isSavingsUpdate) {
      bubbleColor = '#E8F5E8';
      textColor = '#2E7D32';
    } else if (isTip) {
      bubbleColor = '#E3F2FD';
      textColor = '#1565C0';
    }

    return (
      <View style={[
        styles.messageContainer,
        isBot ? styles.botMessage : styles.userMessage
      ]}>
        {/* Bot Avatar */}
        {isBot && (
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.avatarText}>
              {isSavingsUpdate ? '💰' : 
               isTip ? '💡' : 
               isAlert ? '⚠️' : 
               isError ? '❌' : '🤖'}
            </Text>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isBot ? styles.botBubble : styles.userBubble,
          { backgroundColor: bubbleColor }
        ]}>
          <Text style={[
            styles.messageText,
            { color: textColor }
          ]}>
            {item.text}
          </Text>
          
          <Text style={[
            styles.messageTime,
            { color: isBot ? colors.textSecondary : colors.background + '80' }
          ]}>
            {messageTime}
          </Text>
        </View>
        
        {/* User Avatar */}
        {!isBot && (
          <View style={[styles.avatar, { backgroundColor: colors.secondary + '20' }]}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
        )}
      </View>
    );
  };

  const renderQuickAction = ({ item }) => (
    <TouchableOpacity
      style={styles.quickActionCard}
      onPress={() => handleQuickAction(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.quickActionIcon}>{item.icon}</Text>
      <Text style={[styles.quickActionText, { color: colors.text }]}>
        {item.text}
      </Text>
    </TouchableOpacity>
  );

  // Your existing styles here...
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.background,
    },
    headerContent: {
      flex: 1,
    },
    greeting: {
      fontSize: 16,
      color: colors.text,
      opacity: 0.6,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    mascotSubtitle: {
      fontSize: 12,
      color: colors.text,
      opacity: 0.6,
      marginTop: 2,
    },
    statsPreview: {
      fontSize: 11,
      color: colors.primary,
      marginTop: 4,
      fontWeight: '500',
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tipButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tipIcon: {
      fontSize: 18,
    },
    historyButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyIcon: {
      fontSize: 18,
    },
    chatContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messagesList: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    messageContainer: {
      flexDirection: 'row',
      marginBottom: 20,
      alignItems: 'flex-end',
    },
    botMessage: {
      alignSelf: 'flex-start',
    },
    userMessage: {
      alignSelf: 'flex-end',
      flexDirection: 'row-reverse',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 8,
      marginBottom: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    avatarText: {
      fontSize: 18,
    },
    messageBubble: {
      maxWidth: width * 0.75,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    botBubble: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userBubble: {
      backgroundColor: colors.primary,
      borderTopRightRadius: 8,
    },
    messageText: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '400',
    },
    messageTime: {
      fontSize: 12,
      marginTop: 8,
      opacity: 0.7,
      fontWeight: '500',
    },
    quickActionsContainer: {
      paddingVertical: 12,
      backgroundColor: colors.background,
    },
    quickActionsHeader: {
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    quickActionsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    quickActionsList: {
      paddingBottom: 4,
    },
    quickActionCard: {
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginRight: 12,
      borderRadius: 12,
      backgroundColor: colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 80,
    },
    quickActionIcon: {
      fontSize: 20,
      marginBottom: 4,
    },
    quickActionText: {
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 12,
    },
    inputContainer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 34,
      backgroundColor: colors.background,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      backgroundColor: colors.card,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      maxHeight: 100,
      minHeight: 20,
      textAlignVertical: 'top',
      paddingVertical: 0,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    sendButtonDisabled: {
      shadowOpacity: 0,
      elevation: 0,
    },
    sendButtonText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.card,
      marginHorizontal: 20,
      marginVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    loadingText: {
      marginLeft: 8,
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
      opacity: 0.8,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.surface} barStyle="dark-content" />
      
      {/* Enhanced Header with Interactive Mascot */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Chat with</Text>
          <Text style={styles.headerTitle}>MonT 🤖</Text>
          <Text style={styles.mascotSubtitle}>Your Financial Buddy</Text>
          {userStats && (
            <Text style={styles.statsPreview}>
              ₱{userStats.total_saved?.toLocaleString() || '0'} saved • {userStats.savings_streak_days || 0} day streak
            </Text>
          )}
        </View>
        
        <View style={styles.headerActions}>
          {/* Daily Tip Indicator */}
          <TouchableOpacity
            style={[styles.tipButton, { 
              backgroundColor: dailyTip ? colors.primary + '20' : colors.border + '40' 
            }]}
            onPress={handleGetTip}
          >
            <Text style={[styles.tipIcon, { 
              color: dailyTip ? colors.primary : colors.textSecondary 
            }]}>
              💡
            </Text>
          </TouchableOpacity>
          
          {/* History Status Indicator */}
          <TouchableOpacity
            style={[styles.historyButton, { 
              backgroundColor: historyEnabled ? colors.primary + '20' : colors.border + '40' 
            }]}
            onPress={() => navigation.navigate('ChatHistorySettings')}
          >
            <Text style={[styles.historyIcon, { 
              color: historyEnabled ? colors.primary : colors.textSecondary 
            }]}>
              {historyEnabled ? '💾' : '🔒'}
            </Text>
          </TouchableOpacity>
          
          {/* Interactive Header Mascot */}
          <CompactMascot
            currentState={mascot.currentState}
            onTap={handleMascotTap}
            showBubble={false}
            notificationCount={mascot.notificationCount}
          />
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 85}
      >
        {/* Messages List */}
        {(messages.length > 0 ) && (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ paddingBottom: 180 }}
          />
        )}

        {/* Enhanced Loading Indicator */}
        {(isLoading || isLoadingHistory || mascotLoading) && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>
              {isLoadingHistory ? 'Loading chat history...' : 
               mascotLoading ? 'MonT is thinking... 🤖' : 
               'MonT AI is thinking...'}
            </Text>
          </View>
        )}

        {/* Enhanced Quick Actions */}
        {!isLoading && (
          <View style={styles.quickActionsContainer}>
            <View style={styles.quickActionsHeader}>
              <Text style={styles.quickActionsTitle}>💡 Quick Actions</Text>
            </View>
            <FlatList
              data={quickActions}
              renderItem={renderQuickAction}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickActionsList}
              contentContainerStyle={{ paddingHorizontal: 20, paddingRight: 40 }}
            />
          </View>
        )}

        {/* Enhanced Input Container */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.textInput,
                inputText.trim() && styles.textInputFocused
              ]}
              placeholder="Ask me anything about your finances..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              onSubmitEditing={handleSend}
              returnKeyType="send"
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              style={[
                styles.sendButton,
                { backgroundColor: !inputText.trim() || isLoading ? colors.border + '60' : colors.primary },
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled
              ]}
            >
              <Text style={styles.sendButtonText}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Floating Interactive Mascot */}
        {!showMascotModal && mascot.isVisible && (
          <MonTMascot
            currentState={mascot.currentState}
            onTap={handleMascotTap}
            showBubble={mascot.showBubble}
            bubbleText={mascot.bubbleText}
            position="floating"
            size="medium"
            notificationCount={mascot.notificationCount}
          />
        )}
      </KeyboardAvoidingView>

      {/* Mascot Interaction Modal */}
      <MascotModal
        visible={showMascotModal}
        onClose={() => setShowMascotModal(false)}
        mascotState={mascot.currentState}
        onAction={handleMascotAction}
        userStats={userStats}
      />
    </SafeAreaView>
  );
}
