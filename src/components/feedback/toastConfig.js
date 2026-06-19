// src/components/feedback/toastConfig.js
// Branded toast components for react-native-toast-message. Drops from the top,
// auto-dismisses. Reads useTheme() so error/success recolor in light + dark, and
// FONTS so type matches the rest of the app (Sora/Inter). Mounted once in App.js
// via <Toast config={toastConfig} /> — inside ThemeProvider so useTheme resolves.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FONTS } from '../../theme/typography';

const ICON = {
  gafiSuccess: 'checkmark-circle',
  gafiError: 'alert-circle',
  gafiInfo: 'sparkles',
};

const BaseToast = ({ type, text1, text2 }) => {
  const { theme } = useTheme();
  const accent =
    type === 'gafiError' ? theme.colors.error :
    type === 'gafiInfo' ? '#ffb68b' :
    theme.colors.success;

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Ionicons name={ICON[type]} size={22} color={accent} />
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>{text1}</Text>
        {text2 ? <Text style={styles.sub} numberOfLines={2}>{text2}</Text> : null}
      </View>
    </View>
  );
};

export const toastConfig = {
  gafiSuccess: (props) => <BaseToast {...props} type="gafiSuccess" />,
  gafiError: (props) => <BaseToast {...props} type="gafiError" />,
  gafiInfo: (props) => <BaseToast {...props} type="gafiInfo" />,
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '92%',
    backgroundColor: '#1c1c1c',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
  },
  sub: {
    color: '#B0B0B0',
    fontSize: 13,
    marginTop: 2,
    fontFamily: FONTS.bodyRegular,
  },
});
