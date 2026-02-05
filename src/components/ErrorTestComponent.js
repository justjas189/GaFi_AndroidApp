/**
 * Test component to verify ErrorBoundary functionality
 * This component can be used to deliberately trigger errors for testing
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import DebugUtils from '../utils/DebugUtils';

const ErrorTestComponent = () => {
  const { colors } = useTheme();
  const [shouldError, setShouldError] = useState(false);

  // This will trigger an error when shouldError is true
  if (shouldError) {
    throw new Error('Test error triggered for ErrorBoundary verification');
  }

  const triggerError = () => {
    DebugUtils.debug('ERROR_TEST', 'User triggered test error');
    setShouldError(true);
  };

  const testLogging = () => {
    DebugUtils.debug('ERROR_TEST', 'Testing debug logging');
    DebugUtils.log('ERROR_TEST', 'Testing info logging', { timestamp: new Date().toISOString() });
    DebugUtils.warn('ERROR_TEST', 'Testing warning logging');
    DebugUtils.error('ERROR_TEST', 'Testing error logging', new Error('Sample error'));
  };

  const showDebugInfo = () => {
    DebugUtils.showDebugInfo();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        ErrorBoundary Test Panel
      </Text>
      
      <Text style={[styles.description, { color: colors.text }]}>
        Use these buttons to test the ErrorBoundary and enhanced logging system:
      </Text>

      <TouchableOpacity 
        style={[styles.button, styles.errorButton]} 
        onPress={triggerError}
      >
        <Text style={styles.buttonText}>Trigger Error (Test ErrorBoundary)</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: colors.primary }]} 
        onPress={testLogging}
      >
        <Text style={styles.buttonText}>Test Enhanced Logging</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.infoButton]} 
        onPress={showDebugInfo}
      >
        <Text style={styles.buttonText}>Show Debug Info</Text>
      </TouchableOpacity>

      <Text style={[styles.note, { color: colors.textSecondary }]}>
        Note: Check your console for debug output when testing logging.
        The error button will demonstrate the ErrorBoundary in action.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    margin: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 5,
    alignItems: 'center',
  },
  errorButton: {
    backgroundColor: '#FF3B30',
  },
  infoButton: {
    backgroundColor: '#5856D6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});

export default ErrorTestComponent;
