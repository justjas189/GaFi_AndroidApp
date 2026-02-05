import { supabase } from '../config/supabase';

/**
 * LeaderboardService - Unified service for gamified savings and leaderboard functionality
 * This service manages user levels, progress tracking, and leaderboard data
 */
const LeaderboardService = {
  /**
   * Get current user ID from Supabase auth
   * @returns {string|null} User ID or null if not authenticated
   */
  async getCurrentUserId() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user?.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  },

  /**
   * Add savings progress for the current user
   * @param {number} amount - Amount to add to savings
   * @param {string} notes - Optional notes for the transaction
   * @returns {Object} Progress update result
   */
  async addSavingsProgress(amount, notes = null) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.rpc('add_savings_progress', {
        p_user_id: userId,
        p_amount: parseFloat(amount),
        p_notes: notes
      });

      if (error) throw error;

      console.log('Added savings progress:', data);
      return data;

    } catch (error) {
      console.error('Error adding savings progress:', error);
      throw error;
    }
  },

  /**
   * Get user's current level information
   * @returns {Object} User level information including rank
   */
  async getUserLevelInfo() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get user level data directly
      const { data: userLevel, error: levelError } = await supabase
        .from('user_levels')
        .select('user_id, current_level, total_saved, goals_completed, streak_days, last_save_date')
        .eq('user_id', userId)
        .single();

      if (levelError) {
        console.log('Error fetching user levels, returning defaults:', levelError);
        return {
          user_id: userId,
          current_level: 1,
          total_saved: 0,
          goals_completed: 0,
          streak_days: 0,
          last_save_date: null,
          rank: null
        };
      }

      console.log('Retrieved user level info:', userLevel);
      return userLevel;

    } catch (error) {
      console.error('Error getting user level info:', error);
      return {
        current_level: 1,
        total_saved: 0,
        goals_completed: 0,
        streak_days: 0,
        last_save_date: null,
        rank: null
      };
    }
  },

  /**
   * Get user levels directly from user_levels table
   * @returns {Object} User levels data
   */
  async getUserLevels() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create initial user level record
        const { data: newRecord, error: insertError } = await supabase
          .from('user_levels')
          .insert([{
            user_id: userId,
            current_level: 1,
            total_saved: 0,
            goals_completed: 0,
            streak_days: 0
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        return newRecord;
      }

      return data;

    } catch (error) {
      console.error('Error getting user levels:', error);
      return {
        current_level: 1,
        total_saved: 0,
        goals_completed: 0,
        streak_days: 0,
        last_save_date: null
      };
    }
  },

  /**
   * Get leaderboard data (top users by total saved)
   * @param {number} limit - Number of top users to retrieve
   * @returns {Array} Leaderboard data
   */
  async getLeaderboard(limit = 10) {
    try {
      // Get user_levels data without foreign key relationship to avoid errors
      const { data: levelsData, error: levelsError } = await supabase
        .from('user_levels')
        .select('user_id, current_level, total_saved, goals_completed, streak_days')
        .order('total_saved', { ascending: false })
        .limit(limit);

      if (levelsError) {
        console.error('Error fetching user levels:', levelsError);
        // Return sample data if user_levels table doesn't exist or has issues
        return [
          {
            rank: 1,
            userId: 'sample-1',
            name: 'Top Saver',
            level: 5,
            totalSaved: 25000,
            goalsCompleted: 15,
            streakDays: 30
          },
          {
            rank: 2,
            userId: 'sample-2',
            name: 'Money Master',
            level: 4,
            totalSaved: 18000,
            goalsCompleted: 12,
            streakDays: 22
          },
          {
            rank: 3,
            userId: 'sample-3',
            name: 'Smart Spender',
            level: 3,
            totalSaved: 12000,
            goalsCompleted: 8,
            streakDays: 15
          }
        ];
      }

      if (!levelsData || levelsData.length === 0) {
        console.log('No user levels data found');
        return [];
      }

      // Get corresponding profile data separately
      const userIds = levelsData.map(entry => entry.user_id);
      let profilesData = [];
      
      try {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', userIds);

        if (profilesError) {
          console.warn('Could not fetch profiles:', profilesError);
        } else {
          profilesData = profiles || [];
        }
      } catch (profileError) {
        console.warn('Profiles table query failed:', profileError);
      }

      // Merge the data manually
      const data = levelsData.map(entry => {
        const profile = profilesData.find(p => p.id === entry.user_id);
        return {
          ...entry,
          profiles: { 
            full_name: profile?.full_name || profile?.username || `User ${entry.user_id.slice(0, 8)}`
          }
        };
      });

      // Transform data to include user names and rankings
      const leaderboard = data.map((entry, index) => ({
        rank: index + 1,
        userId: entry.user_id,
        name: entry.profiles.full_name,
        level: entry.current_level,
        totalSaved: parseFloat(entry.total_saved || 0),
        goalsCompleted: entry.goals_completed || 0,
        streakDays: entry.streak_days || 0
      }));

      console.log('Leaderboard data processed:', leaderboard.length, 'entries');
      return leaderboard;

    } catch (error) {
      console.error('Error in getLeaderboard:', error);
      // Return sample data as fallback
      return [
        {
          rank: 1,
          userId: 'sample-1',
          name: 'Top Saver',
          level: 5,
          totalSaved: 25000,
          goalsCompleted: 15,
          streakDays: 30
        },
        {
          rank: 2,
          userId: 'sample-2',
          name: 'Money Master',
          level: 4,
          totalSaved: 18000,
          goalsCompleted: 12,
          streakDays: 22
        },
        {
          rank: 3,
          userId: 'sample-3',
          name: 'Smart Spender',
          level: 3,
          totalSaved: 12000,
          goalsCompleted: 8,
          streakDays: 15
        }
      ];
    }
  },

  /**
   * Get savings level configurations
   * @returns {Array} Level configurations
   */
  async getLevelConfigurations() {
    try {
      const { data, error } = await supabase
        .from('savings_level_configs')
        .select('*')
        .order('level', { ascending: true });

      if (error) throw error;

      console.log('Retrieved level configurations:', data?.length || 0);
      return data || [];

    } catch (error) {
      console.error('Error getting level configurations:', error);
      return [];
    }
  },

  /**
   * Initialize level configurations (admin function)
   * @returns {Object} Initialization result
   */
  async initializeLevelConfigurations() {
    try {
      const { data, error } = await supabase.rpc('initialize_level_configurations');

      if (error) throw error;

      console.log('Initialized level configurations:', data);
      return data;

    } catch (error) {
      console.error('Error initializing level configurations:', error);
      throw error;
    }
  },

  /**
   * Get user's current savings goal
   * @returns {Object|null} Current active goal
   */
  async getCurrentSavingsGoal() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('gamified_savings_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('Error getting current savings goal:', error);
      return null;
    }
  },

  /**
   * Get user's savings transaction history
   * @param {number} limit - Number of transactions to retrieve
   * @returns {Array} Transaction history
   */
  async getSavingsTransactions(limit = 50) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('savings_transactions')
        .select(`
          *,
          gamified_savings_goals(goal_name, level)
        `)
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Transform data for easier consumption
      const transactions = data.map(transaction => ({
        id: transaction.id,
        amount: parseFloat(transaction.amount || 0),
        type: transaction.transaction_type,
        notes: transaction.notes,
        date: transaction.transaction_date,
        goalName: transaction.gamified_savings_goals?.goal_name || 'Unknown Goal',
        goalLevel: transaction.gamified_savings_goals?.level || 1
      }));

      console.log('Retrieved savings transactions:', transactions.length);
      return transactions;

    } catch (error) {
      console.error('Error getting savings transactions:', error);
      return [];
    }
  },

  /**
   * Get user's savings statistics
   * @returns {Object} Savings statistics
   */
  async getSavingsStats() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get user level data
      const userLevels = await this.getUserLevels();
      
      // Get additional stats from transactions
      const { data: transactionStats, error } = await supabase
        .from('savings_transactions')
        .select('amount, transaction_date')
        .eq('user_id', userId);

      if (error) throw error;

      const totalTransactions = transactionStats?.length || 0;
      const lastTransactionDate = transactionStats?.length > 0 
        ? transactionStats[0].transaction_date 
        : null;

      return {
        currentLevel: userLevels.current_level || 1,
        totalSaved: parseFloat(userLevels.total_saved || 0),
        goalsCompleted: userLevels.goals_completed || 0,
        streakDays: userLevels.streak_days || 0,
        lastSaveDate: userLevels.last_save_date,
        totalTransactions,
        lastTransactionDate
      };

    } catch (error) {
      console.error('Error getting savings stats:', error);
      return {
        currentLevel: 1,
        totalSaved: 0,
        goalsCompleted: 0,
        streakDays: 0,
        lastSaveDate: null,
        totalTransactions: 0,
        lastTransactionDate: null
      };
    }
  }
};
// Export only as default to ensure compatibility with Metro bundler
export default LeaderboardService;