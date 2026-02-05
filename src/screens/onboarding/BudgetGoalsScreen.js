import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

const BUDGET_PRESETS = [
  { label: '₱5,000', value: 5000 },
  { label: '₱10,000', value: 10000 },
  { label: '₱15,000', value: 15000 },
  { label: '₱20,000', value: 20000 },
  { label: '₱30,000', value: 30000 },
  { label: '₱50,000', value: 50000 },
];

const BudgetGoalsScreen = ({ navigation }) => {
  const { updateBudget } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [error, setError] = useState('');

  const handlePresetSelect = (value) => {
    setMonthlyBudget(value.toString());
    setError('');
  };

  const validateInput = () => {
    if (!monthlyBudget.trim()) {
      setError('Please enter your monthly budget');
      return false;
    }
    const monthly = parseFloat(monthlyBudget);
    if (isNaN(monthly) || monthly <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    if (monthly < 1000) {
      setError('Budget should be at least ₱1,000');
      return false;
    }
    return true;
  };

  const handleComplete = async () => {
    if (!validateInput()) return;

    try {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (!userInfo) {
        Alert.alert('Error', 'User information not found. Please log in again.');
        navigation.replace('Auth');
        return;
      }

      const parsedUserInfo = JSON.parse(userInfo);
      if (!parsedUserInfo.id) {
        Alert.alert('Error', 'User ID not found. Please log in again.');
        navigation.replace('Auth');
        return;
      }

      const monthly = parseFloat(monthlyBudget);
      const categoryBudget = Math.round((monthly / 6) * 100) / 100;

      const budgetData = {
        monthly,
        savingsGoal: 0,
        userId: parsedUserInfo.id,
        categories: {
          food: { limit: categoryBudget, spent: 0 },
          transportation: { limit: categoryBudget, spent: 0 },
          entertainment: { limit: categoryBudget, spent: 0 },
          shopping: { limit: categoryBudget, spent: 0 },
          utilities: { limit: categoryBudget, spent: 0 },
          others: { limit: categoryBudget, spent: 0 }
        }
      };

      await updateBudget(budgetData);

      const { data: { session } } = await import('../../config/supabase').then(m => m.supabase.auth.getSession());
      if (session && session.user) {
        await import('../../config/supabase').then(m => m.supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', session.user.id)
        );
      }

      await AsyncStorage.setItem('onboardingComplete', 'true');
      if (global.setHasOnboarded) global.setHasOnboarded(true);

      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget. Please try again.');
      console.error('Error in BudgetGoalsScreen:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="wallet" size={48} color={theme.colors.primary} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>Set Your Budget</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
              How much do you plan to spend monthly?
            </Text>
          </View>

          {/* Budget Input */}
          <View style={styles.inputSection}>
            <View style={[
              styles.inputContainer, 
              { backgroundColor: theme.colors.card, borderColor: error ? '#FF3B30' : theme.colors.border || '#3C3C3C' }
            ]}>
              <Text style={[styles.currency, { color: theme.colors.primary }]}>₱</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="0"
                placeholderTextColor={theme.colors.text + '40'}
                value={monthlyBudget}
                onChangeText={(text) => {
                  setMonthlyBudget(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                keyboardType="numeric"
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* Quick Select Presets */}
          <View style={styles.presetsSection}>
            <Text style={[styles.presetsLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
              Quick select
            </Text>
            <View style={styles.presetsGrid}>
              {BUDGET_PRESETS.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.presetButton,
                    { backgroundColor: theme.colors.card },
                    monthlyBudget === preset.value.toString() && { 
                      backgroundColor: theme.colors.primary + '20',
                      borderColor: theme.colors.primary,
                      borderWidth: 2,
                    }
                  ]}
                  onPress={() => handlePresetSelect(preset.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.presetText, 
                    { color: monthlyBudget === preset.value.toString() ? theme.colors.primary : theme.colors.text }
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="information-circle" size={24} color="#00D4FF" />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
              You can set savings goals later through the gamification feature. Your budget will be evenly distributed across 6 categories.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={[styles.bottomContainer, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Complete Setup</Text>
          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const presetWidth = (width - 60) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 72,
  },
  currency: {
    fontSize: 32,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 32,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  presetsSection: {
    marginBottom: 24,
  },
  presetsLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  presetButton: {
    width: presetWidth,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
  },
  button: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default BudgetGoalsScreen;
