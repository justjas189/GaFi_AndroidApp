const isFiniteNumber = (value) => Number.isFinite(Number(value));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const textIncludes = (source, target) => {
  const src = normalizeText(source);
  const tgt = normalizeText(target);
  if (!src || !tgt) return false;
  return src.includes(tgt);
};

const getCategoriesForGroup = (group, needsCategories, wantsCategories) => {
  if (group === 'needs') return needsCategories;
  if (group === 'wants') return wantsCategories;
  return [];
};

const getExpenseCountFromDay = (dayState, categories) => {
  if (!categories || categories.length === 0) {
    return toNumber(dayState?.expenseCount);
  }
  return categories.reduce((sum, category) => sum + toNumber(dayState?.categoryCounts?.[category]), 0);
};

const getExpenseTotalFromDay = (dayState, categories) => {
  if (!categories || categories.length === 0) {
    return toNumber(dayState?.expenseTotal);
  }
  return categories.reduce((sum, category) => sum + toNumber(dayState?.categoryTotals?.[category]), 0);
};

const passesBounds = (value, { min, max, exact }) => {
  if (isFiniteNumber(exact)) return value === Number(exact);
  if (isFiniteNumber(min) && value < Number(min)) return false;
  if (isFiniteNumber(max) && value > Number(max)) return false;
  return true;
};

export const evaluateDailyTaskRule = (rule, context) => {
  if (!rule || typeof rule !== 'object') return false;

  const dayState = context?.dayState || {};
  const needsCategories = context?.needsCategories || [];
  const wantsCategories = context?.wantsCategories || [];
  const weeklyBudget = toNumber(context?.weeklyBudget);
  const weeklySpending = toNumber(context?.weeklySpending);
  const dailyBudget = toNumber(context?.dailyBudget);
  const goalTotalsByName = context?.goalTotalsByName || {};
  const goalTargetsByName = context?.goalTargetsByName || {};
  const expenseEntries = Array.isArray(dayState?.expenseEntries) ? dayState.expenseEntries : [];

  switch (rule.type) {
    case 'all_of': {
      const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
      if (conditions.length === 0) return false;
      return conditions.every((child) => evaluateDailyTaskRule(child, context));
    }

    case 'expense_count': {
      let categories = null;
      if (rule.categoryGroup) {
        categories = getCategoriesForGroup(rule.categoryGroup, needsCategories, wantsCategories);
      } else if (Array.isArray(rule.categories)) {
        categories = rule.categories;
      }
      const count = getExpenseCountFromDay(dayState, categories);
      return passesBounds(count, rule);
    }

    case 'travel_count': {
      const count = rule.mode === 'commute'
        ? toNumber(dayState?.commuteTravelCount)
        : toNumber(dayState?.travelCount);
      return passesBounds(count, rule);
    }

    case 'needs_after_travel_count': {
      const count = toNumber(dayState?.needsAfterTravelCount);
      return passesBounds(count, rule);
    }

    case 'distinct_categories': {
      if (rule.categoryGroup) {
        const categories = getCategoriesForGroup(rule.categoryGroup, needsCategories, wantsCategories);
        const distinct = categories.filter((category) => toNumber(dayState?.categoryCounts?.[category]) > 0).length;
        return passesBounds(distinct, rule);
      }

      const distinct = Object.values(dayState?.categoryCounts || {}).filter((count) => toNumber(count) > 0).length;
      return passesBounds(distinct, rule);
    }

    case 'max_single_category_ratio': {
      const total = toNumber(dayState?.expenseTotal);
      if (total <= 0) return false;

      let categories = null;
      if (rule.categoryGroup) {
        categories = getCategoriesForGroup(rule.categoryGroup, needsCategories, wantsCategories);
      } else if (Array.isArray(rule.categories)) {
        categories = rule.categories;
      }

      const totalsByCategory = dayState?.categoryTotals || {};
      const values = categories && categories.length > 0
        ? categories.map((category) => toNumber(totalsByCategory[category]))
        : Object.values(totalsByCategory).map((value) => toNumber(value));

      if (values.length === 0) return false;
      const highest = Math.max(...values);
      const ratio = highest / total;
      return ratio <= toNumber(rule.max);
    }

    case 'spending_ratio_max': {
      const total = toNumber(dayState?.expenseTotal);
      if (total <= 0) return true;
      const categories = getCategoriesForGroup(rule.categoryGroup, needsCategories, wantsCategories);
      const categoryTotal = getExpenseTotalFromDay(dayState, categories);
      const ratio = categoryTotal / total;
      return ratio <= toNumber(rule.max);
    }

    case 'goal_allocation_min': {
      const allocated = toNumber(dayState?.goalAllocations?.[rule.goalName]);
      return allocated >= toNumber(rule.min);
    }

    case 'goal_allocation_actions_min': {
      const actionCount = toNumber(dayState?.goalAllocationActions);
      return passesBounds(actionCount, rule);
    }

    case 'goal_allocation_ratio_exact': {
      const allocations = dayState?.goalAllocations || {};
      const totalAllocated = Object.values(allocations).reduce((sum, value) => sum + toNumber(value), 0);
      if (totalAllocated <= 0) return false;

      const goalRatio = toNumber(allocations?.[rule.goalName]) / totalAllocated;
      if (isFiniteNumber(rule.exact)) {
        const tolerance = isFiniteNumber(rule.tolerance) ? Number(rule.tolerance) : 0;
        return Math.abs(goalRatio - Number(rule.exact)) <= tolerance;
      }

      return passesBounds(goalRatio, rule);
    }

    case 'goal_allocation_gte_day_spend': {
      const allocated = toNumber(dayState?.goalAllocations?.[rule.goalName]);
      const totalSpend = toNumber(dayState?.expenseTotal);
      return allocated >= totalSpend;
    }

    case 'goal_progress_gap_max': {
      const goals = Array.isArray(rule.goals) ? rule.goals : [];
      if (goals.length !== 2) return false;
      const first = toNumber(goalTotalsByName[goals[0]]) / Math.max(1, toNumber(goalTargetsByName[goals[0]]));
      const second = toNumber(goalTotalsByName[goals[1]]) / Math.max(1, toNumber(goalTargetsByName[goals[1]]));
      return Math.abs(first - second) <= toNumber(rule.maxGap);
    }

    case 'combined_goal_progress_min': {
      const goals = Array.isArray(rule.goals) ? rule.goals : [];
      if (goals.length === 0) return false;
      const allocated = goals.reduce((sum, goalName) => sum + toNumber(goalTotalsByName[goalName]), 0);
      const target = goals.reduce((sum, goalName) => sum + toNumber(goalTargetsByName[goalName]), 0);
      if (target <= 0) return false;
      return (allocated / target) >= toNumber(rule.min);
    }

    case 'day_spending_pct_weekly_budget_max': {
      if (weeklyBudget <= 0) return false;
      const pct = toNumber(dayState?.expenseTotal) / weeklyBudget;
      return pct <= toNumber(rule.max);
    }

    case 'travel_destination_any': {
      const required = Array.isArray(rule.destinations) ? rule.destinations : [];
      if (required.length === 0) return false;

      const traveled = Array.isArray(dayState?.travelDestinations) ? dayState.travelDestinations : [];
      if (traveled.length === 0) return false;

      return traveled.some((destination) => required.includes(destination));
    }

    case 'named_expense_match': {
      const targetCategory = rule.category;
      const targetText = rule.noteIncludes;

      const matches = expenseEntries.filter((entry) => {
        const sameCategory = targetCategory ? entry?.category === targetCategory : true;
        const sameText = targetText ? textIncludes(entry?.note, targetText) : true;
        return sameCategory && sameText;
      });

      if (matches.length === 0) return false;

      if (isFiniteNumber(rule.amountPctOfDailyBudget)) {
        if (dailyBudget <= 0) return false;
        const expectedAmount = dailyBudget * toNumber(rule.amountPctOfDailyBudget);
        const tolerance = isFiniteNumber(rule.amountTolerance) ? Number(rule.amountTolerance) : 0;
        return matches.some((entry) => Math.abs(toNumber(entry?.amount) - expectedAmount) <= tolerance);
      }

      if (isFiniteNumber(rule.amount)) {
        const exactTolerance = isFiniteNumber(rule.amountTolerance) ? Number(rule.amountTolerance) : 0;
        return matches.some((entry) => Math.abs(toNumber(entry?.amount) - Number(rule.amount)) <= exactTolerance);
      }

      return true;
    }

    case 'note_contains': {
      const targetText = rule.text;
      if (!targetText) return false;

      return expenseEntries.some((entry) => {
        const sourceMatches = rule.source ? entry?.source === rule.source : true;
        return sourceMatches && textIncludes(entry?.note, targetText);
      });
    }

    case 'mall_visited': {
      return !!dayState?.mallVisited;
    }

    case 'level_savings_rate_min': {
      if (weeklyBudget <= 0) return false;
      const savingsRate = (weeklyBudget - weeklySpending) / weeklyBudget;
      return savingsRate >= toNumber(rule.min);
    }

    default:
      return false;
  }
};

export const evaluateDayTasks = (dayConfig, context) => {
  const tasks = dayConfig?.tasks || [];
  return tasks.map((task) => ({
    conditionKey: task.conditionKey,
    completed: evaluateDailyTaskRule(task.validationLogic, context),
  }));
};
