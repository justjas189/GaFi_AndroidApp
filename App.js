// App.js - Main entry point for the MoneyTrack App

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

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
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { ChatbotProvider } from './src/context/EnhancedChatbotContext';

const Stack = createStackNavigator();

// Root App component with authentication flow
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Auth');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      DebugUtils.log('APP', 'Initializing MoneyTrack application');
      
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
      
      // Check initial state
      await checkInitialState();
      
      DebugUtils.log('APP', 'Application initialization completed', {
        initialRoute,
        hasOnboarded
      });
    } catch (error) {
      DebugUtils.error('APP', 'Failed to initialize application', error);
      // Fallback to auth screen if initialization fails
      setInitialRoute('Auth');
      setIsLoading(false);
    }
  };

  const checkInitialState = async () => {
    try {
      DebugUtils.debug('APP', 'Checking initial authentication state');
      
      const [token, storedUserInfo] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userInfo')
      ]);

      if (!token || !storedUserInfo) {
        DebugUtils.debug('APP', 'No valid authentication found, routing to Auth');
        setInitialRoute('Auth');
        setIsLoading(false);
        return;
      }

      const userInfo = JSON.parse(storedUserInfo);
      
      // Ensure user has an ID
      if (!userInfo.id) {
        userInfo.id = 'user-' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('userInfo', JSON.stringify(userInfo));
        DebugUtils.debug('APP', 'Generated user ID for existing user', { userId: userInfo.id });
      }
      
      const hasOnboarded = await AsyncStorage.getItem(`hasOnboarded_${userInfo.id}`);
      
      // If hasOnboarded is true, ensure all onboarding flags are in sync
      if (hasOnboarded === 'true') {
        await AsyncStorage.setItem('onboardingComplete', 'true');
        setHasOnboarded(true);
        setInitialRoute('Main');
        DebugUtils.debug('APP', 'User has completed onboarding, routing to Main', { userId: userInfo.id });
      } else {
        // Handle new or incomplete onboarding users
        await AsyncStorage.setItem('onboardingComplete', 'false');
        setHasOnboarded(false);
        setInitialRoute('Onboarding');
        DebugUtils.debug('APP', 'User needs onboarding, routing to Onboarding', { userId: userInfo.id });
      }
      setIsLoading(false);
    } catch (error) {
      DebugUtils.error('APP', 'Error checking initial state', error);
      // If there's an error, default to Auth screen
      setInitialRoute('Auth');
      setIsLoading(false);
    }
  };

  // Make setHasOnboarded available globally
  global.setHasOnboarded = setHasOnboarded;

  if (isLoading) {
    DebugUtils.debug('APP', 'App is still loading, showing loading state');
    return null; // Or a loading screen
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer ref={navigationRef}>
            <ThemeProvider>
              <AuthProvider>
                <DataProvider>
                  <ChatbotProvider>
                    <StatusBar style="auto" />
                    <Stack.Navigator 
                      screenOptions={{ headerShown: false }}
                      initialRouteName={initialRoute}
                    >
                      <Stack.Screen 
                        name="Auth" 
                        component={AuthNavigator} 
                        options={{ gestureEnabled: false }}
                      />
                      <Stack.Screen 
                        name="Onboarding" 
                        component={OnboardingNavigator} 
                        options={{ gestureEnabled: false }}
                      />
                      <Stack.Screen 
                        name="Main" 
                        component={MainNavigator} 
                        options={{ gestureEnabled: false }}
                      />
                    </Stack.Navigator>
                  </ChatbotProvider>
                </DataProvider>
              </AuthProvider>
            </ThemeProvider>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

