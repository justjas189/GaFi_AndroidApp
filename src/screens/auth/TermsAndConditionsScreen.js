import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const TermsAndConditionsScreen = ({ navigation, route }) => {
  const { onAccept, returnScreen } = route.params || {};

  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
    navigation.goBack();
  };
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={24} color="#FFF" />
      </TouchableOpacity>

      <ScrollView>
        <Text style={styles.title}>Terms and Conditions</Text>
        
        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.text}>
          By accessing and using MoneyTrack, you accept and agree to be bound by the terms and provision of this agreement.
        </Text>

        <Text style={styles.sectionTitle}>2. Privacy Policy</Text>
        <Text style={styles.text}>
          Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal information.
        </Text>

        <Text style={styles.sectionTitle}>3. User Data</Text>
        <Text style={styles.text}>
          We store your financial data securely and do not share it with third parties without your explicit consent.
        </Text>

        <TouchableOpacity 
          style={styles.button}
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
    backgroundColor: '#1C1C1C',
  },
  backButton: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
    color: '#FFF',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
    color: '#808080',
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#FF6B00',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TermsAndConditionsScreen;
