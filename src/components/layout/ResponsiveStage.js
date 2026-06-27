import React from 'react';
import { View, StyleSheet } from 'react-native';

// Centered "phone frame" for screens that must not stretch on tablets.
// The outer View paints the dark theme colour so tablet side margins are a
// deliberate dark, never raw black; the inner View caps + centers the column.
export const MAX_CONTENT_WIDTH = 600;
// Style-scale ceiling for height-based padding/gaps on very tall tablets.
// Layout still fills via flex; this only bounds the *scale* basis.
export const MAX_CONTENT_HEIGHT = 1100;

export default function ResponsiveStage({ children, backgroundColor = '#1a1a2e', style }) {
  return (
    <View style={[styles.outer, { backgroundColor }]}>
      <View style={[styles.inner, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
