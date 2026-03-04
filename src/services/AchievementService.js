/**
 * AchievementService - Manages user achievements for the gamified expense tracker
 */

import { supabase } from '../config/supabase';

export class AchievementService {
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
   * Achievement definitions - Game-based achievements
   */
  static getAchievementDefinitions() {
    return {
      // === EXPENSE TRACKING ACHIEVEMENTS ===
      'first_expense': {
        id: 'first_expense',
        title: 'First Purchase',
        description: 'Recorded your first expense in the game',
        points: 10,
        icon: '🛒',
        category: 'expense',
        target_value: 1
      },
      'expense_tracker_10': {
        id: 'expense_tracker_10',
        title: 'Expense Tracker',
        description: 'Recorded 10 expenses',
        points: 25,
        icon: '📝',
        category: 'expense',
        target_value: 10
      },
      'expense_master_50': {
        id: 'expense_master_50',
        title: 'Expense Master',
        description: 'Recorded 50 expenses',
        points: 75,
        icon: '📊',
        category: 'expense',
        target_value: 50
      },
      'expense_legend_100': {
        id: 'expense_legend_100',
        title: 'Expense Legend',
        description: 'Recorded 100 expenses',
        points: 150,
        icon: '🏆',
        category: 'expense',
        target_value: 100
      },

      // === STORY MODE ACHIEVEMENTS ===
      'story_beginner': {
        id: 'story_beginner',
        title: 'Story Beginner',
        description: 'Completed Story Mode Level 1',
        points: 100,
        icon: '🌟',
        category: 'story',
        target_value: 1
      },
      'story_intermediate': {
        id: 'story_intermediate',
        title: 'Budget Warrior',
        description: 'Completed Story Mode Level 2',
        points: 200,
        icon: '💎',
        category: 'story',
        target_value: 1
      },
      'story_master': {
        id: 'story_master',
        title: 'Financial Master',
        description: 'Completed Story Mode Level 3',
        points: 500,
        icon: '👑',
        category: 'story',
        target_value: 1
      },
      'perfect_week': {
        id: 'perfect_week',
        title: 'Perfect Week',
        description: 'Saved 50% or more in a story week',
        points: 150,
        icon: '✨',
        category: 'story',
        target_value: 1
      },

      // === EXPLORATION ACHIEVEMENTS ===
      'explorer_school': {
        id: 'explorer_school',
        title: 'Campus Explorer',
        description: 'Visited the School Campus',
        points: 15,
        icon: '🏫',
        category: 'exploration',
        target_value: 1
      },
      'explorer_mall': {
        id: 'explorer_mall',
        title: 'Mall Walker',
        description: 'Visited the Shopping Mall',
        points: 15,
        icon: '🏬',
        category: 'exploration',
        target_value: 1
      },
      'explorer_home': {
        id: 'explorer_home',
        title: 'Home Sweet Home',
        description: 'Returned to your Home/Dorm',
        points: 10,
        icon: '🏠',
        category: 'exploration',
        target_value: 1
      },
      'world_traveler': {
        id: 'world_traveler',
        title: 'World Traveler',
        description: 'Visited all 3 locations in one session',
        points: 50,
        icon: '🗺️',
        category: 'exploration',
        target_value: 3
      },

      // === SPENDING CATEGORY ACHIEVEMENTS ===
      'foodie': {
        id: 'foodie',
        title: 'Foodie',
        description: 'Recorded 5 Food & Dining expenses',
        points: 30,
        icon: '🍔',
        category: 'spending',
        target_value: 5
      },
      'shopaholic': {
        id: 'shopaholic',
        title: 'Shopaholic',
        description: 'Recorded 5 Shopping expenses',
        points: 30,
        icon: '🛍️',
        category: 'spending',
        target_value: 5
      },
      'tech_enthusiast': {
        id: 'tech_enthusiast',
        title: 'Tech Enthusiast',
        description: 'Recorded 3 Electronics expenses',
        points: 30,
        icon: '📱',
        category: 'spending',
        target_value: 3
      },

      // === SAVINGS ACHIEVEMENTS ===
      'saver_bronze': {
        id: 'saver_bronze',
        title: 'Bronze Saver',
        description: 'Saved 20% of weekly budget',
        points: 50,
        icon: '🥉',
        category: 'savings',
        target_value: 1
      },
      'saver_silver': {
        id: 'saver_silver',
        title: 'Silver Saver',
        description: 'Saved 30% of weekly budget',
        points: 100,
        icon: '🥈',
        category: 'savings',
        target_value: 1
      },
      'saver_gold': {
        id: 'saver_gold',
        title: 'Gold Saver',
        description: 'Saved 40% of weekly budget',
        points: 200,
        icon: '🥇',
        category: 'savings',
        target_value: 1
      },

      // === GAMEPLAY ACHIEVEMENTS ===
      'first_travel': {
        id: 'first_travel',
        title: 'On The Move',
        description: 'Traveled to another location for the first time',
        points: 20,
        icon: '🚶',
        category: 'gameplay',
        target_value: 1
      },
      'speed_walker': {
        id: 'speed_walker',
        title: 'Speed Walker',
        description: 'Walked 100 tiles total',
        points: 40,
        icon: '👟',
        category: 'gameplay',
        target_value: 100
      },
      'marathon_runner': {
        id: 'marathon_runner',
        title: 'Marathon Runner',
        description: 'Walked 500 tiles total',
        points: 100,
        icon: '🏃',
        category: 'gameplay',
        target_value: 500
      },

      // === DAILY ACHIEVEMENTS ===
      'daily_tracker': {
        id: 'daily_tracker',
        title: 'Daily Tracker',
        description: 'Tracked expenses for 7 consecutive days',
        points: 75,
        icon: '📅',
        category: 'streak',
        target_value: 7
      },
      'dedicated_tracker': {
        id: 'dedicated_tracker',
        title: 'Dedicated Tracker',
        description: 'Tracked expenses for 30 consecutive days',
        points: 250,
        icon: '🔥',
        category: 'streak',
        target_value: 30
      },

      // === BUDGET ACHIEVEMENTS ===
      'budget_creator': {
        id: 'budget_creator',
        title: 'Budget Planner',
        description: 'Created your first monthly budget',
        points: 25,
        icon: '💰',
        category: 'budget',
        target_value: 1
      },
      'under_budget': {
        id: 'under_budget',
        title: 'Under Budget',
        description: 'Stayed under daily spending limit',
        points: 35,
        icon: '✅',
        category: 'budget',
        target_value: 1
      }
    };
  }

  /**
   * Get achievement definitions as array (for dashboard)
   */
  static getAchievementDefinitionsArray() {
    const definitions = this.getAchievementDefinitions();
    return Object.values(definitions);
  }

  /**
   * Check and award achievements based on user activity
   */
  static async checkAndAwardAchievements(userId, activityType, activityData = {}) {
    try {
      const newAchievements = [];
      const definitions = this.getAchievementDefinitions();

      // Get user's existing achievements
      const { data: existingAchievements } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId);

      const existingIds = existingAchievements?.map(a => a.achievement_id) || [];

      // Check achievements based on activity type
      switch (activityType) {
        case 'expense_recorded':
          // First expense
          if (!existingIds.includes('first_expense')) {
            await this.awardAchievement(userId, 'first_expense');
            newAchievements.push(definitions.first_expense);
          }
          
          // Expense count milestones
          const expenseCount = activityData.totalExpenses || 1;
          if (expenseCount >= 10 && !existingIds.includes('expense_tracker_10')) {
            await this.awardAchievement(userId, 'expense_tracker_10');
            newAchievements.push(definitions.expense_tracker_10);
          }
          if (expenseCount >= 50 && !existingIds.includes('expense_master_50')) {
            await this.awardAchievement(userId, 'expense_master_50');
            newAchievements.push(definitions.expense_master_50);
          }
          if (expenseCount >= 100 && !existingIds.includes('expense_legend_100')) {
            await this.awardAchievement(userId, 'expense_legend_100');
            newAchievements.push(definitions.expense_legend_100);
          }
          
          // Category-based achievements
          const category = activityData.category;
          const categoryCount = activityData.categoryCount || 1;
          
          if (category === 'Food & Dining' && categoryCount >= 5 && !existingIds.includes('foodie')) {
            await this.awardAchievement(userId, 'foodie');
            newAchievements.push(definitions.foodie);
          }
          if (category === 'Shopping' && categoryCount >= 5 && !existingIds.includes('shopaholic')) {
            await this.awardAchievement(userId, 'shopaholic');
            newAchievements.push(definitions.shopaholic);
          }
          if (category === 'Electronics' && categoryCount >= 3 && !existingIds.includes('tech_enthusiast')) {
            await this.awardAchievement(userId, 'tech_enthusiast');
            newAchievements.push(definitions.tech_enthusiast);
          }
          break;

        case 'story_level_complete':
          const level = activityData.level;
          const savingsPercent = activityData.savingsPercent || 0;
          
          if (level === 1 && !existingIds.includes('story_beginner')) {
            await this.awardAchievement(userId, 'story_beginner');
            newAchievements.push(definitions.story_beginner);
          }
          if (level === 2 && !existingIds.includes('story_intermediate')) {
            await this.awardAchievement(userId, 'story_intermediate');
            newAchievements.push(definitions.story_intermediate);
          }
          if (level === 3 && !existingIds.includes('story_master')) {
            await this.awardAchievement(userId, 'story_master');
            newAchievements.push(definitions.story_master);
          }
          
          // Perfect week achievement
          if (savingsPercent >= 50 && !existingIds.includes('perfect_week')) {
            await this.awardAchievement(userId, 'perfect_week');
            newAchievements.push(definitions.perfect_week);
          }
          
          // Savings tier achievements
          if (savingsPercent >= 20 && !existingIds.includes('saver_bronze')) {
            await this.awardAchievement(userId, 'saver_bronze');
            newAchievements.push(definitions.saver_bronze);
          }
          if (savingsPercent >= 30 && !existingIds.includes('saver_silver')) {
            await this.awardAchievement(userId, 'saver_silver');
            newAchievements.push(definitions.saver_silver);
          }
          if (savingsPercent >= 40 && !existingIds.includes('saver_gold')) {
            await this.awardAchievement(userId, 'saver_gold');
            newAchievements.push(definitions.saver_gold);
          }
          break;

        case 'location_visited':
          const locationId = activityData.locationId;
          
          if (locationId === 'school' && !existingIds.includes('explorer_school')) {
            await this.awardAchievement(userId, 'explorer_school');
            newAchievements.push(definitions.explorer_school);
          }
          if ((locationId === 'mall' || locationId === 'mall_1f') && !existingIds.includes('explorer_mall')) {
            await this.awardAchievement(userId, 'explorer_mall');
            newAchievements.push(definitions.explorer_mall);
          }
          if (locationId === 'dorm' && !existingIds.includes('explorer_home')) {
            await this.awardAchievement(userId, 'explorer_home');
            newAchievements.push(definitions.explorer_home);
          }
          
          // World traveler - visited all locations
          const visitedLocations = activityData.visitedLocations || [];
          if (visitedLocations.length >= 3 && !existingIds.includes('world_traveler')) {
            await this.awardAchievement(userId, 'world_traveler');
            newAchievements.push(definitions.world_traveler);
          }
          break;

        case 'first_travel':
          if (!existingIds.includes('first_travel')) {
            await this.awardAchievement(userId, 'first_travel');
            newAchievements.push(definitions.first_travel);
          }
          break;

        case 'tiles_walked':
          const totalTiles = activityData.totalTiles || 0;
          
          if (totalTiles >= 100 && !existingIds.includes('speed_walker')) {
            await this.awardAchievement(userId, 'speed_walker');
            newAchievements.push(definitions.speed_walker);
          }
          if (totalTiles >= 500 && !existingIds.includes('marathon_runner')) {
            await this.awardAchievement(userId, 'marathon_runner');
            newAchievements.push(definitions.marathon_runner);
          }
          break;

        case 'budget_created':
          if (!existingIds.includes('budget_creator')) {
            await this.awardAchievement(userId, 'budget_creator');
            newAchievements.push(definitions.budget_creator);
          }
          break;

        case 'under_budget':
          if (!existingIds.includes('under_budget')) {
            await this.awardAchievement(userId, 'under_budget');
            newAchievements.push(definitions.under_budget);
          }
          break;

        case 'daily_streak':
          const streakDays = activityData.streakDays || 0;
          
          if (streakDays >= 7 && !existingIds.includes('daily_tracker')) {
            await this.awardAchievement(userId, 'daily_tracker');
            newAchievements.push(definitions.daily_tracker);
          }
          if (streakDays >= 30 && !existingIds.includes('dedicated_tracker')) {
            await this.awardAchievement(userId, 'dedicated_tracker');
            newAchievements.push(definitions.dedicated_tracker);
          }
          break;
      }

      return newAchievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  /**
   * Award achievement to user
   */
  static async awardAchievement(userId, achievementId) {
    try {
      const definitions = this.getAchievementDefinitions();
      const achievement = definitions[achievementId];

      if (!achievement) {
        console.error('Achievement not found:', achievementId);
        return;
      }

      // Insert user achievement
      const { error: userError } = await supabase
        .from('user_achievements')
        .insert({
          user_id: userId,
          achievement_id: achievementId,
          achievement_title: achievement.title,
          achievement_description: achievement.description,
          points: achievement.points
        });

      if (userError) throw userError;

      // Insert leaderboard achievement for tracking
      const { error: leaderboardError } = await supabase
        .from('leaderboard_achievements')
        .insert({
          user_id: userId,
          achievement_type: achievement.category,
          achievement_level: this.getAchievementLevel(achievementId),
          criteria_value: achievement.points
        });

      if (leaderboardError) throw leaderboardError;

      console.log(`Achievement awarded: ${achievement.title} to user ${userId}`);
    } catch (error) {
      console.error('Error awarding achievement:', error);
    }
  }

  /**
   * Get achievement level from ID
   */
  static getAchievementLevel(achievementId) {
    if (achievementId.includes('level_1')) return 1;
    if (achievementId.includes('level_2')) return 2;
    if (achievementId.includes('level_3')) return 3;
    if (achievementId.includes('level_4')) return 4;
    if (achievementId.includes('streak_30')) return 3;
    if (achievementId.includes('streak_7')) return 2;
    return 1;
  }

  /**
   * Get user statistics for achievement checking
   */
  static async getUserStats(userId = null) {
    try {
      // Get userId if not provided
      if (!userId) {
        userId = await this.getCurrentUserId();
      }
      
      if (!userId) {
        return {
          currentLevel: 1,
          totalSaved: 0,
          goalsCompleted: 0,
          streakDays: 0,
          friendCount: 0,
          budgetsCreated: 0,
          expensesCount: 0
        };
      }

      const { data: userLevels } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', userId)
        .single();

      const { data: friendsCount } = await supabase
        .from('friends')
        .select('id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      // Get additional stats
      const { data: budgets } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', userId);

      const { data: expenses } = await supabase
        .from('expenses')
        .select('id')
        .eq('user_id', userId);

      return {
        currentLevel: userLevels?.current_level || 1,
        totalSaved: parseFloat(userLevels?.total_saved || 0),
        goalsCompleted: userLevels?.goals_completed || 0,
        streakDays: userLevels?.streak_days || 0,
        friendCount: friendsCount?.length || 0,
        budgetsCreated: budgets?.length || 0,
        expensesCount: expenses?.length || 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        currentLevel: 1,
        totalSaved: 0,
        goalsCompleted: 0,
        streakDays: 0,
        friendCount: 0,
        budgetsCreated: 0,
        expensesCount: 0
      };
    }
  }

  /**
   * Get user's achievements
   */
  static async getUserAchievements() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (error) throw error;

      const definitions = this.getAchievementDefinitions();
      
      return (data || []).map(achievement => ({
        ...achievement,
        icon: definitions[achievement.achievement_id]?.icon || '🏆',
        category: definitions[achievement.achievement_id]?.category || 'general'
      }));
    } catch (error) {
      console.error('Error getting user achievements:', error);
      return [];
    }
  }

  /**
   * Get available achievements (not yet unlocked)
   */
  static async getAvailableAchievements() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return [];

      const userAchievements = await this.getUserAchievements();
      const unlockedIds = userAchievements.map(a => a.achievement_id);
      
      const definitions = this.getAchievementDefinitions();
      
      return Object.values(definitions).filter(
        achievement => !unlockedIds.includes(achievement.id)
      );
    } catch (error) {
      console.error('Error getting available achievements:', error);
      return [];
    }
  }

  /**
   * Get achievement progress for specific achievements
   */
  static async getAchievementProgress() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return {};

      const userStats = await this.getUserStats(userId);
      const definitions = this.getAchievementDefinitions();

      const progress = {};

      // Calculate progress for streak achievements
      progress.savings_streak_7 = Math.min(userStats.streakDays / 7, 1);
      progress.savings_streak_30 = Math.min(userStats.streakDays / 30, 1);

      // Calculate progress for goal achievements
      progress.goal_crusher = Math.min(userStats.goalsCompleted / 5, 1);

      // Calculate progress for social achievements
      progress.social_butterfly = Math.min(userStats.friendCount / 5, 1);

      // Level achievements are binary (complete or not)
      progress.level_1_complete = userStats.currentLevel >= 1 ? 1 : 0;
      progress.level_2_complete = userStats.currentLevel >= 2 ? 1 : 0;
      progress.level_3_complete = userStats.currentLevel >= 3 ? 1 : 0;
      progress.level_4_complete = userStats.currentLevel >= 4 ? 1 : 0;

      return progress;
    } catch (error) {
      console.error('Error getting achievement progress:', error);
      return {};
    }
  }

  /**
   * Get total points earned by user
   */
  static async getTotalPoints() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return 0;

      const { data, error } = await supabase
        .from('user_achievements')
        .select('points')
        .eq('user_id', userId);

      if (error) throw error;

      return (data || []).reduce((total, achievement) => total + (achievement.points || 0), 0);
    } catch (error) {
      console.error('Error getting total points:', error);
      return 0;
    }
  }

  /**
   * Get achievement definitions as an array (for dashboard use)
   */
  static getAchievementDefinitionsArray() {
    const definitions = this.getAchievementDefinitions();
    return Object.values(definitions).map(def => ({
      ...def,
      target_value: this.getTargetValue(def.id),
      achievement_type: this.getAchievementType(def.id)
    }));
  }

  /**
   * Get target value for achievement
   */
  static getTargetValue(achievementId) {
    const targetMap = {
      'first_save': 1,
      'savings_streak_7': 7,
      'savings_streak_30': 30,
      'goal_crusher': 5,
      'savings_milestone_1000': 1000,
      'level_1_complete': 1,
      'level_2_complete': 2,
      'level_3_complete': 3,
      'level_4_complete': 4,
      'social_butterfly': 5,
      'leaderboard_top_10': 1
    };
    return targetMap[achievementId] || 1;
  }

  /**
   * Get achievement type for progress calculation
   */
  static getAchievementType(achievementId) {
    if (achievementId.includes('save')) return 'first_save';
    if (achievementId.includes('streak')) return 'savings_streak';
    if (achievementId.includes('goal')) return 'goals_completed';
    if (achievementId.includes('milestone')) return 'total_saved';
    if (achievementId.includes('level')) return 'level_complete';
    if (achievementId.includes('social')) return 'friends';
    if (achievementId.includes('leaderboard')) return 'leaderboard';
    return 'general';
  }
}
