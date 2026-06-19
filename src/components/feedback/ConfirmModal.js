// src/components/feedback/ConfirmModal.js
// Themed replacement for two-button Alert.alert confirms (delete, logout, reset).
// Presentational only — no business logic. Driven by ConfirmProvider/useConfirm.
// Matches the gamified aesthetic (dark surface, rounded card, orange CTA; red CTA
// when destructive). Reads useTheme() so it works in light + dark.
//
// NOTE: buttons use TouchableOpacity (codebase idiom, see EndOfDayReportModal) and
// the overlay/card use Pressable with PLAIN array styles only — the function form
// `style={({pressed}) => [...]}` silently drops styles in this babel setup.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FONTS } from '../../theme/typography';

const ConfirmModal = ({
  visible,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const confirmColor = destructive ? c.error : c.primary;
  const iconName = icon || (destructive ? 'warning' : 'help-circle');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel || (() => {})}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Absorb taps inside the card so they don't dismiss via the overlay */}
        <Pressable style={[styles.card, { backgroundColor: c.surface || c.card }]} onPress={() => {}}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: confirmColor + '22', borderColor: confirmColor + '55' },
            ]}
          >
            <Ionicons name={iconName} size={26} color={confirmColor} />
          </View>

          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: c.textSecondary || c.text + '99' }]}>
              {message}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={onCancel}
              activeOpacity={0.8}
              style={[styles.button, styles.cancelButton, { backgroundColor: c.border + '55', borderColor: c.border }]}
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
            >
              <Text style={[styles.cancelText, { color: c.text }]}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              activeOpacity={0.8}
              style={[styles.button, { backgroundColor: confirmColor }]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.headingBold,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontFamily: FONTS.bodyRegular,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: FONTS.bodySemiBold,
  },
});

export default ConfirmModal;
