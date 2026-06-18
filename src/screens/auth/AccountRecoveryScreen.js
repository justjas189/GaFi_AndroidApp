import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { FONTS } from '../../theme/typography';

const AccountRecoveryScreen = ({ navigation }) => {
  const { colors, spacing, borderRadius, shadows, createThemedStyles } = useTheme();

  const styles = createThemedStyles((theme) => StyleSheet.create({
    container: {
      flex: 1,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontFamily: FONTS.headingBold,
      fontSize: 28,
      letterSpacing: -0.4,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: FONTS.bodyRegular,
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xl,
      textAlign: 'center',
    },
    stepContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      ...theme.shadows.small,
    },
    stepNumber: {
      fontFamily: FONTS.numberBold,
      fontSize: 18,
      fontVariant: ['tabular-nums'],
      color: theme.colors.primary,
      marginRight: theme.spacing.md,
      width: 30,
      textAlign: 'center',
    },
    stepText: {
      fontFamily: FONTS.bodyRegular,
      fontSize: 16,
      color: theme.colors.text,
      flex: 1,
    },
    button: {
      backgroundColor: theme.colors.primary,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      marginTop: theme.spacing.xl,
      ...theme.shadows.small,
    },
    buttonText: {
      fontFamily: FONTS.bodySemiBold,
      color: '#FFF',
      fontSize: 16,
    },
    backButton: {
      alignItems: 'center',
      marginTop: theme.spacing.lg,
    },
    backButtonText: {
      fontFamily: FONTS.bodyMedium,
      color: theme.colors.primary,
      fontSize: 16,
    },
  }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Account Recovery</Text>
        <Text style={styles.subtitle}>Follow these steps to recover your account:</Text>

        <View style={styles.stepContainer}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>Verify your email address</Text>
        </View>

        <View style={styles.stepContainer}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>Answer security questions</Text>
        </View>

        <View style={styles.stepContainer}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>Reset your password</Text>
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.buttonText}>Start Recovery Process</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Back to Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountRecoveryScreen;
