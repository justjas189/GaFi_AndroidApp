import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { DataContext } from '../../context/DataContext';
import { ThemeContext } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { getSessionForMutation } from '../../services/AuthSessionHelper';
import { FONTS } from '../../theme/typography';
import { toast } from '../../utils/toast';
import { useConfirm } from '../../components/feedback/ConfirmProvider';

const { width } = Dimensions.get('window');

const STUDENT_PRESETS = [
  { label: '₱5,000', value: 5000 },
  { label: '₱10,000', value: 10000 },
  { label: '₱15,000', value: 15000 },
  { label: '₱20,000', value: 20000 },
  { label: '₱30,000', value: 30000 },
  { label: '₱50,000', value: 50000 },
];

const EMPLOYEE_PRESETS = [
  { label: '₱15,000', value: 15000 },
  { label: '₱20,000', value: 20000 },
  { label: '₱30,000', value: 30000 },
  { label: '₱50,000', value: 50000 },
  { label: '₱80,000', value: 80000 },
  { label: '₱100,000', value: 100000 },
];

// Weighted suggested split over the app's canonical categories, ordered by a
// Needs → Savings/Debt → Wants hierarchy (UX revision — replaces the old even
// split whose Math.round drift could over-allocate by ₱0.02).
//
// "Other" (savings/debt buffer) is deliberately NOT computed from its own
// percentage: every other category is floored to the centavo first, and Other
// receives the EXACT remainder of the monthly budget — so the allocations
// always sum to the budget to the centavo, by construction.
const SUGGESTED_SPLIT_WEIGHTS = [
  ['Groceries', 0.15],       // need
  ['Transport', 0.15],       // need
  ['Utilities', 0.10],       // need
  ['Health', 0.10],          // need
  ['Food & Dining', 0.10],   // want
  ['Shopping', 0.08],        // want
  ['Entertainment', 0.07],   // want
  ['Education', 0.03],       // want/need
  ['Electronics', 0.02],     // want
  ['School Supplies', 0.01], // want/need
];

// Display order puts Other in its hierarchy slot (after the four core needs).
const SUGGESTED_SPLIT_ORDER = [
  'Groceries', 'Transport', 'Utilities', 'Health', 'Other',
  'Food & Dining', 'Shopping', 'Entertainment', 'Education', 'Electronics', 'School Supplies',
];

const buildSuggestedCategories = (monthly) => {
  const amounts = {};
  let allocated = 0;
  SUGGESTED_SPLIT_WEIGHTS.forEach(([cat, weight]) => {
    const amount = Math.floor(monthly * weight * 100) / 100; // floor to the centavo
    amounts[cat] = amount;
    allocated = Math.round((allocated + amount) * 100) / 100;
  });
  amounts['Other'] = Math.round((monthly - allocated) * 100) / 100; // exact remainder

  const categories = {};
  SUGGESTED_SPLIT_ORDER.forEach((cat) => {
    categories[cat] = { limit: amounts[cat], spent: 0 };
  });
  return categories;
};

const BudgetGoalsScreen = ({ navigation }) => {
  const { updateBudget } = useContext(DataContext);
  const { theme } = useContext(ThemeContext);
  const { userInfo } = useAuth();
  const confirm = useConfirm();
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [error, setError] = useState('');
  // User-editable category allocations (cat → amount string). Prefilled with the
  // suggested split; the user budgets their own money before completing setup.
  const [allocations, setAllocations] = useState({});
  const [allocTouched, setAllocTouched] = useState(false);

  const isEmployee = userInfo?.userType === 'employee';
  const BUDGET_PRESETS = isEmployee ? EMPLOYEE_PRESETS : STUDENT_PRESETS;

  // Canonical category names are already display-ready; kept as a map for any
  // legacy lowercase keys that survive in cached allocation state.
  const CATEGORY_LABELS = {
    food: 'Food & Dining',
    transportation: 'Transport',
    bills: 'Utilities',
    others: 'Other',
  };

  const suggestedCategories = React.useMemo(() => {
    const monthly = parseFloat(monthlyBudget);
    if (isNaN(monthly) || monthly <= 0) return null;
    return buildSuggestedCategories(monthly);
  }, [monthlyBudget]);

  // Keep allocations in sync with the suggested split until the user edits one.
  React.useEffect(() => {
    if (!suggestedCategories || allocTouched) return;
    const prefill = {};
    Object.entries(suggestedCategories).forEach(([cat, v]) => {
      prefill[cat] = String(v.limit);
    });
    setAllocations(prefill);
  }, [suggestedCategories, allocTouched]);

  const totalAllocated = Object.values(allocations).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0
  );
  const monthlyNum = parseFloat(monthlyBudget) || 0;
  const overAllocated = totalAllocated > monthlyNum + 0.01;
  const unallocated = Math.max(0, Math.round((monthlyNum - totalAllocated) * 100) / 100);

  const handleAllocationChange = (cat, text) => {
    const clean = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAllocTouched(true);
    setAllocations((prev) => ({ ...prev, [cat]: clean }));
  };

  const handlePresetSelect = (value) => {
    setMonthlyBudget(value.toString());
    setError('');
  };

  const validateInput = () => {
    if (!monthlyBudget.trim()) {
      setError('Please enter your monthly budget');
      return false;
    }
    const monthly = parseFloat(monthlyBudget);
    if (isNaN(monthly) || monthly <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    if (monthly < 1000) {
      setError('Budget should be at least ₱1,000');
      return false;
    }
    return true;
  };

  const handleComplete = async () => {
    if (!validateInput()) return;

    try {
      // ── Wait for a verified Supabase session to prevent RLS errors ──
      const { session: budgetSession, userId } = await getSessionForMutation();
      if (!userId) {
        toast.error('Session not ready', 'Give it a moment, then tap Complete Setup again.');
        return;
      }
      const monthly = parseFloat(monthlyBudget);

      // Build categories from the user's own allocations (prefilled with the
      // suggested split, editable above). Fallback to the suggested split if
      // the allocation state is somehow empty.
      let categories;
      if (Object.keys(allocations).length > 0) {
        if (overAllocated) {
          setError(`Your allocations (₱${totalAllocated.toLocaleString()}) exceed your monthly budget. Adjust them first.`);
          return;
        }
        categories = {};
        Object.entries(allocations).forEach(([cat, v]) => {
          categories[cat] = { limit: Math.round((parseFloat(v) || 0) * 100) / 100, spent: 0 };
        });
      } else {
        categories = buildSuggestedCategories(monthly);
      }

      const budgetData = {
        monthly,
        userId,
        categories
      };

      await updateBudget(budgetData);

      // Mark onboarding complete in profile
      try {
        await supabase
          .from('profiles')
          .update({ onboarding_completed: true })
          .eq('id', userId);
      } catch (profileErr) {
        console.warn('Could not update onboarding flag in profile (non-critical):', profileErr);
      }

      await AsyncStorage.setItem('onboardingComplete', 'true');
      await AsyncStorage.setItem(`hasOnboarded_${userId}`, 'true');
      if (global.setHasOnboarded) global.setHasOnboarded(true);

      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (error) {
      console.error('Error in BudgetGoalsScreen:', error);
      // Two-button decision (retry vs. skip into the app) — keep it as a
      // themed confirm. Not destructive: skip just enters with defaults.
      const retry = await confirm({
        title: 'Could not save budget',
        message: "This doesn't affect your account. Retry now, or skip and set your budget up later.",
        confirmLabel: 'Retry',
        cancelLabel: 'Skip for now',
        icon: 'cloud-offline-outline',
      });
      if (retry) {
        handleComplete();
      } else {
        // Let the user into the app with defaults — they can set budget later.
        await AsyncStorage.setItem('onboardingComplete', 'true');
        if (global.setHasOnboarded) global.setHasOnboarded(true);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="wallet" size={48} color={theme.colors.primary} />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {userInfo?.firstName ? `${userInfo.firstName}, set your budget` : 'Set Your Budget'}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
              How much do you plan to spend monthly?
            </Text>
          </View>

          {/* Budget Input */}
          <View style={styles.inputSection}>
            <View style={[
              styles.inputContainer, 
              { backgroundColor: theme.colors.card, borderColor: error ? '#FF3B30' : theme.colors.border || '#3C3C3C' }
            ]}>
              <Text style={[styles.currency, { color: theme.colors.primary }]}>₱</Text>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="0"
                placeholderTextColor={theme.colors.text + '40'}
                value={monthlyBudget}
                onChangeText={(text) => {
                  setMonthlyBudget(text.replace(/[^0-9]/g, ''));
                  setError('');
                }}
                keyboardType="numeric"
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* Quick Select Presets */}
          <View style={styles.presetsSection}>
            <Text style={[styles.presetsLabel, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
              Quick select
            </Text>
            <View style={styles.presetsGrid}>
              {BUDGET_PRESETS.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.presetButton,
                    { backgroundColor: theme.colors.card },
                    monthlyBudget === preset.value.toString() && { 
                      backgroundColor: theme.colors.primary + '20',
                      borderColor: theme.colors.primary,
                      borderWidth: 2,
                    }
                  ]}
                  onPress={() => handlePresetSelect(preset.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.presetText, 
                    { color: monthlyBudget === preset.value.toString() ? theme.colors.primary : theme.colors.text }
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Allocation — the user budgets their own money */}
          {suggestedCategories && (
            <View style={styles.allocationSection}>
              <View style={styles.allocationHeader}>
                <Text style={[styles.presetsLabel, { color: theme.colors.textSecondary || theme.colors.text + '80', marginBottom: 0 }]}>
                  Budget your money
                </Text>
                <TouchableOpacity onPress={() => setAllocTouched(false)} activeOpacity={0.7}>
                  <Text style={[styles.allocationReset, { color: theme.colors.primary }]}>Use suggested split</Text>
                </TouchableOpacity>
              </View>
              {Object.keys(allocations).map((cat) => (
                <View
                  key={cat}
                  style={[styles.allocationRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border || '#3C3C3C' }]}
                >
                  <Text style={[styles.allocationLabel, { color: theme.colors.text }]}>
                    {CATEGORY_LABELS[cat] || cat}
                  </Text>
                  <Text style={[styles.allocationCurrency, { color: theme.colors.primary }]}>₱</Text>
                  <TextInput
                    style={[styles.allocationInput, { color: theme.colors.text }]}
                    value={allocations[cat]}
                    onChangeText={(text) => handleAllocationChange(cat, text)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.colors.text + '40'}
                  />
                </View>
              ))}
              <Text style={[styles.allocationSummary, { color: overAllocated ? '#FF3B30' : theme.colors.textSecondary || theme.colors.text + '80' }]}>
                {overAllocated
                  ? `Over budget by ₱${(totalAllocated - monthlyNum).toLocaleString('en-PH', { maximumFractionDigits: 2 })} — trim your allocations`
                  : unallocated > 0
                    ? `Allocated ₱${totalAllocated.toLocaleString('en-PH', { maximumFractionDigits: 2 })} of ₱${monthlyNum.toLocaleString('en-PH')} · ₱${unallocated.toLocaleString('en-PH', { maximumFractionDigits: 2 })} unallocated`
                    : `All ₱${monthlyNum.toLocaleString('en-PH')} allocated`}
              </Text>
            </View>
          )}

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: theme.colors.card }]}>
            <Ionicons name="information-circle" size={24} color="#00D4FF" />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary || theme.colors.text + '80' }]}>
              We prefilled a needs-first weighted split (essentials like groceries and transport get the biggest share, "Other" holds your savings/debt buffer) — adjust each category to budget your money your way.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={[styles.bottomContainer, { backgroundColor: theme.colors.background }]}>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
          onPress={handleComplete}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Complete Setup</Text>
          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const presetWidth = (width - 60) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 28,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 16,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 72,
  },
  currency: {
    fontFamily: FONTS.numberSemiBold,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.numberSemiBold,
    fontSize: 32,
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    fontFamily: FONTS.bodyRegular,
    color: '#FF3B30',
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },
  presetsSection: {
    marginBottom: 24,
  },
  presetsLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    marginBottom: 12,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  presetButton: {
    width: presetWidth,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  presetText: {
    fontFamily: FONTS.numberSemiBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  allocationSection: {
    marginBottom: 24,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allocationReset: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 8,
  },
  allocationLabel: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  allocationCurrency: {
    fontFamily: FONTS.numberSemiBold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
  allocationInput: {
    minWidth: 90,
    textAlign: 'right',
    fontFamily: FONTS.numberSemiBold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
  },
  allocationSummary: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    marginTop: 4,
    marginLeft: 4,
  },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
  },
  button: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontFamily: FONTS.bodySemiBold,
    color: '#FFFFFF',
    fontSize: 18,
  },
});

export default BudgetGoalsScreen;
