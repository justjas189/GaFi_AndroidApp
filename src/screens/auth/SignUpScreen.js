// screens/auth/SignUpScreen.js
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileService from '../../services/ProfileService';

const SignUpScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const { register, error, isLoading } = useContext(AuthContext);
  const { colors, spacing, borderRadius, shadows, createThemedStyles } = useTheme();

  // Check username availability with debounce
  const checkUsernameAvailability = async (usernameToCheck) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const validation = ProfileService.validateUsername(usernameToCheck);
    if (!validation.valid) {
      setUsernameAvailable(false);
      return;
    }

    setCheckingUsername(true);
    try {
      const available = await ProfileService.isUsernameAvailable(usernameToCheck);
      setUsernameAvailable(available);
    } catch (error) {
      console.error('Error checking username availability:', error);
      setUsernameAvailable(false);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Debounced username check
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (username.trim()) {
        checkUsernameAvailability(username.trim());
      } else {
        setUsernameAvailable(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const validateForm = () => {
    const newErrors = {};

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    // Validate username (optional but if provided must be valid)
    if (username.trim()) {
      const usernameValidation = ProfileService.validateUsername(username.trim());
      if (!usernameValidation.valid) {
        newErrors.username = usernameValidation.error;
      } else if (usernameAvailable === false) {
        newErrors.username = 'Username is already taken';
      } else if (checkingUsername) {
        newErrors.username = 'Checking username availability...';
      }
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = 'Please enter a valid email';
    }

    // Validate password
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!passwordRegex.test(password)) {
      newErrors.password = 'Password must contain letters, numbers, and special characters';
    }

    // Validate confirm password
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkEmailExists = async (email) => {
    try {
      // Use RPC function to check if email exists in auth.users
      const { data, error } = await supabase.rpc('check_email_exists', {
        email_to_check: email.trim().toLowerCase()
      });
      
      if (error) {
        console.error('Error checking email existence:', error);
        // If RPC fails, fallback to letting registration proceed and handling errors
        return { exists: false, error: null };
      }
      
      return { exists: data, error: null };
    } catch (err) {
      console.error('Error in checkEmailExists:', err);
      // If there's any error, allow registration to proceed
      return { exists: false, error: null };
    }
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    if (!termsAccepted) {
      Alert.alert(
        'Terms & Conditions Required',
        'Please accept the Terms & Conditions to create your account.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Check if email already exists in auth.users
      const { exists, error: checkError } = await checkEmailExists(email);
      
      if (checkError) {
        Alert.alert(
          'Error',
          'Unable to verify email availability. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (exists) {
        Alert.alert(
          'Email Already Exists',
          'An account with this email already exists. Please use a different email or sign in to your existing account.',
          [
            {
              text: 'Go to Login',
              onPress: () => navigation.replace('Login')
            },
            { text: 'OK' }
          ]
        );
        return;
      }

      // Proceed with registration since email doesn't exist
      const usernameToRegister = username.trim() || null;
      const { success, error, user, needsVerification } = await register(
        name.trim(), 
        email.trim(), 
        password,
        usernameToRegister
      );
      
      // Handle any unexpected registration errors
      if (error) {
        Alert.alert(
          'Registration Failed',
          error || 'Unable to create account. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      if (success && needsVerification) {
        Alert.alert(
          'Verify Your Email',
          'A verification link has been sent to your email. Please check your inbox and click the link to verify your account.',
          [
            {
              text: 'Resend Email',
              onPress: async () => {
                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: email.trim()
                });
                if (error) {
                  Alert.alert('Error', 'Failed to resend verification email. Please try again.');
                } else {
                  Alert.alert('Success', 'Verification email has been resent. Please check your inbox.');
                }
              }
            },
            {
              text: 'Go to Login',
              onPress: () => navigation.replace('Login')
            }
          ]
        );
        return;
      }
      
      if (success && user) {
        // Registration successful, navigate appropriately
        navigation.replace('Login');
        return;
      }

      // If we reach here, there was an unexpected error
      Alert.alert(
        'Registration Failed',
        'Unable to create account. Please try again.',
        [{ text: 'OK' }]
      );

    } catch (err) {
      console.error('SignUp error:', err);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  };

  const styles = createThemedStyles((theme) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    backButton: {
      marginBottom: theme.spacing.lg,
    },
    header: {
      marginBottom: theme.spacing.xl,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
    },
    form: {
      marginBottom: theme.spacing.lg,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    inputIcon: {
      marginRight: theme.spacing.sm,
    },
    input: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 16,
      paddingVertical: theme.spacing.md,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 12,
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      marginLeft: theme.spacing.xs * 3,
    },
    hintText: {
      fontSize: 12,
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      marginLeft: theme.spacing.xs * 3,
    },
    successText: {
      color: theme.colors.success,
    },
    showPasswordButton: {
      padding: theme.spacing.xs,
    },
    termsButton: {
      marginBottom: theme.spacing.lg,
    },
    termsText: {
      color: theme.colors.primary,
      fontSize: 14,
      textAlign: 'center',
    },
    termsAcceptedText: {
      color: theme.colors.success,
    },
    signUpButton: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      ...theme.shadows.small,
    },
    signUpButtonDisabled: {
      backgroundColor: theme.colors.disabled,
    },
    signUpButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    footerText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    loginText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: 'bold',
    },
  }));

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Track your expenses with GaFI</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                placeholder="Full Name"
                placeholderTextColor={colors.placeholder}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setErrors({ ...errors, name: null });
                }}
                editable={!isLoading}
              />
            </View>
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            <View style={[styles.inputContainer, errors.username && styles.inputError]}>
              <Ionicons name="at-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username (optional)"
                placeholderTextColor={colors.placeholder}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  setErrors({ ...errors, username: null });
                }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                maxLength={30}
              />
              {checkingUsername && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
              )}
              {!checkingUsername && usernameAvailable === true && (
                <Ionicons name="checkmark-circle" size={20} color={colors.success} style={{ marginRight: 8 }} />
              )}
              {!checkingUsername && usernameAvailable === false && (
                <Ionicons name="close-circle" size={20} color={colors.error} style={{ marginRight: 8 }} />
              )}
            </View>
            {errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
            {username.trim() && !errors.username && !checkingUsername && (
              <Text style={[styles.hintText, usernameAvailable ? styles.successText : styles.errorText]}>
                {usernameAvailable ? '✓ Username is available' : '✗ Username is not available'}
              </Text>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Email"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors({ ...errors, email: null });
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                placeholder="Password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrors({ ...errors, password: null });
                }}
                secureTextEntry={!showPassword}
                editable={!isLoading}
              />
              <TouchableOpacity 
                style={styles.showPasswordButton}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color={colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder="Confirm Password"
                placeholderTextColor={colors.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isLoading}>
                <Ionicons 
                  name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color={colors.textSecondary} 
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

            <TouchableOpacity 
              style={styles.termsButton}
              onPress={() => navigation.navigate('TermsAndConditions', {
                onAccept: () => setTermsAccepted(true),
                returnScreen: 'SignUp'
              })}
              disabled={isLoading}
            >
              <Text style={[styles.termsText, termsAccepted && styles.termsAcceptedText]}>
                {termsAccepted ? '✓ Terms & Conditions Accepted' : 'By signing up, you agree to our Terms & Conditions'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.signUpButton, 
                (isLoading || !termsAccepted) && styles.signUpButtonDisabled
              ]}
              onPress={handleSignUp}
              disabled={isLoading || !termsAccepted}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.signUpButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={isLoading}>
              <Text style={styles.loginText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUpScreen;