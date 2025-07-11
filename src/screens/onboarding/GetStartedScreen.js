import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GetStartedScreen = ({ navigation }) => {
  const { theme } = useContext(ThemeContext);

  const handleGetStarted = async () => {
    try {
      // Ensure onboarding is marked as not completed
      await AsyncStorage.setItem('onboardingComplete', 'false');
      
      // Update global state
      if (global.setHasOnboarded) {
        global.setHasOnboarded(false);
      }
      
      // Navigate to budget goals screen
      navigation.replace('BudgetGoals');
    } catch (error) {
      console.error('Error in GetStartedScreen:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <Ionicons name="wallet" size={80} color={theme.colors.primary} />
        </View>
        
        <Text style={[styles.title, { color: theme.colors.text }]}>Welcome to MoneyTrack</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
          Your personal finance companion for smart spending and saving
        </Text>

        <View style={styles.featuresContainer}>
          <Text style={[styles.featureText, { color: theme.colors.text }]}>✓ Track your daily expenses</Text>
          <Text style={[styles.featureText, { color: theme.colors.text }]}>✓ Set and monitor budget goals</Text>
          <Text style={[styles.featureText, { color: theme.colors.text }]}>✓ Get AI-powered insights</Text>
          <Text style={[styles.featureText, { color: theme.colors.text }]}>✓ Stay organized with notes</Text>
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleGetStarted}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    opacity: 0.8,
  },
  featuresContainer: {
    alignSelf: 'stretch',
    marginBottom: 40,
    paddingHorizontal: 40,
  },
  featureText: {
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default GetStartedScreen;
