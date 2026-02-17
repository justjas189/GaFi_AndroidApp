// App.js - Main entry point for the GaFI App

import React, { useState, useEffect, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';

// Enhanced Components & Utilities
import ErrorBoundary from './src/components/ErrorBoundary';
import DebugUtils from './src/utils/DebugUtils';
import PerformanceManager from './src/utils/PerformanceManager';
import SecurityManager from './src/utils/SecurityManager';

// NVIDIA API Reset (Temporary fix)
import { resetCircuitBreaker } from './src/config/nvidia';

// Navigation
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import { navigationRef } from './src/navigation/navigationRef';

// Context Providers
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const Stack = createStackNavigator();

// Simple loading screen component
const LoadingScreen = ({ message }) => (
  <View style={{ 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#1C1C1C' 
  }}>
    <ActivityIndicator size="large" color="#FF6B00" />
    <Text style={{ 
      color: '#FFF', 
      marginTop: 20, 
      fontSize: 16 
    }}>
      {message || 'Loading...'}
    </Text>
  </View>
);

// Navigation container with theme from ThemeContext
const ThemedNavigationContainer = ({ children }) => {
  const { theme } = useTheme();
  // Ensure theme is valid for NavigationContainer
  const navigationTheme = theme && theme.colors ? theme : {
    dark: true,
    colors: {
      primary: '#FF6B00',
      background: '#1C1C1C',
      card: '#2C2C2C',
      text: '#FFFFFF',
      border: '#3C3C3C',
      notification: '#FF6B00',
    },
  };
  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      {children}
    </NavigationContainer>
  );
};

// Inner App component that has access to AuthContext
const AppNavigator = () => {
  const { isLoading, userToken, userInfo } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(null); // Use null to indicate uninitialized state
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (checkingOnboarding) {
        DebugUtils.warn('APP', 'Onboarding check timed out, proceeding with default');
        setHasOnboarded(true); // Default to onboarded to show main app
        setCheckingOnboarding(false);
      }
    }, 3000); // 3 second timeout

    if (!isLoading && userToken && userInfo) {
      setCheckingOnboarding(true);
      checkOnboardingStatus();
    } else if (!isLoading && !userToken) {
      setCheckingOnboarding(false);
      setHasOnboarded(null);
    } else if (!isLoading) {
      // Auth is loaded but no token - show auth screen
      setCheckingOnboarding(false);
      setHasOnboarded(null);
    }

    return () => clearTimeout(timeout);
  }, [isLoading, userToken, userInfo]);

  const checkOnboardingStatus = async () => {
    try {
      DebugUtils.debug('APP', 'Checking onboarding status', { userId: userInfo?.id });
      
      if (!userInfo?.id) {
        DebugUtils.warn('APP', 'No user ID found, defaulting to onboarded');
        setHasOnboarded(true);
        setCheckingOnboarding(false);
        return;
      }

      const hasOnboardedFlag = await AsyncStorage.getItem(`hasOnboarded_${userInfo.id}`);
      const isOnboarded = hasOnboardedFlag === 'true';
      
      setHasOnboarded(isOnboarded);
      DebugUtils.debug('APP', 'Onboarding status checked', { 
        userId: userInfo.id, 
        hasOnboarded: isOnboarded,
        rawFlag: hasOnboardedFlag
      });
    } catch (error) {
      DebugUtils.error('APP', 'Error checking onboarding status', error);
      // Default to onboarded to prevent infinite loading
      setHasOnboarded(true);
    } finally {
      setCheckingOnboarding(false);
    }
  };

  // Make setHasOnboarded available globally
  global.setHasOnboarded = setHasOnboarded;

  // Show loading only if auth is loading OR we're actively checking onboarding
  if (isLoading) {
    DebugUtils.debug('APP', 'Auth is loading');
    return <LoadingScreen message="Authenticating..." />;
  }

  if (checkingOnboarding) {
    DebugUtils.debug('APP', 'Checking onboarding status');
    return <LoadingScreen message="Loading your profile..." />;
  }

  // Determine which navigator to show
  DebugUtils.debug('APP', 'Rendering navigation', { 
    userToken: !!userToken, 
    hasOnboarded,
    userInfo: !!userInfo,
    isLoading,
    checkingOnboarding
  });

  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
    >
      {userToken && userInfo ? (
        hasOnboarded === false ? (
          <Stack.Screen 
            name="Onboarding" 
            component={OnboardingNavigator} 
            options={{ gestureEnabled: false }}
          />
        ) : (
          <Stack.Screen 
            name="Main" 
            component={MainNavigator} 
            options={{ gestureEnabled: false }}
          />
        )
      ) : (
        <Stack.Screen 
          name="Auth" 
          component={AuthNavigator} 
          options={{ gestureEnabled: false }}
        />
      )}
    </Stack.Navigator>
  );
};

// Root App component with authentication flow
export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      DebugUtils.log('APP', 'Initializing GaFI application');
      
      // Reset NVIDIA API circuit breaker (temporary fix)
      try {
        resetCircuitBreaker();
        DebugUtils.log('APP', 'NVIDIA API circuit breaker reset successfully');
      } catch (error) {
        DebugUtils.warn('APP', 'Failed to reset NVIDIA circuit breaker', error);
      }
      
      // Initialize performance monitoring
      await PerformanceManager.initialize();
      DebugUtils.debug('APP', 'Performance manager initialized');
      
      // Initialize security manager
      await SecurityManager.initialize();
      DebugUtils.debug('APP', 'Security manager initialized');

      DebugUtils.log('APP', 'Application initialization completed');
      setIsInitialized(true);
    } catch (error) {
      DebugUtils.error('APP', 'Failed to initialize application', error);
      // Still allow app to continue
      setIsInitialized(true);
    }
  };

  if (!isInitialized) {
    DebugUtils.debug('APP', 'App is still initializing');
    return <LoadingScreen message="Initializing GaFI..." />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <ThemedNavigationContainer>
              <AuthProvider>
                <DataProvider>
                    <StatusBar style="auto" />
                    <AppNavigator />
                </DataProvider>
              </AuthProvider>
            </ThemedNavigationContainer>
          </ThemeProvider>        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}