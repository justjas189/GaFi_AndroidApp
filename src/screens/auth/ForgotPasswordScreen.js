import React, { useState, useContext } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';
import { FONTS } from '../../theme/typography';
import { toast } from '../../utils/toast';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { sendPasswordResetEmail } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);

  const handleResetPassword = async () => {
    try {
      if (!email) {
        toast.error('Email required', 'Enter your email address.');
        return;
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        toast.error('Check your email', "That doesn't look like a valid address.");
        return;
      }

      setIsSubmitting(true);
      const result = await sendPasswordResetEmail(email.trim());
      if (result.success) {
        // Ghost: navigating to the code screen IS the feedback. The
        // toast just carries the why so the new screen has context.
        toast.success('Code sent', `Check ${email.trim()} for your 6-digit code.`);
        navigation.navigate('VerifyResetCode', { email: email.trim() });
      } else {
        toast.error('Could not send code', result.error || 'Try again.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error('Something went wrong', 'Try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text, opacity: 0.6 }]}>
          Enter your email to receive a verification code
        </Text>
        
        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.colors.card,
            color: theme.colors.text,
            borderColor: theme.colors.border
          }]}
          placeholder="Enter your email"
          placeholderTextColor={theme.colors.text + '80'}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleResetPassword}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Send Verification Code</Text>
          )}
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
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  backButton: {
    padding: 10,
    marginLeft: 10,
    marginTop: 10,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 28,
    letterSpacing: -0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  input: {
    height: 55,
    fontFamily: FONTS.bodyRegular,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 2,
  },
  button: {
    height: 55,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});

export default ForgotPasswordScreen;
