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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../../context/ThemeContext';
import { AuthContext } from '../../context/AuthContext';
import { DataContext } from '../../context/DataContext';
import { supabase } from '../../config/supabase';
import goalNotificationService from '../../services/GoalNotificationService';

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'budgeting', label: 'Budgeting', icon: 'pie-chart' },
  { key: 'goals', label: 'Goals', icon: 'flag' },
  { key: 'saving', label: 'Saving', icon: 'wallet' },
];

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

const WALLET_META = {
  'TRADITIONAL BANK': { icon: 'business', color: '#3F51B5' },
  'EWALLET': { icon: 'phone-portrait', color: '#007DFE' },
  'PHYSICAL SAVING': { icon: 'cash', color: '#4CAF50' },
};
const DEFAULT_WALLET = { icon: 'wallet', color: '#795548' };
const WALLET_PRESETS = ['TRADITIONAL BANK', 'EWALLET', 'PHYSICAL SAVING'];

const GOAL_FILTERS = ['Active', 'Achieved', 'Deleted'];
const GOAL_SORTS = [
  { key: 'deadline', label: 'Deadline' },
  { key: 'progress', label: 'Progress' },
  { key: 'amount', label: 'Amount' },
];

const MILESTONES = [25, 50, 75];

const SPENDING_TIPS = {
  'Food & Dining': 'Try meal prepping or cooking at home to save.',
  Transport: 'Carpooling or public transit can cut costs.',
  Shopping: 'Use a 24-hour rule before non-essential purchases.',
  Groceries: 'Make a list before shopping to avoid impulse buys.',
  Entertainment: 'Look for free or discounted activities.',
  Electronics: 'Wait for sales or consider refurbished items.',
  'School Supplies': 'Buy in bulk at the start of the semester.',
  Utilities: 'Turn off unused appliances to lower your bill.',
  Health: 'Check if your school offers free health services.',
  Education: 'Look for scholarships or free online courses.',
  Other: 'Track these to find hidden savings opportunities.',
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

const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatInputDate = (date) => {
  if (!date) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const parseInputDate = (value) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const formatIsoDate = (date) => {
  if (!date) return null;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const getBudgetHealthScore = (breakdown, monthlyBudget) => {
  if (!monthlyBudget || monthlyBudget <= 0) return 0;
  const nb = breakdown.needs.budget || 0;
  const wb = breakdown.wants.budget || 0;
  const sb = breakdown.savings.budget || 0;
  const ns = breakdown.needs.spent || 0;
  const ws = breakdown.wants.spent || 0;
  const sa = breakdown.savings.actual || 0;
  const needsScore = nb > 0 ? (ns <= nb ? 1 : Math.max(0, 1 - (ns - nb) / nb)) : (ns === 0 ? 1 : 0);
  const wantsScore = wb > 0 ? (ws <= wb ? 1 : Math.max(0, 1 - (ws - wb) / wb)) : (ws === 0 ? 1 : 0);
  const savingsScore = sb > 0 ? Math.min(sa / sb, 1) : sa > 0 ? 1 : 0.5;
  const raw = (needsScore * 0.35 + wantsScore * 0.35 + savingsScore * 0.3) * 100;
  const score = Math.round(raw);
  if (!isFinite(score) || isNaN(score)) return 0;
  return Math.max(0, Math.min(100, score));
};

const getHealthLabel = (score) => {
  if (score >= 80) return { label: 'Excellent', color: '#4CAF50' };
  if (score >= 60) return { label: 'Good', color: '#8BC34A' };
  if (score >= 40) return { label: 'Fair', color: '#FF9800' };
  return { label: 'Needs Work', color: '#FF3B30' };
};

const getSavingsRateLabel = (rate, target) => {
  if (target <= 0) return { label: 'No Target', color: '#FF9800' };
  const ratio = rate / target;
  if (ratio >= 1) return { label: 'On Track', color: '#4CAF50' };
  if (ratio >= 0.75) return { label: 'Almost There', color: '#8BC34A' };
  if (ratio >= 0.4) return { label: 'Getting There', color: '#FF9800' };
  return { label: 'Needs Work', color: '#FF3B30' };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomModeDashboard({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useContext(ThemeContext);
  const { user, userInfo } = useContext(AuthContext);
  const { budget, expenses, addExpense } = useContext(DataContext);
  const isEmployee = userInfo?.userType === 'employee';

  // ── Tab ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('budgeting');
  const [refreshing, setRefreshing] = useState(false);
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;

  // ── Budgeting state ─────────────────────────────────────────────────
  const [budgetRules, setBudgetRules] = useState({ needs: 50, wants: 30, savings: 20 });
  const [showBudgetEditor, setShowBudgetEditor] = useState(false);
  const [editRules, setEditRules] = useState({ needs: 50, wants: 30, savings: 20 });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food & Dining');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Goals state ─────────────────────────────────────────────────────
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [goalFilter, setGoalFilter] = useState('Active');
  const [goalSort, setGoalSort] = useState('deadline');
  const [showGoalFilterDropdown, setShowGoalFilterDropdown] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');
  const [newGoalDeadline, setNewGoalDeadline] = useState('');
  const [newGoalDeadlineDate, setNewGoalDeadlineDate] = useState(null);
  const [showGoalDatePicker, setShowGoalDatePicker] = useState(false);
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  const [showAllocate, setShowAllocate] = useState(false);
  const [allocateGoal, setAllocateGoal] = useState(null);
  const [allocateAmount, setAllocateAmount] = useState('');

  // ── Saving state ────────────────────────────────────────────────────
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletLocationType, setNewWalletLocationType] = useState('');
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnType, setTxnType] = useState('deposit');
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [txnAmount, setTxnAmount] = useState('');
  const [txnNote, setTxnNote] = useState('');

  // ── Derived: Budgeting ──────────────────────────────────────────────

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

  // Spendable budget = income - expenses - goal allocations - net savings
  const totalGoalAllocations = useMemo(
    () => savingsGoals
      .filter((g) => !g.is_achieved && !g.is_deleted)
      .reduce((s, g) => s + (parseFloat(g.current_amount) || 0), 0),
    [savingsGoals],
  );
  const remaining = monthlyBudget - totalSpent - totalGoalAllocations - totalInWallets;

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

  const healthScore = useMemo(
    () => getBudgetHealthScore(budgetBreakdown, monthlyBudget),
    [budgetBreakdown, monthlyBudget],
  );
  const healthInfo = getHealthLabel(healthScore);

  const topCategory = useMemo(() => {
    const entries = Object.entries(categoryBreakdown);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { name: entries[0][0], amount: entries[0][1] };
  }, [categoryBreakdown]);

  // ── Derived: Goals ──────────────────────────────────────────────────

  const goalStats = useMemo(() => {
    const nonDeleted = savingsGoals.filter((g) => !g.is_deleted);
    const active = nonDeleted.filter((g) => !g.is_achieved).length;
    const achieved = nonDeleted.filter((g) => g.is_achieved).length;
    const totalAllocated = nonDeleted.reduce((s, g) => s + (parseFloat(g.current_amount) || 0), 0);
    return { active, achieved, total: nonDeleted.length, totalAllocated };
  }, [savingsGoals]);

  const filteredGoals = useMemo(() => {
    let list = [...savingsGoals];
    if (goalFilter === 'Deleted') {
      list = list.filter((g) => g.is_deleted);
    } else if (goalFilter === 'Achieved') {
      list = list.filter((g) => !g.is_deleted && g.is_achieved);
    } else {
      // Active
      list = list.filter((g) => !g.is_deleted && !g.is_achieved);
    }
    if (goalSort === 'deadline')
      list.sort((a, b) => new Date(a.deadline || '9999-12-31') - new Date(b.deadline || '9999-12-31'));
    else if (goalSort === 'progress')
      list.sort((a, b) => {
        const pA = (parseFloat(a.current_amount) || 0) / (parseFloat(a.target_amount) || 1);
        const pB = (parseFloat(b.current_amount) || 0) / (parseFloat(b.target_amount) || 1);
        return pB - pA;
      });
    else if (goalSort === 'amount')
      list.sort((a, b) => (parseFloat(b.target_amount) || 0) - (parseFloat(a.target_amount) || 0));
    return list;
  }, [savingsGoals, goalFilter, goalSort]);

  // ── Derived: Saving ─────────────────────────────────────────────────

  const totalInWallets = wallets.reduce((s, w) => s + (parseFloat(w.current_amount) || 0), 0);

  const { monthlyDeposits, monthlyWithdrawals } = useMemo(() => {
    const { start, end } = getCurrentMonthRange();
    let deps = 0;
    let wds = 0;
    (transactions || []).forEach((t) => {
      const d = new Date(t.created_at);
      if (d >= start && d <= end) {
        const amt = t.signed_amount != null ? t.signed_amount : (parseFloat(t.amount) || 0);
        if (amt > 0) deps += amt;
        else wds += Math.abs(amt);
      }
    });
    return { monthlyDeposits: deps, monthlyWithdrawals: wds };
  }, [transactions]);

  const savingsTarget = budgetRules.savings;
  const savingsRate = monthlyBudget > 0 ? Math.min((monthlyDeposits / monthlyBudget) * 100, savingsTarget) : 0;
  const rateInfo = getSavingsRateLabel(savingsRate, savingsTarget);

  // ── Data fetching ───────────────────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('goals_custom_mode')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Map new column names to the shape the UI already expects
      const mapped = (data || []).map((g) => ({
        ...g,
        deadline: g.target_date,
        is_achieved: g.is_completed,
      }));
      setSavingsGoals(mapped);
    } catch (err) {
      console.warn('fetchGoals:', err.message);
    }
  }, [user?.id]);

  const fetchSavingsData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Fetch accounts
      const { data: accounts, error: accErr } = await supabase
        .from('savings_accounts_custom_mode')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (accErr) throw accErr;

      // Fetch logs
      const { data: logs, error: logErr } = await supabase
        .from('savings_logs_custom_mode')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false });
      if (logErr) throw logErr;

      // Compute balances per account
      const balanceMap = {};
      (logs || []).forEach((log) => {
        const aid = log.account_id;
        if (aid) {
          balanceMap[aid] = (balanceMap[aid] || 0) + (parseFloat(log.amount) || 0);
        }
      });

      // Build wallet objects from accounts
      const accountMap = {};
      const walletsData = (accounts || []).map((acc) => {
        accountMap[acc.id] = acc;
        return {
          id: acc.id,
          name: acc.name,
          location_type: acc.location_type,
          current_amount: balanceMap[acc.id] || 0,
          created_at: acc.created_at,
        };
      });
      setWallets(walletsData);

      // Map logs to transaction-like objects
      setTransactions(
        (logs || []).filter((l) => l.account_id).map((log) => {
          const raw = parseFloat(log.amount) || 0;
          const acc = accountMap[log.account_id];
          return {
            id: log.id,
            amount: Math.abs(raw),
            signed_amount: raw,
            transaction_type: raw >= 0 ? 'deposit' : 'withdrawal',
            note: null,
            created_at: log.logged_at,
            savings_goals: { title: acc?.name || 'Unknown' },
            location_type: acc?.location_type,
          };
        }),
      );
    } catch (err) {
      console.warn('fetchSavingsData:', err.message);
    }
  }, [user?.id]);

  const fetchBudgetRules = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('budgets_custom_mode')
        .select('needs_pct, wants_pct, savings_pct')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setBudgetRules({ needs: data.needs_pct, wants: data.wants_pct, savings: data.savings_pct });
      }
    } catch (_) { /* fallback to default 50/30/20 */ }
  }, [user?.id]);

  useEffect(() => {
    fetchGoals();
    fetchSavingsData();
    fetchBudgetRules();
  }, [fetchGoals, fetchSavingsData, fetchBudgetRules]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchGoals(), fetchSavingsData(), fetchBudgetRules()]);
    setRefreshing(false);
  }, [fetchGoals, fetchSavingsData, fetchBudgetRules]);

  // ── Tab switch ──────────────────────────────────────────────────────

  const switchTab = (key) => {
    const idx = TABS.findIndex((t) => t.key === key);
    Animated.spring(tabIndicatorAnim, {
      toValue: idx,
      useNativeDriver: true,
      friction: 10,
      tension: 60,
    }).start();
    setActiveTab(key);
  };

  // ── Expense handlers ────────────────────────────────────────────────

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
      const success = await addExpense({
        amount: savedAmount,
        category: savedCategory,
        note: savedNote || `${savedCategory} expense`,
        date: new Date().toISOString(),
        appMode: 'custom',
      });
      if (!success) {
        Alert.alert('Sync Error', 'Your expense may not have been saved.');
      } else {
        Alert.alert('Expense Recorded', `₱${savedAmount.toFixed(2)} added to ${savedCategory}`);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to save expense: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Budget rules handlers ───────────────────────────────────────────

  const adjustEditRule = (key, delta) => {
    setEditRules((prev) => {
      let newVal = Math.max(0, Math.min(100, prev[key] + delta));
      // Enforce 20% minimum floor for Savings
      if (key === 'savings' && newVal < 20) newVal = 20;
      return { ...prev, [key]: newVal };
    });
  };

  const editRulesTotal = editRules.needs + editRules.wants + editRules.savings;

  const handleSaveBudgetRules = async () => {
    if (editRules.savings < 20) {
      Alert.alert('Invalid', 'Savings must be at least 20%.');
      return;
    }
    if (editRulesTotal !== 100) {
      Alert.alert('Invalid', 'Needs + Wants + Savings must equal 100%.');
      return;
    }
    setBudgetRules({ ...editRules });
    setShowBudgetEditor(false);
    try {
      await supabase.from('budgets_custom_mode').upsert({
        user_id: user.id,
        needs_pct: editRules.needs,
        wants_pct: editRules.wants,
        savings_pct: editRules.savings,
        total_income: monthlyBudget,
      }, { onConflict: 'user_id' });
    } catch (_) { /* non-critical */ }
  };

  // ── Goal handlers ───────────────────────────────────────────────────

  const handleGoalDeadlineChange = (value) => {
    setNewGoalDeadline(value);
    const parsed = parseInputDate(value.trim());
    setNewGoalDeadlineDate(parsed);
  };

  const handleGoalDateChange = (event, selectedDate) => {
    setShowGoalDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewGoalDeadlineDate(selectedDate);
      setNewGoalDeadline(formatInputDate(selectedDate));
    }
  };

  const handleAddGoal = async () => {
    const target = parseFloat(newGoalTarget);
    if (!newGoalTitle.trim() || isNaN(target) || target <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid goal name and target amount.');
      return;
    }
    if (!newGoalDeadline.trim() || !newGoalDeadlineDate) {
      Alert.alert('Invalid Date', 'Please enter a valid deadline date in MM/DD/YYYY format.');
      return;
    }
    setGoalSubmitting(true);
    try {
      const { data, error } = await supabase.from('goals_custom_mode').insert({
        user_id: user.id,
        title: newGoalTitle.trim(),
        target_amount: target,
        current_amount: 0,
        is_completed: false,
        target_date: formatIsoDate(newGoalDeadlineDate),
      }).select().single();
      if (error) throw error;
      const savedTitle = newGoalTitle.trim();
      setNewGoalTitle('');
      setNewGoalTarget('');
      setNewGoalDeadline('');
      setNewGoalDeadlineDate(null);
      setShowAddGoal(false);
      await fetchGoals();
      if (data && data.target_date) {
        goalNotificationService.scheduleGoalNotifications(
          data.id,
          savedTitle,
          data.target_date,
          0,
          target
        );
      }
      Alert.alert('Goal Added', `Goal added successfully: ${savedTitle}`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setGoalSubmitting(false);
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
            const { error } = await supabase
              .from('goals_custom_mode')
              .update({ is_deleted: true, deleted_at: new Date().toISOString() })
              .eq('id', goal.id);
            if (error) throw error;
            await fetchGoals();
            goalNotificationService.cancelGoalNotifications(goal.id);
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
        .from('goals_custom_mode')
        .update({
          current_amount: newAmount,
          is_completed: isAchieved,
          ...(isAchieved ? { achieved_at: new Date().toISOString() } : {}),
        })
        .eq('id', allocateGoal.id);
      if (error) throw error;
      setAllocateAmount('');
      setShowAllocate(false);
      
      if (isAchieved) {
        goalNotificationService.cancelGoalNotifications(allocateGoal.id);
      }
      
      setAllocateGoal(null);
      await fetchGoals();
      if (isAchieved) {
        Alert.alert('Goal Achieved!', `You've reached your target for "${allocateGoal.title}"!`);
      } else {
        Alert.alert('Funds Allocated', `${formatCurrency(amt)} allocated to ${allocateGoal.title}`);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // ── Savings log handlers ─────────────────────────────────────────────

  const handleAddWallet = async () => {
    if (!newWalletName.trim()) {
      Alert.alert('Invalid', 'Please enter a name for the savings account.');
      return;
    }
    if (!newWalletLocationType) {
      Alert.alert('Invalid', 'Please select a savings location type.');
      return;
    }
    try {
      const { error } = await supabase.from('savings_accounts_custom_mode').insert({
        user_id: user.id,
        name: newWalletName.trim(),
        location_type: newWalletLocationType,
      });
      if (error) throw error;
      Alert.alert('Account Added', `${newWalletName.trim()} added successfully`);
      setNewWalletName('');
      setNewWalletLocationType('');
      setShowAddWallet(false);
      await fetchSavingsData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleTransaction = async () => {
    const amt = parseFloat(txnAmount);
    if (!selectedWallet || isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid', 'Enter a valid amount.');
      return;
    }
    const currentBalance = parseFloat(selectedWallet.current_amount) || 0;
    if (txnType === 'withdrawal' && amt > currentBalance) {
      Alert.alert(
        'Insufficient Balance',
        `${selectedWallet.name} only has ${formatCurrency(currentBalance)}.`,
      );
      return;
    }
    // Deposits are positive, withdrawals are negative in the ledger
    const ledgerAmount = txnType === 'deposit' ? amt : -amt;
    try {
      const { error } = await supabase.from('savings_logs_custom_mode').insert({
        user_id: user.id,
        amount: ledgerAmount,
        location: selectedWallet.name,
        account_id: selectedWallet.id,
      });
      if (error) throw error;
      const label = txnType === 'deposit' ? 'deposited to' : 'withdrawn from';
      Alert.alert('Success', `${formatCurrency(amt)} ${label} ${selectedWallet.name}`);
      setTxnAmount('');
      setTxnNote('');
      setShowTxnModal(false);
      setSelectedWallet(null);
      await fetchSavingsData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDeleteWallet = (wallet) => {
    const bal = parseFloat(wallet.current_amount) || 0;
    const msg = bal > 0
      ? `"${wallet.name}" has ${formatCurrency(bal)} in savings. Delete this account and all its transactions?`
      : `Delete "${wallet.name}" and all its transactions?`;
    Alert.alert('Delete Account', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase
              .from('savings_accounts_custom_mode')
              .delete()
              .eq('id', wallet.id);
            if (error) throw error;
            await fetchSavingsData();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  // ── FAB ─────────────────────────────────────────────────────────────

  const onFabPress = () => {
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(fabScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      if (activeTab === 'budgeting') setShowExpenseModal(true);
      else if (activeTab === 'goals') setShowAddGoal(true);
      else setShowAddWallet(true);
    });
  };

  const fabLabel = { budgeting: 'Log Expense', goals: 'New Goal', saving: 'Add Account' };

  // ── Styles ──────────────────────────────────────────────────────────

  const colors = theme.colors;
  const s = useMemo(() => createStyles(colors), [colors]);

  // ── Segmented control layout ────────────────────────────────────────

  const TAB_INNER_PAD = 4;
  const tabContainerWidth = SCREEN_WIDTH - 32;
  const tabWidth = (tabContainerWidth - TAB_INNER_PAD * 2) / TABS.length;
  const translateX = tabIndicatorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [TAB_INNER_PAD, TAB_INNER_PAD + tabWidth, TAB_INNER_PAD + tabWidth * 2],
  });

  // ── Render helpers ──────────────────────────────────────────────────

  const renderBudgetBar = (label, color, budgetAmt, spentOrActual, isSpending = true) => {
    const pct = budgetAmt > 0 ? Math.min((spentOrActual / budgetAmt) * 100, 100) : 0;
    const overBudget = isSpending && spentOrActual > budgetAmt;
    return (
      <View style={{ marginBottom: 12 }} key={label}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text>
          <Text style={{ fontSize: 12, color: overBudget ? colors.error : colors.textSecondary }}>
            {formatCurrency(spentOrActual)} / {formatCurrency(budgetAmt)}
          </Text>
        </View>
        <View style={s.barTrack}>
          <View
            style={[
              s.barFill,
              { width: `${Math.min(pct, 100)}%`, backgroundColor: overBudget ? colors.error : color },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderCategoryRow = (cat, amt) => {
    const meta = CATEGORY_META[cat] || CATEGORY_META.Other;
    const budgetType = CATEGORY_BUDGET_MAP[cat] || 'wants';
    return (
      <View style={s.categoryRow} key={cat}>
        <View style={[s.categoryIcon, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 }} numberOfLines={1}>
              {cat}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginLeft: 8 }}>
              {formatCurrency(amt)}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
            {budgetType === 'needs' ? 'Needs' : 'Wants'}
          </Text>
        </View>
      </View>
    );
  };

  const renderGoalCard = (item) => {
    const current = parseFloat(item.current_amount) || 0;
    const target = parseFloat(item.target_amount) || 1;
    const pct = Math.min((current / target) * 100, 100);
    const isComplete = item.is_achieved;
    const days = daysUntil(item.deadline);
    const remainingAmt = Math.max(0, target - current);

    // Dynamic savings tip: pick the right time unit based on how far the deadline is
    let savingsTip = null;
    if (!isComplete && remainingAmt > 0 && days != null && days > 0) {
      if (days <= 7) {
        // Less than a week — show daily target
        const perDay = remainingAmt / days;
        savingsTip = `Save ${formatCurrency(perDay)}/day to reach this on time`;
      } else if (days <= 30) {
        // Less than a month — show weekly target
        const weeks = days / 7;
        const perWeek = remainingAmt / weeks;
        savingsTip = `Save ${formatCurrency(perWeek)}/week to reach this on time`;
      } else {
        // More than a month — show monthly target
        const months = days / 30;
        const perMonth = remainingAmt / months;
        savingsTip = `Save ${formatCurrency(perMonth)}/month to reach this on time`;
      }
    }

    return (
      <View key={item.id} style={[s.goalCard, isComplete && { borderColor: colors.success, borderWidth: 1.5 }, item.is_deleted && { opacity: 0.65 }]}>
        <View style={s.goalHeader}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {isComplete && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            {item.is_deleted && (
              <View style={{ backgroundColor: colors.error + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.error }}>Deleted</Text>
              </View>
            )}
            {!item.is_deleted && (
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleDeleteGoal(item)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
          {formatCurrency(current)} / {formatCurrency(target)}
        </Text>

        {/* Progress bar with milestones */}
        <View style={{ marginTop: 6 }}>
          <View style={s.barTrack}>
            <View
              style={[s.barFill, { width: `${pct}%`, backgroundColor: isComplete ? colors.success : colors.primary }]}
            />
          </View>
          <View style={{ position: 'relative', height: 18, marginTop: 4 }}>
            {MILESTONES.map((m) => (
              <View
                key={m}
                style={{ position: 'absolute', left: `${m}%`, marginLeft: -8, alignItems: 'center', width: 16 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: pct >= m ? colors.success : colors.border,
                  }}
                />
                <Text style={{ fontSize: 8, color: pct >= m ? colors.success : colors.textSecondary }}>{m}%</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>{pct.toFixed(0)}% reached</Text>
          <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
            {item.is_deleted && item.deleted_at && (
              <Text style={{ fontSize: 11, color: colors.error }}>
                Deleted on {formatDate(item.deleted_at)}
              </Text>
            )}
            {isComplete && !item.is_deleted && item.achieved_at && (
              <Text style={{ fontSize: 11, color: colors.success }}>
                Achieved on {formatDate(item.achieved_at)}
              </Text>
            )}
            {!isComplete && !item.is_deleted && item.deadline && (
              <Text
                style={{ fontSize: 11, color: days != null && days <= 7 ? colors.warning : colors.textSecondary }}
              >
                {days != null ? (days === 0 ? 'Due today' : `${days}d left`) : ''}
              </Text>
            )}
            {item.deadline && (
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                Deadline: {formatDate(item.deadline)}
              </Text>
            )}
          </View>
        </View>

        {/* Suggested savings tip — dynamic time unit */}
        {savingsTip != null && !item.is_deleted && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 6,
              backgroundColor: colors.info + '12',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <Ionicons name="bulb-outline" size={14} color={colors.info} />
            <Text style={{ fontSize: 11, color: colors.info, marginLeft: 6 }}>
              {savingsTip}
            </Text>
          </View>
        )}

        {!isComplete && !item.is_deleted && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 }}
            onPress={() => { setAllocateGoal(item); setShowAllocate(true); }}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', marginLeft: 4 }}>
              Allocate Funds
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderWalletCard = (wallet) => {
    const meta = WALLET_META[wallet.location_type] || DEFAULT_WALLET;
    const balance = parseFloat(wallet.current_amount) || 0;
    const hasBalance = balance > 0;
    return (
      <View key={wallet.id} style={s.walletCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[s.walletIcon, { backgroundColor: meta.color + '18' }]}>
            <Ionicons name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{wallet.name}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{wallet.location_type}</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: hasBalance ? colors.success : colors.textSecondary, marginTop: 2 }}>
              {formatCurrency(balance)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          <TouchableOpacity
            style={[s.walletActionBtn, { backgroundColor: colors.success + '15' }]}
            onPress={() => {
              setSelectedWallet(wallet);
              setTxnType('deposit');
              setTxnAmount('');
              setTxnNote('');
              setShowTxnModal(true);
            }}
          >
            <Ionicons name="add" size={16} color={colors.success} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.success, marginLeft: 4 }}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.walletActionBtn, { backgroundColor: colors.error + '15' }, !hasBalance && { opacity: 0.35 }]}
            onPress={() => {
              setSelectedWallet(wallet);
              setTxnType('withdrawal');
              setTxnAmount('');
              setTxnNote('');
              setShowTxnModal(true);
            }}
            disabled={!hasBalance}
          >
            <Ionicons name="remove" size={16} color={colors.error} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.error, marginLeft: 4 }}>Withdraw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.walletActionBtn, { backgroundColor: colors.surface }]}
            onPress={() => handleDeleteWallet(wallet)}
          >
            <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTransactionRow = (txn) => {
    const isDeposit = txn.transaction_type === 'deposit';
    const walletName = txn.savings_goals?.title || 'Unknown';
    const meta = WALLET_META[txn.location_type] || DEFAULT_WALLET;
    return (
      <View key={txn.id} style={s.txnRow}>
        <View style={[s.txnIconWrap, { backgroundColor: (isDeposit ? colors.success : colors.error) + '15' }]}>
          <Ionicons
            name={isDeposit ? 'arrow-down' : 'arrow-up'}
            size={16}
            color={isDeposit ? colors.success : colors.error}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{walletName}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: isDeposit ? colors.success : colors.error }}>
              {isDeposit ? '+' : '-'}{formatCurrency(txn.amount)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
              {txn.note || (isDeposit ? 'Deposit' : 'Withdrawal')}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{formatShortDate(txn.created_at)}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ── Tab content renderers ───────────────────────────────────────────

  const renderBudgetingTab = () => (
    <>
      {/* Summary Card */}
      <View style={s.summaryCard}>
        <Text style={s.summaryLabel}>Spendable Budget</Text>
        {/* <Text style={[s.summaryValue, { color: remaining >= 0 ? colors.success : colors.error }]}>
          {formatCurrency(remaining)}
        </Text> */}
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
            <Text style={s.summarySmallLabel}>Goals</Text>
            <Text style={[s.summarySmallValue, { color: colors.savings || '#2196F3' }]}>{formatCurrency(totalGoalAllocations)}</Text>
          </View>
          <View style={s.summaryColDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Saved</Text>
            <Text style={[s.summarySmallValue, { color: colors.success }]}>{formatCurrency(totalInWallets)}</Text>
          </View>
        </View>
      </View>

      {/* Budget Health Score */}
      {monthlyBudget > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="pulse" size={20} color={healthInfo.color} />
            <Text style={s.sectionTitle}>Budget Health</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.healthCircle, { borderColor: healthInfo.color }]}>
              <Text style={[s.healthScore, { color: healthInfo.color }]}>{healthScore}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: healthInfo.color }}>{healthInfo.label}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                Based on your {budgetRules.needs}/{budgetRules.wants}/{budgetRules.savings} budget split adherence.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Budget Split */}
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

      {/* Top Spending Insight */}
      {topCategory && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="bulb" size={20} color={colors.warning} />
            <Text style={s.sectionTitle}>Spending Insight</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.categoryIcon, { backgroundColor: (CATEGORY_META[topCategory.name]?.color || '#795548') + '18' }]}>
              <Ionicons
                name={CATEGORY_META[topCategory.name]?.icon || 'ellipsis-horizontal'}
                size={24}
                color={CATEGORY_META[topCategory.name]?.color || '#795548'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                Top: {topCategory.name} — {formatCurrency(topCategory.amount)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {SPENDING_TIPS[topCategory.name] || SPENDING_TIPS.Other}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Category Breakdown */}
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
          Object.entries(categoryBreakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => renderCategoryRow(cat, amt))
        )}
      </View>
    </>
  );

  const renderGoalsTab = () => (
    <>
      {/* Goal Stats */}
      <View style={s.summaryCard}>
        <View style={s.summaryRow}>
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Total</Text>
            <Text style={s.summarySmallValue}>{goalStats.total}</Text>
          </View>
          <View style={s.summaryColDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Active</Text>
            <Text style={[s.summarySmallValue, { color: colors.primary }]}>{goalStats.active}</Text>
          </View>
          <View style={s.summaryColDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Achieved</Text>
            <Text style={[s.summarySmallValue, { color: colors.success }]}>{goalStats.achieved}</Text>
          </View>
          <View style={s.summaryColDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Allocated</Text>
            <Text style={[s.summarySmallValue, { color: colors.savings }]}>
              {formatCurrency(goalStats.totalAllocated)}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter & Sort */}
      <View style={s.filterSortRow}>
        {/* Dropdown filter */}
        <View style={{ position: 'relative' }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
            onPress={() => setShowGoalFilterDropdown((v) => !v)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={goalFilter === 'Active' ? 'flame' : goalFilter === 'Achieved' ? 'trophy' : 'trash'}
              size={15}
              color={goalFilter === 'Active' ? colors.primary : goalFilter === 'Achieved' ? colors.success : colors.error}
            />
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{goalFilter}</Text>
            <Ionicons name={showGoalFilterDropdown ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
          </TouchableOpacity>
          {showGoalFilterDropdown && (
            <View style={{
              position: 'absolute',
              top: 42,
              left: 0,
              backgroundColor: colors.card,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              zIndex: 100,
              minWidth: 140,
              ...Platform.select({
                ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
                android: { elevation: 8 },
              }),
            }}>
              {GOAL_FILTERS.map((f, idx) => (
                <TouchableOpacity
                  key={f}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    gap: 8,
                    borderBottomWidth: idx < GOAL_FILTERS.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: colors.border,
                    backgroundColor: goalFilter === f ? colors.primary + '12' : 'transparent',
                  }}
                  onPress={() => { setGoalFilter(f); setShowGoalFilterDropdown(false); }}
                >
                  <Ionicons
                    name={f === 'Active' ? 'flame' : f === 'Achieved' ? 'trophy' : 'trash'}
                    size={16}
                    color={f === 'Active' ? colors.primary : f === 'Achieved' ? colors.success : colors.error}
                  />
                  <Text style={{ fontSize: 13, fontWeight: goalFilter === f ? '700' : '500', color: goalFilter === f ? colors.primary : colors.text }}>{f}</Text>
                  {goalFilter === f && <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {/* Sort chips */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {GOAL_SORTS.map((so) => (
            <TouchableOpacity
              key={so.key}
              style={[s.filterChip, goalSort === so.key && { backgroundColor: colors.primary }]}
              onPress={() => setGoalSort(so.key)}
            >
              <Text style={[s.filterChipText, goalSort === so.key && { color: '#FFF' }]}>{so.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Goal Cards */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="flag" size={20} color={colors.primary} />
          <Text style={s.sectionTitle}>Your Goals</Text>
        </View>
        {filteredGoals.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="flag-outline" size={40} color={colors.textSecondary} />
            <Text style={s.emptyText}>
              {goalFilter === 'Active' ? 'No active goals — tap + to create one' : goalFilter === 'Deleted' ? 'No deleted goals' : 'No achieved goals yet'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredGoals.map((g) => renderGoalCard(g))}
          </View>
        )}
      </View>
    </>
  );

  const renderSavingTab = () => (
    <>
      {/* Savings Overview */}
      <View style={s.summaryCard}>
        <View style={s.summaryRow}>
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Total Saved</Text>
            <Text style={[s.summarySmallValue, { color: colors.success }]}>{formatCurrency(totalInWallets)}</Text>
          </View>
          <View style={s.summaryColDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Deposits</Text>
            <Text style={[s.summarySmallValue, { color: colors.income }]}>{formatCurrency(monthlyDeposits)}</Text>
          </View>
          <View style={s.summaryColDivider} />
          <View style={s.summaryCol}>
            <Text style={s.summarySmallLabel}>Withdrawals</Text>
            <Text style={[s.summarySmallValue, { color: colors.expense }]}>{formatCurrency(monthlyWithdrawals)}</Text>
          </View>
        </View>
      </View>

      {/* Savings Rate Gauge */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="trending-up" size={20} color={monthlyDeposits === 0 && totalInWallets === 0 ? colors.textSecondary : rateInfo.color} />
          <Text style={s.sectionTitle}>Savings Rate</Text>
        </View>
        {monthlyDeposits === 0 && totalInWallets === 0 ? (
          /* Empty State: no savings data yet */
          <View style={s.emptyState}>
            <Ionicons name="leaf-outline" size={44} color={colors.primary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 10, textAlign: 'center' }}>
              No savings logged yet
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6, textAlign: 'center', lineHeight: 19, paddingHorizontal: 12 }}>
              You haven't logged any savings yet. Start setting aside some cash today — even a small amount makes a difference!
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.healthCircle, { borderColor: rateInfo.color }]}>
                <Text style={[s.healthScore, { color: rateInfo.color, fontSize: 20 }]}>{savingsRate.toFixed(0)}%</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: rateInfo.color }}>{rateInfo.label}</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  {monthlyBudget > 0
                    ? `You've saved ${savingsRate.toFixed(1)}% of your ${isEmployee ? 'income' : 'allowance'} this month (target: ${savingsTarget}%).`
                    : 'Set a monthly budget to track your savings rate.'}
                </Text>
              </View>
            </View>
            {/* Rate bar */}
            <View style={{ marginTop: 12 }}>
              <View style={s.barTrack}>
                <View
                  style={[s.barFill, { width: `${savingsTarget > 0 ? Math.min((savingsRate / savingsTarget) * 100, 100) : 0}%`, backgroundColor: rateInfo.color }]}
                />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>0%</Text>
                <Text style={{ fontSize: 10, color: colors.textSecondary }}>Target: {savingsTarget}%</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Wallets */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="wallet" size={20} color={colors.primary} />
          <Text style={s.sectionTitle}>Savings Accounts</Text>
        </View>
        {wallets.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="wallet-outline" size={40} color={colors.textSecondary} />
            <Text style={s.emptyText}>No accounts yet — tap + to add one</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>{wallets.map(renderWalletCard)}</View>
        )}
      </View>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="swap-vertical" size={20} color={colors.primary} />
            <Text style={s.sectionTitle}>Transaction History</Text>
          </View>
          <View style={{ gap: 0 }}>{transactions.slice(0, 20).map(renderTransactionRow)}</View>
        </View>
      )}
    </>
  );

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

      {/* Segmented Control */}
      <View style={s.tabContainer}>
        <Animated.View style={[s.tabIndicator, { width: tabWidth, transform: [{ translateX }] }]} />
        {TABS.map((tab) => (
          <TouchableOpacity key={tab.key} style={s.tabButton} onPress={() => switchTab(tab.key)} activeOpacity={0.7}>
            <Ionicons
              name={tab.icon}
              size={15}
              color={activeTab === tab.key ? '#FFF' : colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onScrollBeginDrag={() => setShowGoalFilterDropdown(false)}
      >
        {activeTab === 'budgeting' && renderBudgetingTab()}
        {activeTab === 'goals' && renderGoalsTab()}
        {activeTab === 'saving' && renderSavingTab()}
        <View style={{ height: 90 }} />
      </ScrollView>

      {/* FAB */}
      <Animated.View style={[s.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity style={s.fabTouchable} onPress={onFabPress} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* ════════════════════ MODALS ════════════════════ */}

      {/* ── Expense Modal ──────────────────────────────────────────── */}
      <Modal visible={showExpenseModal} transparent animationType="slide" onRequestClose={() => setShowExpenseModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <View style={s.modalIconWrap}>
                  <Ionicons name="book" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={s.modalTitle}>Log Expense</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: -14 }}>Quick Add</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                <Text style={s.inputLabel}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const selected = expenseCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 20,
                          backgroundColor: selected ? cat.color : colors.surface,
                          borderWidth: 1.5,
                          borderColor: selected ? cat.color : colors.border,
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

                <Text style={s.inputLabel}>Quick amounts</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {QUICK_AMOUNTS.map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: 'center',
                        backgroundColor: expenseAmount === String(amt) ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: expenseAmount === String(amt) ? colors.primary : colors.border,
                      }}
                      onPress={() => setExpenseAmount(String(amt))}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: expenseAmount === String(amt) ? '#FFF' : colors.text }}>
                        ₱{amt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={s.inputLabel}>Amount (₱)</Text>
                <TextInput
                  style={s.input}
                  placeholder="Enter amount"
                  placeholderTextColor={colors.placeholder}
                  keyboardType="numeric"
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                />

                <Text style={[s.inputLabel, { marginTop: 10 }]}>Description (optional)</Text>
                <TextInput
                  style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder="e.g., Lunch, Bus fare..."
                  placeholderTextColor={colors.placeholder}
                  multiline
                  value={expenseNote}
                  onChangeText={setExpenseNote}
                />

                {monthlyBudget > 0 && (
                  <View style={s.budgetStatus}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 2 }}>Budget Status</Text>
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      Remaining:{' '}
                      <Text style={{ fontWeight: 'bold', color: remaining >= 0 ? colors.success : colors.error }}>
                        {formatCurrency(remaining)}
                      </Text>
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {CATEGORY_BUDGET_MAP[expenseCategory] === 'needs'
                        ? `Counts as Needs (${budgetRules.needs}%)`
                        : `Counts as Wants (${budgetRules.wants}%)`}
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
                  style={[
                    s.modalConfirmBtn,
                    { backgroundColor: EXPENSE_CATEGORIES.find((c) => c.id === expenseCategory)?.color || colors.primary },
                    isSubmitting && { opacity: 0.5 },
                  ]}
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
            ].map(({ key, label, color }) => {
              const isSavings = key === 'savings';
              const atFloor = isSavings && editRules[key] <= 20;
              return (
                <View key={key} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color }}>{label}{isSavings ? ' (min 20%)' : ''}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color }}>{editRules[key]}%</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                    {/* Hide minus button when savings is at the 20% floor */}
                    {!(isSavings && atFloor) ? (
                      <TouchableOpacity style={s.adjButton} onPress={() => adjustEditRule(key, -5)}>
                        <Ionicons name="remove" size={20} color={colors.text} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[s.adjButton, { opacity: 0 }]} />
                    )}
                    <TextInput
                      style={[s.ruleInput, { color }]}
                      keyboardType="numeric"
                      value={String(editRules[key])}
                      onChangeText={(t) => {
                        const v = parseInt(t, 10);
                        if (!isNaN(v)) {
                          // Enforce 20% floor for savings
                          const clamped = isSavings ? Math.max(20, Math.min(100, v)) : Math.max(0, Math.min(100, v));
                          setEditRules((prev) => ({ ...prev, [key]: clamped }));
                        } else if (t === '') {
                          setEditRules((prev) => ({ ...prev, [key]: isSavings ? 20 : 0 }));
                        }
                      }}
                    />
                    <TouchableOpacity style={s.adjButton} onPress={() => adjustEditRule(key, 5)}>
                      <Ionicons name="add" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

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
              <TextInput style={s.input} placeholder="e.g. New Shoes" placeholderTextColor={colors.placeholder} value={newGoalTitle} onChangeText={setNewGoalTitle} />

              <Text style={s.inputLabel}>Target Amount (₱)</Text>
              <TextInput style={s.input} placeholder="0.00" placeholderTextColor={colors.placeholder} keyboardType="numeric" value={newGoalTarget} onChangeText={setNewGoalTarget} />

              <Text style={s.inputLabel}>Deadline (optional, MM/DD/YYYY)</Text>
              <View style={s.dateInputRow}>
                <TextInput
                  style={s.dateInputField}
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={colors.placeholder}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  maxLength={10}
                  value={newGoalDeadline}
                  onChangeText={handleGoalDeadlineChange}
                  onBlur={() => {
                    if (newGoalDeadlineDate) setNewGoalDeadline(formatInputDate(newGoalDeadlineDate));
                  }}
                />
                <TouchableOpacity
                  style={s.dateIconButton}
                  onPress={() => setShowGoalDatePicker((prev) => !prev)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              {showGoalDatePicker && (
                <DateTimePicker
                  value={newGoalDeadlineDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleGoalDateChange}
                />
              )}

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
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => { setShowAllocate(false); setAllocateGoal(null); setAllocateAmount(''); }}>
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

      {/* ── Add Account Modal ──────────────────────────────────────── */}
      <Modal visible={showAddWallet} transparent animationType="slide" onRequestClose={() => setShowAddWallet(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Add Savings Account</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>
                Name your account and pick where it's kept.
              </Text>

              <Text style={s.inputLabel}>Account Name</Text>
              <TextInput
                style={s.input}
                placeholder="e.g., BDO Savings, GCash, Piggy Bank"
                placeholderTextColor={colors.placeholder}
                value={newWalletName}
                onChangeText={setNewWalletName}
              />

              <Text style={[s.inputLabel, { marginTop: 14 }]}>Location Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {WALLET_PRESETS.map((name) => {
                  const meta = WALLET_META[name] || DEFAULT_WALLET;
                  const selected = newWalletLocationType === name;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 20,
                        backgroundColor: selected ? meta.color : colors.surface,
                        borderWidth: 1.5,
                        borderColor: selected ? meta.color : colors.border,
                      }}
                      onPress={() => setNewWalletLocationType(name)}
                    >
                      <Ionicons name={meta.icon} size={16} color={selected ? '#FFF' : meta.color} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, fontWeight: selected ? '700' : '500', color: selected ? '#FFF' : colors.text }}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => { setShowAddWallet(false); setNewWalletName(''); setNewWalletLocationType(''); }}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalConfirmBtn} onPress={handleAddWallet}>
                  <Text style={s.modalConfirmText}>Add Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Transaction (Deposit / Withdraw) Modal ─────────────────── */}
      <Modal visible={showTxnModal} transparent animationType="slide" onRequestClose={() => setShowTxnModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>
                {txnType === 'deposit' ? 'Deposit to' : 'Withdraw from'} "{selectedWallet?.name}"
              </Text>
              {selectedWallet && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                  Current balance: {formatCurrency(selectedWallet.current_amount)}
                </Text>
              )}

              <Text style={s.inputLabel}>Amount (₱)</Text>
              <TextInput
                style={s.input}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                value={txnAmount}
                onChangeText={setTxnAmount}
              />

              <Text style={[s.inputLabel, { marginTop: 10 }]}>Note (optional)</Text>
              <TextInput
                style={s.input}
                placeholder={txnType === 'deposit' ? 'e.g., Savings from allowance' : 'e.g., Emergency need'}
                placeholderTextColor={colors.placeholder}
                value={txnNote}
                onChangeText={setTxnNote}
              />

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => { setShowTxnModal(false); setSelectedWallet(null); setTxnAmount(''); setTxnNote(''); }}>
                  <Text style={s.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalConfirmBtn, { backgroundColor: txnType === 'deposit' ? colors.success : colors.error }]}
                  onPress={handleTransaction}
                >
                  <Ionicons name={txnType === 'deposit' ? 'arrow-down' : 'arrow-up'} size={16} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={s.modalConfirmText}>{txnType === 'deposit' ? 'Deposit' : 'Withdraw'}</Text>
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
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 20,
    },

    // ── Segmented Control ────────────────────────────────────────────
    tabContainer: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 4,
      position: 'relative',
    },
    tabIndicator: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      borderRadius: 10,
      backgroundColor: colors.primary,
    },
    tabButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      zIndex: 1,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabLabelActive: {
      color: '#FFF',
      fontWeight: '700',
    },

    // ── Summary Card ─────────────────────────────────────────────────
    summaryCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      ...Platform.select({
        ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10 },
        android: { elevation: 4 },
      }),
    },
    summaryLabel: {
      fontSize: 15,
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
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },

    // ── Section ──────────────────────────────────────────────────────
    section: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
      ...Platform.select({
        ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
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

    // ── Budget Bar ───────────────────────────────────────────────────
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
    splitBarContainer: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 6,
      overflow: 'hidden',
    },
    splitBarSegment: {
      height: '100%',
    },

    // ── Health Circle ────────────────────────────────────────────────
    healthCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    healthScore: {
      fontSize: 24,
      fontWeight: '800',
    },

    // ── Category ─────────────────────────────────────────────────────
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

    // ── Filter & Sort ────────────────────────────────────────────────
    filterSortRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      gap: 8,
      zIndex: 10,
    },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },

    // ── Wallet Card ──────────────────────────────────────────────────
    walletCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
    },
    walletIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    walletActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },

    // ── Transaction Row ──────────────────────────────────────────────
    txnRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    txnIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
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
    editBtn: { padding: 4 },

    // ── FAB ──────────────────────────────────────────────────────────
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 20,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
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
    modalIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
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
    dateInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    dateInputField: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 15,
      color: colors.text,
    },
    dateIconButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
    },
    budgetStatus: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
      marginTop: 12,
      borderWidth: 1,
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
