// src/screens/onboarding/UserTypeScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import MascotImage from '../../components/MascotImage';

const UserTypeScreen = ({ navigation }) => {
  const [selectedType, setSelectedType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { userInfo } = useAuth();
  const { theme } = React.useContext(ThemeContext);

  const userTypes = [
    {
      id: 'student',
      title: 'Student',
      subtitle: 'I\'m a student managing my allowance',
      icon: 'school-outline',
      color: '#4CAF50',
      gradient: ['#4CAF50', '#45a049'],
    },
    {
      id: 'employee',
      title: 'Employee',
      subtitle: 'I\'m an employee managing my salary',
      icon: 'briefcase-outline',
      color: '#2196F3',
      gradient: ['#2196F3', '#1976D2'],
    },
  ];

  const handleSelectType = (type) => {
    setSelectedType(type);
  };

  const handleContinue = async () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select whether you\'re a student or an employee.');
      return;
    }

    try {
      setIsLoading(true);

      // Save user type to AsyncStorage
      await AsyncStorage.setItem('userType', selectedType);
      
      // Save to database if user is authenticated
      if (userInfo?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            user_type: selectedType,
            updated_at: new Date().toISOString()
          })
          .eq('id', userInfo.id);

        if (error) {
          console.warn('Could not update user type in database:', error);
          // Don't block the user from continuing - AsyncStorage is sufficient
        }
      }

      // Navigate to next onboarding screen
      navigation.navigate('BudgetGoals');
    } catch (error) {
      console.error('Error saving user type:', error);
      Alert.alert('Error', 'Failed to save your selection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Allow skip but still navigate to next screen
    navigation.navigate('BudgetGoals');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.mascotContainer}>
          <MascotImage size={80} />
        </View>
        <Text style={[styles.title, { color: theme.colors.text }]}>Welcome to GaFI! 👋</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
          Let's personalize your experience. Are you a student or an employee?
        </Text>
      </View>

      <View style={styles.optionsContainer}>
        {userTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.optionCard,
              { backgroundColor: theme.colors.card },
              selectedType === type.id && styles.optionCardSelected,
              { borderColor: selectedType === type.id ? type.color : theme.colors.border }
            ]}
            onPress={() => handleSelectType(type.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: type.color + '20' }]}>
              <Ionicons name={type.icon} size={40} color={type.color} />
            </View>
            
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>{type.title}</Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.text }]}>{type.subtitle}</Text>
            </View>

            <View style={styles.radioContainer}>
              <View style={[
                styles.radioOuter,
                { borderColor: theme.colors.border },
                selectedType === type.id && { borderColor: type.color }
              ]}>
                {selectedType === type.id && (
                  <View style={[styles.radioInner, { backgroundColor: type.color }]} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
        <Text style={styles.infoText}>
          This helps us customize your budget categories and financial tracking experience.
        </Text>
      </View>

      <View style={styles.footer}>
        {/* <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isLoading}
        >
          <Text style={[styles.skipButtonText, { color: theme.colors.text }]}>Skip for now</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: theme.colors.primary },
            (!selectedType || isLoading) && styles.continueButtonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedType || isLoading}
        >
          <Text style={styles.continueButtonText}>
            {isLoading ? 'Saving...' : 'Continue'}
          </Text>
          {!isLoading && <Ionicons name="arrow-forward" size={20} color="#FFF" />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
    alignItems: 'center',
  },
  mascotContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.8,
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  optionCardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  radioContainer: {
    marginLeft: 12,
  },
  radioOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  footer: {
    gap: 12,
    marginTop: 'auto',
  },
  skipButton: {
    padding: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  continueButton: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: '#CCCCCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default UserTypeScreen;
