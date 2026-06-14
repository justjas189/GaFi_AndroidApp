const levelsData = require('../../levels.json');

export const STORY_DAY_COUNTS = {
  1: 3,
  2: 3,
  3: 4,
};

export const NEEDS_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Groceries',
  'School Supplies',
  'Utilities',
  'Health',
  'Education',
];

export const WANTS_CATEGORIES = [
  'Shopping',
  'Electronics',
  'Entertainment',
  'Other',
];

const DAILY_TASK_RULES = {
  '1_1_1': {
    type: 'all_of',
    conditions: [
      { type: 'expense_count', exact: 2, categoryGroup: 'needs' },
      { type: 'expense_count', exact: 1, categoryGroup: 'wants' },
    ],
  },
  '1_1_2': {
    type: 'all_of',
    conditions: [
      { type: 'travel_destination_any', destinations: ['school', 'office'] },
      { type: 'expense_count', min: 1, categories: ['Transport'] },
    ],
  },
  '1_1_3': {
    type: 'all_of',
    conditions: [
      { type: 'spending_ratio_max', categoryGroup: 'needs', max: 0.5 },
      { type: 'spending_ratio_max', categoryGroup: 'wants', max: 0.3 },
    ],
  },
  '1_2_1': {
    type: 'distinct_categories',
    min: 4,
  },
  '1_2_2': {
    type: 'distinct_categories',
    min: 2,
    categoryGroup: 'needs',
  },
  '1_2_3': {
    type: 'max_single_category_ratio',
    max: 0.4,
  },
  '1_3_1': {
    type: 'expense_count',
    min: 4,
  },
  '1_3_2': {
    type: 'expense_count',
    min: 1,
    categories: ['Other'],
  },
  '1_3_3': {
    type: 'all_of',
    conditions: [
      { type: 'spending_ratio_max', categoryGroup: 'needs', max: 0.5 },
      { type: 'spending_ratio_max', categoryGroup: 'wants', max: 0.3 },
      { type: 'level_savings_rate_min', min: 0.2 },
    ],
  },
  // Level 2 — Goals: simplified essential logging + the "Allocate to Goals" mechanic.
  // Day 4 (Inflation): log a basic essential, then hedge purchasing power via allocation.
  '2_4_1': {
    type: 'expense_count',
    min: 1,
    categories: ['Food & Dining', 'Transport'],
  },
  '2_4_2': {
    type: 'goal_allocation_total_min',
    min: 50,
    goalNames: ['Emergency Fund', 'Fun Money'],
  },
  // Day 5 (Risk vs. Return): cover one essential, then split capital across a low- and high-risk goal.
  '2_5_1': {
    type: 'expense_count',
    min: 2,
    categories: ['Food & Dining', 'Transport'],
  },
  '2_5_2': {
    type: 'all_of',
    conditions: [
      { type: 'goal_allocation_min', goalName: 'Emergency Fund', min: 20 },
      { type: 'goal_allocation_min', goalName: 'Fun Money', min: 20 },
    ],
  },
  // Day 6 (Rebalancing): cover one essential, then rebalance goals to even progress (portfolio parity).
  '2_6_1': {
    type: 'expense_count',
    min: 3,
    categories: ['Food & Dining', 'Transport', 'Groceries'],
  },
  '2_6_2': {
    type: 'all_of',
    conditions: [
      { type: 'goal_allocation_actions_min', min: 2 },
      { type: 'goal_progress_gap_max', goals: ['Emergency Fund', 'Fun Money'], maxGap: 0.15 },
    ],
  },
  // Level 3 — Saving (Days 7 - 10)
  '3_7_1': {
    type: 'all_of',
    conditions: [
      { type: 'expense_count', exact: 1, categoryGroup: 'needs' },
      { type: 'expense_count', max: 0, categoryGroup: 'wants' },
    ],
  },
  '3_7_2': {
    type: 'day_spending_pct_weekly_budget_max',
    max: 0.20,
  },
  '3_8_1': {
    type: 'all_of',
    conditions: [
      { type: 'travel_count', min: 1, mode: 'commute' },
      { type: 'expense_count', min: 1, categories: ['Transport'] },
    ],
  },
  '3_8_2': {
    type: 'day_spending_pct_weekly_budget_max',
    max: 0.15,
  },
  '3_9_1': {
    type: 'all_of',
    conditions: [
      { type: 'mall_visited' },
      { type: 'expense_count', exact: 1, categoryGroup: 'needs' },
    ],
  },
  '3_9_2': {
    type: 'expense_count',
    max: 0,
    categoryGroup: 'wants',
  },
  '3_10_1': {
    type: 'level_savings_rate_min',
    min: 0.3,
  },
  '3_10_2': {
    type: 'all_of',
    conditions: [
      { type: 'expense_count', min: 2 },
      { type: 'spending_ratio_max', categoryGroup: 'wants', max: 0.1 },
    ],
  },
};

const DAILY_TASK_SUFFIX = {
  // Level 1 Suffixes
  '1_1_1': 'exact_2_needs_1_wants',
  '1_1_2': 'school_or_office_travel_and_transport',
  '1_1_3': 'needs_50_wants_30',
  '1_2_1': 'four_categories_logged',
  '1_2_2': 'two_distinct_needs',
  '1_2_3': 'single_category_under_40',
  '1_3_1': 'four_expenses_logged',
  '1_3_2': 'other_unplanned_expense',
  '1_3_3': 'division_50_30_20_intact',
  // Level 2 Suffixes
  '2_4_1': 'essential_log_food_or_transport',
  '2_4_2': 'allocate_min_50_inflation_hedge',
  '2_5_1': 'essential_log_food_or_transport',
  '2_5_2': 'allocate_low_and_high_risk_goals',
  '2_6_1': 'essential_log_food_or_transport',
  '2_6_2': 'rebalance_goals_even_progress',
  // Level 3 Suffixes
  '3_7_1': 'one_needs_no_wants',
  '3_7_2': 'spend_under_20pct_weekly_budget',
  '3_8_1': 'commute_and_transport_log',
  '3_8_2': 'spend_under_15pct_weekly_budget',
  '3_9_1': 'mall_visit_one_needs',
  '3_9_2': 'no_wants_expenses_today',
  '3_10_1': 'savings_rate_at_least_30pct',
  '3_10_2': 'two_expenses_wants_under_10pct',
};

const DAILY_TASK_REWARD_XP = {
  // Level 1 XP
  '1_1_1': 20,
  '1_1_2': 20,
  '1_1_3': 20,
  '1_2_1': 25,
  '1_2_2': 25,
  '1_2_3': 25,
  '1_3_1': 30,
  '1_3_2': 30,
  '1_3_3': 35,
  // Level 2 XP
  '2_4_1': 30,
  '2_4_2': 40,
  '2_5_1': 35,
  '2_5_2': 45,
  '2_6_1': 35,
  '2_6_2': 50,
  // Level 3 XP
  '3_7_1': 35,
  '3_7_2': 35,
  '3_8_1': 40,
  '3_8_2': 40,
  '3_9_1': 45,
  '3_9_2': 45,
  '3_10_1': 50,
  '3_10_2': 60,
};

const buildLevelConfigFromJson = (level) => {
  const levelRows = levelsData
    .filter((row) => row.level === level)
    .sort((a, b) => a.day - b.day);

  if (levelRows.length === 0) {
    return null;
  }

  const displayTotalDays = levelRows[levelRows.length - 1].day;

  return {
    levelName: levelRows[0].levelName,
    totalDays: levelRows.length,
    displayTotalDays,
    days: levelRows.map((row, index) => {
      const internalDayNumber = index + 1;
      const displayDayNumber = row.day;

      const tasks = row.tasks.map((taskText, taskIndex) => {
        const taskNumber = taskIndex + 1;
        const ruleKey = `${level}_${displayDayNumber}_${taskNumber}`;
        const validationLogic = DAILY_TASK_RULES[ruleKey];
        const suffix = DAILY_TASK_SUFFIX[ruleKey] || `task_${taskNumber}`;

        if (!validationLogic) {
          throw new Error(`Missing validation rule for story daily task key: ${ruleKey}`);
        }

        return {
          id: `L${level}_D${displayDayNumber}_T${taskNumber}`,
          conditionKey: `l${level}_d${displayDayNumber}_t${taskNumber}_${suffix}`,
          requiredAppAction: taskText,
          validationLogic,
          failMessage: `Task ${taskNumber} incomplete: ${taskText}`,
          successMessage: `Task ${taskNumber} complete: ${taskText}`,
          reward: { xp: DAILY_TASK_REWARD_XP[ruleKey] || 20 },
        };
      });

      return {
        dayNumber: internalDayNumber,
        displayDayNumber,
        financialConcept: row.financialConcept,
        koinDialogue: {
          student: row.koinDialogue,
          employee: row.koinDialogue,
        },
        tasks,
      };
    }),
  };
};

export const STORY_DAILY_TASKS = {
  1: buildLevelConfigFromJson(1),
  2: buildLevelConfigFromJson(2),
  3: buildLevelConfigFromJson(3),
};

export const getStoryLevelTasks = (level) => STORY_DAILY_TASKS[level] || null;

export const getStoryDayTasks = (level, dayNumber) => {
  const levelConfig = STORY_DAILY_TASKS[level];
  return levelConfig?.days?.find((d) => d.dayNumber === dayNumber) || null;
};

export const getStoryDayDisplayNumber = (level, dayNumber) => {
  const dayConfig = getStoryDayTasks(level, dayNumber);
  return dayConfig?.displayDayNumber || dayNumber;
};

export const getStoryLevelDisplayTotalDays = (level) => {
  const levelConfig = STORY_DAILY_TASKS[level];
  return levelConfig?.displayTotalDays || levelConfig?.totalDays || 0;
};
