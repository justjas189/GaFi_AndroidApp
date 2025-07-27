import React, { createContext, useState, useContext, useEffect } from 'react';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Appearance, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

// Theme modes
export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

const darkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#FF6B00',
    secondary: '#FFB366',
    accent: '#FF8C42',
    background: '#1C1C1C',
    surface: '#2C2C2C',
    card: '#2C2C2C',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    border: '#3C3C3C',
    notification: '#FF6B00',
    // Semantic colors
    success: '#4CD964',
    warning: '#FFCC00',
    error: '#FF3B30',
    info: '#5856D6',
    // Additional UI colors
    placeholder: '#808080',
    disabled: '#4C4C4C',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.5)',
    // Financial context colors
    income: '#4CD964',
    expense: '#FF3B30',
    savings: '#5856D6',
    budget: '#FFCC00',
    // Chart colors
    chart: {
      background: '#2C2C2C',
      grid: '#3C3C3C',
      text: '#FFFFFF',
      primary: '#FF6B00',
      secondary: '#4CD964',
      tertiary: '#5856D6',
      quaternary: '#FFCC00',
      gradient: ['#FF6B00', '#FFB366'],
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
  },
  shadows: {
    small: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#FF6B00',
    secondary: '#FF8C42',
    accent: '#FFB366',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    card: '#F5F5F5',
    text: '#1C1C1C',
    textSecondary: '#666666',
    border: '#E0E0E0',
    notification: '#FF6B00',
    // Semantic colors
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    info: '#007AFF',
    // Additional UI colors
    placeholder: '#999999',
    disabled: '#D1D1D6',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.3)',
    // Financial context colors
    income: '#34C759',
    expense: '#FF3B30',
    savings: '#007AFF',
    budget: '#FF9500',
    // Chart colors
    chart: {
      background: '#FFFFFF',
      grid: '#E0E0E0',
      text: '#1C1C1C',
      primary: '#FF6B00',
      secondary: '#34C759',
      tertiary: '#007AFF',
      quaternary: '#FF9500',
      gradient: ['#FF6B00', '#FF8C42'],
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
  },
  shadows: {
    small: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    large: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export const ThemeProvider = ({ children }) => {
  const [themeMode, setThemeMode] = useState(THEME_MODES.SYSTEM);
  const [systemColorScheme, setSystemColorScheme] = useState(Appearance.getColorScheme());
  const [isLoading, setIsLoading] = useState(true);
  
  // Determine if dark mode should be active
  const isDarkMode = themeMode === THEME_MODES.SYSTEM 
    ? systemColorScheme === 'dark' 
    : themeMode === THEME_MODES.DARK;
  
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

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  // Update status bar style based on theme
  useEffect(() => {
    StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content', true);
  }, [isDarkMode]);

  if (isLoading) {
    return null;
  }

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');
      if (savedTheme && Object.values(THEME_MODES).includes(savedTheme)) {
        setThemeMode(savedTheme);
      } else {
        // Default to system theme if no preference is saved
        setThemeMode(THEME_MODES.SYSTEM);
        await AsyncStorage.setItem('themeMode', THEME_MODES.SYSTEM);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      setThemeMode(THEME_MODES.SYSTEM);
    }
  };

  const setTheme = async (mode) => {
    try {
      if (!Object.values(THEME_MODES).includes(mode)) {
        throw new Error(`Invalid theme mode: ${mode}`);
      }
      
      setThemeMode(mode);
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = async () => {
    try {
      const newMode = isDarkMode ? THEME_MODES.LIGHT : THEME_MODES.DARK;
      await setTheme(newMode);
    } catch (error) {
      console.error('Error toggling theme:', error);
    }
  };

  // Utility functions for easier theming
  const getColor = (colorPath) => {
    return colorPath.split('.').reduce((obj, key) => obj?.[key], theme.colors);
  };

  const getSpacing = (size) => {
    return theme.spacing[size] || size;
  };

  const getBorderRadius = (size) => {
    return theme.borderRadius[size] || size;
  };

  const getShadow = (size) => {
    return theme.shadows[size] || {};
  };

  // Create themed styles helper
  const createThemedStyles = (styleFunction) => {
    return styleFunction(theme);
  };

  return (
    <ThemeContext.Provider value={{ 
      // Theme data
      theme, 
      colors: theme.colors,
      spacing: theme.spacing,
      borderRadius: theme.borderRadius,
      shadows: theme.shadows,
      
      // Theme state
      themeMode,
      isDarkMode,
      isLightMode: !isDarkMode,
      systemColorScheme,
      
      // Theme actions
      setTheme,
      toggleTheme,
      
      // Utility functions
      getColor,
      getSpacing,
      getBorderRadius,
      getShadow,
      createThemedStyles,
      
      // Theme constants
      THEME_MODES,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Custom hooks for specific theme features
export const useColors = () => {
  const { colors } = useTheme();
  return colors;
};

export const useSpacing = () => {
  const { spacing, getSpacing } = useTheme();
  return { spacing, getSpacing };
};

export const useShadows = () => {
  const { shadows, getShadow } = useTheme();
  return { shadows, getShadow };
};

export const useThemedStyles = (styleFunction) => {
  const { createThemedStyles } = useTheme();
  return createThemedStyles(styleFunction);
};
