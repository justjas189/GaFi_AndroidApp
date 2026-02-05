# MoneyTrack Database Schema Analysis

## 📋 Overview

This analysis compares the current database schema with the app's features to identify needed updates, deletions, and new table suggestions.

---

## 🟢 TABLES CURRENTLY IN USE (Keep & Maintain)

### Core Financial Tables
| Table | Status | Used By |
|-------|--------|---------|
| `expenses` | ✅ Active | DataContext, BuildScreen, Dashboard |
| `budgets` | ✅ Active | BudgetDatabaseService, Story Mode |
| `budget_categories` | ✅ Active | Budget tracking, 50/30/20 rule |
| `budget_alerts` | ✅ Active | BudgetAlertManager |
| `profiles` | ✅ Active | ProfileService, Friends display |

### Gamification Tables
| Table | Status | Used By |
|-------|--------|---------|
| `user_levels` | ✅ Active | LeaderboardService, GamifiedSavingsService |
| `user_achievements` | ✅ Active | AchievementService, SavingsGoalsDatabaseService |
| `achievement_definitions` | ✅ Active | AchievementService |
| `leaderboards` | ✅ Active | GamifiedSavingsService |
| `leaderboard_achievements` | ⚠️ Review | Possibly redundant with user_achievements |

### Savings Tables
| Table | Status | Used By |
|-------|--------|---------|
| `savings_goals` | ✅ Active | SavingsGoalsDatabaseService |
| `savings_goal_transactions` | ✅ Active | SavingsGoalsDatabaseService |
| `gamified_savings_goals` | ✅ Active | GamifiedSavingsService |
| `savings_transactions` | ✅ Active | GamifiedSavingsService, LeaderboardService |
| `savings_level_configs` | ✅ Active | GamifiedSavingsService, LeaderboardService |

### Social Tables
| Table | Status | Used By |
|-------|--------|---------|
| `friends` | ✅ Active | FriendService, AchievementService |

### Learning Tables
| Table | Status | Used By |
|-------|--------|---------|
| `learning_modules` | ✅ Active | LearningProgressDatabaseService |
| `learning_progress` | ✅ Active | LearningProgressDatabaseService |
| `learning_quizzes` | ✅ Active | LearningProgressDatabaseService |
| `user_learning_progress` | ✅ Active | LearningProgressDatabaseService |
| `user_quiz_results` | ✅ Active | LearningProgressDatabaseService |
| `user_favorite_tips` | ✅ Active | LearningProgressDatabaseService |
| `user_learning_stats` | ✅ Active | LearningProgressDatabaseService |

### Authentication/School Tables
| Table | Status | Used By |
|-------|--------|---------|
| `user_profiles` | ✅ Active | SchoolAuthService (school-wide auth) |
| `school_id_registry` | ✅ Active | SchoolAuthService |
| `user_permissions` | ✅ Active | Role-based access control |
| `role_permissions` | ✅ Active | RBAC mapping |

### Chat Tables
| Table | Status | Used By |
|-------|--------|---------|
| `chatbot_interactions` | ✅ Active | Chatbot logging |
| `chat_history` | ✅ Active | ChatHistoryService |

---

## 🟡 TABLES THAT NEED UPDATING

### 1. `user_levels` - Add Story Mode Progress Fields

**Current Structure:**
```sql
- user_id, current_level, total_xp, level_name, achievements_earned
```

**Suggested Updates:**
```sql
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS story_level_1_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS story_level_2_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS story_level_3_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS story_level_1_stars INTEGER DEFAULT 0; -- 0-3 stars
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS story_level_2_stars INTEGER DEFAULT 0;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS story_level_3_stars INTEGER DEFAULT 0;
ALTER TABLE user_levels ADD COLUMN IF NOT EXISTS custom_mode_completions INTEGER DEFAULT 0;
```

### 2. `user_achievements` - Add More Achievement Types

**Current Fields:** `user_id, achievement_id, earned_at, progress_data`

**Suggested Updates:**
```sql
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS category VARCHAR(50); -- 'story', 'custom', 'social', 'financial'
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS stars_earned INTEGER DEFAULT 0; -- For story levels
```

### 3. `profiles` - Add Character Selection

**Suggested Updates:**
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_character VARCHAR(20) DEFAULT 'girl'; -- 'girl' or 'jasper'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS character_customizations JSONB DEFAULT '{}';
```

### 4. `expenses` - Add Location/Game Context

**Suggested Updates:**
```sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS location VARCHAR(50); -- 'canteen', 'mall', etc.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recorded_from VARCHAR(20) DEFAULT 'manual'; -- 'manual', 'game', 'chatbot'
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS game_session_id UUID; -- Link to game session
```

---

## 🔴 TABLES TO CONSIDER DELETING/REVIEWING

| Table | Reason | Recommendation |
|-------|--------|----------------|
| `notes` | Not used in codebase | Review usage, DELETE if unused |
| `chatbot_transactions` | Duplicate of chatbot_interactions? | Review and MERGE or DELETE |
| `user_interactions` | Overlaps with user_achievements | Review - may be redundant |
| `leaderboard_achievements` | Potentially duplicate | MERGE with user_achievements |

---

## 🆕 NEW TABLES NEEDED

### 1. `story_mode_sessions` - Track Story Mode Progress

```sql
CREATE TABLE IF NOT EXISTS story_mode_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3), -- Story level 1, 2, or 3
  level_type VARCHAR(20) NOT NULL, -- 'budgeting', 'goals', 'saving'
  weekly_budget DECIMAL(12, 2) NOT NULL,
  weekly_spending DECIMAL(12, 2) DEFAULT 0,
  
  -- Level 1 (Budgeting) specific
  needs_spent DECIMAL(12, 2) DEFAULT 0,
  wants_spent DECIMAL(12, 2) DEFAULT 0,
  savings_amount DECIMAL(12, 2) DEFAULT 0,
  
  -- Level 2 (Goals) specific
  goals_data JSONB, -- Array of {goal_id, name, target, allocated}
  
  -- Level 3 (Saving) specific
  savings_percentage DECIMAL(5, 2),
  
  -- Session tracking
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed', 'abandoned'
  
  -- Results
  passed BOOLEAN,
  stars_earned INTEGER DEFAULT 0 CHECK (stars_earned BETWEEN 0 AND 3),
  results_data JSONB, -- Detailed completion results
  xp_earned INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_story_sessions_user ON story_mode_sessions(user_id);
CREATE INDEX idx_story_sessions_level ON story_mode_sessions(level);
CREATE INDEX idx_story_sessions_status ON story_mode_sessions(status);
```

### 2. `custom_mode_sessions` - Track Custom Mode Progress

```sql
CREATE TABLE IF NOT EXISTS custom_mode_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode_type VARCHAR(20) NOT NULL, -- 'budgeting', 'goals', 'saving'
  
  -- Custom Rules
  custom_rules JSONB NOT NULL, -- {needs: 50, wants: 30, savings: 20} or custom goals
  weekly_budget DECIMAL(12, 2) NOT NULL,
  
  -- Progress
  weekly_spending DECIMAL(12, 2) DEFAULT 0,
  category_spending JSONB, -- {category: amount}
  
  -- Session tracking
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(20) DEFAULT 'in_progress',
  
  -- Results
  passed BOOLEAN,
  results_data JSONB,
  xp_earned INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_custom_sessions_user ON custom_mode_sessions(user_id);
```

### 3. `transport_expenses` - Track Travel Costs

```sql
CREATE TABLE IF NOT EXISTS transport_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  
  transport_mode VARCHAR(20) NOT NULL, -- 'commute', 'car', 'walk'
  origin_map VARCHAR(20) NOT NULL, -- 'school', 'dorm', 'mall'
  destination_map VARCHAR(20) NOT NULL,
  
  fare_amount DECIMAL(12, 2), -- For commute
  fuel_amount DECIMAL(12, 2), -- For car
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transport_user ON transport_expenses(user_id);
CREATE INDEX idx_transport_mode ON transport_expenses(transport_mode);
```

### 4. `character_customizations` - Store Character Selections

```sql
CREATE TABLE IF NOT EXISTS character_customizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  selected_character VARCHAR(20) DEFAULT 'girl', -- 'girl', 'jasper'
  unlocked_characters TEXT[] DEFAULT ARRAY['girl', 'jasper'],
  
  -- Future: outfit/accessory customizations
  equipped_outfit VARCHAR(50),
  equipped_accessories TEXT[],
  customization_data JSONB DEFAULT '{}',
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_character_user ON character_customizations(user_id);
```

### 5. `game_activity_log` - Track All Game Activities

```sql
CREATE TABLE IF NOT EXISTS game_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID, -- Link to story/custom session
  
  activity_type VARCHAR(50) NOT NULL, -- 'expense', 'travel', 'goal_allocation', 'closet_visit', 'level_start', 'level_complete'
  map_id VARCHAR(20), -- Current map
  location_id VARCHAR(50), -- Specific location
  
  details JSONB,
  xp_earned INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON game_activity_log(user_id);
CREATE INDEX idx_activity_type ON game_activity_log(activity_type);
CREATE INDEX idx_activity_session ON game_activity_log(session_id);
```

### 6. `tutorial_progress` - Track Tutorial Completion

```sql
CREATE TABLE IF NOT EXISTS tutorial_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  tutorial_completed BOOLEAN DEFAULT FALSE,
  tutorial_step INTEGER DEFAULT 0,
  
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

---

## 📊 SUMMARY

| Action | Count | Tables |
|--------|-------|--------|
| ✅ Keep | 25+ | Core tables in active use |
| 🔄 Update | 4 | user_levels, user_achievements, profiles, expenses |
| ❌ Review/Delete | 4 | notes, chatbot_transactions, user_interactions, leaderboard_achievements |
| 🆕 Create | 6 | story_mode_sessions, custom_mode_sessions, transport_expenses, character_customizations, game_activity_log, tutorial_progress |

---

## 🚀 RECOMMENDED MIGRATION ORDER

1. **Phase 1 - Updates:**
   - Add columns to `user_levels` for story progress
   - Add character field to `profiles`
   - Add game context columns to `expenses`

2. **Phase 2 - New Tables:**
   - Create `story_mode_sessions`
   - Create `custom_mode_sessions`
   - Create `transport_expenses`

3. **Phase 3 - Enhanced Tracking:**
   - Create `character_customizations`
   - Create `game_activity_log`
   - Create `tutorial_progress`

4. **Phase 4 - Cleanup:**
   - Review and remove unused tables
   - Merge duplicate/overlapping tables

---

*Generated: Analysis based on codebase grep search and feature review*
