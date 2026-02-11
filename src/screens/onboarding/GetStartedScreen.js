import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MascotImage from '../../components/MascotImage';

const { width } = Dimensions.get('window');

const GetStartedScreen = ({ navigation }) => {
  const { theme } = useContext(ThemeContext);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem('onboardingComplete', 'false');
      if (global.setHasOnboarded) {
        global.setHasOnboarded(false);
      }
      navigation.navigate('BudgetGoals');
    } catch (error) {
      console.error('Error in GetStartedScreen:', error);
    }
  };

  const features = [
    {
      icon: 'game-controller',
      color: '#E91E63',
      title: 'Gamified Savings',
      description: 'Save money through fun challenges',
    },
    {
      icon: 'sparkles',
      color: '#00D4FF',
      title: 'AI Insights',
      description: 'Smart spending recommendations',
    },
    {
      icon: 'analytics',
      color: '#4CAF50',
      title: 'Predictions',
      description: 'Forecast your expenses',
    },
    {
      icon: 'trophy',
      color: '#FFCC00',
      title: 'Achievements',
      description: 'Earn rewards as you save',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.mascotGlow, { backgroundColor: theme.colors.primary + '20' }]}>
            <MascotImage size={100} />
          </View>
          <Text style={[styles.title, { color: theme.colors.text }]}>Welcome to GaFI</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
            Your gamified finance companion
          </Text>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <View 
              key={index} 
              style={[styles.featureCard, { backgroundColor: theme.colors.card }]}
            >
              <View style={[styles.featureIconContainer, { backgroundColor: feature.color + '20' }]}>
                <Ionicons name={feature.icon} size={24} color={feature.color} />
              </View>
              <Text style={[styles.featureTitle, { color: theme.colors.text }]}>
                {feature.title}
              </Text>
              <Text style={[styles.featureDescription, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
                {feature.description}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const cardWidth = (width - 60) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  mascotGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  featureCard: {
    width: cardWidth,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  ctaContainer: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  button: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 32,
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

export default GetStartedScreen;
