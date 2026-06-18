import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../../theme/typography';
import { useTheme } from '../../context/ThemeContext';

const TermsAndConditionsScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { onAccept, returnScreen } = route.params || {};

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
    navigation.goBack();
  };
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>

      <ScrollView>
        <Text style={[styles.title, { color: theme.colors.text }]}>Terms and Conditions</Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>1. Acceptance of Terms</Text>
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
          By accessing and using GaFI, you accept and agree to be bound by the terms and provision of this agreement.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>2. Privacy Policy</Text>
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
          Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal information.
        </Text>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>3. User Data</Text>
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
          We store your financial data securely and do not share it with third parties without your explicit consent.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleAccept}
        >
          <Text style={styles.buttonText}>I Accept</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  backButton: {
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 24,
    letterSpacing: -0.4,
    marginBottom: 30,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 18,
    letterSpacing: -0.2,
    marginTop: 20,
    marginBottom: 10,
  },
  text: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 15,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  buttonText: {
    fontFamily: FONTS.bodySemiBold,
    color: '#FFF',
    fontSize: 16,
  },
});

export default TermsAndConditionsScreen;
