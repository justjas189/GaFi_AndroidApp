// context/DataContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from './ThemeContext';
import { supabase } from '../config/supabase';
import { analyzeExpenses, getRecommendations } from '../config/deepseek';

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

  // Initialize data context
  useEffect(() => {
    const initializeData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        await loadData();
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing data context:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Load data from Supabase
  const loadData = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (!session) {
        console.log('No authentication found, skipping data load');
        return;
      }

      const userId = session.user.id;

      // Load budget data
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_categories (*)
        `)
        .eq('user_id', userId)
        .single();

      if (budgetError && budgetError.code !== 'PGRST116') {
        throw budgetError;
      }

      // Load expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (expensesError) throw expensesError;

      // Load notes
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

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
      if (budgetData?.budget_categories) {
        budgetData.budget_categories.forEach(category => {
          if (transformedBudget.categories[category.category.toLowerCase()]) {
            transformedBudget.categories[category.category.toLowerCase()] = {
              limit: category.limit_amount || 0,
              spent: category.spent_amount || 0
            };
          }
        });
      }

      setBudget(transformedBudget);
      setExpenses(expensesData || []);
      setNotes(notesData || []);

      // Generate AI insights using Deepseek
      if (expensesData?.length > 0) {
        const insights = await analyzeExpenses(expensesData);
        const recommendations = await getRecommendations(session.user, expensesData);
        setInsights([...insights, ...recommendations]);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    }
  };

  // Add a new expense
  const addExpense = async (expense) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          user_id: session.user.id,
          amount: expense.amount,
          category: expense.category,
          note: expense.note,
          date: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setExpenses(prev => [data, ...prev]);

      // Update category spent amount in budget_categories
      const { data: categoryData, error: categoryError } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('category', expense.category.toLowerCase())
        .single();

      if (!categoryError) {
        await supabase
          .from('budget_categories')
          .update({
            spent_amount: (categoryData.spent_amount || 0) + parseFloat(expense.amount)
          })
          .eq('id', categoryData.id);

        // Update local budget state
        setBudget(prev => ({
          ...prev,
          categories: {
            ...prev.categories,
            [expense.category.toLowerCase()]: {
              ...prev.categories[expense.category.toLowerCase()],
              spent: prev.categories[expense.category.toLowerCase()].spent + parseFloat(expense.amount)
            }
          }
        }));
      }

      return true;
    } catch (error) {
      console.error('Error adding expense:', error);
      return false;
    }
  };

  // Delete an expense
  const deleteExpense = async (expenseId) => {
    try {
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) return false;

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      // Update local state
      setExpenses(prev => prev.filter(e => e.id !== expenseId));

      // Update category spent amount
      const { data: categoryData, error: categoryError } = await supabase
        .from('budget_categories')
        .select('*')
        .eq('category', expense.category.toLowerCase())
        .single();

      if (!categoryError) {
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
            [expense.category.toLowerCase()]: {
              ...prev.categories[expense.category.toLowerCase()],
              spent: Math.max(0, prev.categories[expense.category.toLowerCase()].spent - parseFloat(expense.amount))
            }
          }
        }));
      }

      return true;
    } catch (error) {
      console.error('Error deleting expense:', error);
      return false;
    }
  };

  // Add a new note
  const addNote = async (note) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('notes')
        .insert([{
          user_id: session.user.id,
          title: note.title,
          content: note.content
        }])
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      return true;
    } catch (error) {
      console.error('Error adding note:', error);
      return false;
    }
  };

  // Delete a note
  const deleteNote = async (noteId) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNotes(prev => prev.filter(note => note.id !== noteId));
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  };

  // Edit a note
  const editNote = async (noteId, updatedNote) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          title: updatedNote.title,
          content: updatedNote.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId);

      if (error) throw error;

      setNotes(prev => prev.map(note =>
        note.id === noteId ? { ...note, ...updatedNote } : note
      ));
      return true;
    } catch (error) {
      console.error('Error editing note:', error);
      return false;
    }
  };

  // Update budget settings
  const updateBudget = async (newBudget) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authenticated user');

      // Update or create budget
      const { data: budgetData, error: budgetError } = await supabase
        .from('budgets')
        .upsert({
          user_id: session.user.id,
          monthly: newBudget.monthly,
          weekly: newBudget.weekly,
          savings_goal: newBudget.savingsGoal
        })
        .select()
        .single();

      if (budgetError) throw budgetError;

      // Update budget categories
      for (const [category, values] of Object.entries(newBudget.categories)) {
        const { error: categoryError } = await supabase
          .from('budget_categories')
          .upsert({
            budget_id: budgetData.id,
            category: category.toLowerCase(),
            limit_amount: values.limit,
            spent_amount: budget.categories[category].spent // Preserve existing spent amount
          });

        if (categoryError) throw categoryError;
      }

      setBudget(newBudget);
      return true;
    } catch (error) {
      console.error('Error updating budget:', error);
      return false;
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