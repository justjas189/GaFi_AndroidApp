// Learning Progress Database Service
// Handles all database operations for user-specific learning progress

import { supabase } from '../config/supabase';

export class LearningProgressDatabaseService {
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
   * Get user's learning progress for all modules
   * @returns {Object} Progress data by module ID
   */
  async getUserLearningProgress() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_learning_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('completed', true);

      if (error) throw error;

      // Transform data into the expected format for the component
      const progressByModule = {};
      data.forEach(progress => {
        if (!progressByModule[progress.module_id]) {
          progressByModule[progress.module_id] = 0;
        }
        progressByModule[progress.module_id]++;
      });

      console.log('Loaded user learning progress:', progressByModule);
      return progressByModule;

    } catch (error) {
      console.error('Error loading user learning progress:', error);
      return {};
    }
  }

  /**
   * Mark a lesson as completed
   * @param {string} moduleId - Module ID
   * @param {string} lessonId - Lesson ID
   * @param {number} score - Optional score
   * @returns {boolean} Success status
   */
  async completLesson(moduleId, lessonId, score = null) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_learning_progress')
        .upsert([
          {
            user_id: userId,
            module_id: moduleId,
            lesson_id: lessonId,
            completed: true,
            score: score,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ], { 
          onConflict: 'user_id,lesson_id' 
        });

      if (error) throw error;

      console.log(`Marked lesson ${lessonId} as completed for module ${moduleId}`);
      return true;

    } catch (error) {
      console.error('Error completing lesson:', error);
      return false;
    }
  }

  /**
   * Save quiz result
   * @param {string} quizId - Quiz ID
   * @param {string} lessonId - Lesson ID (optional)
   * @param {string} tipId - Tip ID (optional)
   * @param {number} selectedAnswer - Selected answer index
   * @param {number} correctAnswer - Correct answer index
   * @param {boolean} isCorrect - Whether answer was correct
   * @returns {boolean} Success status
   */
  async saveQuizResult(quizId, selectedAnswer, correctAnswer, isCorrect, lessonId = null, tipId = null) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Check if user has attempted this quiz before
      const { data: existingAttempts, error: fetchError } = await this.supabase
        .from('user_quiz_results')
        .select('attempts')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const attempts = existingAttempts.length > 0 ? existingAttempts[0].attempts + 1 : 1;
      const firstAttemptCorrect = attempts === 1 ? isCorrect : false;

      const { data, error } = await this.supabase
        .from('user_quiz_results')
        .insert([
          {
            user_id: userId,
            quiz_id: quizId,
            lesson_id: lessonId,
            tip_id: tipId,
            selected_answer: selectedAnswer,
            correct_answer: correctAnswer,
            is_correct: isCorrect,
            attempts: attempts,
            first_attempt_correct: firstAttemptCorrect,
            completed_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;

      console.log(`Saved quiz result for ${quizId}: ${isCorrect ? 'Correct' : 'Incorrect'}`);
      return true;

    } catch (error) {
      console.error('Error saving quiz result:', error);
      return false;
    }
  }

  /**
   * Get user's quiz results
   * @returns {Object} Quiz results by quiz ID
   */
  async getUserQuizResults() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_quiz_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data into the expected format
      const quizResults = {};
      data.forEach(result => {
        const key = result.lesson_id || result.tip_id;
        if (key) {
          quizResults[key] = {
            selected: result.selected_answer,
            correct: result.is_correct,
            attempts: result.attempts,
            firstAttemptCorrect: result.first_attempt_correct
          };
        }
      });

      console.log('Loaded user quiz results:', Object.keys(quizResults).length);
      return quizResults;

    } catch (error) {
      console.error('Error loading user quiz results:', error);
      return {};
    }
  }

  /**
   * Get user's favorite tips
   * @returns {Array} Array of favorite tip IDs
   */
  async getUserFavoriteTips() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_favorite_tips')
        .select('tip_id')
        .eq('user_id', userId)
        .order('favorited_at', { ascending: false });

      if (error) throw error;

      const favoriteTips = data.map(item => item.tip_id);
      console.log('Loaded user favorite tips:', favoriteTips.length);
      return favoriteTips;

    } catch (error) {
      console.error('Error loading user favorite tips:', error);
      return [];
    }
  }

  /**
   * Toggle favorite status for a tip
   * @param {string} tipId - Tip ID
   * @returns {boolean} New favorite status
   */
  async toggleFavoriteTip(tipId) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Check if tip is already favorited
      const { data: existing, error: fetchError } = await this.supabase
        .from('user_favorite_tips')
        .select('id')
        .eq('user_id', userId)
        .eq('tip_id', tipId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (existing) {
        // Remove from favorites
        const { error: deleteError } = await this.supabase
          .from('user_favorite_tips')
          .delete()
          .eq('user_id', userId)
          .eq('tip_id', tipId);

        if (deleteError) throw deleteError;

        console.log(`Removed tip ${tipId} from favorites`);
        return false;
      } else {
        // Add to favorites
        const { error: insertError } = await this.supabase
          .from('user_favorite_tips')
          .insert([
            {
              user_id: userId,
              tip_id: tipId,
              favorited_at: new Date().toISOString()
            }
          ]);

        if (insertError) throw insertError;

        console.log(`Added tip ${tipId} to favorites`);
        return true;
      }

    } catch (error) {
      console.error('Error toggling favorite tip:', error);
      return false;
    }
  }

  /**
   * Get user's learning statistics
   * @returns {Object} Learning statistics
   */
  async getUserLearningStats() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_learning_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const stats = data || {
        total_lessons_completed: 0,
        total_quizzes_taken: 0,
        total_tips_favorited: 0,
        average_quiz_score: 0,
        learning_streak_days: 0,
        last_activity_date: null
      };

      console.log('Loaded user learning stats:', stats);
      return {
        totalLessonsCompleted: stats.total_lessons_completed || 0,
        totalQuizzesTaken: stats.total_quizzes_taken || 0,
        totalTipsFavorited: stats.total_tips_favorited || 0,
        averageQuizScore: parseFloat(stats.average_quiz_score || 0),
        learningStreakDays: stats.learning_streak_days || 0,
        lastActivityDate: stats.last_activity_date
      };

    } catch (error) {
      console.error('Error loading user learning stats:', error);
      return {
        totalLessonsCompleted: 0,
        totalQuizzesTaken: 0,
        totalTipsFavorited: 0,
        averageQuizScore: 0,
        learningStreakDays: 0,
        lastActivityDate: null
      };
    }
  }

  /**
   * Update learning streak
   * @returns {boolean} Success status
   */
  async updateLearningStreak() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get current stats
      const { data: currentStats, error: fetchError } = await this.supabase
        .from('user_learning_stats')
        .select('learning_streak_days, last_activity_date')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const lastActivity = currentStats?.last_activity_date;
      
      let newStreak = 1;
      
      if (lastActivity) {
        const lastDate = new Date(lastActivity);
        const todayDate = new Date(today);
        const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
          // Consecutive day
          newStreak = (currentStats.learning_streak_days || 0) + 1;
        } else if (daysDiff === 0) {
          // Same day - no change to streak
          newStreak = currentStats.learning_streak_days || 1;
        } else {
          // Streak broken
          newStreak = 1;
        }
      }

      // Update or insert streak
      const { error: upsertError } = await this.supabase
        .from('user_learning_stats')
        .upsert([
          {
            user_id: userId,
            learning_streak_days: newStreak,
            last_activity_date: today,
            updated_at: new Date().toISOString()
          }
        ], { 
          onConflict: 'user_id' 
        });

      if (upsertError) throw upsertError;

      console.log(`Updated learning streak: ${newStreak} days`);
      return true;

    } catch (error) {
      console.error('Error updating learning streak:', error);
      return false;
    }
  }

  /**
   * Get detailed progress for a specific module
   * @param {string} moduleId - Module ID
   * @returns {Array} Array of completed lesson IDs
   */
  async getModuleProgress(moduleId) {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('user_learning_progress')
        .select('lesson_id, completed_at, score')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .eq('completed', true)
        .order('completed_at');

      if (error) throw error;

      return data;

    } catch (error) {
      console.error('Error getting module progress:', error);
      return [];
    }
  }

  /**
   * Reset user's progress (for testing or user request)
   * @returns {boolean} Success status
   */
  async resetUserProgress() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Delete all user learning data
      const tables = [
        'user_learning_progress',
        'user_quiz_results', 
        'user_favorite_tips',
        'user_learning_stats'
      ];

      for (const table of tables) {
        const { error } = await this.supabase
          .from(table)
          .delete()
          .eq('user_id', userId);

        if (error) throw error;
      }

      console.log('Reset all user learning progress');
      return true;

    } catch (error) {
      console.error('Error resetting user progress:', error);
      return false;
    }
  }
}

export default new LearningProgressDatabaseService();
