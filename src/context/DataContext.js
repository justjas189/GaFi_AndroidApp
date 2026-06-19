// context/DataContext.js
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { ThemeContext } from './ThemeContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import { analyzeExpenses, getRecommendations } from '../config/nvidia';
import { BudgetDatabaseService } from '../services/BudgetDatabaseService_NEW';
import { normalizeCategory } from '../utils/categoryUtils';
import notificationService from '../services/NotificationService';
import goalNotificationService from '../services/GoalNotificationService';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const { theme } = useContext(ThemeContext);
  const { userInfo, isLoading: isAuthLoading } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState([]);
  const defaultBudget = {
    monthly: 0,
    weekly: 0,
    categories: {
      food: { limit: 0, spent: 0 },
      transportation: { limit: 0, spent: 0 },
      entertainment: { limit: 0, spent: 0 },
      shopping: { limit: 0, spent: 0 },
      utilities: { limit: 0, spent: 0 },
      others: { limit: 0, spent: 0 }
    }
  };
  const [budget, setBudget] = useState(defaultBudget);
  const [expenses, setExpenses] = useState([]);
  const [notes, setNotes] = useState([]);

  // ── Savings snapshot ──────────────────────────────────────────────────
  // Custom Mode's savings/goals live in their OWN Supabase tables
  // (savings_accounts_custom_mode / savings_logs_custom_mode /
  // goals_custom_mode), which the dashboard fetches into LOCAL state. Koin
  // (the AI buddy) only ever read this DataContext, so it was blind to them and
  // reported "Saved so far: ₱0". We mirror the dashboard's exact math here so
  // the numbers Koin quotes always match what the user sees on screen.
  const defaultSavings = {
    totalSaved: 0,          // lifetime balance across all savings accounts (= dashboard "Total Saved")
    monthlyDeposits: 0,     // deposits logged this calendar month
    monthlyWithdrawals: 0,  // withdrawals logged this calendar month
    monthlySaved: 0,        // net kept this month (deposits − withdrawals)
    walletCount: 0,
    goalsActive: 0,
    goalsAchieved: 0,
    goalsTotalAllocated: 0,
    goals: [],              // up to 5 non-deleted goals: { title, current, target, pct, deadline, achieved }
    budgetRules: { needs: 50, wants: 30, savings: 20 }, // 50/30/20 split from budgets_custom_mode
  };
  const [savings, setSavings] = useState(defaultSavings);

  // Helper function to get current user ID (resilient multi-layer lookup)
  const getCurrentUserId = async () => {
    const userId = userInfo?.id || null;
    if (!userId) throw new Error('No authenticated user');
    return userId;
  };

  // Helper function to ensure user is authenticated (resilient multi-layer lookup)
  const ensureAuthenticated = async () => {
    const userId = userInfo?.id || null;
    if (!userId) throw new Error('User not authenticated');
    return { user: { id: userId } };
  };

  // ── Initialize / tear-down data when auth state changes ──
  // We watch AuthContext's resolved state (isAuthLoading + userInfo)
  // instead of independently calling getSession(), which races the
  // GoTrueClient session restoration from AsyncStorage.
  const prevUserIdRef = useRef(null);

  useEffect(() => {
    // Auth is still loading from storage — don't do anything yet
    if (isAuthLoading) return;

    let expenseSubscription = null;
    let budgetSubscription = null;
    let cancelled = false;

    const userId = userInfo?.id || null;

    if (userId && userId !== prevUserIdRef.current) {
      // ── User is authenticated → load data + subscribe ──
      prevUserIdRef.current = userId;

      const setup = async () => {
        try {
          console.log('Auth ready, loading data for user:', userId);
          await loadData({ deferInsights: true });
          if (cancelled) return;
          setIsInitialized(true);

          // Set up real-time subscriptions
          expenseSubscription = supabase
            .channel('expenses_changes_' + userId)
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'expenses',
              filter: `user_id=eq.${userId}`
            }, async () => { await loadData({ deferInsights: true }); })
            .subscribe();

          budgetSubscription = supabase
            .channel('budget_changes_' + userId)
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'budgets',
              filter: `user_id=eq.${userId}`
            }, async () => { await loadData({ deferInsights: true }); })
            .subscribe();

        } catch (err) {
          console.error('Error initializing data context:', err);
          if (!cancelled) setError(err.message);
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      };

      setup();
    } else if (!userId) {
      // ── No user (logged out or first load without session) → clear ──
      prevUserIdRef.current = null;
      setBudget(defaultBudget);
      setExpenses([]);
      setNotes([]);
      setSavings(defaultSavings);
      setInsights([]);
      setError(null);
      setIsInitialized(true);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      if (expenseSubscription) expenseSubscription.unsubscribe();
      if (budgetSubscription) budgetSubscription.unsubscribe();
    };
  }, [isAuthLoading, userInfo?.id]);

  // ── Load the savings snapshot ─────────────────────────────────────────
  // Mirrors CustomModeDashboard's computations exactly so Koin never drifts
  // from the on-screen numbers:
  //   • totalSaved      = Σ signed savings_logs for logs tied to a live account
  //                       (== dashboard's `totalInWallets`)
  //   • monthly*        = same logs filtered to the current calendar month
  //   • goals*          = non-deleted goals_custom_mode rows
  //   • budgetRules     = needs/wants/savings split from budgets_custom_mode
  // Plain async fn (not a hook) so it can be both called inside loadData() and
  // exposed as `refreshSavings` for on-demand refresh (e.g. when Koin opens).
  const loadSavingsSnapshot = async (uid) => {
    const userId = uid || userInfo?.id || null;
    if (!userId) return;
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      // Accounts + logs → balances (same as dashboard's fetchSavingsData)
      const [{ data: accounts }, { data: logs }] = await Promise.all([
        supabase.from('savings_accounts_custom_mode').select('id').eq('user_id', userId),
        supabase.from('savings_logs_custom_mode').select('amount, logged_at, account_id').eq('user_id', userId),
      ]);

      const liveAccountIds = new Set((accounts || []).map((a) => a.id));
      let totalSaved = 0;
      let monthlyDeposits = 0;
      let monthlyWithdrawals = 0;
      (logs || []).forEach((log) => {
        // Only logs tied to an existing account count toward the balance —
        // exactly how the dashboard derives `totalInWallets`.
        if (!log.account_id || !liveAccountIds.has(log.account_id)) return;
        const amt = parseFloat(log.amount) || 0;
        totalSaved += amt;
        const d = new Date(log.logged_at);
        if (d >= monthStart && d <= monthEnd) {
          if (amt > 0) monthlyDeposits += amt;
          else monthlyWithdrawals += Math.abs(amt);
        }
      });

      // Goals
      const { data: goalsData } = await supabase
        .from('goals_custom_mode')
        .select('*')
        .eq('user_id', userId);
      const nonDeleted = (goalsData || []).filter((g) => !g.is_deleted);
      const goalsActive = nonDeleted.filter((g) => !g.is_completed).length;
      const goalsAchieved = nonDeleted.filter((g) => g.is_completed).length;
      const goalsTotalAllocated = nonDeleted.reduce((s, g) => s + (parseFloat(g.current_amount) || 0), 0);
      const goals = nonDeleted.slice(0, 5).map((g) => {
        const current = parseFloat(g.current_amount) || 0;
        const target = parseFloat(g.target_amount) || 0;
        return {
          title: g.title,
          current,
          target,
          pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
          deadline: g.target_date,
          achieved: !!g.is_completed,
        };
      });

      // Budget split rules (needs/wants/savings)
      let budgetRules = { needs: 50, wants: 30, savings: 20 };
      try {
        const { data: rules } = await supabase
          .from('budgets_custom_mode')
          .select('needs_pct, wants_pct, savings_pct')
          .eq('user_id', userId)
          .maybeSingle();
        if (rules) {
          budgetRules = { needs: rules.needs_pct, wants: rules.wants_pct, savings: rules.savings_pct };
        }
      } catch (_) { /* keep default split */ }

      setSavings({
        totalSaved,
        monthlyDeposits,
        monthlyWithdrawals,
        monthlySaved: monthlyDeposits - monthlyWithdrawals,
        walletCount: liveAccountIds.size,
        goalsActive,
        goalsAchieved,
        goalsTotalAllocated,
        goals,
        budgetRules,
      });
    } catch (err) {
      console.warn('loadSavingsSnapshot warning:', err?.message || err);
    }
  };

  // Load data from Supabase
  // Options:
  //   deferInsights: true  →  load budget/expenses/notes immediately,
  //                           schedule slow NVIDIA AI insight generation in background.
  //                           Used during login so the UI renders fast.
  const loadData = async ({ deferInsights = false } = {}) => {
    try {
      const userId = userInfo?.id || null;
      if (!userId) {
        console.log('loadData skipped: User not authenticated');
        return;
      }

      console.log('Loading data for user ID:', userId, deferInsights ? '(insights deferred)' : '');

      // Load budget data with explicit user scoping
      let budgetData = null;
      let budgetCategories = [];
      try {
        const { data, error: budgetError } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (budgetError && budgetError.code !== 'PGRST116') {
          console.warn('Budget load warning:', budgetError?.message || budgetError);
        } else {
          budgetData = data;
        }
      } catch (budgetErr) {
        console.warn('Budget load warning:', budgetErr?.message || budgetErr);
      }

      // Load budget categories separately if budget exists
      if (budgetData) {
        try {
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('budget_categories')
            .select('*')
            .eq('budget_id', budgetData.id);
          
          if (!categoriesError) {
            budgetCategories = categoriesData || [];
          }
        } catch (catError) {
          console.log('Budget categories table not found, using defaults');
        }
      }

      // Load expenses with explicit user scoping
      let expensesData = [];
      try {
        const { data, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .eq('app_mode', 'custom')
          .order('date', { ascending: false })
          .range(0, 9999);

        if (expensesError) {
          console.warn('Expenses load warning:', expensesError?.message || expensesError);
        } else {
          expensesData = data || [];
        }
      } catch (expErr) {
        console.warn('Expenses load warning:', expErr?.message || expErr);
      }

      // Load notes with explicit user scoping
      let notesData = [];
      try {
        const { data, error: notesError } = await supabase
          .from('notes')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (notesError) {
          console.warn('Notes load warning:', notesError?.message || notesError);
        } else {
          notesData = data || [];
        }
      } catch (notesErr) {
        console.warn('Notes load warning:', notesErr?.message || notesErr);
      }

      // Load custom mode goals to resync notifications
      try {
        const { data: goalsData, error: goalsError } = await supabase
          .from('goals_custom_mode')
          .select('*')
          .eq('user_id', userId);
        
        if (!goalsError && goalsData) {
          goalNotificationService.resyncAllGoalNotifications(goalsData);
        }
      } catch (goalErr) {
        console.warn('Goals resync warning:', goalErr?.message || goalErr);
      }

      console.log('Data loaded successfully:', {
        budget: budgetData ? 'found' : 'not found',
        expenses: expensesData?.length || 0,
        notes: notesData?.length || 0
      });

      // Transform budget data to match app structure
      const transformedBudget = budgetData ? {
        monthly: budgetData.monthly || 0,
        weekly: budgetData.weekly || 0,
        categories: {
          food: { limit: 0, spent: 0 },
          transportation: { limit: 0, spent: 0 },
          entertainment: { limit: 0, spent: 0 },
          shopping: { limit: 0, spent: 0 },
          utilities: { limit: 0, spent: 0 },
          others: { limit: 0, spent: 0 }
        }
      } : defaultBudget;

      // Update category limits and spent amounts
      if (budgetCategories?.length > 0) {
        budgetCategories.forEach(category => {
          if (transformedBudget.categories[category.category_name.toLowerCase()]) {
            transformedBudget.categories[category.category_name.toLowerCase()] = {
              limit: category.allocated_amount || 0,
              spent: category.spent_amount || 0
            };
          }
        });
      }

      setBudget(transformedBudget);
      setExpenses(expensesData || []);
      setNotes(notesData || []);

      // Refresh the savings/goals snapshot alongside the rest (fire-and-forget
      // so it never blocks the main UI render). Keeps Koin's "Total Saved" in
      // sync after logins and expense/budget changes.
      loadSavingsSnapshot(userId).catch((e) => console.warn('Savings snapshot warning:', e?.message || e));

      // ── AI insight generation (uses closure-captured data, not stale state) ──
      const runInsightGeneration = async () => {
        if (expensesData?.length > 0) {
          try {
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            const currentMonthExpenses = expensesData.filter(exp => {
              const expDate = new Date(exp.date);
              return expDate >= monthStart && expDate <= monthEnd;
            });

            const aiInsights = await analyzeExpenses(currentMonthExpenses, transformedBudget);
            const recommendations = await getRecommendations(userInfo, currentMonthExpenses, transformedBudget);
            setInsights([...aiInsights, ...recommendations]);
            console.log('AI insights generated:', aiInsights.length + recommendations.length);
          } catch (insightError) {
            console.error('Error generating AI insights:', insightError);
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            const currentMonthExpenses = expensesData.filter(exp => {
              const expDate = new Date(exp.date);
              return expDate >= monthStart && expDate <= monthEnd;
            });

            const basicInsights = generateBasicInsights(currentMonthExpenses, transformedBudget);
            setInsights(basicInsights);
          }
        } else {
          setInsights([{
            id: 'welcome',
            type: 'info',
            title: 'Welcome to GaFI',
            message: 'Start tracking your expenses to get AI-powered insights!',
            icon: 'bulb-outline',
            color: '#4CAF50'
          }]);
        }
      };

      if (deferInsights) {
        // Login path: let the UI render immediately, generate insights in background
        console.log('Deferring AI insight generation to background...');
        setTimeout(() => {
          runInsightGeneration().catch(e => console.error('Deferred insight generation error:', e));
        }, 800);
      } else {
        // Normal path (expense added, refresh, etc.): generate insights inline
        await runInsightGeneration();
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    }
  };

  // Add a new expense
  // normalizeCategory is imported from ../utils/categoryUtils

  const addExpense = async (expense) => {
    try {
      if (!userInfo?.id) {
        setError('Session not ready. Please try again.');
        return false;
      }

      const session = await ensureAuthenticated();
      const userId = session.user.id;
      const appMode = expense.appMode === 'story' ? 'story' : 'custom';

      console.log('Adding expense for user:', userId, expense);

      // Normalize category before processing
      const normalizedCategory = normalizeCategory(expense.category);

      // Use the enhanced BudgetDatabaseService for expense recording
      const budgetService = new BudgetDatabaseService();
      
      // Prepare transaction data object as expected by recordExpense
      const transactionData = {
        amount: parseFloat(expense.amount),
        category: normalizedCategory,
        description: expense.note || null,
        date: expense.date || null, // Pass the selected date or null for current time
        sub_category: expense.sub_category || null, // Sub-category for granular tracking
        naturalLanguageInput: null, // null for manual entries
        confidence: null,  // null for manual entries
        app_mode: appMode
      };
      
      const result = await budgetService.recordExpense(userId, transactionData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to record expense');
      }

      console.log('Expense recorded successfully:', result);

      // ── Check budget thresholds for notification alerts (custom mode only) ──
      if (appMode === 'custom') {
        try {
          await notificationService.checkBudgetThresholds(
            budget,
            parseFloat(expense.amount),
            normalizedCategory
          );
        } catch (alertError) {
          console.warn('Budget alert check failed (non-critical):', alertError);
        }
      }

      // Refresh local state by reloading all data (defer AI insights to avoid blocking)
      await loadData({ deferInsights: true });

      return true;
    } catch (error) {
      console.error('Error adding expense:', error);
      setError(error.message);
      return false;
    }
  };

  // Delete an expense
  const deleteExpense = async (expenseId) => {
    try {
      const session = await ensureAuthenticated();
      const userId = session.user.id;

      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) return false;

      console.log('Deleting expense for user:', userId, expenseId);

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('user_id', userId); // Ensure user can only delete their own expenses

      if (error) {
        console.error('Error deleting expense:', error);
        throw error;
      }

      // Update local state
      setExpenses(prev => prev.filter(e => e.id !== expenseId));

      // Update category spent amount
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!budgetError && budgetData) {
        // Normalize category before querying
        const normalizedCategory = normalizeCategory(expense.category);
        
        const { data: categoryData, error: categoryError } = await supabase
          .from('budget_categories')
          .select('*')
          .eq('budget_id', budgetData.id)
          .eq('category_name', normalizedCategory) // Use normalized category
          .single();

        if (!categoryError && categoryData) {
          await supabase
            .from('budget_categories')
            .update({
              spent_amount: Math.max(0, (categoryData.spent_amount || 0) - parseFloat(expense.amount))
            })
            .eq('id', categoryData.id);

          // Update local budget state
          setBudget(prev => ({
            ...prev,
            categories: {
              ...prev.categories,
              [normalizedCategory]: { // Use normalized category
                ...prev.categories[normalizedCategory],
                spent: Math.max(0, prev.categories[normalizedCategory].spent - parseFloat(expense.amount))
              }
            }
          }));
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      setError(error.message);
      return false;
    }
  };

  // Add a new note
  const addNote = async (note) => {
    try {
      const session = await ensureAuthenticated();
      const userId = session.user.id;

      console.log('Adding note for user:', userId, note);

      const { data, error } = await supabase
        .from('notes')
        .insert([{
          user_id: userId,
          title: note.title,
          content: note.content
        }])
        .select()
        .single();

      if (error) {
        console.error('Error adding note:', error);
        throw error;
      }

      setNotes(prev => [data, ...prev]);
      return true;
    } catch (error) {
      console.error('Error adding note:', error);
      setError(error.message);
      return false;
    }
  };

  // Delete a note
  const deleteNote = async (noteId) => {
    try {
      const session = await ensureAuthenticated();
      const userId = session.user.id;

      console.log('Deleting note for user:', userId, noteId);

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', userId); // Ensure user can only delete their own notes

      if (error) {
        console.error('Error deleting note:', error);
        throw error;
      }

      setNotes(prev => prev.filter(note => note.id !== noteId));
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      setError(error.message);
      return false;
    }
  };

  // Edit a note
  const editNote = async (noteId, updatedNote) => {
    try {
      const session = await ensureAuthenticated();
      const userId = session.user.id;

      console.log('Updating note for user:', userId, noteId);

      const { error } = await supabase
        .from('notes')
        .update({
          title: updatedNote.title,
          content: updatedNote.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
        .eq('user_id', userId); // Ensure user can only edit their own notes

      if (error) {
        console.error('Error updating note:', error);
        throw error;
      }

      setNotes(prev => prev.map(note =>
        note.id === noteId ? { ...note, ...updatedNote } : note
      ));
      return true;
    } catch (error) {
      console.error('Error editing note:', error);
      setError(error.message);
      return false;
    }
  };

  // Update budget settings
  const updateBudget = async (newBudget) => {
    try {
      // Use the userId passed from the caller (e.g. onboarding) if available,
      // otherwise fall back to the current session.
      let userId = newBudget.userId || userInfo?.id || null;

      if (!userId) {
        console.warn('updateBudget: No authenticated user, falling back to local state');
        setBudget(newBudget);
        return true;
      }

      console.log('Updating budget for user:', userId, newBudget);

      // Use the enhanced BudgetDatabaseService for budget creation/update
      const budgetService = new BudgetDatabaseService();
      
      // Check if user already has a budget
      const { data: existingBudget, error: existingBudgetError } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingBudgetError && existingBudgetError.code !== 'PGRST116') {
        console.error('Error checking existing budget:', existingBudgetError);
        // Fallback to local state update
        setBudget(newBudget);
        return true;
      }

      if (existingBudget) {
        // Update existing budget
        const { data, error: updateError } = await supabase
          .from('budgets')
          .update({
            monthly: newBudget.monthly,
            weekly: newBudget.weekly
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating existing budget:', updateError);
          setBudget(newBudget);
          return true;
        }

        // Update budget categories with user's allocation
        if (newBudget.categories) {
          for (const [category, values] of Object.entries(newBudget.categories)) {
            const normalizedCategory = normalizeCategory(category);
            
            // First try to update existing category
            const { data: existingCategory, error: checkError } = await supabase
              .from('budget_categories')
              .select('id')
              .eq('budget_id', data.id)
              .eq('category_name', normalizedCategory)
              .maybeSingle();

            if (existingCategory) {
              // Update existing category
              const { error: catUpdateError } = await supabase
                .from('budget_categories')
                .update({
                  allocated_amount: values.limit,
                  spent_amount: budget.categories[normalizedCategory]?.spent || 0
                })
                .eq('id', existingCategory.id);

              if (catUpdateError) {
                console.error('Error updating budget category:', catUpdateError);
              }
            } else {
              // Insert new category
              const { error: insertError } = await supabase
                .from('budget_categories')
                .insert({
                  budget_id: data.id,
                  category_name: normalizedCategory,
                  allocated_amount: values.limit,
                  spent_amount: budget.categories[normalizedCategory]?.spent || 0
                });

              if (insertError) {
                console.error('Error inserting budget category:', insertError);
              }
            }
          }
        }
      } else {
        // Create new budget using the enhanced service
        const result = await budgetService.createDefaultBudget(userId, newBudget.monthly);
        if (!result.success) {
          console.warn('createDefaultBudget returned failure, falling back to local state:', result.error);
          // Don't throw — fall through to local state update
        }
      }

      // Update local state
      setBudget(newBudget);
      return true;
    } catch (error) {
      console.error('Error updating budget:', error);
      // Always update local state as fallback — never trigger logout
      setBudget(newBudget);
      return true;
    }
  };

  // Get expenses for a date range
  const getExpensesByDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) return [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= start && expenseDate <= end;
    });
  };

  // Calculate total expenses
  const calculateTotalExpenses = (expenseList = expenses) => {
    return expenseList.reduce((total, expense) => total + parseFloat(expense.amount), 0);
  };

  // Generate insights from expenses data - FOCUS ON CURRENT MONTH
  const generateInsights = () => {
    if (!expenses || expenses.length === 0) {
      return [
        {
          id: 1,
          type: 'info',
          title: 'Welcome to GaFI',
          message: 'Start tracking your expenses to get personalized insights.',
          icon: '📊'
        }
      ];
    }

    const insights = [];
    
    // Filter to current month only
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const currentMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate >= monthStart && expenseDate <= monthEnd;
    });

    if (currentMonthExpenses.length === 0) {
      return [
        {
          id: 1,
          type: 'info',
          title: 'No expenses this month',
          message: 'Start tracking your expenses this month to get personalized insights.',
          icon: 'calendar-outline',
          color: '#2196F3'
        }
      ];
    }
    
    // Calculate spending by category for CURRENT MONTH
    const categorySpending = {};
    currentMonthExpenses.forEach(expense => {
      const category = normalizeCategory(expense.category);
      categorySpending[category] = (categorySpending[category] || 0) + parseFloat(expense.amount);
    });

    // Find top spending category for current month
    const topCategory = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory) {
      insights.push({
        id: insights.length + 1,
        type: 'warning',
        title: 'Top Spending Category This Month',
        message: `You've spent ₱${topCategory[1].toFixed(2)} on ${topCategory[0]} this month.`,
        icon: 'trending-up-outline',
        color: '#FF9800'
      });
    }

    // Budget warnings
    Object.entries(budget.categories).forEach(([category, data]) => {
      if (data.limit > 0 && data.spent >= data.limit * 0.8) {
        insights.push({
          id: insights.length + 1,
          type: data.spent >= data.limit ? 'error' : 'warning',
          title: `${category.charAt(0).toUpperCase() + category.slice(1)} Budget Alert`,
          message: data.spent >= data.limit 
            ? `You've exceeded your ${category} budget by ₱${(data.spent - data.limit).toFixed(2)} this month`
            : `You've used ${((data.spent / data.limit) * 100).toFixed(1)}% of your ${category} budget this month`,
          icon: data.spent >= data.limit ? 'alert-circle-outline' : 'warning-outline',
          color: data.spent >= data.limit ? '#F44336' : '#FF9800'
        });
      }
    });

    // Recent spending trend (last 3 days of current month)
    const recentExpenses = currentMonthExpenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        return expenseDate >= threeDaysAgo;
      });

    if (recentExpenses.length > 5) {
      const recentTotal = calculateTotalExpenses(recentExpenses);
      insights.push({
        id: insights.length + 1,
        type: 'info',
        title: 'Recent Activity',
        message: `You've spent ₱${recentTotal.toFixed(2)} in the last 3 days across ${recentExpenses.length} transactions.`,
        icon: 'stats-chart-outline',
        color: '#2196F3'
      });
    }

    return insights.length > 0 ? insights : [
      {
        id: 1,
        type: 'success',
        title: 'Great Job!',
        message: 'Your spending looks healthy. Keep up the good work!',
        icon: 'checkmark-circle-outline',
        color: '#4CAF50'
      }
    ];
  };

  // Generate basic insights as fallback when AI fails
  const generateBasicInsights = (expensesData, budgetData) => {
    const insights = [];
    const totalSpent = expensesData.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    // Category analysis
    const categorySpending = {};
    expensesData.forEach(expense => {
      const cat = normalizeCategory(expense.category);
      categorySpending[cat] = (categorySpending[cat] || 0) + parseFloat(expense.amount);
    });

    const topCategory = Object.entries(categorySpending).sort(([,a], [,b]) => b - a)[0];
    
    if (topCategory) {
      insights.push({
        id: 'top-spending',
        type: 'info',
        title: 'Top Spending Category',
        message: `You spent most on ${topCategory[0]}: ₱${topCategory[1].toLocaleString()}`,
        icon: 'trending-up-outline',
        color: '#FF9800'
      });
    }

    // Budget analysis
    if (budgetData?.monthly > 0) {
      const percentage = (totalSpent / budgetData.monthly) * 100;
      if (percentage > 80) {
        insights.push({
          id: 'budget-alert',
          type: 'warning',
          title: 'Budget Alert',
          message: `You've used ${percentage.toFixed(0)}% of your monthly budget`,
          icon: 'warning-outline',
          color: '#F44336'
        });
      } else {
        insights.push({
          id: 'budget-good',
          type: 'success',
          title: 'On Track',
          message: `${(100 - percentage).toFixed(0)}% of budget remaining`,
          icon: 'checkmark-circle-outline',
          color: '#4CAF50'
        });
      }
    }

    // Add a tip
    insights.push({
      id: 'tip',
      type: 'info',
      title: 'Saving Tip',
      message: 'Try cooking meals at home to save ₱500+ monthly',
      icon: 'bulb-outline',
      color: '#2196F3'
    });

    return insights;
  };

  return (
    <DataContext.Provider 
      value={{
        budget,
        expenses,
        notes,
        insights,
        savings,
        refreshSavings: loadSavingsSnapshot,
        addExpense,
        deleteExpense,
        updateBudget,
        getExpensesByDateRange,
        calculateTotalExpenses,
        generateInsights,
        addNote,
        deleteNote,
        editNote,
        loadData,
        isLoading,
        error
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

// Custom hook to use DataContext
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};