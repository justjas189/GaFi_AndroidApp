/**
 * BudgetService - Manages user budgets, categories, and alerts
 */

import { supabase } from '../config/supabase';

export class BudgetService {
  /**
   * Get current user ID from Supabase auth
   */
  static async getCurrentUserId() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  /**
   * Get user's budget
   */
  static async getUserBudget() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          budget_categories (*)
        `)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting user budget:', error);
      return null;
    }
  }

  /**
   * Create or update user budget
   */
  static async createOrUpdateBudget(budgetData) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const existingBudget = await this.getUserBudget();

      if (existingBudget) {
        // Update existing budget
        const { data, error } = await supabase
          .from('budgets')
          .update({
            total_budget: budgetData.totalBudget,
            savings_goal: budgetData.savingsGoal,
            monthly: budgetData.monthly,
            weekly: budgetData.weekly,
            budget_period: budgetData.budgetPeriod || 'monthly',
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new budget
        const { data, error } = await supabase
          .from('budgets')
          .insert({
            user_id: userId,
            total_budget: budgetData.totalBudget,
            savings_goal: budgetData.savingsGoal,
            monthly: budgetData.monthly,
            weekly: budgetData.weekly,
            budget_period: budgetData.budgetPeriod || 'monthly',
            currency: 'PHP'
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error creating/updating budget:', error);
      throw error;
    }
  }

  /**
   * Add or update budget category
   */
  static async addBudgetCategory(categoryName, allocatedAmount) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const budget = await this.getUserBudget();
      if (!budget) throw new Error('No budget found. Create a budget first.');

      // Check if category already exists
      const existingCategory = budget.budget_categories?.find(
        cat => cat.category_name.toLowerCase() === categoryName.toLowerCase()
      );

      if (existingCategory) {
        // Update existing category
        const { data, error } = await supabase
          .from('budget_categories')
          .update({
            allocated_amount: allocatedAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCategory.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new category
        const { data, error } = await supabase
          .from('budget_categories')
          .insert({
            budget_id: budget.id,
            category_name: categoryName,
            allocated_amount: allocatedAmount
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error adding budget category:', error);
      throw error;
    }
  }

  /**
   * Update category spending
   */
  static async updateCategorySpending(categoryName, spentAmount) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const budget = await this.getUserBudget();
      if (!budget) return;

      const category = budget.budget_categories?.find(
        cat => cat.category_name.toLowerCase() === categoryName.toLowerCase()
      );

      if (category) {
        const newSpentAmount = parseFloat(category.spent_amount) + parseFloat(spentAmount);
        
        const { error } = await supabase
          .from('budget_categories')
          .update({
            spent_amount: newSpentAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', category.id);

        if (error) throw error;

        // Check for budget alerts
        await this.checkBudgetAlerts(category, newSpentAmount);
      }
    } catch (error) {
      console.error('Error updating category spending:', error);
    }
  }

  /**
   * Check and trigger budget alerts
   */
  static async checkBudgetAlerts(category, newSpentAmount) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      const percentage = (newSpentAmount / category.allocated_amount) * 100;
      
      // Check for active alerts for this category
      const { data: alerts } = await supabase
        .from('budget_alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category.category_name)
        .eq('is_active', true);

      for (const alert of alerts || []) {
        if (percentage >= alert.threshold_percentage && !alert.triggered_at) {
          // Trigger alert
          await supabase
            .from('budget_alerts')
            .update({
              triggered_at: new Date().toISOString(),
              message: `You've spent ${percentage.toFixed(1)}% of your ${category.category_name} budget!`
            })
            .eq('id', alert.id);
        }
      }
    } catch (error) {
      console.error('Error checking budget alerts:', error);
    }
  }

  /**
   * Create budget alert
   */
  static async createBudgetAlert(alertData) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const budget = await this.getUserBudget();
      if (!budget) throw new Error('No budget found');

      const { data, error } = await supabase
        .from('budget_alerts')
        .insert({
          user_id: userId,
          budget_id: budget.id,
          alert_type: alertData.alertType,
          category: alertData.category,
          threshold_percentage: alertData.thresholdPercentage || 80,
          amount: alertData.amount,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating budget alert:', error);
      throw error;
    }
  }

  /**
   * Get budget alerts
   */
  static async getBudgetAlerts() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('budget_alerts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting budget alerts:', error);
      return [];
    }
  }

  /**
   * Get budget summary and analytics
   */
  static async getBudgetSummary() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return null;

      const budget = await this.getUserBudget();
      if (!budget) return null;

      // Calculate totals
      const totalAllocated = budget.budget_categories?.reduce(
        (sum, cat) => sum + parseFloat(cat.allocated_amount), 0
      ) || 0;

      const totalSpent = budget.budget_categories?.reduce(
        (sum, cat) => sum + parseFloat(cat.spent_amount), 0
      ) || 0;

      const totalBudget = parseFloat(budget.total_budget) || 0;
      const remaining = totalBudget - totalSpent; // Remaining from total budget
      const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      // Get recent transactions
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        budget,
        summary: {
          totalBudget: totalBudget,
          totalAllocated,
          totalSpent,
          remaining,
          percentageUsed,
          savingsGoal: parseFloat(budget.savings_goal) || 0,
          monthly: parseFloat(budget.monthly || 0),
          weekly: parseFloat(budget.weekly || 0)
        },
        categories: budget.budget_categories?.map(cat => ({
          ...cat,
          percentage: parseFloat(cat.allocated_amount) > 0 
            ? (parseFloat(cat.spent_amount) / parseFloat(cat.allocated_amount)) * 100 
            : 0,
          remaining: parseFloat(cat.allocated_amount) - parseFloat(cat.spent_amount)
        })) || [],
        recentTransactions: recentTransactions || []
      };
    } catch (error) {
      console.error('Error getting budget summary:', error);
      return null;
    }
  }

  /**
   * Delete budget category
   */
  static async deleteBudgetCategory(categoryId) {
    try {
      const { error } = await supabase
        .from('budget_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting budget category:', error);
      throw error;
    }
  }

  /**
   * Get spending by category for charts
   */
  static async getSpendingByCategory(period = 'month') {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      const budget = await this.getUserBudget();
      if (!budget || !budget.budget_categories) return [];

      return budget.budget_categories.map(category => ({
        name: category.category_name,
        allocated: parseFloat(category.allocated_amount),
        spent: parseFloat(category.spent_amount),
        percentage: parseFloat(category.allocated_amount) > 0 
          ? (parseFloat(category.spent_amount) / parseFloat(category.allocated_amount)) * 100 
          : 0
      }));
    } catch (error) {
      console.error('Error getting spending by category:', error);
      return [];
    }
  }
}
