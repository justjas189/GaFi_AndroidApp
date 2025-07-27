import { useMemo, useCallback, useState, useEffect } from 'react';

/**
 * Custom hooks for performance optimization
 */

// Memoized expense calculations
export const useExpenseCalculations = (expenses, budget) => {
  return useMemo(() => {
    if (!expenses || expenses.length === 0) {
      return {
        totalSpent: 0,
        categorySpending: {},
        monthlySpent: 0,
        remainingBudget: budget?.monthly || 0,
        spendingTrend: []
      };
    }

    const totalSpent = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
    
    const categorySpending = expenses.reduce((acc, expense) => {
      const category = expense.category || 'others';
      acc[category] = (acc[category] || 0) + parseFloat(expense.amount || 0);
      return acc;
    }, {});

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlySpent = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
      })
      .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);

    const remainingBudget = (budget?.monthly || 0) - monthlySpent;

    // Calculate spending trend for last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const spendingTrend = last7Days.map(date => {
      const daySpending = expenses
        .filter(expense => expense.date.startsWith(date))
        .reduce((sum, expense) => sum + parseFloat(expense.amount || 0), 0);
      return { date, amount: daySpending };
    });

    return {
      totalSpent,
      categorySpending,
      monthlySpent,
      remainingBudget,
      spendingTrend
    };
  }, [expenses, budget]);
};

// Memoized category suggestions
export const useCategorysuggestions = (expenses) => {
  return useMemo(() => {
    if (!expenses || expenses.length === 0) return [];

    const categoryFrequency = expenses.reduce((acc, expense) => {
      const category = expense.category || 'others';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(categoryFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category);
  }, [expenses]);
};

// Debounced search hook
export const useDebouncedSearch = (searchTerm, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(searchTerm);
    }, delay);

    return () => clearTimeout(handler);
  }, [searchTerm, delay]);

  return debouncedValue;
};

// Optimized expense filtering
export const useFilteredExpenses = (expenses, filters) => {
  return useMemo(() => {
    if (!expenses || expenses.length === 0) return [];

    return expenses.filter(expense => {
      // Date filter
      if (filters.startDate && expense.date < filters.startDate) return false;
      if (filters.endDate && expense.date > filters.endDate) return false;
      
      // Category filter
      if (filters.category && expense.category !== filters.category) return false;
      
      // Amount range filter
      if (filters.minAmount && parseFloat(expense.amount) < filters.minAmount) return false;
      if (filters.maxAmount && parseFloat(expense.amount) > filters.maxAmount) return false;
      
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesNote = expense.note?.toLowerCase().includes(searchLower);
        const matchesCategory = expense.category?.toLowerCase().includes(searchLower);
        const matchesAmount = expense.amount?.toString().includes(filters.searchTerm);
        
        if (!matchesNote && !matchesCategory && !matchesAmount) return false;
      }

      return true;
    });
  }, [expenses, filters]);
};

// Memoized budget status calculations
export const useBudgetStatus = (expenses, budget) => {
  return useMemo(() => {
    const categorySpending = expenses.reduce((acc, expense) => {
      const category = expense.category || 'others';
      acc[category] = (acc[category] || 0) + parseFloat(expense.amount || 0);
      return acc;
    }, {});

    const categoryStatus = {};
    
    if (budget?.categories) {
      Object.keys(budget.categories).forEach(category => {
        const spent = categorySpending[category] || 0;
        const limit = budget.categories[category]?.limit || 0;
        const percentage = limit > 0 ? (spent / limit) * 100 : 0;
        
        categoryStatus[category] = {
          spent,
          limit,
          remaining: Math.max(0, limit - spent),
          percentage,
          status: percentage >= 100 ? 'over' : percentage >= 80 ? 'warning' : 'safe'
        };
      });
    }

    return {
      categorySpending,
      categoryStatus,
      totalSpent: Object.values(categorySpending).reduce((sum, amount) => sum + amount, 0),
      totalBudget: budget?.monthly || 0
    };
  }, [expenses, budget]);
};

// Async operation hook with loading states
export const useAsyncOperation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (operation) => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation();
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, execute };
};
