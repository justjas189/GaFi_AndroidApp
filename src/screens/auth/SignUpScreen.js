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
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ProfileService from '../../services/ProfileService';
import { validatePassword } from '../../utils/ValidationUtils';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import UserTypeCards from '../../components/onboarding/UserTypeCards';
import { detectUserTypeFromEmail } from '../../utils/emailUserType';
import { FONTS } from '../../theme/typography';
import { toast } from '../../utils/toast';
import { useConfirm } from '../../components/feedback/ConfirmProvider';

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
  const [selectedUserType, setSelectedUserType] = useState(null); // 'student' | 'employee'
  const [userTypeTouched, setUserTypeTouched] = useState(false);  // manual pick freezes auto-detect
  const { register, loginWithGoogle, error, isLoading } = useContext(AuthContext);
  const { colors, spacing, borderRadius, shadows, createThemedStyles } = useTheme();
  const confirm = useConfirm();

  const handleGoogleSignUp = async () => {
    // Google handles sign-up and sign-in identically; the SIGNED_IN auth event
    // swaps the navigator (new users route to Onboarding automatically).
    const { success, error, cancelled } = await loginWithGoogle();
    if (!success && !cancelled) {
      toast.error('Google sign-in failed', error || 'Could not sign in with Google. Try again.');
    }
  };

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

  // Live auto-detect: as the email is typed, a recognized school/work domain
  // flips the user-type cards automatically. A manual card tap wins for the
  // rest of the session, and a null detection never clears an existing
  // selection (no jumpy UI mid-typing).
  React.useEffect(() => {
    if (userTypeTouched) return;
    const detected = detectUserTypeFromEmail(email);
    if (detected) setSelectedUserType(detected);
  }, [email, userTypeTouched]);

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

    // Validate user type (Student / Employee cards)
    if (!selectedUserType) {
      newErrors.userType = 'Tell us if you are a student or an employee';
    }

    // Validate password — shared rules (min length, uppercase, lowercase,
    // number, special char) live in ValidationUtils, same as the reset flow.
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      newErrors.password = passwordCheck.errors[0];
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
      toast.error('Accept the terms', 'Agree to the Terms & Conditions to create your account.');
      return;
    }

    try {
      // Check if email already exists in auth.users
      const { exists, error: checkError } = await checkEmailExists(email);
      
      if (checkError) {
        toast.error('Something went wrong', 'Could not verify email availability. Try again.');
        return;
      }

      if (exists) {
        // Two-way decision (sign in vs. pick another email) → confirm modal.
        const goLogin = await confirm({
          title: 'Email already registered',
          message: 'An account with this email exists. Sign in instead?',
          confirmLabel: 'Go to login',
          cancelLabel: 'Use another email',
          icon: 'mail',
        });
        if (goLogin) navigation.replace('Login');
        return;
      }

      // Proceed with registration since email doesn't exist
      const usernameToRegister = username.trim() || null;
      const { success, error, user, needsVerification } = await register(
        name.trim(),
        email.trim(),
        password,
        usernameToRegister,
        selectedUserType
      );
      
      // Handle any unexpected registration errors
      if (error) {
        toast.error('Registration failed', error || 'Could not create your account. Try again.');
        return;
      }

      if (success && needsVerification) {
        // Two-button decision (resend vs. head to login) → confirm modal.
        const resend = await confirm({
          title: 'Verify your email',
          message: 'We sent a verification link to your email. Tap it to activate your account.',
          confirmLabel: 'Resend email',
          cancelLabel: 'Go to login',
          icon: 'mail-unread',
        });
        if (resend) {
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.trim(),
            options: {
              emailRedirectTo: Linking.createURL(''),
            },
          });
          if (error) {
            toast.error('Resend failed', 'Could not resend the email. Try again.');
          } else {
            toast.success('Email sent', 'Check your inbox for the verification link.');
          }
        } else {
          navigation.replace('Login');
        }
        return;
      }
      
      if (success && user) {
        // Registration successful, navigate appropriately
        navigation.replace('Login');
        return;
      }

      // If we reach here, there was an unexpected error
      toast.error('Registration failed', 'Could not create your account. Try again.');

    } catch (err) {
      console.error('SignUp error:', err);
      toast.error('Something went wrong', 'An unexpected error occurred. Try again later.');
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
      fontFamily: FONTS.headingBold,
      fontSize: 28,
      letterSpacing: -0.4,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontFamily: FONTS.bodyRegular,
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
      fontFamily: FONTS.bodyRegular,
      color: theme.colors.text,
      fontSize: 16,
      paddingVertical: theme.spacing.md,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    errorText: {
      fontFamily: FONTS.bodyRegular,
      color: theme.colors.error,
      fontSize: 12,
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      marginLeft: theme.spacing.xs * 3,
    },
    hintText: {
      fontFamily: FONTS.bodyRegular,
      fontSize: 12,
      marginTop: -theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      marginLeft: theme.spacing.xs * 3,
    },
    successText: {
      color: theme.colors.success,
    },
    sectionLabel: {
      fontFamily: FONTS.bodyMedium,
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      marginLeft: theme.spacing.xs,
    },
    userTypeSection: {
      marginBottom: theme.spacing.md,
    },
    // The user-type cards sit between two inputs; hints below them need their
    // own top offset (the shared hintText negative margin assumes an input above).
    userTypeHint: {
      marginTop: theme.spacing.xs,
    },
    showPasswordButton: {
      padding: theme.spacing.xs,
    },
    termsButton: {
      marginBottom: theme.spacing.lg,
    },
    termsText: {
      fontFamily: FONTS.bodyMedium,
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
      fontFamily: FONTS.bodySemiBold,
      color: '#FFF',
      fontSize: 16,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: theme.spacing.lg,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      fontFamily: FONTS.bodyMedium,
      color: theme.colors.textSecondary,
      fontSize: 13,
      marginHorizontal: theme.spacing.md,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    footerText: {
      fontFamily: FONTS.bodyRegular,
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    loginText: {
      fontFamily: FONTS.bodySemiBold,
      color: theme.colors.primary,
      fontSize: 14,
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
            <Text style={styles.subtitle}>Track your expenses with GaFi</Text>
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
            {!errors.username && !checkingUsername && usernameAvailable !== null && (
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

            <View style={styles.userTypeSection}>
              <Text style={styles.sectionLabel}>I am a…</Text>
              <UserTypeCards
                compact
                selectedType={selectedUserType}
                onSelect={(type) => {
                  setSelectedUserType(type);
                  setUserTypeTouched(true);
                  setErrors({ ...errors, userType: null });
                }}
              />
              {!userTypeTouched && selectedUserType && detectUserTypeFromEmail(email) === selectedUserType && (
                <Text style={[styles.hintText, styles.successText, styles.userTypeHint]}>
                  ✨ Detected "{selectedUserType === 'student' ? 'Student' : 'Employee'}" from your school email — tap the other card if that's wrong.
                </Text>
              )}
              {errors.userType && <Text style={[styles.errorText, styles.userTypeHint]}>{errors.userType}</Text>}
            </View>

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

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <GoogleSignInButton
              onPress={handleGoogleSignUp}
              loading={isLoading}
              disabled={isLoading}
              label="Sign up with Google"
            />
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