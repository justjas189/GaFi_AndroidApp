// App.js - Main entry point for the MoneyTrack App

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

// Navigation
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import { navigationRef } from './src/navigation/navigationRef';

// Context Providers
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import { ThemeProvider } from './src/context/ThemeContext';

const Stack = createStackNavigator();

// Root App component with authentication flow
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [initialRoute, setInitialRoute] = useState('Auth');

  useEffect(() => {
    checkInitialState();
  }, []);

  const checkInitialState = async () => {
    try {
      const [token, storedUserInfo] = await Promise.all([
        AsyncStorage.getItem('userToken'),
        AsyncStorage.getItem('userInfo')
      ]);

      if (!token || !storedUserInfo) {
        setInitialRoute('Auth');
        setIsLoading(false);
        return;
      }

      const userInfo = JSON.parse(storedUserInfo);
      
      // Ensure user has an ID
      if (!userInfo.id) {
        userInfo.id = 'user-' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('userInfo', JSON.stringify(userInfo));
      }
      
      const hasOnboarded = await AsyncStorage.getItem(`hasOnboarded_${userInfo.id}`);
      
      // If hasOnboarded is true, ensure all onboarding flags are in sync
      if (hasOnboarded === 'true') {
        await AsyncStorage.setItem('onboardingComplete', 'true');
        setHasOnboarded(true);
        setInitialRoute('Main');
      } else {
        // Handle new or incomplete onboarding users
        await AsyncStorage.setItem('onboardingComplete', 'false');
        setHasOnboarded(false);
        setInitialRoute('Onboarding');
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error checking initial state:', error);
      // If there's an error, default to Auth screen
      setInitialRoute('Auth');
      setIsLoading(false);
    }
  };

  // Make setHasOnboarded available globally
  global.setHasOnboarded = setHasOnboarded;

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <ThemeProvider>
            <AuthProvider>
              <DataProvider>
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
              </DataProvider>
            </AuthProvider>
          </ThemeProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

