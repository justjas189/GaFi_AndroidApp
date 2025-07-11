import React, { createContext, useState, useContext, useEffect } from 'react';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

const darkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#FF6B00',
    background: '#1C1C1C',
    card: '#2C2C2C',
    text: '#FFFFFF',
    border: '#3C3C3C',
    notification: '#FF6B00',
    // Additional semantic colors
    success: '#4CD964',
    warning: '#FFCC00',
    error: '#FF3B30',
    info: '#5856D6',
    secondaryText: '#808080',
    divider: '#2C2C2C',
    // Chart colors
    chart: {
      background: '#2C2C2C',
      grid: '#3C3C3C',
      text: '#FFFFFF',
    }
  },
};

const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#FF6B00',
    background: '#FFFFFF',
    card: '#F5F5F5',
    text: '#1C1C1C',
    border: '#E0E0E0',
    notification: '#FF6B00',
    // Additional semantic colors
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#007AFF',
    secondaryText: '#666666',
    divider: '#E0E0E0',
    // Chart colors
    chart: {
      background: '#FFFFFF',
      grid: '#E0E0E0',
      text: '#1C1C1C',
    }
  },
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await loadThemePreference();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return null;
  }

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        // Default to dark theme if no preference is saved
        setIsDarkMode(true);
        await AsyncStorage.setItem('theme', 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      isDarkMode, 
      toggleTheme,
      colors: theme.colors // Expose colors directly for convenience
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
