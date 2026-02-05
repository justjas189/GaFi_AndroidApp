// Enhanced Chat Screen with Financial Mascot Integration
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
import { supabase } from '../../config/supabase';
import MascotImage from '../../components/MascotImage';

const { width } = Dimensions.get('window');

// Financial Mascot Service
class MascotService {
  static async sendMessage(message) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      const response = await fetch('http://localhost:5000/api/mascot/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending message to mascot:', error);
      throw error;
    }
  }

  static async getUserStats() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      const response = await fetch('http://localhost:5000/api/mascot/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting user stats:', error);
      return null;
    }
  }

  static async getDailyTip(category = 'savings') {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('User not authenticated');

      const response = await fetch(`http://localhost:5000/api/mascot/tips?category=${category}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting daily tip:', error);
      return null;
    }
  }
}

export default function ChatScreen({ navigation }) {
  const { colors } = useTheme();
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
  const flatListRef = useRef(null);

  // Enhanced quick actions for financial mascot
  const [quickActions] = useState([
    {
      id: 'savings',
      icon: '💰',
      text: 'Log Savings',
      action: () => setInputText('I saved ₱')
    },
    {
      id: 'goal',
      icon: '🎯',
      text: 'Check Goal',
      action: () => setInputText('How am I doing with my savings goal?')
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
      action: () => setInputText('Help me with budgeting')
    },
    {
      id: 'motivation',
      icon: '⭐',
      text: 'Motivate Me',
      action: () => setInputText('I need some motivation')
    }
  ]);

  // Load user stats and daily tip on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [stats, tip] = await Promise.all([
        MascotService.getUserStats(),
        MascotService.getDailyTip('savings')
      ]);
      
      setUserStats(stats);
      setDailyTip(tip);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleGetTip = async () => {
    try {
      const tip = await MascotService.getDailyTip('savings');
      if (tip) {
        setDailyTip(tip);
        // Add tip as a message
        const tipMessage = {
          id: Date.now().toString(),
          text: `${tip.mascot_message}\n\n${tip.tip}`,
          isBot: true,
          timestamp: new Date().toISOString(),
          type: 'tip',
          data: { tip: tip.tip, category: tip.category }
        };
        // You'll need to add this message to your chat context
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get tip. Please try again.');
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

    try {
      // Add user message immediately
      const userMessage = {
        id: Date.now().toString(),
        text: message,
        isBot: false,
        timestamp: new Date().toISOString()
      };

      // Send to mascot backend
      const mascotResponse = await MascotService.sendMessage(message);
      
      // Create bot response message
      const botMessage = {
        id: (Date.now() + 1).toString(),
        text: mascotResponse.message,
        isBot: true,
        timestamp: new Date().toISOString(),
        type: mascotResponse.type,
        data: mascotResponse
      };

      // Add financial tip if provided
      if (mascotResponse.tip) {
        botMessage.text += `\n\n💡 ${mascotResponse.tip}`;
      }

      // Add progress info for savings updates
      if (mascotResponse.type === 'savings_update') {
        botMessage.data.savings = {
          amount_added: mascotResponse.amount_added,
          total_saved: mascotResponse.total_saved,
          progress: mascotResponse.progress,
          goal_name: mascotResponse.goal_name
        };
      }

      // Use the original sendMessage or add messages directly to context
      // This depends on how your context is structured
      await originalSendMessage(userMessage.text);
      
      // Refresh user stats if it was a savings update
      if (mascotResponse.type === 'savings_update') {
        await loadUserData();
      }

    } catch (error) {
      console.error('Error communicating with mascot:', error);
      Alert.alert('Error', 'MonT is taking a break. Please try again in a moment! 🤖');
    } finally {
      setMascotLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    action.action();
  };

  const handleRecoverySuggestion = (suggestion) => {
    if (suggestion.action) {
      setInputText(suggestion.action);
    } else if (suggestion.example) {
      setInputText(suggestion.example);
    }
  };

  const renderMessage = ({ item }) => {
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
      bubbleColor = '#FFF3CD'; // Warning yellow background
      textColor = '#856404'; // Dark yellow text
    } else if (isError) {
      bubbleColor = '#F8D7DA'; // Error red background
      textColor = '#721C24'; // Dark red text
    } else if (isSavingsUpdate) {
      bubbleColor = '#E8F5E8'; // Success green background
      textColor = '#2E7D32'; // Dark green text
    } else if (isTip) {
      bubbleColor = '#E3F2FD'; // Info blue background
      textColor = '#1565C0'; // Dark blue text
    }

    return (
      <View style={[
        styles.messageContainer,
        isBot ? styles.botMessage : styles.userMessage
      ]}>
        {/* Bot Avatar */}
        {isBot && (
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            {isSavingsUpdate ? (
              <Text style={styles.avatarText}>💰</Text>
            ) : isTip ? (
              <Text style={styles.avatarText}>💡</Text>
            ) : isAlert ? (
              <Text style={styles.avatarText}>⚠️</Text>
            ) : isError ? (
              <Text style={styles.avatarText}>❌</Text>
            ) : (
              <MascotImage size={28} />
            )}
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isBot ? styles.botBubble : styles.userBubble,
          { backgroundColor: bubbleColor }
        ]}>
          {/* Savings Update Header */}
          {isSavingsUpdate && item.data?.savings && (
            <View style={styles.savingsHeader}>
              <Text style={styles.savingsHeaderText}>
                💰 Savings Updated! +₱{item.data.savings.amount_added?.toLocaleString()}
              </Text>
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        backgroundColor: colors.primary,
                        width: `${Math.min(item.data.savings.progress || 0, 100)}%`
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {item.data.savings.progress?.toFixed(1)}% of goal
                </Text>
              </View>
            </View>
          )}
          
          {/* Alert Type Indicator */}
          {isAlert && item.alertType && (
            <View style={styles.alertTypeContainer}>
              <Text style={styles.alertTypeText}>
                {item.alertType === 'budget_exceeded' ? '💸 Budget Alert' : 
                 item.alertType === 'spending_velocity' ? '⚡ Spending Alert' : 
                 item.alertType === 'category_limit' ? '📊 Category Alert' : '⚠️ Alert'}
              </Text>
            </View>
          )}
          
          <Text style={[
            styles.messageText,
            { color: textColor }
          ]}>
            {item.text}
          </Text>
          
          {/* Recovery Suggestions */}
          {hasRecovery && (
            <View style={styles.recoveryContainer}>
              <Text style={styles.recoveryTitle}>💡 Suggested Actions:</Text>
              {item.recovery.suggestions.map((suggestion, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.recoverySuggestion}
                  onPress={() => handleRecoverySuggestion(suggestion)}
                >
                  <Text style={styles.recoverySuggestionText}>
                    {suggestion.title}
                  </Text>
                  <Text style={styles.recoverySuggestionDesc}>
                    {suggestion.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {/* Display structured data if available */}
          {item.data && item.data.transaction && (
            <View style={[styles.dataCard, { backgroundColor: colors.background }]}>
              <View style={styles.dataHeader}>
                <Text style={styles.dataIcon}>💳</Text>
                <Text style={[styles.dataTitle, { color: colors.text }]}>Transaction Recorded</Text>
              </View>
              <Text style={[styles.dataText, { color: colors.primary }]}>
                ₱{parseFloat(item.data.transaction.amount).toLocaleString()}
              </Text>
              <Text style={[styles.dataSubtext, { color: colors.textSecondary }]}>
                {item.data.transaction.category}
              </Text>
              {item.data.transaction.description && (
                <Text style={[styles.dataSubtext, { color: colors.textSecondary }]}>
                  {item.data.transaction.description}
                </Text>
              )}
            </View>
          )}
          
          {/* Display budget summary if available */}
          {item.data && item.data.summary && (
            <View style={[styles.dataCard, { backgroundColor: colors.background }]}>
              <View style={styles.dataHeader}>
                <Text style={styles.dataIcon}>📊</Text>
                <Text style={[styles.dataTitle, { color: colors.text }]}>Budget Overview</Text>
              </View>
              <Text style={[styles.dataText, { color: colors.text }]}>
                Total: ₱{item.data.summary.totalBudget.toLocaleString()}
              </Text>
              <Text style={[styles.dataText, { color: '#FF6B6B' }]}>
                Spent: ₱{item.data.summary.totalSpent.toLocaleString()}
              </Text>
              <Text style={[styles.dataText, { color: '#4ECDC4' }]}>
                Remaining: ₱{item.data.summary.remaining.toLocaleString()}
              </Text>
            </View>
          )}
          
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
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.primary + '30',
    },
    headerEmoji: {
      fontSize: 24,
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
    dataCard: {
      marginTop: 16,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    dataHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    dataIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    dataTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    dataText: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 6,
    },
    dataSubtext: {
      fontSize: 14,
      marginBottom: 4,
      opacity: 0.8,
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
    quickActionsSubtitle: {
      fontSize: 14,
      color: colors.text,
      opacity: 0.6,
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
      paddingBottom: 34, // Account for tab bar height (60px) + safe area
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
    textInputFocused: {
      // Focus styling handled by wrapper
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
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingBottom: 0, // Account for tab bar and quick actions
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 8,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
      maxWidth: 320,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 24,
      opacity: 0.8,
    },
    alertTypeContainer: {
      marginBottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: 'rgba(255, 165, 0, 0.2)',
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    alertTypeText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#B7791F',
    },
    recoveryContainer: {
      marginTop: 12,
      padding: 12,
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      borderRadius: 8,
      borderLeftWidth: 3,
      borderLeftColor: '#4CAF50',
    },
    recoveryTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#2E7D32',
      marginBottom: 8,
    },
    recoverySuggestion: {
      marginBottom: 8,
      padding: 8,
      backgroundColor: 'rgba(76, 175, 80, 0.05)',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#4CAF50',
    },
    recoverySuggestionText: {
      fontSize: 13,
      fontWeight: '500',
      color: '#2E7D32',
      marginBottom: 2,
    },
    recoverySuggestionDesc: {
      fontSize: 12,
      color: '#4CAF50',
      opacity: 0.8,
    },
    savingsUpdateCard: {
      backgroundColor: colors.primary,
      marginVertical: 4,
      marginHorizontal: 8,
      padding: 12,
      borderRadius: 12,
    },
    savingsUpdateText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    progressContainer: {
      marginTop: 8,
      backgroundColor: 'rgba(255,255,255,0.2)',
      height: 6,
      borderRadius: 3,
    },
    progressBar: {
      height: 6,
      backgroundColor: '#FFFFFF',
      borderRadius: 3,
    },
    progressText: {
      color: '#FFFFFF',
      fontSize: 11,
      textAlign: 'center',
      marginTop: 4,
      opacity: 0.9,
    },
    tipCard: {
      backgroundColor: colors.card,
      margin: 8,
      padding: 12,
      borderRadius: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    tipTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    tipContent: {
      fontSize: 13,
      color: colors.text,
      opacity: 0.8,
      lineHeight: 18,
    },
    motivationalCard: {
      backgroundColor: colors.primary,
      margin: 8,
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    motivationalEmoji: {
      fontSize: 24,
      marginBottom: 4,
    },
    motivationalText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.surface} barStyle="dark-content" />
      
      {/* Enhanced Header with Modern Design */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Chat with</Text>
          <Text style={styles.headerTitle}>MonT 🤖</Text>
          <Text style={styles.mascotSubtitle}>Your Financial Buddy</Text>
          {userStats && (
            <Text style={styles.statsPreview}>
              ₱{userStats.total_saved?.toLocaleString()} saved • {userStats.savings_streak_days} day streak
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
          
          {/* Mascot Avatar */}
          <View style={styles.headerIcon}>
            <MascotImage size={40} />
          </View>
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
        ) }

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

        {/* Enhanced Quick Actions with Card Design */}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
