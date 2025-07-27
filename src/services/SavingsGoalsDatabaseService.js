// Savings Goals Database Service
// Handles all database operations for user-specific savings goals

import { supabase } from '../config/supabase';

export class SavingsGoalsDatabaseService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Get current authenticated user ID
   * @returns {string|null} User ID or null if not authenticated
   */
  async getCurrentUserId() {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error) throw error;
      return user?.id || null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get all savings goals for the current user
   * @returns {Array} Array of user's savings goals
   */
  async getUserSavingsGoals() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('savings_goals')
        .select(`
          *,
          savings_goal_transactions(
            id,
            amount,
            note,
            transaction_date
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match the expected format
      const transformedGoals = data.map(goal => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        targetAmount: parseFloat(goal.target_amount),
        currentAmount: parseFloat(goal.current_amount || 0),
        icon: goal.icon,
        color: goal.color,
        category: goal.category,
        timeline: goal.timeline,
        isCompleted: goal.is_completed,
        completedAt: goal.completed_at,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at,
        transactions: goal.savings_goal_transactions || []
      }));

      console.log('Loaded user savings goals:', transformedGoals.length);
      return transformedGoals;

    } catch (error) {
      console.error('Error loading user savings goals:', error);
      throw error;
    }
  }

  /**
   * Create a new savings goal for the current user
   * @param {Object} goalData - The goal data to create
   * @returns {Object} Created goal
   */
  async createSavingsGoal(goalData) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('savings_goals')
        .insert([
          {
            user_id: userId,
            title: goalData.title,
            description: goalData.description,
            target_amount: parseFloat(goalData.targetAmount),
            current_amount: 0,
            icon: goalData.icon || 'flag-outline',
            color: goalData.color || '#4CAF50',
            category: goalData.category,
            timeline: goalData.timeline,
            is_completed: false
          }
        ])
        .select()
        .single();

      if (error) throw error;

      console.log('Created new savings goal:', data.title);
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        targetAmount: parseFloat(data.target_amount),
        currentAmount: parseFloat(data.current_amount || 0),
        icon: data.icon,
        color: data.color,
        category: data.category,
        timeline: data.timeline,
        isCompleted: data.is_completed,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

    } catch (error) {
      console.error('Error creating savings goal:', error);
      throw error;
    }
  }

  /**
   * Add money to a savings goal
   * @param {string} goalId - The goal ID
   * @param {number} amount - Amount to add
   * @param {string} note - Optional note for the transaction
   * @returns {Object} Updated goal data
   */
  async addMoneyToGoal(goalId, amount, note = '') {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Verify the goal belongs to the current user
      const { data: goal, error: goalError } = await this.supabase
        .from('savings_goals')
        .select('id, user_id, title, target_amount')
        .eq('id', goalId)
        .eq('user_id', userId)
        .single();

      if (goalError || !goal) {
        throw new Error('Goal not found or access denied');
      }

      // Add the transaction
      const { data: transaction, error: transactionError } = await this.supabase
        .from('savings_goal_transactions')
        .insert([
          {
            user_id: userId,
            goal_id: goalId,
            amount: parseFloat(amount),
            note: note,
            transaction_date: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Get the updated goal data (the trigger will have updated current_amount)
      const updatedGoal = await this.getSavingsGoal(goalId);
      
      console.log(`Added ₱${amount} to goal: ${goal.title}`);
      return updatedGoal;

    } catch (error) {
      console.error('Error adding money to goal:', error);
      throw error;
    }
  }

  /**
   * Get a single savings goal by ID
   * @param {string} goalId - The goal ID
   * @returns {Object} Goal data
   */
  async getSavingsGoal(goalId) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('savings_goals')
        .select(`
          *,
          savings_goal_transactions(
            id,
            amount,
            note,
            transaction_date
          )
        `)
        .eq('id', goalId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        targetAmount: parseFloat(data.target_amount),
        currentAmount: parseFloat(data.current_amount || 0),
        icon: data.icon,
        color: data.color,
        category: data.category,
        timeline: data.timeline,
        isCompleted: data.is_completed,
        completedAt: data.completed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        transactions: data.savings_goal_transactions || []
      };

    } catch (error) {
      console.error('Error getting savings goal:', error);
      throw error;
    }
  }

  /**
   * Update a savings goal
   * @param {string} goalId - The goal ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} Updated goal data
   */
  async updateSavingsGoal(goalId, updates) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const updateData = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.description) updateData.description = updates.description;
      if (updates.targetAmount) updateData.target_amount = parseFloat(updates.targetAmount);
      if (updates.icon) updateData.icon = updates.icon;
      if (updates.color) updateData.color = updates.color;
      if (updates.category) updateData.category = updates.category;
      if (updates.timeline) updateData.timeline = updates.timeline;
      
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('savings_goals')
        .update(updateData)
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      console.log('Updated savings goal:', data.title);
      return await this.getSavingsGoal(goalId);

    } catch (error) {
      console.error('Error updating savings goal:', error);
      throw error;
    }
  }

  /**
   * Delete a savings goal
   * @param {string} goalId - The goal ID
   * @returns {boolean} Success status
   */
  async deleteSavingsGoal(goalId) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { error } = await this.supabase
        .from('savings_goals')
        .delete()
        .eq('id', goalId)
        .eq('user_id', userId);

      if (error) throw error;

      console.log('Deleted savings goal:', goalId);
      return true;

    } catch (error) {
      console.error('Error deleting savings goal:', error);
      throw error;
    }
  }

  /**
   * Get user achievements
   * @returns {Array} Array of user achievements
   */
  async getUserAchievements() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;

      return data.map(achievement => achievement.achievement_id);

    } catch (error) {
      console.error('Error loading user achievements:', error);
      return [];
    }
  }

  /**
   * Add achievement for user
   * @param {string} achievementId - Achievement ID
   * @param {Object} achievementData - Achievement data
   * @returns {boolean} Success status
   */
  async addUserAchievement(achievementId, achievementData) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_achievements')
        .upsert([
          {
            user_id: userId,
            achievement_id: achievementId,
            achievement_title: achievementData.title,
            achievement_description: achievementData.description,
            points: achievementData.points || 0
          }
        ], { 
          onConflict: 'user_id,achievement_id',
          ignoreDuplicates: true 
        });

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        throw error;
      }

      console.log('Added achievement:', achievementId);
      return true;

    } catch (error) {
      console.error('Error adding user achievement:', error);
      return false;
    }
  }

  /**
   * Get user savings statistics
   * @returns {Object} User savings statistics
   */
  async getUserSavingsStats() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get savings goals stats
      const { data: goalsData, error: goalsError } = await this.supabase
        .from('savings_goals')
        .select('current_amount, target_amount, is_completed')
        .eq('user_id', userId);

      if (goalsError) throw goalsError;

      // Get total transactions
      const { data: transactionsData, error: transactionsError } = await this.supabase
        .from('savings_goal_transactions')
        .select('amount')
        .eq('user_id', userId);

      if (transactionsError) throw transactionsError;

      const totalSaved = goalsData.reduce((sum, goal) => sum + parseFloat(goal.current_amount || 0), 0);
      const totalTarget = goalsData.reduce((sum, goal) => sum + parseFloat(goal.target_amount || 0), 0);
      const completedGoals = goalsData.filter(goal => goal.is_completed).length;
      const totalGoals = goalsData.length;
      const totalTransactions = transactionsData.length;

      return {
        totalSaved,
        totalTarget,
        completedGoals,
        totalGoals,
        totalTransactions,
        overallProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0
      };

    } catch (error) {
      console.error('Error getting user savings stats:', error);
      return {
        totalSaved: 0,
        totalTarget: 0,
        completedGoals: 0,
        totalGoals: 0,
        totalTransactions: 0,
        overallProgress: 0
      };
    }
  }
}

export default new SavingsGoalsDatabaseService();
