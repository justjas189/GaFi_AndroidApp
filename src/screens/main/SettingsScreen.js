import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Linking,
  Share,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';

const SettingsScreen = ({ navigation }) => {
  const { logout, userInfo } = useContext(AuthContext);
  const { expenses } = useContext(DataContext);
  const { theme, isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [exportingData, setExportingData] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ── Handlers ──

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await logout();
            if (!result.success) {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleExportData = async () => {
    if (!expenses || expenses.length === 0) {
      Alert.alert('No Data', 'You have no expense data to export yet.');
      return;
    }

    Alert.alert(
      'Export Format',
      'Choose your preferred export format:',
      [
        {
          text: 'CSV',
          onPress: () => exportAs('csv'),
        },
        {
          text: 'TXT',
          onPress: () => exportAs('txt'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const exportAs = async (format) => {
    try {
      setExportingData(true);

      if (format === 'csv') {
        const header = 'Date,Category,Amount,Description\n';
        const rows = expenses
          .map((e) => {
            const date = new Date(e.date || e.created_at).toLocaleDateString();
            const category = (e.category || 'Uncategorized').replace(/,/g, ' ');
            const amount = parseFloat(e.amount || 0).toFixed(2);
            const description = (e.description || e.note || '').replace(/,/g, ' ').replace(/\n/g, ' ');
            return `${date},${category},${amount},${description}`;
          })
          .join('\n');

        await Share.share({
          message: header + rows,
          title: 'GaFI Expense Export (CSV)',
        });
      } else {
        // TXT format – readable plain text
        const lines = expenses
          .map((e, i) => {
            const date = new Date(e.date || e.created_at).toLocaleDateString();
            const category = e.category || 'Uncategorized';
            const amount = parseFloat(e.amount || 0).toFixed(2);
            const description = e.description || e.note || 'No description';
            return `${i + 1}. [${date}] ${category} — ₱${amount}\n   ${description}`;
          })
          .join('\n\n');

        const txt = `GaFI Expense Report\n${'='.repeat(30)}\nTotal entries: ${expenses.length}\n\n${lines}\n`;

        await Share.share({
          message: txt,
          title: 'GaFI Expense Export (TXT)',
        });
      }
    } catch (error) {
      if (error.message !== 'User did not share') {
        console.error('Export error:', error);
        Alert.alert('Error', 'Failed to export data. Please try again.');
      }
    } finally {
      setExportingData(false);
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your local expense data and cached information. Your account will remain active. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const userId = session?.user?.id;
              // Clear locally-cached keys (keep auth tokens so user stays signed in)
              const allKeys = await AsyncStorage.getAllKeys();
              const keysToRemove = allKeys.filter(
                (k) =>
                  !k.startsWith('userToken') &&
                  !k.startsWith('userInfo') &&
                  !k.startsWith('hasOnboarded_') &&
                  !k.startsWith('theme')
              );
              if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
              }
              Alert.alert('Done', 'Local cached data has been cleared. Your cloud data remains intact.');
            } catch (error) {
              console.error('Clear data error:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleHelpSupport = () => {
    Alert.alert(
      'Help & Support',
      'How can we help you?',
      [
        {
          text: 'FAQs',
          onPress: () => {
            Alert.alert(
              'Frequently Asked Questions',
              '• How do I add an expense?\n  Go to the Expenses tab and tap the + button.\n\n• How do I set my budget?\n  Go to Profile → Budget and set your monthly budget.\n\n• How does the leaderboard work?\n  Save money consistently to earn XP and climb the rankings!\n\n• Is my data secure?\n  Yes! All data is encrypted and stored securely via Supabase.\n\n• How do I add friends?\n  Set a username in your profile, then go to Friends List to search and add friends.'
            );
          },
        },
        {
          text: 'Report a Bug',
          onPress: () => {
            Linking.openURL(
              'mailto:malabananbills@gmail.com?subject=GaFI%20Bug%20Report&body=Please%20describe%20the%20issue%20you%20encountered:'
            ).catch(() => {
              Alert.alert('Error', 'Could not open email client. Please email malabananbills@gmail.com manually.');
            });
          },
        },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    try {
      setDeletingAccount(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'You are not signed in.');
        return;
      }

      const userId = session.user.id;

      // Delete user data from related tables (order matters for foreign keys)
      const tablesToClear = [
        'friends',
        'savings_transactions',
        'gamified_savings_goals',
        'user_achievements',
        'story_mode_sessions',
        'user_levels',
        'expenses',
        'profiles',
      ];

      for (const table of tablesToClear) {
        try {
          // friends table has user in either column
          if (table === 'friends') {
            await supabase.from(table).delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
          } else {
            await supabase.from(table).delete().eq('user_id', userId);
          }
        } catch (e) {
          console.warn(`Could not clear ${table}:`, e);
        }
      }

      // Clear local storage
      await AsyncStorage.clear();

      // Sign out (this also invalidates the session)
      await supabase.auth.signOut();

      setShowDeleteModal(false);
      setDeleteConfirmText('');

      // The AuthContext will detect the sign-out and redirect to auth screen
      Alert.alert('Account Deleted', 'Your account and all associated data have been permanently deleted.');
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
    } finally {
      setDeletingAccount(false);
    }
  };

  // ── Render ──

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with back arrow */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>

        {/* ── Preferences ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Preferences</Text>

          <View style={[styles.settingItem, { backgroundColor: theme.colors.card }]}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Ionicons
                  name={isDarkMode ? 'moon-outline' : 'sunny-outline'}
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Dark Mode</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                  {isDarkMode ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#767577', true: `${theme.colors.primary}80` }}
              thumbColor={isDarkMode ? theme.colors.primary : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
            />
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('NotificationSettings')}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Notifications</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                  Customize reminders & alerts
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('NotificationTest')}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.secondary}20` }]}>
                <Ionicons name="flask-outline" size={20} color={theme.colors.secondary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Test Notifications</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                  Test notification functionality
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Features (temporarily hidden) ── */}
        {/*
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Features</Text>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('Achievements')}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#FFD70020' }]}>
                <Ionicons name="trophy-outline" size={20} color="#FFD700" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Achievements</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>View your progress</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('FriendsList')}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Friends List</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>Manage friends</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('Calendar')}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#4CAF5020' }]}>
                <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Calendar View</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>Monthly expenses</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('OldLearn')}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#FF980020' }]}>
                <Ionicons name="book-outline" size={20} color="#FF9800" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Financial Tips</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>Learn & improve</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        */}

        {/* ── Data Management ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Data Management</Text>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={handleExportData}
            activeOpacity={0.7}
            disabled={exportingData}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#2196F320' }]}>
                <Ionicons name="download-outline" size={20} color="#2196F3" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Export Data</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>Share your expense history</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={handleClearData}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#FF3B3020' }]}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Clear Local Data</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                  Remove cached data & start fresh
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Help & Support ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Help & Support</Text>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={handleHelpSupport}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#5856D620' }]}>
                <Ionicons name="help-circle-outline" size={20} color="#5856D6" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Help & FAQs</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                  Get answers & report issues
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { backgroundColor: theme.colors.card }]}
            onPress={() => {
              Linking.openURL(
                'mailto:malabananbills@gmail.com?subject=GaFI%20Feedback'
              ).catch(() => {
                Alert.alert('Error', 'Could not open email client.');
              });
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: '#00BCD420' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#00BCD4" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>Send Feedback</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                  Tell us what you think
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── About ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>

          <TouchableOpacity style={[styles.settingItem, { backgroundColor: theme.colors.card }]} activeOpacity={0.7}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.textSecondary }]}>App Version</Text>
                <Text style={[styles.settingValue, { color: theme.colors.text }]}>GaFI v1.0.0</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Log Out & Delete Account ── */}
        <View style={styles.accountActions}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={[styles.logoutButtonText, { color: theme.colors.background }]}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteAccountButton, { borderColor: theme.colors.error }]}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={18} color={theme.colors.error} />
            <Text style={[styles.deleteAccountButtonText, { color: theme.colors.error }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Delete Account Confirmation Modal ── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText('');
        }}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Ionicons name="alert-circle" size={48} color={theme.colors.error} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Delete Account</Text>
            <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
              This action is permanent and cannot be undone. All your data — expenses, friends, achievements, and progress — will be permanently deleted.
            </Text>
            <Text style={[styles.modalInstruction, { color: theme.colors.text }]}>
              Type <Text style={{ fontWeight: 'bold', color: theme.colors.error }}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: theme.colors.text,
                  borderColor: deleteConfirmText === 'DELETE' ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.card,
                },
              ]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE here"
              placeholderTextColor={theme.colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.colors.card }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteBtn,
                  {
                    backgroundColor: deleteConfirmText === 'DELETE' ? theme.colors.error : theme.colors.card,
                    opacity: deleteConfirmText === 'DELETE' ? 1 : 0.5,
                  },
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                activeOpacity={0.8}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.modalDeleteText,
                      { color: deleteConfirmText === 'DELETE' ? '#fff' : theme.colors.textSecondary },
                    ]}
                  >
                    Delete Forever
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    marginHorizontal: 16,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },

  // Setting items
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 18,
  },

  // Logout
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Account actions
  accountActions: {
    marginBottom: 32,
  },
  deleteAccountButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Delete Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInstruction: {
    fontSize: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalDeleteText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
