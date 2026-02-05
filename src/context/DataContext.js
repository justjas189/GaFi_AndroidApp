// context/DataContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './ThemeContext';
import { supabase } from '../config/supabase';
import { analyzeExpenses, getRecommendations } from '../config/nvidia';
import { BudgetDatabaseService } from '../services/BudgetDatabaseService_NEW';

export const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const { theme } = useContext(ThemeContext);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState([]);
  const defaultBudget = {
    monthly: 0,
    weekly: 0,
    savingsGoal: 0,
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

  // Helper function to get current user ID
  const getCurrentUserId = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('No authenticated user');
    return session.user.id;
  };

  // Helper function to ensure user is authenticated
  const ensureAuthenticated = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) throw new Error('User not authenticated');
    return session;
  };

  // Initialize data context
  useEffect(() => {
    let expenseSubscription = null;
    let budgetSubscription = null;

    const initializeData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          console.log('No authenticated user found');
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        console.log('Loading data for user:', session.user.id);
        await loadData();
        setIsInitialized(true);

        // Set up real-time subscriptions for expenses
        expenseSubscription = supabase
          .channel('expenses_changes')
          .on('postgres_changes', {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'expenses',
            filter: `user_id=eq.${session.user.id}`
          }, async (payload) => {
            console.log('Real-time expense change detected:', payload);
            // Reload data and regenerate insights when expenses change
            await loadData();
          })
          .subscribe();

        // Set up real-time subscriptions for budget changes
        budgetSubscription = supabase
          .channel('budget_changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'budgets',
            filter: `user_id=eq.${session.user.id}`
          }, async (payload) => {
            console.log('Real-time budget change detected:', payload);
            await loadData();
          })
          .subscribe();

      } catch (error) {
        console.error('Error initializing data context:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();

    // Set up auth state listener to reload data when user changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('User signed in, reloading data for:', session.user.id);
        await loadData();
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, clearing data');
        setBudget(defaultBudget);
        setExpenses([]);
        setNotes([]);
        setInsights([]);
        
        // Clean up real-time subscriptions
        if (expenseSubscription) {
          expenseSubscription.unsubscribe();
          expenseSubscription = null;
        }
        if (budgetSubscription) {
          budgetSubscription.unsubscribe();
          budgetSubscription = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (expenseSubscription) {
        expenseSubscription.unsubscribe();
      }
      if (budgetSubscription) {
        budgetSubscription.unsubscribe();
      }
    };
  }, []);

  // Load data from Supabase
  const loadData = async () => {
    try {
      const session = await ensureAuthenticated();
      const userId = session.user.id;

      console.log('Loading data for user ID:', userId);

      // Load budget data with explicit user scoping
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (budgetError && budgetError.code !== 'PGRST116') {
        console.error('Budget load error:', budgetError);
        throw budgetError;
      }

      // Load budget categories separately if budget exists
      let budgetCategories = [];
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

      if (budgetError && budgetError.code !== 'PGRST116') {
        console.error('Budget load error:', budgetError);
        throw budgetError;
      }

      // Load expenses with explicit user scoping
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (expensesError) {
        console.error('Expenses load error:', expensesError);
        throw expensesError;
      }

      // Load notes with explicit user scoping
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.error('Notes load error:', notesError);
        throw notesError;
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
        savingsGoal: budgetData.savings_goal || 0,
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

      // Generate AI insights using Nvidia Llama - FILTER TO CURRENT MONTH
      if (expensesData?.length > 0) {
        try {
          // Filter expenses to current month only for AI analysis
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          monthStart.setHours(0, 0, 0, 0);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          
          const currentMonthExpenses = expensesData.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= monthStart && expDate <= monthEnd;
          });

          // Generate insights based on current month data only
          const insights = await analyzeExpenses(currentMonthExpenses, transformedBudget);
          const recommendations = await getRecommendations(session.user, currentMonthExpenses, transformedBudget);
          setInsights([...insights, ...recommendations]);
          console.log('AI insights generated successfully for current month:', insights.length + recommendations.length, 'insights');
        } catch (insightError) {
          console.error('Error generating AI insights:', insightError);
          // Fall back to basic insights if AI fails
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
        // No expenses yet - show welcome insights
        setInsights([{
          id: 'welcome',
          type: 'info',
          title: 'Welcome to GaFI',
          message: 'Start tracking your expenses to get AI-powered insights!',
          icon: 'bulb-outline',
          color: '#4CAF50'
        }]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    }
  };

  // Add a new expense
  // Helper function to normalize category names
  const normalizeCategory = (category) => {
    if (!category) return 'others';
    
    const normalized = category.toLowerCase().trim();
    
    const categoryMap = {
      'groceries': 'food',
      'dining': 'food',
      'restaurant': 'food',
      'meals': 'food',
      'fuel': 'transportation',
      'gas': 'transportation',
      'commute': 'transportation',
      'transport': 'transportation',
      'movies': 'entertainment',
      'cinema': 'entertainment',
      'games': 'entertainment',
      'gaming': 'entertainment',
      'hobby': 'entertainment',
      'clothes': 'shopping',
      'clothing': 'shopping',
      'gadgets': 'shopping',
      'electronics': 'shopping',
      'bills': 'utilities',
      'electricity': 'utilities',
      'water': 'utilities',
      'internet': 'utilities',
      'phone': 'utilities',
      'miscellaneous': 'others',
      'misc': 'others',
      'other': 'others'
    };
    
    const mappedCategory = categoryMap[normalized] || normalized;
    const allowedCategories = ['food', 'transportation', 'entertainment', 'shopping', 'utilities', 'others'];
    
    return allowedCategories.includes(mappedCategory) ? mappedCategory : 'others';
  };

  const addExpense = async (expense) => {
    try {
      const session = await ensureAuthenticated();
      const userId = session.user.id;

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
        naturalLanguageInput: null, // null for manual entries
        confidence: null  // null for manual entries
      };
      
      const result = await budgetService.recordExpense(userId, transactionData);

      if (!result.success) {
        throw new Error(result.error || 'Failed to record expense');
      }

      console.log('Expense recorded successfully:', result);

      // Refresh local state by reloading all data
      await loadData();

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
      const session = await ensureAuthenticated();
      const userId = session.user.id;

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
            weekly: newBudget.weekly,
            savings_goal: newBudget.savingsGoal
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
            const { error: updateError } = await supabase
              .from('budget_categories')
              .update({
                allocated_amount: values.limit,
                spent_amount: budget.categories[normalizedCategory]?.spent || 0
              })
              .eq('id', existingCategory.id);

            if (updateError) {
              console.error('Error updating budget category:', updateError);
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
      } else {
        // Create new budget using the enhanced service
        await budgetService.createDefaultBudget(userId, newBudget.monthly, newBudget.savingsGoal);
      }

      // Update local state
      setBudget(newBudget);
      return true;
    } catch (error) {
      console.error('Error updating budget:', error);
      // Always update local state as fallback
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
      const category = expense.category.toLowerCase();
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
      const cat = expense.category.toLowerCase();
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