// components/auth/GoogleSignInButton.js
import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

// Hoisted static asset — official multi-color Google "G" mark.
const GOOGLE_G_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
</svg>
`;

/**
 * Sleek, accessible, theme-aware Google Sign-In button.
 *
 * Structurally a full-width outlined button with the "G" mark left of the
 * label. Colors are driven entirely by the active theme so the button sits in
 * the same visual family as the Email/Password inputs:
 *   - surface background + subtle border (NOT the primary orange)
 *   - borderRadius matches the inputs (theme.borderRadius.md)
 *   - label is white in dark mode, near-black in light mode
 *
 * NOTE: the theme colors are applied via a plain style array, not Pressable's
 * `style={({ pressed }) => [...]}` callback form — that callback form silently
 * dropped the background/border/justify styles under this project's Babel
 * transform. Press feedback is handled natively via `android_ripple`.
 *
 * @param {() => void} onPress
 * @param {boolean} loading  - shows a spinner and blocks taps
 * @param {boolean} disabled
 * @param {string}  label    - defaults to "Continue with Google"
 */
const GoogleSignInButton = ({ onPress, loading = false, disabled = false, label = 'Continue with Google' }) => {
  const { colors, borderRadius, isDarkMode } = useTheme();
  const isDisabled = disabled || loading;
  // Pure white on dark, near-black on light — same weight/size as input text.
  const textColor = isDarkMode ? '#FFFFFF' : '#111111';

  return (
    <Pressable
      // Remount on theme flip: Android's ripple drawable caches its backdrop and
      // won't re-resolve backgroundColor on a live theme switch without a fresh mount.
      key={isDarkMode ? 'dark' : 'light'}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      android_ripple={{ color: colors.border }}
      style={[
        styles.button,
        {
          // Match the inputs: surface fill + subtle border + same corner radius.
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: borderRadius.md,
          opacity: isDisabled ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          <SvgXml xml={GOOGLE_G_SVG} width={20} height={20} />
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  label: {
    marginLeft: 12,
    // Match the text typed inside the inputs: fontSize 16, default (normal) weight.
    fontSize: 16,
    fontWeight: '400',
  },
});

export default React.memo(GoogleSignInButton);
