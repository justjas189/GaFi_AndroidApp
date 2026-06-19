// src/components/LoadingScreen.js
//
// Branded, theme-aware loading surface. Used for every full-screen "wait"
// state in the app: boot ("Initializing GaFI..."), auth ("Authenticating...")
// and profile/onboarding resolution ("Loading your profile...").
//
// IMPORTANT — this component renders in TWO scopes:
//   1. Inside ThemeProvider (AppNavigator) — fonts loaded, full theme available.
//   2. At the root App() boot gate — OUTSIDE ThemeProvider AND before fonts
//      finish loading.
// So we read theme via useContext(ThemeContext) directly (never useTheme(),
// which throws without a provider) and fall back to the OS color scheme. That
// way Light Mode is honored even on the very first frame. Custom font families
// degrade silently to the system font until useFonts resolves — no crash.

import React, { useEffect, useRef, useContext } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated, Appearance, AccessibilityInfo } from 'react-native';
import { Image } from 'expo-image';
import { ThemeContext } from '../context/ThemeContext';
import { FONTS } from '../theme/typography';

const LOGO = require('../../assets/GaFi_Logo_Mark.png');

// Mirrors the background/text/primary tokens in ThemeContext so the boot frame
// (no provider) matches the themed frames exactly. Brand orange is shared.
const fallbackColors = (scheme) =>
  scheme === 'dark'
    ? { background: '#1C1C1C', text: '#FFFFFF', textSecondary: '#B0B0B0', primary: '#FF6B00' }
    : { background: '#FFFFFF', text: '#1C1C1C', textSecondary: '#666666', primary: '#FF6B00' };

const LoadingScreen = ({ message }) => {
  // Defensive: resolve theme if a provider is above us, else read the OS scheme.
  const themeCtx = useContext(ThemeContext);
  const colors = themeCtx?.colors ?? fallbackColors(Appearance.getColorScheme());

  // Signature motion: the brand mark gently breathes while we wait, so the
  // screen reads as alive rather than frozen. The spinner stays the honest,
  // functional indicator. Opacity only (GPU-friendly) + reduced-motion safe.
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.7, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
    });

    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={{ opacity: pulse }}>
        <Image
          source={LOGO}
          style={styles.logo}
          contentFit="contain"
          accessibilityRole="image"
          accessibilityLabel="GaFi logo"
        />
      </Animated.View>

      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />

      <Text
        style={[styles.message, { color: colors.textSecondary }]}
        accessibilityLiveRegion="polite"
      >
        {message || 'Loading...'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 28,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontFamily: FONTS.bodyMedium, // Inter_500Medium — body/UI role per type system
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

export default LoadingScreen;
