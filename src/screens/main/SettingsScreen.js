import React, { useContext, useState } from 'react';
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

const SettingsScreen = ({ navigation }) => {
  const { logout, userInfo } = useContext(AuthContext);
  const { budget, updateBudget } = useContext(DataContext);
  const { theme, isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditBudget, setShowEditBudget] = useState(false);
  const [name, setName] = useState(userInfo?.name || '');
  const [email, setEmail] = useState(userInfo?.email || '');
  const [monthlyBudget, setMonthlyBudget] = useState(budget.monthly.toString());
  const [savingsGoal, setSavingsGoal] = useState(budget.savingsGoal.toString());

  const handleUpdateProfile = async () => {
    try {
      // Get current user info
      const storedUserInfo = await AsyncStorage.getItem('userInfo');
      if (!storedUserInfo) {
        Alert.alert('Error', 'User information not found');
        return;
      }

      const currentUserInfo = JSON.parse(storedUserInfo);
      const updatedUserInfo = {
        ...currentUserInfo,
        name: name.trim(),
        email: email.trim()
      };

      // Save updated user info
      await AsyncStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
      Alert.alert('Success', 'Profile updated successfully');
      setShowEditProfile(false);
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
            const success = await logout();
            if (success) {
              // Reset navigation stack to Auth
              navigation.reset({
                index: 0,
                routes: [{ name: 'Auth' }]
              });
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
      
      <ScrollView>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Account</Text>
          <TouchableOpacity onPress={() => setShowEditProfile(true)}>
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="person-outline" size={24} color={theme.colors.text} />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>Profile</Text>
                  <View>
                    <Text style={[styles.settingValue, { color: theme.colors.text }]}>{userInfo?.name || 'Set your name'}</Text>
                    <Text style={[styles.emailText, { color: theme.colors.text }]}>{userInfo?.email}</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowEditBudget(true)}>
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="wallet-outline" size={24} color={theme.colors.text} />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>Budget & Goals</Text>
                  <View>
                    <Text style={[styles.settingValue, { color: theme.colors.text }]}>Monthly: ₱{budget.monthly.toFixed(2)}</Text>
                    <Text style={[styles.settingValue, { color: theme.colors.text }]}>Savings Goal: ₱{budget.savingsGoal.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
            </View>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Preferences</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons 
                  name={isDarkMode ? "moon-outline" : "sunny-outline"} 
                  size={24} 
                  color={theme.colors.text} 
                />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>Dark Mode</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                    {isDarkMode ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: '#FF6B00' }}
                thumbColor={isDarkMode ? '#f4f3f4' : '#f4f3f4'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="notifications-outline" size={24} color={theme.colors.text} />
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>Notifications</Text>
                  <Text style={[styles.settingValue, { color: theme.colors.text }]}>
                    {notificationsEnabled ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsChange}
                trackColor={{ false: '#767577', true: '#FF6B00' }}
                thumbColor={notificationsEnabled ? '#f4f3f4' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>
        
        {/* About Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingItemLeft}>
              <Ionicons name="information-circle-outline" size={24} color={theme.colors.text} />
              <Text style={[styles.settingText, { color: theme.colors.text }]}>App Info</Text>
            </View>
            <Text style={[styles.versionText, { color: theme.colors.text }]}>v1.0.0</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
          onPress={handleLogout}
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
                placeholderText="Enter your name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { 
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card
                }]}
                value={email}
                onChangeText={setEmail}
                placeholderTextColor={theme.colors.secondaryText}
                placeholderText="Enter your email"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.card }
                ]}
                onPress={() => setShowEditProfile(false)}
              >
                <Text style={[styles.cancelModalButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleUpdateProfile}
              >
                <Text style={[styles.saveModalButtonText, { color: theme.colors.background }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal
        visible={showEditBudget}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditBudget(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Update Budget & Goals</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Monthly Budget</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>₱</Text>
                <TextInput
                  style={[styles.input, { 
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card 
                  }]}
                  value={monthlyBudget}
                  onChangeText={setMonthlyBudget}
                  keyboardType="decimal-pad"
                  placeholder="Enter monthly budget"
                  placeholderTextColor={theme.colors.secondaryText}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.text }]}>Savings Goal</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>₱</Text>
                <TextInput
                  style={[styles.input, { 
                    color: theme.colors.text,
                    backgroundColor: theme.colors.card 
                  }]}
                  value={savingsGoal}
                  onChangeText={setSavingsGoal}
                  keyboardType="decimal-pad"
                  placeholder="Enter savings goal"
                  placeholderTextColor={theme.colors.secondaryText}
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
              >
                <Text style={[styles.cancelModalButtonText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleUpdateBudget}
              >
                <Text style={[styles.saveModalButtonText, { color: theme.colors.background }]}>Save</Text>
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
    flex:           1,
  },
  section: {
    marginBottom:   20,
  },
  profileSection: {
    padding: 20,
    backgroundColor: '#2C2C2C',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  profileInfo: {
    alignItems: 'center',
  },
  userName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userEmail: {
    color: '#808080',
    fontSize: 14,
  },

  // Header styles
  title: {
    fontSize:       24,
    fontWeight:     'bold',
    padding:        20,
  },
  sectionTitle: {
    fontSize:       14,
    fontWeight:     '500',
    paddingHorizontal: 20,
    marginBottom:   10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 60,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 15,
  },
  settingText: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 15,
  },
  emailText: {
    color: '#808080',
    fontSize: 14,
    marginLeft: 15,
  },
  settingInfo: {
    flex: 1,
    marginLeft: 15,
  },
  settingValue: {
    color: '#808080',
    fontSize: 14,
    marginTop: 2,
  },
  versionText: {
    color: '#808080',
    fontSize: 14,
  },
  logoutButton: {
    margin: 20,
    padding: 15,
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1C1C1C',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#808080',
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 15,
    color: '#FFF',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    paddingHorizontal: 15,
  },
  currencySymbol: {
    color: '#FF6B00',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#2C2C2C',
    marginRight: 10,
  },
  saveModalButton: {
    backgroundColor: '#FF6B00',
    marginLeft: 10,
  },
  cancelModalButtonText: {
    color: '#808080',
    fontSize: 16,
  },
  saveModalButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;
