// Chat History Settings Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useChatbot } from '../../context/EnhancedChatbotContext';

export default function ChatHistorySettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { 
    getChatPreferences, 
    updateChatPreferences, 
    getChatSessions, 
    deleteChatSession, 
    clearAllHistory,
    historyEnabled 
  } = useChatbot();

  const [preferences, setPreferences] = useState({
    enable_history: true,
    max_sessions: 50,
    max_messages_per_session: 500,
    auto_delete_after_days: 90,
    context_memory_enabled: true
  });
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      
      // Load preferences
      const prefsResult = await getChatPreferences();
      if (prefsResult.success) {
        setPreferences(prefsResult.data);
      }

      // Load sessions
      const sessionsResult = await getChatSessions();
      if (sessionsResult.success) {
        setSessions(sessionsResult.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load chat settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key, value) => {
    try {
      setIsSaving(true);
      const updates = { [key]: value };
      const result = await updateChatPreferences(updates);
      
      if (result.success) {
        setPreferences(prev => ({ ...prev, [key]: value }));
      } else {
        Alert.alert('Error', result.error || 'Failed to update preference');
      }
    } catch (error) {
      console.error('Error updating preference:', error);
      Alert.alert('Error', 'Failed to update preference');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSession = (sessionId, sessionName) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete "${sessionName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deleteChatSession(sessionId);
              if (result.success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                Alert.alert('Success', 'Session deleted successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to delete session');
              }
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          }
        }
      ]
    );
  };

  const handleClearAllHistory = () => {
    Alert.alert(
      'Clear All History',
      'Are you sure you want to delete all your chat history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await clearAllHistory();
              if (result.success) {
                setSessions([]);
                Alert.alert('Success', 'All chat history cleared successfully');
              } else {
                Alert.alert('Error', result.error || 'Failed to clear history');
              }
            } catch (error) {
              console.error('Error clearing history:', error);
              Alert.alert('Error', 'Failed to clear history');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      marginRight: 16,
      padding: 8,
    },
    backButtonText: {
      fontSize: 24,
      color: colors.primary,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    scrollContainer: {
      flex: 1,
    },
    section: {
      backgroundColor: colors.card,
      marginHorizontal: 20,
      marginVertical: 10,
      borderRadius: 12,
      paddingVertical: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    lastSettingRow: {
      borderBottomWidth: 0,
    },
    settingInfo: {
      flex: 1,
      marginRight: 12,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    numberInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      width: 80,
      textAlign: 'center',
      color: colors.text,
      backgroundColor: colors.background,
    },
    sessionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    lastSessionItem: {
      borderBottomWidth: 0,
    },
    sessionInfo: {
      flex: 1,
    },
    sessionName: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 4,
    },
    sessionDate: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    deleteButton: {
      backgroundColor: '#FF6B6B',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    deleteButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '500',
    },
    clearAllButton: {
      backgroundColor: '#FF6B6B',
      marginHorizontal: 20,
      marginVertical: 10,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    clearAllButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: colors.textSecondary,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    statusBadge: {
      backgroundColor: historyEnabled ? '#4ECDC4' : '#FF6B6B',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chat History Settings</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat History Settings</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {historyEnabled ? 'ENABLED' : 'DISABLED'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔒 Privacy Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Chat History</Text>
              <Text style={styles.settingDescription}>
                Save your conversations for continuity across sessions
              </Text>
            </View>
            <Switch
              value={preferences.enable_history}
              onValueChange={(value) => updatePreference('enable_history', value)}
              disabled={isSaving}
            />
          </View>

          <View style={[styles.settingRow, styles.lastSettingRow]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>AI Context Memory</Text>
              <Text style={styles.settingDescription}>
                Allow AI to remember previous conversation context
              </Text>
            </View>
            <Switch
              value={preferences.context_memory_enabled}
              onValueChange={(value) => updatePreference('context_memory_enabled', value)}
              disabled={isSaving || !preferences.enable_history}
            />
          </View>
        </View>

        {/* Storage Limits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💾 Storage Limits</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Max Sessions</Text>
              <Text style={styles.settingDescription}>
                Maximum number of chat sessions to keep
              </Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={preferences.max_sessions?.toString()}
              onChangeText={(text) => {
                const value = parseInt(text) || 0;
                updatePreference('max_sessions', value);
              }}
              keyboardType="numeric"
              editable={!isSaving && preferences.enable_history}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Messages per Session</Text>
              <Text style={styles.settingDescription}>
                Maximum messages to keep in each session
              </Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={preferences.max_messages_per_session?.toString()}
              onChangeText={(text) => {
                const value = parseInt(text) || 0;
                updatePreference('max_messages_per_session', value);
              }}
              keyboardType="numeric"
              editable={!isSaving && preferences.enable_history}
            />
          </View>

          <View style={[styles.settingRow, styles.lastSettingRow]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-delete After (Days)</Text>
              <Text style={styles.settingDescription}>
                Automatically delete sessions older than specified days (0 = never)
              </Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={preferences.auto_delete_after_days?.toString()}
              onChangeText={(text) => {
                const value = parseInt(text) || 0;
                updatePreference('auto_delete_after_days', value);
              }}
              keyboardType="numeric"
              editable={!isSaving && preferences.enable_history}
            />
          </View>
        </View>

        {/* Chat Sessions */}
        {preferences.enable_history && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              💬 Your Chat Sessions ({sessions.length})
            </Text>
            
            {sessions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  No chat sessions found.{'\n'}Start chatting to create your first session!
                </Text>
              </View>
            ) : (
              sessions.map((session, index) => (
                <View 
                  key={session.id} 
                  style={[
                    styles.sessionItem,
                    index === sessions.length - 1 && styles.lastSessionItem
                  ]}
                >
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionName}>
                      {session.session_name || 'Untitled Session'}
                    </Text>
                    <Text style={styles.sessionDate}>
                      Last updated: {formatDate(session.updated_at)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSession(session.id, session.session_name)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* Clear All History */}
        {preferences.enable_history && sessions.length > 0 && (
          <TouchableOpacity 
            style={styles.clearAllButton}
            onPress={handleClearAllHistory}
          >
            <Text style={styles.clearAllButtonText}>
              🗑️ Clear All Chat History
            </Text>
          </TouchableOpacity>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
