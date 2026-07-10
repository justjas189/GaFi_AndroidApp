// src/components/onboarding/UserTypeCards.js
// Student / Employee selection cards, shared by SignUpScreen (compact) and
// GetStartedScreen's Google-sign-up fallback picker (full). Lifted from the
// retired UserTypeScreen so the visual language stays identical.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../context/ThemeContext';
import { FONTS } from '../../theme/typography';

export const USER_TYPES = [
  {
    id: 'student',
    title: 'Student',
    subtitle: "I'm a student managing my allowance",
    icon: 'school-outline',
    color: '#4CAF50',
  },
  {
    id: 'employee',
    title: 'Employee',
    subtitle: "I'm an employee managing my salary",
    icon: 'briefcase-outline',
    color: '#2196F3',
  },
];

const UserTypeCards = ({ selectedType, onSelect, compact = false }) => {
  const { theme } = React.useContext(ThemeContext);

  if (compact) {
    // Side-by-side half-width cards for the dense sign-up form.
    return (
      <View style={styles.compactRow}>
        {USER_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.compactCard,
                { backgroundColor: theme.colors.card },
                { borderColor: isSelected ? type.color : theme.colors.border },
                isSelected && styles.cardSelected,
              ]}
              onPress={() => onSelect(type.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.compactIcon, { backgroundColor: type.color + '20' }]}>
                <Ionicons name={type.icon} size={28} color={type.color} />
              </View>
              <Text style={[styles.compactTitle, { color: theme.colors.text }]}>{type.title}</Text>
              <View
                style={[
                  styles.radioOuter,
                  styles.radioOuterCompact,
                  { borderColor: isSelected ? type.color : theme.colors.border },
                ]}
              >
                {isSelected && <View style={[styles.radioInner, styles.radioInnerCompact, { backgroundColor: type.color }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.optionsContainer}>
      {USER_TYPES.map((type) => {
        const isSelected = selectedType === type.id;
        return (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.optionCard,
              { backgroundColor: theme.colors.card },
              { borderColor: isSelected ? type.color : theme.colors.border },
              isSelected && styles.cardSelected,
            ]}
            onPress={() => onSelect(type.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: type.color + '20' }]}>
              <Ionicons name={type.icon} size={40} color={type.color} />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={[styles.optionTitle, { color: theme.colors.text }]}>{type.title}</Text>
              <Text style={[styles.optionSubtitle, { color: theme.colors.text }]}>{type.subtitle}</Text>
            </View>
            <View style={styles.radioContainer}>
              <View style={[styles.radioOuter, { borderColor: isSelected ? type.color : theme.colors.border }]}>
                {isSelected && <View style={[styles.radioInner, { backgroundColor: type.color }]} />}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  // ── full (onboarding) variant ──
  optionsContainer: {
    gap: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  cardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 20,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  radioContainer: {
    marginLeft: 12,
  },
  radioOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  // ── compact (sign-up form) variant ──
  compactRow: {
    flexDirection: 'row',
    gap: 12,
  },
  compactCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  compactIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  radioOuterCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  radioInnerCompact: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default UserTypeCards;
