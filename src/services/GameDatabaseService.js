/**
 * GameDatabaseService - Persists game state to Supabase tables
 *
 * Handles inserts/updates for:
 *   1. story_mode_sessions
 *   2. custom_mode_sessions
 *   3. tutorial_progress
 *   4. transport_expenses
 *   5. character_customizations
 *   6. game_activity_log
 *   7. user_levels (XP / game-stat updates)
 */

import { supabase } from '../config/supabase';

class GameDatabaseService {
  // ─── helpers ──────────────────────────────────────────────

  async _getUserId() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }

  // ─── 1. story_mode_sessions ───────────────────────────────

  /**
   * Insert a new story mode session when the user starts a story level.
   * Returns the session row (with id) so GameScreen can reference it.
   */
  async createStorySession({
    level,
    levelType,     // 'budgeting' | 'goals' | 'saving'
    levelName,
    weeklyBudget,
    startDate,
    endDate,
    needsBudget = null,
    wantsBudget = null,
    savingsBudget = null,
    goalsData = null,
    savingsGoalPercent = null,
  }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('story_mode_sessions')
        .insert({
          user_id: userId,
          level,
          level_type: levelType,
          level_name: levelName,
          weekly_budget: weeklyBudget,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          needs_budget: needsBudget,
          wants_budget: wantsBudget,
          savings_budget: savingsBudget,
          goals_data: goalsData,
          savings_goal_percent: savingsGoalPercent,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Created story_mode_session:', data.id);
      return data;
    } catch (err) {
      console.error('❌ createStorySession error:', err.message, err.details || '');
      return null;
    }
  }

  /**
   * Update spending totals on an active story session.
   */
  async updateStorySessionSpending(sessionId, {
    weeklySpending,
    needsSpent = null,
    wantsSpent = null,
    savingsAmount = null,
    categorySpending = null,
    totalAllocated = null,
    actualSavingsPercent = null,
    goalsData = null,
  }) {
    try {
      const updates = {
        weekly_spending: weeklySpending,
        updated_at: new Date().toISOString(),
      };
      if (needsSpent !== null) updates.needs_spent = needsSpent;
      if (wantsSpent !== null) updates.wants_spent = wantsSpent;
      if (savingsAmount !== null) updates.savings_amount = savingsAmount;
      if (categorySpending !== null) updates.category_spending = categorySpending;
      if (totalAllocated !== null) updates.total_allocated = totalAllocated;
      if (actualSavingsPercent !== null) updates.actual_savings_percent = actualSavingsPercent;
      if (goalsData !== null) updates.goals_data = goalsData;

      const { error } = await supabase
        .from('story_mode_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;
    } catch (err) {
      console.error('❌ updateStorySessionSpending error:', err.message);
    }
  }

  /**
   * Mark a story session as completed (or failed).
   */
  async completeStorySession(sessionId, {
    passed,
    starsEarned = 0,
    xpEarned = 0,
    resultsData = null,
    weeklySpending = 0,
  }) {
    try {
      const { error } = await supabase
        .from('story_mode_sessions')
        .update({
          status: passed ? 'completed' : 'failed',
          passed,
          stars_earned: starsEarned,
          xp_earned: xpEarned,
          results_data: resultsData,
          weekly_spending: weeklySpending,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      console.log(`✅ Story session ${sessionId} completed (passed=${passed})`);
    } catch (err) {
      console.error('❌ completeStorySession error:', err.message);
    }
  }

  // ─── 2. custom_mode_sessions ──────────────────────────────

  /**
   * Insert a new custom mode session.
   */
  async createCustomSession({
    modeType,       // 'budgeting' | 'goals' | 'saving'
    customRules,    // e.g. { needs: 50, wants: 30, savings: 20 }
    weeklyBudget,
    startDate,
    endDate,
    customGoals = null,
    customSavingsTarget = null,
  }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('custom_mode_sessions')
        .insert({
          user_id: userId,
          mode_type: modeType,
          custom_rules: customRules,
          weekly_budget: weeklyBudget,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          custom_goals: customGoals,
          custom_savings_target: customSavingsTarget,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Created custom_mode_session:', data.id);
      return data;
    } catch (err) {
      console.error('❌ createCustomSession error:', err.message, err.details || '');
      return null;
    }
  }

  /**
   * Update custom session spending.
   */
  async updateCustomSessionSpending(sessionId, {
    weeklySpending,
    needsSpent = null,
    wantsSpent = null,
    savingsAmount = null,
    categorySpending = null,
    goalsProgress = null,
    customRules = null,
    customGoals = null,
    customSavingsTarget = null,
    modeType = null,
    endDate = null,
  }) {
    try {
      const updates = {
        weekly_spending: weeklySpending,
        updated_at: new Date().toISOString(),
      };
      if (needsSpent !== null) updates.needs_spent = needsSpent;
      if (wantsSpent !== null) updates.wants_spent = wantsSpent;
      if (savingsAmount !== null) updates.savings_amount = savingsAmount;
      if (categorySpending !== null) updates.category_spending = categorySpending;
      if (goalsProgress !== null) updates.goals_progress = goalsProgress;
      if (customRules !== null) updates.custom_rules = customRules;
      if (customGoals !== null) updates.custom_goals = customGoals;
      if (customSavingsTarget !== null) updates.custom_savings_target = Math.min(customSavingsTarget, 100);
      if (modeType !== null) updates.mode_type = modeType;
      if (endDate !== null) updates.end_date = endDate;

      const { error } = await supabase
        .from('custom_mode_sessions')
        .update(updates)
        .eq('id', sessionId);

      if (error) throw error;
    } catch (err) {
      console.error('❌ updateCustomSessionSpending error:', err.message);
    }
  }

  /**
   * Mark a custom session as completed (or failed).
   */
  async completeCustomSession(sessionId, {
    passed,
    xpEarned = 0,
    resultsData = null,
    weeklySpending = 0,
  }) {
    try {
      const { error } = await supabase
        .from('custom_mode_sessions')
        .update({
          status: passed ? 'completed' : 'failed',
          passed,
          xp_earned: xpEarned,
          results_data: resultsData,
          weekly_spending: weeklySpending,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      console.log(`✅ Custom session ${sessionId} completed (passed=${passed})`);
    } catch (err) {
      console.error('❌ completeCustomSession error:', err.message);
    }
  }

  // ─── 3. tutorial_progress ─────────────────────────────────

  /**
   * Upsert tutorial progress when the user starts / advances / completes the tutorial.
   */
  async saveTutorialProgress({ currentStep, stepsCompleted = [], tutorialCompleted = false }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('tutorial_progress')
        .upsert({
          user_id: userId,
          current_step: currentStep,
          steps_completed: stepsCompleted,
          tutorial_completed: tutorialCompleted,
          started_at: new Date().toISOString(),
          completed_at: tutorialCompleted ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      console.log(`✅ Tutorial progress saved (step ${currentStep}, completed=${tutorialCompleted})`);
    } catch (err) {
      console.error('❌ saveTutorialProgress error:', err.message);
    }
  }

  // ─── 4. transport_expenses ────────────────────────────────

  /**
   * Record a transport expense (commute fare or fuel) when the player travels between maps.
   */
  async recordTransportExpense({
    transportMode,     // 'commute' | 'car' | 'walk'
    originMap,
    destinationMap,
    fareAmount = null,
    fuelAmount = null,
    expenseId = null,
    sessionId = null,
  }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('transport_expenses')
        .insert({
          user_id: userId,
          transport_mode: transportMode,
          origin_map: originMap,
          destination_map: destinationMap,
          fare_amount: fareAmount,
          fuel_amount: fuelAmount,
          expense_id: expenseId,
          session_id: sessionId,
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Recorded transport_expense:', data.id);
      return data;
    } catch (err) {
      console.error('❌ recordTransportExpense error:', err.message);
      return null;
    }
  }

  // ─── 5. character_customizations ──────────────────────────

  /**
   * Upsert character selection and unlocked items.
   * If selectedCharacter is undefined, only unlocked_characters is updated.
   */
  async saveCharacterCustomization({
    selectedCharacter,
    unlockedCharacters = ['girl', 'jasper'],
    equippedOutfit = null,
  }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      const upsertData = {
        user_id: userId,
        unlocked_characters: unlockedCharacters,
        equipped_outfit: equippedOutfit,
        updated_at: new Date().toISOString(),
      };

      // Only set selected_character if explicitly provided
      if (selectedCharacter !== undefined) {
        upsertData.selected_character = selectedCharacter;
      }

      const { error } = await supabase
        .from('character_customizations')
        .upsert(upsertData, { onConflict: 'user_id' });

      if (error) throw error;
      console.log(`✅ Character customization saved (selected=${selectedCharacter || 'unchanged'}, unlocked=${unlockedCharacters.length})`);
    } catch (err) {
      console.error('❌ saveCharacterCustomization error:', err.message);
    }
  }

  /**
   * Load character customization from Supabase.
   */
  async loadCharacterCustomization() {
    try {
      const userId = await this._getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('character_customizations')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('❌ loadCharacterCustomization error:', err.message);
      return null;
    }
  }

  // ─── 5b. Store purchases (persisted in customization_data JSONB) ──

  /**
   * Save store purchase data (purchased item IDs + spent XP) to Supabase.
   * Uses the customization_data JSONB column on character_customizations.
   */
  async saveStorePurchases({ purchasedItems, spentXP, unlockedCharacters }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('character_customizations')
        .upsert({
          user_id: userId,
          unlocked_characters: unlockedCharacters,
          customization_data: {
            purchased_items: purchasedItems,
            spent_xp: spentXP,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      console.log(`✅ Store purchases saved to Supabase (${purchasedItems.length} items, ${spentXP} XP spent)`);
    } catch (err) {
      console.error('❌ saveStorePurchases error:', err.message);
    }
  }

  /**
   * Load store purchase data from Supabase.
   * Returns { purchasedItems, spentXP, unlockedCharacters } or null.
   */
  async loadStorePurchases() {
    try {
      const userId = await this._getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('character_customizations')
        .select('unlocked_characters, customization_data')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const customData = data.customization_data || {};
      return {
        purchasedItems: customData.purchased_items || [],
        spentXP: customData.spent_xp || 0,
        unlockedCharacters: data.unlocked_characters || ['girl', 'jasper'],
      };
    } catch (err) {
      console.error('❌ loadStorePurchases error:', err.message);
      return null;
    }
  }

  // ─── 6. game_activity_log ─────────────────────────────────

  /**
   * Log a game activity event.
   * @param {string} activityType - e.g. 'expense_recorded', 'map_travel', 'level_start',
   *   'level_complete', 'tutorial_step', 'achievement_earned', 'closet_visit', 'goal_allocation'
   */
  async logActivity({
    activityType,
    mapId = null,
    locationId = null,
    details = null,
    amount = null,
    xpEarned = 0,
    sessionId = null,
  }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('game_activity_log')
        .insert({
          user_id: userId,
          session_id: sessionId,
          activity_type: activityType,
          map_id: mapId,
          location_id: locationId,
          details,
          amount,
          xp_earned: xpEarned,
        });

      if (error) throw error;
    } catch (err) {
      // Activity log is non-critical — don't crash
      console.warn('⚠️ logActivity error:', err.message);
    }
  }

  // ─── 8. Load all saved game progress on startup ───────────

  /**
   * Fetches user_levels, character_customizations, tutorial_progress,
   * and any active (in_progress) story/custom session from Supabase.
   * Returns a single object that GameScreen can use to hydrate local state.
   */
  async loadGameProgress() {
    try {
      const userId = await this._getUserId();
      if (!userId) return null;

      // Fire all reads in parallel
      const [
        userLevelsRes,
        characterRes,
        tutorialRes,
        activeStoryRes,
        activeCustomRes,
      ] = await Promise.all([
        supabase
          .from('user_levels')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('character_customizations')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('tutorial_progress')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('story_mode_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('custom_mode_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const userLevels = userLevelsRes.data;
      const character = characterRes.data;
      const tutorial = tutorialRes.data;
      const activeStory = activeStoryRes.data;
      const activeCustom = activeCustomRes.data;

      // Derive unlocked levels from user_levels story completion booleans
      const unlocked = [1]; // Level 1 always unlocked
      if (userLevels?.story_level_1_completed) unlocked.push(2);
      if (userLevels?.story_level_2_completed) unlocked.push(3);

      // Derive intro-seen flags from user_levels
      const introSeen = {
        1: !!userLevels?.intro_seen_level_1,
        2: !!userLevels?.intro_seen_level_2,
        3: !!userLevels?.intro_seen_level_3,
      };

      console.log('📦 Loaded game progress:', {
        hasUserLevels: !!userLevels,
        unlockedLevels: unlocked,
        introSeen,
        selectedCharacter: character?.selected_character || 'girl',
        tutorialCompleted: tutorial?.tutorial_completed || false,
        activeStorySession: activeStory?.id || null,
        activeCustomSession: activeCustom?.id || null,
      });

      return {
        userLevels,
        character,
        tutorial,
        activeStory,
        activeCustom,
        unlockedLevels: unlocked,
        introSeen,
      };
    } catch (err) {
      console.error('❌ loadGameProgress error:', err.message);
      return null;
    }
  }

  // ─── 9. Mark story level completed on user_levels ─────────

  /**
   * Directly set story_level_X_completed = true on user_levels.
   * This is a safety net in addition to the DB trigger.
   */
  async markStoryLevelCompleted(level, starsEarned = 0) {
    try {
      const userId = await this._getUserId();
      if (!userId) return;

      const updates = { updated_at: new Date().toISOString() };
      if (level === 1) {
        updates.story_level_1_completed = true;
        updates.story_level_1_stars = starsEarned;
      } else if (level === 2) {
        updates.story_level_2_completed = true;
        updates.story_level_2_stars = starsEarned;
      } else if (level === 3) {
        updates.story_level_3_completed = true;
        updates.story_level_3_stars = starsEarned;
      }

      const { error } = await supabase
        .from('user_levels')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;
      console.log(`✅ Marked story level ${level} completed (${starsEarned} stars)`);
    } catch (err) {
      console.error('❌ markStoryLevelCompleted error:', err.message);
    }
  }

  // ─── 7. user_levels — game-stat increments ────────────────

  /**
   * Increment game-specific counters on user_levels (total_xp, maps traveled, etc.)
   * Uses upsert-then-update to avoid race-condition duplicate-key errors.
   */
  async incrementUserLevelStats({
    xpToAdd = 0,
    expensesRecorded = 0,
    mapsTraveled = 0,
    goalsAchieved = 0,
    achievementsEarned = 0,
  }) {
    try {
      const userId = await this._getUserId();
      if (!userId) throw new Error('Not authenticated');

      // Step 1: Ensure the row exists (race-safe upsert with DO NOTHING semantics)
      await supabase
        .from('user_levels')
        .upsert(
          {
            user_id: userId,
            total_xp: 0,
            current_level: 1,
            level_name: 'Rookie',
            total_expenses_recorded: 0,
            total_maps_traveled: 0,
            total_goals_achieved: 0,
            achievements_earned: 0,
          },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );

      // Step 2: Read the current values
      const { data: existing, error: fetchErr } = await supabase
        .from('user_levels')
        .select('total_xp, total_expenses_recorded, total_maps_traveled, total_goals_achieved, achievements_earned')
        .eq('user_id', userId)
        .single();

      if (fetchErr) throw fetchErr;

      // Step 3: Update with incremented values
      const newXp = (existing.total_xp || 0) + xpToAdd;
      const { error: updateErr } = await supabase
        .from('user_levels')
        .update({
          total_xp: newXp,
          current_level: this._calculateLevelFromXp(newXp),
          level_name: this._getLevelName(this._calculateLevelFromXp(newXp)),
          total_expenses_recorded: (existing.total_expenses_recorded || 0) + expensesRecorded,
          total_maps_traveled: (existing.total_maps_traveled || 0) + mapsTraveled,
          total_goals_achieved: (existing.total_goals_achieved || 0) + goalsAchieved,
          achievements_earned: (existing.achievements_earned || 0) + achievementsEarned,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateErr) throw updateErr;
    } catch (err) {
      console.error('❌ incrementUserLevelStats error:', err.message);
    }
  }

  // ─── 10. Intro-seen flags (one-time level intros) ───────

  /**
   * Mark a story level intro as seen for the current user.
   * Persists to the `user_levels` table (intro_seen_level_X column).
   */
  async markIntroSeen(level) {
    try {
      const userId = await this._getUserId();
      if (!userId) return;

      const col = `intro_seen_level_${level}`;
      // Ensure the row exists first
      await supabase
        .from('user_levels')
        .upsert(
          { user_id: userId },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );

      const { error } = await supabase
        .from('user_levels')
        .update({ [col]: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;
      console.log(`✅ Marked intro seen for level ${level}`);
    } catch (err) {
      console.error('❌ markIntroSeen error:', err.message);
    }
  }

  /**
   * Load which level intros have been seen from the DB.
   * Returns an object like { 1: true, 2: false, 3: false }.
   */
  async getIntroSeenLevels() {
    try {
      const userId = await this._getUserId();
      if (!userId) return {};

      const { data, error } = await supabase
        .from('user_levels')
        .select('intro_seen_level_1, intro_seen_level_2, intro_seen_level_3')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return {};

      return {
        1: !!data.intro_seen_level_1,
        2: !!data.intro_seen_level_2,
        3: !!data.intro_seen_level_3,
      };
    } catch (err) {
      console.error('❌ getIntroSeenLevels error:', err.message);
      return {};
    }
  }

  // ─── 11. Find active session by level ─────────────────────

  /**
   * Find an in-progress story session for a specific level.
   * Used to resume instead of creating duplicates.
   */
  async findActiveStorySession(level) {
    try {
      const userId = await this._getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('story_mode_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('level', level)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('❌ findActiveStorySession error:', err.message);
      return null;
    }
  }

  /**
   * Find ANY in-progress story session (regardless of level).
   * Used by the 'Single Active Session' model to auto-resume.
   */
  async findAnyActiveStorySession() {
    try {
      const userId = await this._getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('story_mode_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('❌ findAnyActiveStorySession error:', err.message);
      return null;
    }
  }

  // ─── 12. Abandon sessions ─────────────────────────────────

  /**
   * Mark a story session as 'abandoned'.
   * Resets progress for the level — the user can start fresh.
   */
  async abandonStorySession(sessionId) {
    try {
      const { error } = await supabase
        .from('story_mode_sessions')
        .update({
          status: 'abandoned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      console.log(`✅ Story session ${sessionId} abandoned`);
    } catch (err) {
      console.error('❌ abandonStorySession error:', err.message);
    }
  }

  /**
   * Mark a custom session as 'abandoned'.
   */
  async abandonCustomSession(sessionId) {
    try {
      const { error } = await supabase
        .from('custom_mode_sessions')
        .update({
          status: 'abandoned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      console.log(`✅ Custom session ${sessionId} abandoned`);
    } catch (err) {
      console.error('❌ abandonCustomSession error:', err.message);
    }
  }

  /**
   * Find an in-progress custom mode session.
   */
  async findActiveCustomSession() {
    try {
      const userId = await this._getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('custom_mode_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('❌ findActiveCustomSession error:', err.message);
      return null;
    }
  }

  // XP → level calculation (matches rank system)
  _calculateLevelFromXp(xp) {
    if (xp >= 5000) return 10;
    if (xp >= 4000) return 9;
    if (xp >= 3200) return 8;
    if (xp >= 2500) return 7;
    if (xp >= 1900) return 6;
    if (xp >= 1400) return 5;
    if (xp >= 1000) return 4;
    if (xp >= 600) return 3;
    if (xp >= 300) return 2;
    return 1;
  }

  _getLevelName(level) {
    const names = {
      1: 'Rookie',
      2: 'Saver',
      3: 'Planner',
      4: 'Budgeteer',
      5: 'Strategist',
      6: 'Investor',
      7: 'Financier',
      8: 'Tycoon',
      9: 'Mogul',
      10: 'Economy God',
    };
    return names[level] || 'Rookie';
  }
}

// Export a singleton instance
const gameDatabaseService = new GameDatabaseService();
export default gameDatabaseService;
