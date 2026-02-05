// src/screens/auth/SchoolRegistrationScreen.js
// Enhanced Registration Screen for School-Wide Implementation
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import SchoolAuthService from '../../services/SchoolAuthService';
import DebugUtils from '../../utils/DebugUtils';

const SchoolRegistrationScreen = ({ navigation }) => {
  const { theme } = useTheme();
  
  // Form state
  const [step, setStep] = useState(1); // Multi-step registration
  const [schoolId, setSchoolId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [department, setDepartment] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errors, setErrors] = useState({});

  // Department options based on user role
  const departmentOptions = {
    student_college: [
      { label: 'CCIS - Computer & Information Sciences', value: 'ccis' },
      { label: 'CMET - Mechanical Engineering Technology', value: 'cmet' },
      { label: 'COED - Education', value: 'coed' },
      { label: 'COBA - Business Administration', value: 'coba' }
    ],
    student_shs: [
      { label: 'STEM', value: 'stem' },
      { label: 'ABM - Accountancy, Business & Management', value: 'abm' },
      { label: 'HUMSS - Humanities & Social Sciences', value: 'humss' },
      { label: 'GAS - General Academic Strand', value: 'gas' },
      { label: 'TVL - Technical-Vocational-Livelihood', value: 'tvl' }
    ],
    staff_non_teaching: [
      { label: 'Administration Office', value: 'admin_office' },
      { label: 'Registrar', value: 'registrar' },
      { label: 'Library', value: 'library' },
      { label: 'Cashier', value: 'cashier' },
      { label: 'Maintenance', value: 'maintenance' }
    ],
    faculty: [
      { label: 'CCIS Faculty', value: 'ccis' },
      { label: 'CMET Faculty', value: 'cmet' },
      { label: 'COED Faculty', value: 'coed' },
      { label: 'COBA Faculty', value: 'coba' },
      { label: 'SHS Faculty', value: 'shs' }
    ]
  };

  const yearLevelOptions = {
    student_college: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'],
    student_shs: ['Grade 11', 'Grade 12']
  };

  /**
   * Step 1: Validate School ID
   */
  const handleValidateSchoolId = async () => {
    if (!schoolId.trim()) {
      Alert.alert('Error', 'Please enter your School ID');
      return;
    }

    setIsValidating(true);
    
    try {
      const result = await SchoolAuthService.validateSchoolId(schoolId);
      
      if (!result.success) {
        Alert.alert('Error', result.error);
        return;
      }

      if (!result.isValid) {
        Alert.alert(
          'Invalid School ID',
          'This School ID is not registered in our system. Please contact the Registrar\'s Office.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (result.isRegistered) {
        Alert.alert(
          'Already Registered',
          'This School ID is already registered. Please use "Login" or "Forgot Password" to access your account.',
          [
            { text: 'Go to Login', onPress: () => navigation.navigate('Login') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      // School ID is valid and not registered
      setValidationResult(result);
      setFullName(result.fullName || '');
      setUserRole(result.userType || '');
      setDepartment(result.department || '');
      
      Alert.alert(
        'School ID Verified! ✅',
        `Welcome, ${result.fullName}!\n\nPlease continue with your registration.`,
        [{ text: 'Continue', onPress: () => setStep(2) }]
      );
      
    } catch (error) {
      Alert.alert('Error', 'Failed to validate School ID. Please try again.');
      DebugUtils.error('REGISTRATION', 'School ID validation error', error);
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Step 2: Complete Registration
   */
  const handleRegister = async () => {
    // Validation
    const newErrors = {};
    
    if (!email.trim() || !email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!fullName.trim()) {
      newErrors.fullName = 'Please enter your full name';
    }
    
    if (!department) {
      newErrors.department = 'Please select your department/course';
    }
    
    if ((userRole.includes('student')) && !yearLevel) {
      newErrors.yearLevel = 'Please select your year level';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert('Validation Error', 'Please fill in all required fields correctly.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await SchoolAuthService.registerWithSchoolId({
        email: email.trim(),
        password,
        schoolId: schoolId.trim(),
        fullName: fullName.trim(),
        userRole,
        department,
        yearLevel: userRole.includes('student') ? yearLevel : null,
        contactNumber: contactNumber.trim()
      });

      if (!result.success) {
        Alert.alert('Registration Failed', result.error);
        return;
      }

      Alert.alert(
        'Registration Successful! 🎉',
        'Your account has been created successfully. Please check your email for verification instructions.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );

    } catch (error) {
      Alert.alert('Error', 'Registration failed. Please try again.');
      DebugUtils.error('REGISTRATION', 'Registration error', error);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.primary,
      paddingTop: 50,
      paddingBottom: 30,
      paddingHorizontal: 20,
    },
    headerText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    subHeaderText: {
      fontSize: 14,
      color: '#FFFFFF',
      textAlign: 'center',
      marginTop: 8,
      opacity: 0.9,
    },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 20,
      paddingHorizontal: 20,
    },
    stepDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.colors.border,
      marginHorizontal: 5,
    },
    stepDotActive: {
      backgroundColor: theme.colors.primary,
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      elevation: 3,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 15,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },
    inputError: {
      borderColor: '#F44336',
    },
    errorText: {
      color: '#F44336',
      fontSize: 12,
      marginTop: -12,
      marginBottom: 12,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
    },
    eyeIcon: {
      position: 'absolute',
      right: 15,
      padding: 10,
    },
    pickerContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
      overflow: 'hidden',
    },
    picker: {
      color: theme.colors.text,
    },
    button: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 10,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    secondaryButtonText: {
      color: theme.colors.primary,
    },
    linkButton: {
      marginTop: 20,
      alignItems: 'center',
    },
    linkText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    infoBox: {
      backgroundColor: `${theme.colors.primary}15`,
      borderRadius: 12,
      padding: 15,
      marginBottom: 20,
    },
    infoText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    validationSuccess: {
      backgroundColor: '#4CAF5015',
      borderRadius: 12,
      padding: 15,
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
    },
    validationIcon: {
      marginRight: 10,
    },
    validationText: {
      flex: 1,
      color: '#4CAF50',
      fontSize: 14,
      fontWeight: '600',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>🏫 School Registration</Text>
        <Text style={styles.subHeaderText}>
          Create your GaFI account
        </Text>
      </View>

      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: School ID Validation */}
        {step === 1 && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                📋 Please enter your School ID (Student ID or Employee ID) to begin registration.
                {'\n\n'}
                If your ID is not recognized, please contact the Registrar's Office.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>School ID *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 2024-0001 or EMP-001"
                placeholderTextColor={theme.colors.textSecondary}
                value={schoolId}
                onChangeText={setSchoolId}
                autoCapitalize="characters"
                editable={!isValidating}
              />

              <TouchableOpacity
                style={[styles.button, isValidating && styles.buttonDisabled]}
                onPress={handleValidateSchoolId}
                disabled={isValidating}
              >
                {isValidating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Validate School ID</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Step 2: Complete Registration */}
        {step === 2 && validationResult && (
          <>
            <View style={styles.validationSuccess}>
              <Ionicons 
                name="checkmark-circle" 
                size={24} 
                color="#4CAF50" 
                style={styles.validationIcon}
              />
              <Text style={styles.validationText}>
                School ID Verified: {schoolId}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={theme.colors.textSecondary}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="your.email@example.com"
                placeholderTextColor={theme.colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

              <Text style={styles.label}>Department/Course *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={department}
                  onValueChange={setDepartment}
                  style={styles.picker}
                >
                  <Picker.Item label="Select department/course" value="" />
                  {departmentOptions[userRole]?.map((dept) => (
                    <Picker.Item 
                      key={dept.value} 
                      label={dept.label} 
                      value={dept.value} 
                    />
                  ))}
                </Picker>
              </View>
              {errors.department && <Text style={styles.errorText}>{errors.department}</Text>}

              {userRole.includes('student') && (
                <>
                  <Text style={styles.label}>Year Level *</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={yearLevel}
                      onValueChange={setYearLevel}
                      style={styles.picker}
                    >
                      <Picker.Item label="Select year level" value="" />
                      {yearLevelOptions[userRole]?.map((level) => (
                        <Picker.Item key={level} label={level} value={level} />
                      ))}
                    </Picker>
                  </View>
                  {errors.yearLevel && <Text style={styles.errorText}>{errors.yearLevel}</Text>}
                </>
              )}

              <Text style={styles.label}>Contact Number (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="09XX XXX XXXX"
                placeholderTextColor={theme.colors.textSecondary}
                value={contactNumber}
                onChangeText={setContactNumber}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                  placeholder="At least 8 characters"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={[styles.input, errors.confirmPassword && styles.inputError]}
                placeholder="Re-enter your password"
                placeholderTextColor={theme.colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Complete Registration</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => setStep(1)}
                disabled={isLoading}
              >
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  Back to School ID
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Login Link */}
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.linkText}>
            Already have an account? Login
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SchoolRegistrationScreen;