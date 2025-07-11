import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';

const BudgetGoalsScreen = ({ navigation }) => {
  const { updateBudget } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');
  const [errors, setErrors] = useState({});

  const validateInputs = () => {
    const newErrors = {};
    if (!monthlyBudget.trim()) {
      newErrors.monthlyBudget = 'Monthly budget is required';
    } else {
      const monthly = parseFloat(monthlyBudget);
      if (isNaN(monthly) || monthly <= 0) {
        newErrors.monthlyBudget = 'Please enter a valid amount';
      }
    }

    if (!savingsGoal.trim()) {
      newErrors.savingsGoal = 'Savings goal is required';
    } else {
      const savings = parseFloat(savingsGoal);
      if (isNaN(savings) || savings <= 0) {
        newErrors.savingsGoal = 'Please enter a valid amount';
      } else if (savings >= parseFloat(monthlyBudget)) {
        newErrors.savingsGoal = 'Savings goal should be less than monthly budget';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleComplete = async () => {
    if (!validateInputs()) return;

    try {
      // Get user info to ensure we have the user ID
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
      const savings = parseFloat(savingsGoal);
      const budgetableAmount = monthly - savings;
      const categoryBudget = Math.round((budgetableAmount / 6) * 100) / 100;

      // Set budget data
      const budgetData = {
        monthly,
        savingsGoal: savings,
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

      // Save budget to backend (scoped to user)
      await updateBudget(budgetData);

      // Mark onboarding as complete in Supabase
      const { data: { session } } = await import('../../config/supabase').then(m => m.supabase.auth.getSession());
      if (session && session.user) {
        await import('../../config/supabase').then(m => m.supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', session.user.id)
        );
      }

      // Mark onboarding as complete locally
      await AsyncStorage.setItem('onboardingComplete', 'true');
      if (global.setHasOnboarded) global.setHasOnboarded(true);

      // Navigate to main app
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget and complete onboarding. Please try again.');
      console.error('Error in BudgetGoalsScreen:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="wallet" size={60} color={theme.colors.primary} />
          <Text style={[styles.title, { color: theme.colors.text }]}>Set Your Budget Goals</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text }]}>
            Let's set up your monthly budget and savings goals to help you manage your finances better
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Monthly Budget</Text>
            <View style={[styles.inputContainer, errors.monthlyBudget && styles.inputError]}>
              <Text style={[styles.currency, { color: theme.colors.text }]}>₱</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Enter your monthly budget"
                placeholderTextColor={theme.colors.text + '80'}
                value={monthlyBudget}
                onChangeText={(text) => {
                  setMonthlyBudget(text);
                  setErrors({ ...errors, monthlyBudget: null });
                }}
                keyboardType="numeric"
              />
            </View>
            {errors.monthlyBudget && <Text style={styles.errorText}>{errors.monthlyBudget}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Monthly Savings Goal</Text>
            <View style={[styles.inputContainer, errors.savingsGoal && styles.inputError]}>
              <Text style={[styles.currency, { color: theme.colors.text }]}>₱</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Enter your savings goal"
                placeholderTextColor={theme.colors.text + '80'}
                value={savingsGoal}
                onChangeText={(text) => {
                  setSavingsGoal(text);
                  setErrors({ ...errors, savingsGoal: null });
                }}
                keyboardType="numeric"
              />
            </View>
            {errors.savingsGoal && <Text style={styles.errorText}>{errors.savingsGoal}</Text>}
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleComplete}
        >
          <Text style={styles.buttonText}>Complete Setup</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginVertical: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.8,
  },
  form: {
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3C3C3C',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  currency: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default BudgetGoalsScreen;
