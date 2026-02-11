import React, { useState, useRef, useContext } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { ThemeContext } from '../../context/ThemeContext';

const VerifyResetCodeScreen = ({ navigation, route }) => {
  const { email } = route.params;
  const [resetCode, setResetCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { resetPassword } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const codeInputs = useRef([...Array(6)].map(() => React.createRef()));

  // Password validation helper functions
  const hasUpperCase = (str) => /[A-Z]/.test(str);
  const hasLowerCase = (str) => /[a-z]/.test(str);
  const hasNumber = (str) => /\d/.test(str);
  const hasSpecialChar = (str) => /[@$!%*?&]/.test(str);
  const isLongEnough = (str) => str.length >= 8;

  const [passwordStrength, setPasswordStrength] = useState({
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    length: false
  });

  const handlePasswordChange = (text) => {
    setNewPassword(text);
    setPasswordStrength({
      uppercase: hasUpperCase(text),
      lowercase: hasLowerCase(text),
      number: hasNumber(text),
      special: hasSpecialChar(text),
      length: isLongEnough(text)
    });
  };

  const handleCodeChange = (text, index) => {
    const newCode = [...resetCode];
    newCode[index] = text;
    setResetCode(newCode);

    // Auto-advance to next input
    if (text && index < 5) {
      codeInputs.current[index + 1]?.current?.focus();
    }
    // Auto-submit when all digits are entered
    if (text && index === 5) {
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !resetCode[index] && index > 0) {
      codeInputs.current[index - 1]?.current?.focus();
    }
  };  const handleResetPassword = async () => {
    try {
      const code = resetCode.join('');
      if (!code || code.length !== 6) {
        Alert.alert('Error', 'Please enter the complete 6-digit code');
        return;
      }

      if (!newPassword) {
        Alert.alert('Error', 'Please enter your new password');
        return;
      }

      // Validate all password requirements are met
      if (!Object.values(passwordStrength).every(Boolean)) {
        Alert.alert(
          'Invalid Password',
          'Your password must include:\n' +
          '• At least 8 characters\n' +
          '• One uppercase letter\n' +
          '• One lowercase letter\n' +
          '• One number\n' +
          '• One special character (@$!%*?&)'
        );
        return;
      }

      setIsSubmitting(true);
      const result = await resetPassword(code, newPassword.trim(), email);
      if (result.success) {
        Alert.alert(
          'Success', 
          'Your password has been reset successfully. Please log in with your new password.',
          [{ 
            text: 'OK',
            onPress: () => {
              // Clear sensitive data
              setResetCode(['', '', '', '', '', '']);
              setNewPassword('');
              setPasswordStrength({
                uppercase: false,
                lowercase: false,
                number: false,
                special: false,
                length: false
              });
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          }]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      Alert.alert(
        'Error',
        'An unexpected error occurred while resetting your password. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPasswordStrengthIndicator = () => (
    <View style={styles.strengthContainer}>
      <Text style={[styles.strengthTitle, { color: theme.colors.text }]}>Password Requirements:</Text>
      <View style={styles.requirementList}>
        <Text style={[styles.requirement, { color: passwordStrength.length ? theme.colors.primary : theme.colors.text }]}>
          {passwordStrength.length ? '✓' : '○'} At least 8 characters
        </Text>
        <Text style={[styles.requirement, { color: passwordStrength.uppercase ? theme.colors.primary : theme.colors.text }]}>
          {passwordStrength.uppercase ? '✓' : '○'} One uppercase letter
        </Text>
        <Text style={[styles.requirement, { color: passwordStrength.lowercase ? theme.colors.primary : theme.colors.text }]}>
          {passwordStrength.lowercase ? '✓' : '○'} One lowercase letter
        </Text>
        <Text style={[styles.requirement, { color: passwordStrength.number ? theme.colors.primary : theme.colors.text }]}>
          {passwordStrength.number ? '✓' : '○'} One number
        </Text>
        <Text style={[styles.requirement, { color: passwordStrength.special ? theme.colors.primary : theme.colors.text }]}>
          {passwordStrength.special ? '✓' : '○'} One special character (@$!%*?&)
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Reset Password</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
          Enter the 6-digit code sent to {email}
        </Text>

        <View style={styles.codeContainer}>
          {resetCode.map((digit, index) => (
            <TextInput
              key={index}
              ref={codeInputs.current[index]}
              style={[
                styles.codeInput,
                { 
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text.replace(/[^0-9]/g, ''), index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              selectTextOnFocus
              returnKeyType={index === 5 ? "done" : "next"}
            />
          ))}
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.colors.card, color: theme.colors.text }]}
            placeholder="New Password"
            placeholderTextColor={theme.colors.text + '80'}
            value={newPassword}
            onChangeText={handlePasswordChange}
            secureTextEntry
          />
        </View>

        {renderPasswordStrengthIndicator()}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleResetPassword}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Reset Password</Text>
          )}
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
  backButton: {
    marginBottom: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
    opacity: 0.8,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  codeInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 5,
  },
  inputContainer: {
    marginVertical: 20,
  },
  input: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  strengthContainer: {
    marginBottom: 20,
  },
  strengthTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  requirementList: {
    paddingLeft: 10,
  },
  requirement: {
    fontSize: 14,
    marginBottom: 5,
  },
});

export default VerifyResetCodeScreen;
