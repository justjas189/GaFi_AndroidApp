import React, { useContext, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Switch,
  Modal,
  TextInput,
  useColorScheme
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { reset } from '../../navigation/navigationRef';

const SettingsScreen = ({ navigation }) => {
  const { logout, userInfo, updateProfile } = useContext(AuthContext);
  const { budget, updateBudget } = useContext(DataContext);
  const { theme, isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditBudget, setShowEditBudget] = useState(false);
  const [name, setName] = useState(userInfo?.name || '');
  const [email, setEmail] = useState(userInfo?.email || '');
  const [username, setUsername] = useState(userInfo?.username || '');
  const [monthlyBudget, setMonthlyBudget] = useState(budget.monthly.toString());
  const [savingsGoal, setSavingsGoal] = useState(budget.savingsGoal.toString());

  // Update name and username state when userInfo changes
  useEffect(() => {
    if (userInfo?.name) {
      setName(userInfo.name);
    }
    if (userInfo?.username) {
      setUsername(userInfo.username);
    }
  }, [userInfo]);

  const handleUpdateProfile = async () => {
    try {
      if (!name.trim()) {
        Alert.alert('Error', 'Please enter your name');
        return;
      }

      if (username.trim() && username.trim().length < 3) {
        Alert.alert('Error', 'Username must be at least 3 characters long');
        return;
      }

      if (username.trim() && !/^[a-zA-Z0-9_]+$/.test(username.trim())) {
        Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
        return;
      }

      const profileData = { 
        name: name.trim(),
        ...(username.trim() && { username: username.trim() })
      };

      const result = await updateProfile(profileData);
      
      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully');
        setShowEditProfile(false);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleCurrencyPress = () => {
    Alert.alert('Currency', 'Currently only Philippine Peso (₱) is supported');
  };

  const handleNotificationsChange = (value) => {
    setNotificationsEnabled(value);
    // TODO: Implement notifications toggle
  };

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
            if (result.success) {
              // Use global navigation to reset to Auth screen
              reset('Auth');
            } else {
              Alert.alert('Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleUpdateBudget = () => {
    const newBudget = {
      ...budget,
      monthly: parseFloat(monthlyBudget) || 0,
      savingsGoal: parseFloat(savingsGoal) || 0
    };
    updateBudget(newBudget);
    setShowEditBudget(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
          
          <TouchableOpacity 
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.settingItem, { backgroundColor: theme.colors.card }]}>
              <View style={styles.settingItemLeft}>
                <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <Ionicons name="person-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>Profile</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.text }]}>{userInfo?.name || 'Set your name'}</Text>
                  {userInfo?.username && (
                    <Text style={[styles.usernameText, { color: theme.colors.primary }]}>@{userInfo.username}</Text>
                  )}
                  <Text style={[styles.emailText, { color: theme.colors.text }]}>{userInfo?.email}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text} style={{ opacity: 0.6 }} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setShowEditBudget(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.settingItem, { backgroundColor: theme.colors.card }]}>
              <View style={styles.settingItemLeft}>
                <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <Ionicons name="wallet-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>Budget & Goals</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.text }]}>Monthly: ₱{budget.monthly.toLocaleString()}</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.text }]}>Savings Goal: ₱{budget.savingsGoal.toLocaleString()}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.text} style={{ opacity: 0.6 }} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Preferences</Text>
          
          <View style={[styles.settingItem, { backgroundColor: theme.colors.card }]}>
            <View style={styles.settingItemLeft}>
              <View style={[styles.settingIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <Ionicons 
                  name={isDarkMode ? "moon-outline" : "sunny-outline"} 
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

        {/* Features Section */}
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
        
        {/* About Section */}
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
        
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={[styles.logoutButtonText, { color: theme.colors.background }]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showEditProfile}
        onRequestClose={() => setShowEditProfile(false)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Profile</Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Name</Text>
              <TextInput
                style={[styles.input, { 
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card
                }]}
                value={name}
                onChangeText={setName}
                placeholderTextColor={theme.colors.secondaryText}
                placeholder="Enter your name"
                returnKeyType="done"
                onSubmitEditing={handleUpdateProfile}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Username</Text>
              <TextInput
                style={[styles.input, { 
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card
                }]}
                value={username}
                onChangeText={setUsername}
                placeholderTextColor={theme.colors.secondaryText}
                placeholder="Enter a unique username (optional)"
                returnKeyType="next"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.helpText, { color: theme.colors.text }]}>
                Username will be used for the Friends feature. Only letters, numbers, and underscores allowed.
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { 
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  opacity: 0.6
                }]}
                value={email}
                editable={false}
                placeholderTextColor={theme.colors.secondaryText}
                placeholder="Enter your email"
              />
              <Text style={[styles.helpText, { color: theme.colors.text }]}>
                Email cannot be changed for security reasons
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.card }
                ]}
                onPress={() => setShowEditProfile(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelModalButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleUpdateProfile}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveModalButtonText, { color: theme.colors.background }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal
        visible={showEditBudget}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditBudget(false)}
        statusBarTranslucent
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Update Budget & Goals</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Monthly Budget</Text>
              <View style={[styles.inputContainer, { 
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border 
              }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>₱</Text>
                <TextInput
                  style={[styles.input, { 
                    color: theme.colors.text,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    flex: 1,
                    paddingVertical: 16
                  }]}
                  value={monthlyBudget}
                  onChangeText={setMonthlyBudget}
                  keyboardType="decimal-pad"
                  placeholder="Enter monthly budget"
                  placeholderTextColor={theme.colors.secondaryText}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Savings Goal</Text>
              <View style={[styles.inputContainer, { 
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border 
              }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>₱</Text>
                <TextInput
                  style={[styles.input, { 
                    color: theme.colors.text,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    flex: 1,
                    paddingVertical: 16
                  }]}
                  value={savingsGoal}
                  onChangeText={setSavingsGoal}
                  keyboardType="decimal-pad"
                  placeholder="Enter savings goal"
                  placeholderTextColor={theme.colors.secondaryText}
                  returnKeyType="done"
                  onSubmitEditing={handleUpdateBudget}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.card }
                ]}
                onPress={() => setShowEditBudget(false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelModalButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleUpdateBudget}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveModalButtonText, { color: theme.colors.background }]}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    marginHorizontal: 16,
  },
  
  // Header styles
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    letterSpacing: -0.5,
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
  settingValue: {
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 18,
  },
  emailText: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  usernameText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  versionText: {
    fontSize: 14,
    opacity: 0.7,
  },
  
  // Logout button
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  
  // Input styles
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  input: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 12,
  },
  helpText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  
  // Modal buttons
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 32,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default SettingsScreen;
