// src/screens/main/FAQScreen.js
// Dedicated full-screen FAQ list. Moved OUT of SettingsScreen so the long
// accordion no longer clogs the Settings layout. One open at a time, smooth
// expand/collapse via LayoutAnimation.

import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../context/ThemeContext';
import { FONTS } from '../../theme/typography';

// Enable LayoutAnimation on Android (no-op on the new architecture / iOS)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// FAQ content kept as data so copy edits never touch render logic.
const FAQ_ITEMS = [
  {
    id: 'add-expense',
    q: 'How do I add an expense?',
    a: 'Open the Expenses tab and tap the + button, or walk into a location in the Game tab (like the canteen) to log spending in-context. Pick a category, enter the amount, and save.',
  },
  {
    id: 'budget',
    q: 'How do I set or change my budget?',
    a: 'Go to Profile → Budget. Tap your monthly budget amount to set and update your limit. GaFi will automatically track your spending using the 50/30/20 rule (needs/wants/savings) based on your new total.',
  },
  {
    id: 'story-mode',
    q: 'What is Story Mode?',
    a: 'Story Mode is a guided, level-based journey that teaches budgeting through daily challenges. Each level runs several in-game days where you manage a weekly budget, cover needs vs wants, and allocate to savings goals.',
  },
  {
    id: 'custom-mode',
    q: 'What is Custom Mode?',
    a: 'Custom Mode lets you set your own rules and challenge targets instead of following the scripted Story levels — ideal once you know the basics and want to practice your real budget.',
  },
  {
    id: 'koin',
    q: 'Who is Koin?',
    a: 'Koin is your AI finance buddy (the floating mascot). Tap it anytime to ask about your spending, budgets, or any GaFI feature. Koin is context-aware — it knows which screen you are on.',
  },
  {
    id: 'xp',
    q: 'How do XP and ranks work?',
    a: 'You earn XP for healthy money habits — logging expenses, staying under budget, and completing goals. Accumulated XP raises your rank and your position on the Leaderboard.',
  },
  {
    id: 'notifications',
    q: 'How do I control notifications?',
    a: 'Go to Settings → Notifications. You can toggle Budget alerts, Level-up celebrations, the weekly Koin check-in, budget-reset reminders, the daily tracker, and Story/Custom mode reminders independently.',
  },
  {
    id: 'data',
    q: 'Is my data secure, and can I export it?',
    a: 'Your data is stored securely via Supabase with encrypted auth. You can export your full expense history any time from Settings → Data Management → Export Data (CSV or TXT).',
  },
];

const FAQScreen = ({ navigation }) => {
  const { theme } = useContext(ThemeContext);
  const [expandedFaq, setExpandedFaq] = useState(null); // id of the open FAQ item

  // Smoothly expand/collapse a FAQ item (accordion — one open at a time)
  const toggleFaq = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaq((prev) => (prev === id ? null : id));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with back arrow */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>FAQs</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[styles.intro, { color: theme.colors.textSecondary || theme.colors.text }]}>
          Quick answers about how GaFI works.
        </Text>

        {FAQ_ITEMS.map((item) => {
          const open = expandedFaq === item.id;
          return (
            <View key={item.id} style={[styles.faqItem, { backgroundColor: theme.colors.card }]}>
              <TouchableOpacity
                style={styles.faqQuestionRow}
                onPress={() => toggleFaq(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={20}
                  color={theme.colors.primary}
                  style={{ marginRight: 12 }}
                />
                <Text style={[styles.faqQuestion, { color: theme.colors.text }]}>{item.q}</Text>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.textSecondary || theme.colors.text}
                />
              </TouchableOpacity>

              {open && (
                <Text style={[styles.faqAnswer, { color: theme.colors.textSecondary || theme.colors.text }]}>
                  {item.a}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 24,
    letterSpacing: -0.3,
  },
  intro: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
    marginLeft: 4,
  },
  faqItem: {
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    marginRight: 8,
  },
  faqAnswer: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
    opacity: 0.85,
  },
});

export default FAQScreen;
