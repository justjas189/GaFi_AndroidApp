import React, { useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Platform,
  RefreshControl,
  Animated,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { supabase } from '../../config/supabase';
import gameDatabaseService from '../../services/GameDatabaseService';

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QUICK_AMOUNTS = [20, 50, 100, 150];

const EXPENSE_CATEGORIES = [
  { id: 'Food & Dining', name: 'Food & Dining', icon: '🍔', color: '#FF9800' },
  { id: 'Transport', name: 'Transport', icon: '🚌', color: '#2196F3' },
  { id: 'Shopping', name: 'Shopping', icon: '🛒', color: '#E91E63' },
  { id: 'Groceries', name: 'Groceries', icon: '🥬', color: '#8BC34A' },
  { id: 'Entertainment', name: 'Entertainment', icon: '🎮', color: '#9C27B0' },
  { id: 'Electronics', name: 'Electronics', icon: '📱', color: '#00BCD4' },
  { id: 'School Supplies', name: 'School Supplies', icon: '📚', color: '#3F51B5' },
  { id: 'Utilities', name: 'Utilities', icon: '💡', color: '#607D8B' },
  { id: 'Health', name: 'Health', icon: '💊', color: '#4CAF50' },
  { id: 'Education', name: 'Education', icon: '🎓', color: '#673AB7' },
  { id: 'Other', name: 'Other', icon: '📦', color: '#795548' },
];

const CATEGORY_BUDGET_MAP = {
  'Food & Dining': 'needs',
  Transport: 'needs',
  Groceries: 'needs',
  'School Supplies': 'needs',
  Utilities: 'needs',
  Health: 'needs',
  Education: 'needs',
  Shopping: 'wants',
  Electronics: 'wants',
  Entertainment: 'wants',
  Other: 'wants',
};

const CATEGORY_META = {
  'Food & Dining': { icon: 'fast-food', color: '#FF9800' },
  Transport: { icon: 'bus', color: '#2196F3' },
  Shopping: { icon: 'cart', color: '#E91E63' },
  Groceries: { icon: 'leaf', color: '#8BC34A' },
  Entertainment: { icon: 'game-controller', color: '#9C27B0' },
  Electronics: { icon: 'phone-portrait', color: '#00BCD4' },
  'School Supplies': { icon: 'book', color: '#3F51B5' },
  Utilities: { icon: 'flash', color: '#607D8B' },
  Health: { icon: 'medkit', color: '#4CAF50' },
  Education: { icon: 'school', color: '#673AB7' },
  Other: { icon: 'ellipsis-horizontal', color: '#795548' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (value) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₱0.00';
  return '₱' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const getCurrentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomModeDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { user, userInfo } = useContext(AuthContext);
  const { budget, expenses, addExpense } = useContext(DataContext);
  const isEmployee = userInfo?.userType === 'employee';

  const [refreshing, setRefreshing] = useState(false);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);

  // ── Budget Rules (editable 50/30/20) ────────────────────────────────
  const [budgetRules, setBudgetRules] = useState({ needs: 50, wants: 30, savings: 20 });
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [editRules, setEditRules] = useState({ needs: 50, wants: 30, savings: 20 });

  // ── Expense modal state (Notebook-style) ────────────────────────────
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food & Dining');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Add Goal modal state ────────────────────────────────────────────
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  // ── Edit Goal modal state ───────────────────────────────────────────
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [editGoalData, setEditGoalData] = useState(null);

  // ── Allocate funds modal state ──────────────────────────────────────
  const [showAllocate, setShowAllocate] = useState(false);
  const [allocateGoal, setAllocateGoal] = useState(null);
  const [allocateAmount, setAllocateAmount] = useState('');

  // ── FAB animation ───────────────────────────────────────────────────
  const fabScale = useRef(new Animated.Value(1)).current;

  // ── Derived financial data ──────────────────────────────────────────

  const { categoryBreakdown, totalSpent } = useMemo(() => {
    const { start, end } = getCurrentMonthRange();
    const filtered = (expenses || []).filter((e) => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });
    const breakdown = {};
    let spent = 0;
    filtered.forEach((e) => {
      const amt = parseFloat(e.amount) || 0;
      spent += amt;
      const cat = e.category || 'Other';
      breakdown[cat] = (breakdown[cat] || 0) + amt;
    });
    return { categoryBreakdown: breakdown, totalSpent: spent };
  }, [expenses]);

  const monthlyBudget = budget?.monthly || 0;
  const remaining = monthlyBudget - totalSpent;
  const totalSaved = savingsGoals.reduce((sum, g) => sum + (parseFloat(g.current_amount) || 0), 0);

  // 50/30/20 actual spending breakdown
  const budgetBreakdown = useMemo(() => {
    let needsSpent = 0;
    let wantsSpent = 0;
    Object.entries(categoryBreakdown).forEach(([cat, amt]) => {
      if (CATEGORY_BUDGET_MAP[cat] === 'needs') needsSpent += amt;
      else wantsSpent += amt;
    });
    const savingsActual = Math.max(0, monthlyBudget - totalSpent);
    return {
      needs: { budget: monthlyBudget * (budgetRules.needs / 100), spent: needsSpent },
      wants: { budget: monthlyBudget * (budgetRules.wants / 100), spent: wantsSpent },
      savings: { budget: monthlyBudget * (budgetRules.savings / 100), actual: savingsActual },
    };
  }, [categoryBreakdown, monthlyBudget, totalSpent, budgetRules]);

  // ── Data fetching ───────────────────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavingsGoals(data || []);
    } catch (err) {
      console.warn('Failed to fetch savings goals:', err.message);
    }
  }, [user?.id]);

  const fetchPastSessions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('custom_mode_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['completed', 'failed'])
        .order('completed_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPastSessions(data || []);
    } catch (err) {
      console.warn('Failed to fetch past sessions:', err.message);
    }
  }, [user?.id]);

  const fetchBudgetRules = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('custom_mode_sessions')
        .select('custom_rules')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.custom_rules && typeof data.custom_rules === 'object') {
        const r = data.custom_rules;
        if (r.needs != null && r.wants != null && r.savings != null) {
          setBudgetRules({ needs: r.needs, wants: r.wants, savings: r.savings });
        }
      }
    } catch (_) { /* fallback to default */ }
  }, [user?.id]);

  useEffect(() => {
    fetchGoals();
    fetchPastSessions();
    fetchBudgetRules();
  }, [fetchGoals, fetchPastSessions, fetchBudgetRules]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchGoals(), fetchPastSessions(), fetchBudgetRules()]);
    setRefreshing(false);
  }, [fetchGoals, fetchPastSessions, fetchBudgetRules]);

  // ── Expense submit (Notebook-style) ─────────────────────────────────

  const handleSubmitExpense = async () => {
    const amount = parseFloat(expenseAmount);
    if (!expenseAmount || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to save expenses.');
      return;
    }
    setIsSubmitting(true);
    const savedAmount = amount;
    const savedNote = expenseNote;
    const savedCategory = expenseCategory;

    setShowExpenseModal(false);
    setExpenseAmount('');
    setExpenseNote('');
    setExpenseCategory('Food & Dining');

    try {
      const expenseData = {
        amount: savedAmount,
        category: savedCategory,
        note: savedNote || `${savedCategory} expense`,
        date: new Date().toISOString(),
      };
      const success = await addExpense(expenseData);
      if (!success) {
        Alert.alert('Sync Error', 'Your expense may not have been saved.');
      } else {
        Alert.alert('✅ Expense Recorded!', `₱${savedAmount.toFixed(2)} added to ${savedCategory}`, [{ text: 'OK' }]);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to save expense: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Budget Rules CRUD ───────────────────────────────────────────────

  const adjustEditRule = (key, delta) => {
    setEditRules((prev) => {
      const newVal = Math.max(0, Math.min(100, prev[key] + delta));
      return { ...prev, [key]: newVal };
    });
  };

  const editRulesTotal = editRules.needs + editRules.wants + editRules.savings;

  const handleSaveBudgetRules = async () => {
    if (editRulesTotal !== 100) {
      Alert.alert('Invalid', 'Needs + Wants + Savings must equal 100%.');
      return;
    }
    setBudgetRules({ ...editRules });
    setShowBudgetEditor(false);
    // Persist as a "settings" custom session so it can be loaded next time
    try {
      await gameDatabaseService.createCustomSession({
        modeType: 'budgeting',
        customRules: editRules,
        weeklyBudget: monthlyBudget / 4,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } catch (_) { /* non-critical */ }
  };

  // ── Goal CRUD ───────────────────────────────────────────────────────

  const handleAddGoal = async () => {
    const target = parseFloat(newGoalTarget);
    if (!newGoalTitle.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid goal name and target amount.');
      return;
    }
    setGoalSubmitting(true);
    try {
      const payload = {
        user_id: user.id,
        title: newGoalTitle.trim(),
        target_amount: target,
        current_amount: 0,
        deadline: newGoalDeadline.trim() || null,
      };
      const { error } = await supabase.from('savings_goals').insert(payload);
      if (error) throw error;
      setNewGoalTitle('');
      setNewGoalTarget('');
      setNewGoalDeadline('');
      setShowAddGoal(false);
      await fetchGoals();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setGoalSubmitting(false);
    }
  };

  const handleEditGoal = async () => {
    if (!editGoalData) return;
    const target = parseFloat(editGoalData.target_amount);
    if (!editGoalData.title?.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid goal name and target amount.');
      return;
    }
    try {
      const { error } = await supabase
        .from('savings_goals')
        .update({
          title: editGoalData.title.trim(),
          target_amount: target,
          deadline: editGoalData.deadline || null,
        })
        .eq('id', editGoalData.id);
      if (error) throw error;
      setShowEditGoal(false);
      setEditGoalData(null);
      await fetchGoals();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDeleteGoal = (goal) => {
    Alert.alert('Delete Goal', `Are you sure you want to delete "${goal.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('savings_goals').delete().eq('id', goal.id);
            if (error) throw error;
            await fetchGoals();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const handleAllocate = async () => {
    const amt = parseFloat(allocateAmount);
    if (!allocateGoal || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Enter a positive number.');
      return;
    }
    try {
      const newAmount = (parseFloat(allocateGoal.current_amount) || 0) + amt;
      const isAchieved = newAmount >= parseFloat(allocateGoal.target_amount);
      const { error } = await supabase
        .from('savings_goals')
        .update({
          current_amount: newAmount,
          is_achieved: isAchieved,
          ...(isAchieved ? { achieved_at: new Date().toISOString() } : {}),
        })
        .eq('id', allocateGoal.id);
      if (error) throw error;
      setAllocateAmount('');
      setShowAllocate(false);
      setAllocateGoal(null);
      await fetchGoals();
      if (isAchieved) {
        Alert.alert('🎉 Goal Achieved!', `You've reached your target for "${allocateGoal.title}"!`);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // ── FAB press animation ─────────────────────────────────────────────
  const onFabPress = () => {
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(fabScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => setShowExpenseModal(true));
  };

  // ── Dynamic styles ──────────────────────────────────────────────────

  const colors = theme.colors;
  const s = useMemo(() => createStyles(colors), [colors]);

  // ── Render helpers ──────────────────────────────────────────────────

  const renderBudgetBar = (label, color, budgetAmt, spentOrActual, isSpending = true) => {
    const pct = budgetAmt > 0 ? Math.min((spentOrActual / budgetAmt) * 100, 100) : 0;
    const overBudget = isSpending && spentOrActual > budgetAmt;
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text>
          <Text style={{ fontSize: 12, color: overBudget ? colors.error : colors.textSecondary }}>
            {formatCurrency(spentOrActual)} / {formatCurrency(budgetAmt)}
          </Text>
        </View>
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: overBudget ? colors.error : color }]} />
        </View>
      </View>
    );
  };

  const renderCategoryRow = ({ item }) => {
    const [cat, amt] = item;
    const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
    const budgetType = CATEGORY_BUDGET_MAP[cat] || 'wants';
    const typeLabel = budgetType === 'needs' ? 'Needs' : 'Wants';
    return (
      <View style={s.categoryRow}>
        <View style={[s.categoryIcon, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={s.categoryHeader}>
            <Text style={s.categoryName} numberOfLines={1}>{cat}</Text>
            <Text style={s.categoryAmount}>{formatCurrency(amt)}</Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{typeLabel}</Text>
        </View>
      </View>
    );
  };

  const renderGoalCard = ({ item }) => {
    const current = parseFloat(item.current_amount) || 0;
    const target = parseFloat(item.target_amount) || 1;
    const pct = Math.min((current / target) * 100, 100);
    const isComplete = item.is_achieved;
    const days = daysUntil(item.deadline);

    return (
      <View style={[s.goalCard, isComplete && { borderColor: colors.success, borderWidth: 1.5 }]}>
        <View style={s.goalHeader}>
          <Text style={s.goalTitle} numberOfLines={1}>{item.title}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {isComplete && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => { setEditGoalData({ ...item }); setShowEditGoal(true); }}
            >
              <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => handleDeleteGoal(item)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={s.goalSubtext}>
          {formatCurrency(current)} / {formatCurrency(target)}
        </Text>
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${pct}%`, backgroundColor: isComplete ? colors.success : colors.primary }]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={s.goalPctText}>{pct.toFixed(0)}% reached</Text>
          {item.deadline && (
            <Text style={[s.goalPctText, days !== null && days <= 7 && { color: colors.warning }]}>
              {days !== null ? (days === 0 ? 'Due today' : `${days}d left`) : ''}  •  {formatDate(item.deadline)}
            </Text>
          )}
        </View>
        {!isComplete && (
          <TouchableOpacity
            style={s.allocateBtn}
            onPress={() => { setAllocateGoal(item); setShowAllocate(true); }}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', marginLeft: 4 }}>Allocate Funds</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSessionCard = (session) => {
    const isPassed = session.passed;
    const modeLabels = { budgeting: '📊 Budgeting', goals: '🎯 Goal Setting', saving: '💰 Savings' };
    const rules = session.custom_rules;
    return (
      <View key={session.id} style={s.sessionCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
            {modeLabels[session.mode_type] || session.mode_type}
          </Text>
          <View style={[s.statusBadge, { backgroundColor: isPassed ? colors.success + '20' : colors.error + '20' }]}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: isPassed ? colors.success : colors.error }}>
              {isPassed ? 'Passed' : 'Failed'}
            </Text>
          </View>
        </View>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
          {formatDate(session.start_date)} — {formatDate(session.end_date || session.completed_at)}
        </Text>
        {rules && session.mode_type === 'budgeting' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={[s.miniTag, { backgroundColor: '#4CAF50' + '20' }]}>
              <Text style={{ fontSize: 10, color: '#4CAF50', fontWeight: '700' }}>Needs {rules.needs}%</Text>
            </View>
            <View style={[s.miniTag, { backgroundColor: '#FF9800' + '20' }]}>
              <Text style={{ fontSize: 10, color: '#FF9800', fontWeight: '700' }}>Wants {rules.wants}%</Text>
            </View>
            <View style={[s.miniTag, { backgroundColor: '#2196F3' + '20' }]}>
              <Text style={{ fontSize: 10, color: '#2196F3', fontWeight: '700' }}>Savings {rules.savings}%</Text>
            </View>
          </View>
        )}
        {session.mode_type === 'goals' && session.custom_goals && (
          <View style={{ marginTop: 8, gap: 2 }}>
            {session.custom_goals.map((g, i) => (
              <Text key={i} style={{ fontSize: 11, color: colors.textSecondary }}>
                • {g.name}: {formatCurrency(g.target)}
              </Text>
            ))}
          </View>
        )}
        {session.mode_type === 'saving' && session.custom_savings_target != null && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
            Savings Target: {session.custom_savings_target}% — Spent: {formatCurrency(session.weekly_spending || 0)} / {formatCurrency(session.weekly_budget || 0)}
          </Text>
        )}
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Financial Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* ── Top Summary Card ─────────────────────────────────────── */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Current Balance</Text>
          <Text style={[s.summaryValue, { color: remaining >= 0 ? colors.success : colors.error }]}>
            {formatCurrency(remaining)}
          </Text>

          <View style={s.summaryDivider} />

          <View style={s.summaryRow}>
            <View style={s.summaryCol}>
              <Text style={s.summarySmallLabel}>{isEmployee ? 'Income' : 'Allowance'}</Text>
              <Text style={[s.summarySmallValue, { color: colors.income }]}>{formatCurrency(monthlyBudget)}</Text>
            </View>
            <View style={s.summaryColDivider} />
            <View style={s.summaryCol}>
              <Text style={s.summarySmallLabel}>Expenses</Text>
              <Text style={[s.summarySmallValue, { color: colors.expense }]}>{formatCurrency(totalSpent)}</Text>
            </View>
            <View style={s.summaryColDivider} />
            <View style={s.summaryCol}>
              <Text style={s.summarySmallLabel}>Saved</Text>
              <Text style={[s.summarySmallValue, { color: colors.savings }]}>{formatCurrency(totalSaved)}</Text>
            </View>
          </View>
        </View>

        {/* ── 50/30/20 Budgeting Section ──────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="pie-chart" size={20} color={colors.primary} />
            <Text style={s.sectionTitle}>Budget Split</Text>
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => { setEditRules({ ...budgetRules }); setShowBudgetEditor(true); }}
            >
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Visual split bar */}
          <View style={s.splitBarContainer}>
            <View style={[s.splitBarSegment, { flex: budgetRules.needs, backgroundColor: '#4CAF50', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
            <View style={[s.splitBarSegment, { flex: budgetRules.wants, backgroundColor: '#FF9800' }]} />
            <View style={[s.splitBarSegment, { flex: budgetRules.savings, backgroundColor: '#2196F3', borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 16 }}>
            <Text style={{ fontSize: 11, color: '#4CAF50', fontWeight: '600' }}>Needs {budgetRules.needs}%</Text>
            <Text style={{ fontSize: 11, color: '#FF9800', fontWeight: '600' }}>Wants {budgetRules.wants}%</Text>
            <Text style={{ fontSize: 11, color: '#2196F3', fontWeight: '600' }}>Savings {budgetRules.savings}%</Text>
          </View>

          {renderBudgetBar('Needs', '#4CAF50', budgetBreakdown.needs.budget, budgetBreakdown.needs.spent)}
          {renderBudgetBar('Wants', '#FF9800', budgetBreakdown.wants.budget, budgetBreakdown.wants.spent)}
          {renderBudgetBar('Savings', '#2196F3', budgetBreakdown.savings.budget, budgetBreakdown.savings.actual, false)}
        </View>

        {/* ── Monthly Expenses ─────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="receipt" size={20} color={colors.primary} />
            <Text style={s.sectionTitle}>Monthly Expenses</Text>
          </View>

          {Object.keys(categoryBreakdown).length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
              <Text style={s.emptyText}>No expenses recorded this month</Text>
            </View>
          ) : (
            <FlatList
              data={Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1])}
              keyExtractor={([cat]) => cat}
              renderItem={renderCategoryRow}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* ── Savings Goals Section ────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="flag" size={20} color={colors.primary} />
            <Text style={s.sectionTitle}>Savings Goals</Text>
            <TouchableOpacity style={s.addButton} onPress={() => setShowAddGoal(true)}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {savingsGoals.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="flag-outline" size={40} color={colors.textSecondary} />
              <Text style={s.emptyText}>No goals yet — tap + to create one</Text>
            </View>
          ) : (
            <FlatList
              data={savingsGoals}
              keyExtractor={(g) => g.id}
              renderItem={renderGoalCard}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          )}
        </View>

        {/* ── Past Sessions History ────────────────────────────────── */}
        {pastSessions.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="time" size={20} color={colors.primary} />
              <Text style={s.sectionTitle}>Past Sessions</Text>
            </View>
            {pastSessions.map(renderSessionCard)}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── FAB (Floating Action Button) ───────────────────────────── */}
      <Animated.View style={[s.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity style={s.fabTouchable} onPress={onFabPress} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Expense Modal (Notebook-style) ─────────────────────────── */}
      <Modal visible={showExpenseModal} transparent animationType="slide" onRequestClose={() => setShowExpenseModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Ionicons name="book" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={s.modalTitle}>Log Expense</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: -14 }}>Quick Add Any Expense</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
                {/* Category Selection */}
                <Text style={s.inputLabel}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const selected = expenseCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
                          backgroundColor: selected ? cat.color : colors.surface,
                          borderWidth: 1.5, borderColor: selected ? cat.color : colors.border,
                        }}
                        onPress={() => setExpenseCategory(cat.id)}
                      >
                        <Text style={{ fontSize: 14, marginRight: 4 }}>{cat.icon}</Text>
                        <Text style={{ fontSize: 12, fontWeight: selected ? 'bold' : 'normal', color: selected ? '#FFF' : colors.text }}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Quick Amounts */}
                <Text style={s.inputLabel}>Quick amounts</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {QUICK_AMOUNTS.map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                        backgroundColor: expenseAmount === String(amt) ? colors.primary : colors.surface,
                        borderWidth: 1, borderColor: expenseAmount === String(amt) ? colors.primary : colors.border,
                      }}
                      onPress={() => setExpenseAmount(String(amt))}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: expenseAmount === String(amt) ? '#FFF' : colors.text }}>
                        ₱{amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amount Input */}
                <Text style={s.inputLabel}>Amount (₱)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter custom amount"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                />

                {/* Description */}
                <Text style={[s.inputLabel, { marginTop: 10 }]}>Description (optional)</Text>
                <TextInput
                  style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="e.g., Lunch, Bus fare..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  value={expenseNote}
                  onChangeText={setExpenseNote}
                />

                {/* Budget Status Info */}
                {monthlyBudget > 0 && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 2 }}>📊 Budget Status</Text>
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      Remaining: <Text style={{ fontWeight: 'bold', color: remaining >= 0 ? colors.success : colors.error }}>{formatCurrency(remaining)}</Text>
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {CATEGORY_BUDGET_MAP[expenseCategory] === 'needs' ? `Counts as Needs (${budgetRules.needs}%)` : `Counts as Wants (${budgetRules.wants}%)`}
                    </Text>
                  </View>
                )}
              </ScrollView>

              <View style={[s.modalActions, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={s.modalCancelBtn}
                  onPress={() => { setShowExpenseModal(false); setExpenseAmount(''); setExpenseNote(''); setExpenseCategory('Food & Dining'); }}
                >
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalConfirmBtn, { backgroundColor: EXPENSE_CATEGORIES.find(c => c.id === expenseCategory)?.color || colors.primary }, isSubmitting && { opacity: 0.5 }]}
                  onPress={handleSubmitExpense}
                  disabled={isSubmitting}
                >
                  <Ionicons name="checkmark" size={18} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={s.modalConfirmText}>{isSubmitting ? 'Saving…' : 'Log Expense'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Budget Rules Editor Modal ──────────────────────────────── */}
      <Modal visible={showBudgetEditor} transparent animationType="slide" onRequestClose={() => setShowBudgetEditor(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Edit Budget Split</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>
              Adjust how your monthly budget is distributed. Must total 100%.
            </Text>

            {[
              { key: 'needs', label: 'Needs', color: '#4CAF50' },
              { key: 'wants', label: 'Wants', color: '#FF9800' },
              { key: 'savings', label: 'Savings', color: '#2196F3' },
            ].map(({ key, label, color }) => (
              <View key={key} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color }}>{label}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color }}>{editRules[key]}%</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                  <TouchableOpacity
                    style={s.adjButton}
                    onPress={() => adjustEditRule(key, -5)}
                  >
                    <Ionicons name="remove" size={20} color={colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={[s.ruleInput, { color }]}
                    keyboardType="numeric"
                    value={String(editRules[key])}
                    onChangeText={(t) => {
                      const v = parseInt(t, 10);
                      if (!isNaN(v) && v >= 0 && v <= 100) setEditRules((prev) => ({ ...prev, [key]: v }));
                      else if (t === '') setEditRules((prev) => ({ ...prev, [key]: 0 }));
                    }}
                  />
                  <TouchableOpacity
                    style={s.adjButton}
                    onPress={() => adjustEditRule(key, 5)}
                  >
                    <Ionicons name="add" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={[s.totalIndicator, editRulesTotal !== 100 && { backgroundColor: colors.error + '15' }]}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: editRulesTotal === 100 ? colors.success : colors.error }}>
                Total: {editRulesTotal}%
              </Text>
              {editRulesTotal !== 100 && (
                <Text style={{ fontSize: 11, color: colors.error, marginLeft: 8 }}>Must equal 100%</Text>
              )}
            </View>

            <View style={[s.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowBudgetEditor(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, editRulesTotal !== 100 && { opacity: 0.4 }]}
                onPress={handleSaveBudgetRules}
                disabled={editRulesTotal !== 100}
              >
                <Text style={s.modalConfirmText}>Save Rules</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Goal Modal ─────────────────────────────────────────── */}
      <Modal visible={showAddGoal} transparent animationType="slide" onRequestClose={() => setShowAddGoal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>New Savings Goal</Text>

              <Text style={s.inputLabel}>Goal Name</Text>
              <TextInput style={s.input} placeholder="e.g. Emergency Fund" placeholderTextColor={colors.placeholder} value={newGoalTitle} onChangeText={setNewGoalTitle} />

              <Text style={s.inputLabel}>Target Amount (₱)</Text>
              <TextInput style={s.input} placeholder="0.00" placeholderTextColor={colors.placeholder} keyboardType="numeric" value={newGoalTarget} onChangeText={setNewGoalTarget} />

              <Text style={s.inputLabel}>Deadline (optional, YYYY-MM-DD)</Text>
              <TextInput style={s.input} placeholder="2026-12-31" placeholderTextColor={colors.placeholder} value={newGoalDeadline} onChangeText={setNewGoalDeadline} />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowAddGoal(false)}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalConfirmBtn, goalSubmitting && { opacity: 0.5 }]}
                  onPress={handleAddGoal}
                  disabled={goalSubmitting}
                >
                  <Text style={s.modalConfirmText}>{goalSubmitting ? 'Saving…' : 'Create Goal'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Goal Modal ────────────────────────────────────────── */}
      <Modal visible={showEditGoal} transparent animationType="slide" onRequestClose={() => setShowEditGoal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Edit Goal</Text>

              <Text style={s.inputLabel}>Goal Name</Text>
              <TextInput
                style={s.input}
                value={editGoalData?.title || ''}
                onChangeText={(t) => setEditGoalData((prev) => prev ? { ...prev, title: t } : prev)}
              />

              <Text style={s.inputLabel}>Target Amount (₱)</Text>
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={editGoalData?.target_amount != null ? String(editGoalData.target_amount) : ''}
                onChangeText={(t) => setEditGoalData((prev) => prev ? { ...prev, target_amount: t } : prev)}
              />

              <Text style={s.inputLabel}>Deadline (optional, YYYY-MM-DD)</Text>
              <TextInput
                style={s.input}
                placeholder="2026-12-31"
                placeholderTextColor={colors.placeholder}
                value={editGoalData?.deadline || ''}
                onChangeText={(t) => setEditGoalData((prev) => prev ? { ...prev, deadline: t } : prev)}
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => { setShowEditGoal(false); setEditGoalData(null); }}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalConfirmBtn} onPress={handleEditGoal}>
                  <Text style={s.modalConfirmText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Allocate Funds Modal ───────────────────────────────────── */}
      <Modal visible={showAllocate} transparent animationType="slide" onRequestClose={() => setShowAllocate(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Allocate to "{allocateGoal?.title}"</Text>
              {allocateGoal && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                  Current: {formatCurrency(allocateGoal.current_amount)} / Target: {formatCurrency(allocateGoal.target_amount)}
                </Text>
              )}

              <Text style={s.inputLabel}>Amount (₱)</Text>
              <TextInput style={s.input} placeholder="0.00" placeholderTextColor={colors.placeholder} keyboardType="numeric" value={allocateAmount} onChangeText={setAllocateAmount} />

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.modalCancelBtn}
                  onPress={() => { setShowAllocate(false); setAllocateGoal(null); setAllocateAmount(''); }}
                >
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalConfirmBtn} onPress={handleAllocate}>
                  <Text style={s.modalConfirmText}>Allocate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },

    // Scroll
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },

    // ── Summary Card ─────────────────────────────────────────────────
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
        },
        android: { elevation: 4 },
      }),
    },
    summaryLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
    },
    summaryDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    summaryCol: {
      flex: 1,
      alignItems: 'center',
    },
    summaryColDivider: {
      width: StyleSheet.hairlineWidth,
      height: '100%',
      backgroundColor: colors.border,
    },
    summarySmallLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    summarySmallValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },

    // ── Progress Bar ─────────────────────────────────────────────────
    barTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: 'hidden',
      marginTop: 4,
    },
    barFill: {
      height: '100%',
      borderRadius: 4,
    },
    barLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'right',
    },

    // ── Split Bar ────────────────────────────────────────────────────
    splitBarContainer: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 6,
      overflow: 'hidden',
    },
    splitBarSegment: {
      height: '100%',
    },

    // ── Section ──────────────────────────────────────────────────────
    section: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      ...Platform.select({
        ios: {
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
        },
        android: { elevation: 2 },
      }),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 8,
      flex: 1,
    },

    // ── Category Row ─────────────────────────────────────────────────
    categoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    categoryIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    categoryName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    categoryAmount: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginLeft: 8,
    },

    // ── Goal Card ────────────────────────────────────────────────────
    goalCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
    },
    goalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    goalTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    goalSubtext: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    goalPctText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    allocateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 8,
      paddingVertical: 4,
    },

    // ── Session Card ─────────────────────────────────────────────────
    sessionCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    miniTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },

    // ── Empty State ──────────────────────────────────────────────────
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 8,
    },

    // ── Buttons ──────────────────────────────────────────────────────
    addButton: {
      padding: 4,
    },
    editBtn: {
      padding: 4,
    },

    // ── FAB ──────────────────────────────────────────────────────────
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
        },
        android: { elevation: 8 },
      }),
    },
    fabTouchable: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Modal ────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      maxHeight: '85%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: 6,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 20,
      gap: 12,
    },
    modalCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    modalConfirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    modalConfirmText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    // ── Budget Rules Editor ──────────────────────────────────────────
    adjButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    ruleInput: {
      fontSize: 22,
      fontWeight: '700',
      textAlign: 'center',
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 70,
    },
    totalIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success + '15',
      borderRadius: 8,
      padding: 10,
      marginTop: 4,
    },
  });
