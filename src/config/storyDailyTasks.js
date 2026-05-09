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
  '2_4_1': {
    type: 'all_of',
    conditions: [
      { type: 'expense_count', min: 1, categoryGroup: 'needs', destinations: ['home'] },
      { type: 'expense_count', min: 1, categoryGroup: 'needs', destinations: ['school', 'office'] },
    ],
  },
  '2_4_2': {
    type: 'expense_count',
    min: 1,
    categories: ['Other'],
  },
  '2_4_3': {
    type: 'all_of',
    conditions: [
      { type: 'spending_ratio_max', categoryGroup: 'needs', max: 0.5 },
      { type: 'day_spending_pct_daily_budget_max', max: 0.85 },
    ],
  },
  '2_5_1': {
    type: 'expense_count',
    exact: 3,
    categoryGroup: 'needs',
  },
  '2_5_2': {
    type: 'all_of',
    conditions: [
      { type: 'expense_count', exact: 1, categoryGroup: 'wants' },
      { type: 'travel_destination_any', destinations: ['store'] },
    ],
  },
  '2_5_3': {
    type: 'spending_ratio_max',
    categoryGroup: 'wants',
    max: 0.3,
  },
  '2_6_1': {
    type: 'all_of',
    conditions: [
      { type: 'expense_count', exact: 2, categoryGroup: 'needs' },
      { type: 'expense_count', exact: 2, categoryGroup: 'wants' },
    ],
  },
  '2_6_2': {
    type: 'all_of',
    conditions: [
      { type: 'spending_ratio_range', categoryGroup: 'needs', min: 0.4, max: 0.6 },
      { type: 'spending_ratio_range', categoryGroup: 'wants', min: 0.2, max: 0.4 },
    ],
  },
  '2_6_3': {
    type: 'distinct_destinations_min',
    min: 3,
  },
};

const DAILY_TASK_SUFFIX = {
  '1_1_1': 'exact_2_needs_1_wants',
  '1_1_2': 'school_or_office_travel_and_transport',
  '1_1_3': 'needs_50_wants_30',
  '1_2_1': 'four_categories_logged',
  '1_2_2': 'two_distinct_needs',
  '1_2_3': 'single_category_under_40',
  '1_3_1': 'four_expenses_logged',
  '1_3_2': 'other_unplanned_expense',
  '1_3_3': 'division_50_30_20_intact',
  '2_4_1': 'needs_at_home_and_school',
  '2_4_2': 'other_inflation_expense',
  '2_4_3': 'needs_50_spend_under_85',
  '2_5_1': 'exactly_3_needs',
  '2_5_2': 'one_want_at_store',
  '2_5_3': 'wants_under_30pct',
  '2_6_1': 'balanced_2_needs_2_wants',
  '2_6_2': 'needs_40_60_wants_20_40',
  '2_6_3': 'three_locations_visited',
};

const DAILY_TASK_REWARD_XP = {
  '1_1_1': 20,
  '1_1_2': 20,
  '1_1_3': 20,
  '1_2_1': 25,
  '1_2_2': 25,
  '1_2_3': 25,
  '1_3_1': 30,
  '1_3_2': 30,
  '1_3_3': 35,
  '2_4_1': 30,
  '2_4_2': 35,
  '2_4_3': 35,
  '2_5_1': 40,
  '2_5_2': 40,
  '2_5_3': 40,
  '2_6_1': 45,
  '2_6_2': 50,
  '2_6_3': 45,
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
  3: {
    levelName: 'Saving',
    totalDays: 4,
    days: [
      {
        dayNumber: 1,
        koinDialogue: {
          student: 'Save-first day. Keep spending super lean and essentials-only.',
          employee: 'Cash-retention kickoff. Minimal spend, zero impulse categories.',
        },
        tasks: [
          {
            id: 'L3_D1_T1',
            conditionKey: 'l3_d1_t1_single_needs_expense_only',
            requiredAppAction: 'Log exactly 1 expense and make it a Needs category.',
            validationLogic: {
              type: 'all_of',
              conditions: [
                { type: 'expense_count', exact: 1 },
                { type: 'expense_count', min: 1, categoryGroup: 'needs' },
              ],
            },
            failMessage: 'Task 1 incomplete: log exactly one Needs expense.',
            successMessage: 'Task 1 complete: lean essentials spending achieved.',
            reward: { xp: 35 },
          },
          {
            id: 'L3_D1_T2',
            conditionKey: 'l3_d1_t2_no_impulse_categories',
            requiredAppAction: 'Do not log Shopping, Electronics, or Entertainment.',
            validationLogic: {
              type: 'expense_count',
              max: 0,
              categories: ['Shopping', 'Electronics', 'Entertainment'],
            },
            failMessage: 'Task 2 incomplete: impulse categories must stay at zero.',
            successMessage: 'Task 2 complete: no impulse-category spending logged.',
            reward: { xp: 35 },
          },
        ],
      },
      {
        dayNumber: 2,
        koinDialogue: {
          student: 'Commute optimization mission. Pick the cheaper ride and protect your savings.',
          employee: 'Cost-control day. Use an efficient transport choice and keep the rest tight.',
        },
        tasks: [
          {
            id: 'L3_D2_T1',
            conditionKey: 'l3_d2_t1_commute_transport_logged',
            requiredAppAction: 'Travel once using commute.',
            validationLogic: {
              type: 'travel_count',
              min: 1,
              mode: 'commute',
            },
            failMessage: 'Task 1 incomplete: complete at least one commute travel.',
            successMessage: 'Task 1 complete: commute travel recorded.',
            reward: { xp: 40 },
          },
          {
            id: 'L3_D2_T2',
            conditionKey: 'l3_d2_t2_day_spend_under_15pct_weekly_budget',
            requiredAppAction: 'Keep today spending at or below 15% of weekly budget.',
            validationLogic: {
              type: 'day_spending_pct_weekly_budget_max',
              max: 0.15,
            },
            failMessage: 'Task 2 incomplete: keep today spending <= 15% of weekly budget.',
            successMessage: 'Task 2 complete: daily spending cap achieved.',
            reward: { xp: 40 },
          },
        ],
      },
      {
        dayNumber: 3,
        koinDialogue: {
          student: 'Mall discipline test. Enter temptation zones and still stay intentional.',
          employee: 'Controlled exposure challenge. Visit spending hotspots without lifestyle leakage.',
        },
        tasks: [
          {
            id: 'L3_D3_T1',
            conditionKey: 'l3_d3_t1_mall_visit_and_one_planned_needs_expense',
            requiredAppAction: 'Visit mall and log exactly one expense in Groceries, Health, or Food & Dining.',
            validationLogic: {
              type: 'all_of',
              conditions: [
                { type: 'mall_visited' },
                { type: 'expense_count', exact: 1, categories: ['Groceries', 'Health', 'Food & Dining'] },
              ],
            },
            failMessage: 'Task 1 incomplete: visit mall and log exactly one allowed needs expense.',
            successMessage: 'Task 1 complete: mall discipline objective achieved.',
            reward: { xp: 45 },
          },
          {
            id: 'L3_D3_T2',
            conditionKey: 'l3_d3_t2_no_wants_expenses_today',
            requiredAppAction: 'Log no Wants-category expenses.',
            validationLogic: {
              type: 'expense_count',
              max: 0,
              categoryGroup: 'wants',
            },
            failMessage: 'Task 2 incomplete: Wants expenses must be zero today.',
            successMessage: 'Task 2 complete: Wants spending stayed at zero.',
            reward: { xp: 45 },
          },
        ],
      },
      {
        dayNumber: 4,
        koinDialogue: {
          student: 'Final showdown. Lock in Super Saver status today.',
          employee: 'Final audit. Finish with strong savings and clean spending behavior.',
        },
        tasks: [
          {
            id: 'L3_D4_T1',
            conditionKey: 'l3_d4_t1_savings_rate_at_least_30pct',
            requiredAppAction: 'Reach at least 30% level savings rate.',
            validationLogic: {
              type: 'level_savings_rate_min',
              min: 0.3,
            },
            failMessage: 'Task 1 incomplete: level savings rate must be at least 30%.',
            successMessage: 'Task 1 complete: Super Saver threshold reached.',
            reward: { xp: 50 },
          },
          {
            id: 'L3_D4_T2',
            conditionKey: 'l3_d4_t2_two_expenses_wants_under_10pct',
            requiredAppAction: 'Log at least 2 expenses while keeping Wants <= 10% of day spend.',
            validationLogic: {
              type: 'all_of',
              conditions: [
                { type: 'expense_count', min: 2 },
                { type: 'spending_ratio_max', categoryGroup: 'wants', max: 0.1 },
              ],
            },
            failMessage: 'Task 2 incomplete: log 2+ expenses and keep Wants <= 10%.',
            successMessage: 'Task 2 complete: final-day spending discipline achieved.',
            reward: { xp: 60 },
          },
        ],
      },
    ],
  },
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
