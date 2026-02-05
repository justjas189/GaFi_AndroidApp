/**
 * GamifiedSavingsService - Manages gamified savings goals and level progression
 */

import { supabase } from '../config/supabase';

export class GamifiedSavingsService {
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
   * Get all level configurations
   */
  static async getLevelConfigurations() {
    try {
      const { data, error } = await supabase
        .from('savings_level_configs')
        .select('*')
        .order('level');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting level configurations:', error);
      return [];
    }
  }

  /**
   * Get user's current gamified savings goal
   */
  static async getCurrentGamifiedGoal() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('gamified_savings_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('is_completed', false)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting current gamified goal:', error);
      return null;
    }
  }

  /**
   * Create a new gamified savings goal
   */
  static async createGamifiedGoal(level, targetAmount, timelineDays) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      // Deactivate any existing active goals
      await supabase
        .from('gamified_savings_goals')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      const dailyTarget = targetAmount / timelineDays;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + timelineDays);

      const { data, error } = await supabase
        .from('gamified_savings_goals')
        .insert({
          user_id: userId,
          level: level,
          target_amount: targetAmount,
          daily_target: dailyTarget,
          timeline_days: timelineDays,
          end_date: endDate.toISOString(),
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating gamified goal:', error);
      throw error;
    }
  }

  /**
   * Add money to current gamified goal
   */
  static async addToGamifiedGoal(amount, note = '') {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) throw new Error('User not authenticated');

      const currentGoal = await this.getCurrentGamifiedGoal();
      if (!currentGoal) {
        throw new Error('No active gamified goal found');
      }

      // Add savings transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('savings_transactions')
        .insert({
          user_id: userId,
          goal_id: currentGoal.id,
          amount: amount,
          transaction_type: 'deposit',
          notes: note,
          description: `Gamified savings - Level ${currentGoal.level}`
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Update goal current amount
      const newCurrentAmount = parseFloat(currentGoal.current_amount) + parseFloat(amount);
      const isCompleted = newCurrentAmount >= parseFloat(currentGoal.target_amount);

      const { data: updatedGoal, error: updateError } = await supabase
        .from('gamified_savings_goals')
        .update({
          current_amount: newCurrentAmount,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentGoal.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Update user levels table
      await this.updateUserLevel(userId, newCurrentAmount, isCompleted);

      return {
        transaction,
        updatedGoal,
        isCompleted,
        celebration: isCompleted ? await this.generateCelebration(currentGoal.level) : null
      };
    } catch (error) {
      console.error('Error adding to gamified goal:', error);
      throw error;
    }
  }

  /**
   * Update user level and stats
   */
  static async updateUserLevel(userId, totalSaved, goalCompleted = false) {
    try {
      const { data: existingLevel, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', userId)
        .single();

      const currentLevel = this.calculateLevel(totalSaved);
      const goalsCompleted = (existingLevel?.goals_completed || 0) + (goalCompleted ? 1 : 0);

      if (existingLevel) {
        const { error: updateError } = await supabase
          .from('user_levels')
          .update({
            current_level: currentLevel,
            total_saved: totalSaved,
            goals_completed: goalsCompleted,
            last_save_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_levels')
          .insert({
            user_id: userId,
            current_level: currentLevel,
            total_saved: totalSaved,
            goals_completed: goalsCompleted,
            last_save_date: new Date().toISOString().split('T')[0]
          });

        if (insertError) throw insertError;
      }

      // Update leaderboard
      await this.updateLeaderboard(userId, totalSaved, currentLevel, goalsCompleted);

      return { currentLevel, goalsCompleted };
    } catch (error) {
      console.error('Error updating user level:', error);
      throw error;
    }
  }

  /**
   * Calculate user level based on total saved
   */
  static calculateLevel(totalSaved) {
    const amount = parseFloat(totalSaved) || 0;
    if (amount >= 10000) return 4; // Savings Master
    if (amount >= 5000) return 3;  // Savings Expert
    if (amount >= 1000) return 2;  // Savings Enthusiast
    return 1; // Savings Beginner
  }

  /**
   * Update leaderboard entry
   */
  static async updateLeaderboard(userId, totalSaved, currentLevel, goalsCompleted) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', userId)
        .single();

      const username = profile?.username || profile?.full_name || 'Anonymous';

      const { data: existing } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('user_id', userId)
        .single();

      const rankScore = parseFloat(totalSaved) + (goalsCompleted * 100) + (currentLevel * 50);

      if (existing) {
        await supabase
          .from('leaderboards')
          .update({
            total_saved: totalSaved,
            highest_level: Math.max(existing.highest_level, currentLevel),
            goals_completed: goalsCompleted,
            rank_score: rankScore,
            last_activity: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      } else {
        await supabase
          .from('leaderboards')
          .insert({
            user_id: userId,
            username: username,
            total_saved: totalSaved,
            highest_level: currentLevel,
            goals_completed: goalsCompleted,
            rank_score: rankScore
          });
      }
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  }

  /**
   * Generate celebration data for completed level
   */
  static async generateCelebration(level) {
    const celebrations = {
      1: {
        title: 'Level 1 Completed!',
        message: "Congratulations! You've started your savings journey!",
        emoji: '🎉',
        color: '#4CAF50'
      },
      2: {
        title: 'Level 2 Completed!',
        message: "Amazing! You're becoming a savings enthusiast!",
        emoji: '🚀',
        color: '#2196F3'
      },
      3: {
        title: 'Level 3 Completed!',
        message: "Incredible! You're now a savings expert!",
        emoji: '⭐',
        color: '#FF9800'
      },
      4: {
        title: 'Level 4 Completed!',
        message: "Outstanding! You've mastered the art of saving!",
        emoji: '🏆',
        color: '#9C27B0'
      }
    };

    return celebrations[level] || celebrations[1];
  }

  /**
   * Get user's savings statistics
   */
  static async getUserSavingsStats() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        currentLevel: data?.current_level || 1,
        totalSaved: parseFloat(data?.total_saved || 0),
        goalsCompleted: data?.goals_completed || 0,
        streakDays: data?.streak_days || 0
      };
    } catch (error) {
      console.error('Error getting user savings stats:', error);
      return {
        currentLevel: 1,
        totalSaved: 0,
        goalsCompleted: 0,
        streakDays: 0
      };
    }
  }

  /**
   * Get all completed gamified goals
   */
  static async getCompletedGoals() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('gamified_savings_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting completed goals:', error);
      return [];
    }
  }

  /**
   * Get savings transactions for a goal
   */
  static async getGoalTransactions(goalId) {
    try {
      const { data, error } = await supabase
        .from('savings_transactions')
        .select('*')
        .eq('goal_id', goalId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting goal transactions:', error);
      return [];
    }
  }
}
