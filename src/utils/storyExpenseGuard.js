// src/utils/storyExpenseGuard.js
// Pre-log guard for Story Mode expenses. Answers two questions BEFORE an
// expense is committed:
//   1) Does it overflow the player's global weekly budget?
//   2) Which of today's tasks would it push over their failure limit?
//
// v3 — global budget check + per-rule warning messages.
//   evaluateStoryExpense() is the primary API: it returns a structured verdict
//   ({ shouldWarn, budgetOverflow, brokenTasks }) so the UI can cite exactly
//   what the expense breaks. budgetOverflow is a WARNING (spending money you
//   don't have) — it does NOT by itself fail the day; only brokenTasks should
//   arm the day-failed flow.
//
// v2 — absolute limit-crossing checks (bug fix). The old implementation
// re-evaluated whole rules before/after a simulated expense. That misfired on
// share-of-day ratio rules: an empty day trivially "passes" (0% ≤ cap), so the
// FIRST expense of the day always swung a ratio to 100% and flagged a break —
// Koin warned on every single log. The guard checks each task rule as a strict
// limit crossing: (current spent + proposed amount) > limit, AND it was ≤ limit
// before — a task is flagged only when THIS expense pushes the user over.
// Rules an expense cannot IRREVERSIBLY break (min-counts, travel/mall actions,
// distinct-categories, goal allocations, and share-of-current-spend ratios
// that later expenses or allocations can rebalance) never flag here — warning
// on those re-creates the v1 false-positive bug. The end-of-day evaluator
// (storyDailyTaskEvaluator) remains their source of truth.
//
// v2.1 — zero-budget fallback. Budget rules flag on ANY positive expense when
// their weekly/daily budget context resolves to 0 or undefined (see
// crossesLimit); an early `budget <= 0 → return false` disarmed the guard
// entirely in the ₱0.00-budget state.
//
// Pure module: no React, no state — unit-testable in isolation.

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const peso = (value) =>
  `₱${toNumber(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pct = (value) => `${Math.round(toNumber(value) * 100)}%`;

const getCategoriesForGroup = (group, needsCategories, wantsCategories) => {
  if (group === 'needs') return needsCategories || [];
  if (group === 'wants') return wantsCategories || [];
  return [];
};

// Categories a rule applies to: explicit list, needs/wants group, or null = all.
const getRuleCategories = (rule, ctx) => {
  if (rule.categoryGroup) {
    return getCategoriesForGroup(rule.categoryGroup, ctx.needsCategories, ctx.wantsCategories);
  }
  if (Array.isArray(rule.categories)) return rule.categories;
  return null;
};

// Human label for the slice of spending a rule constrains.
const getRuleScopeLabel = (rule) => {
  if (rule.categoryGroup) return rule.categoryGroup; // 'needs' / 'wants'
  if (Array.isArray(rule.categories)) return rule.categories.join(' / ');
  return null;
};

const sumCategoryTotals = (dayState, categories) => {
  if (!categories) return toNumber(dayState?.expenseTotal);
  return categories.reduce(
    (sum, category) => sum + toNumber(dayState?.categoryTotals?.[category]),
    0,
  );
};

const sumCategoryCounts = (dayState, categories) => {
  if (!categories) return toNumber(dayState?.expenseCount);
  return categories.reduce(
    (sum, category) => sum + toNumber(dayState?.categoryCounts?.[category]),
    0,
  );
};

// True when adding `amount` crosses `limit` (before ≤ limit < before + amount).
// v2.1: a limit of 0 — because the weekly/daily budget resolved to 0 or
// undefined — is NOT a free pass. On a zero limit ANY positive expense is a
// break, even if the user is already past it.
const crossesLimit = (before, amount, limit) => {
  if (!(limit > 0)) return amount > 0;
  return before <= limit && before + amount > limit;
};

// Messages describing how THIS expense breaks `rule` (empty array = no break).
// Only irreversible limit crossings produce messages — see the v2 note above.
const ruleBreakMessages = (rule, ctx) => {
  if (!rule || typeof rule !== 'object') return [];

  const { dayState, expense } = ctx;
  const amount = toNumber(expense.amount);

  switch (rule.type) {
    case 'all_of': {
      const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
      // Crossing ANY capped sub-condition dooms the composite task.
      return conditions.flatMap((child) => ruleBreakMessages(child, ctx));
    }

    // e.g. { type: 'expense_count', max: 0, categoryGroup: 'wants' } — logging
    // one more expense in a capped category crosses the count limit.
    case 'expense_count': {
      if (!Number.isFinite(Number(rule.max))) return []; // min/exact bounds can't be broken by adding
      const categories = getRuleCategories(rule, ctx);
      if (categories && !categories.includes(expense.category)) return [];
      const before = sumCategoryCounts(dayState, categories);
      const max = Number(rule.max);
      if (!(before <= max && before + 1 > max)) return [];
      const scope = getRuleScopeLabel(rule);
      return [
        max === 0
          ? `No ${scope ? `${scope} ` : ''}expenses are allowed today.`
          : `This would be ${scope ? `${scope} ` : ''}expense #${before + 1} — today's cap is ${max}.`,
      ];
    }

    // Share-of-day-spend cap (e.g. wants ≤ 30%). As a PRE-LOG warning this is
    // checked as an absolute amount against today's budget slice:
    //   limit = max × dailyBudget;  warn when (group spent today + amount) > limit.
    // Checking the raw ratio here is what caused the v1 false positives — the
    // first expense of a day is always 100% of that day's spending.
    case 'spending_ratio_max': {
      const categories = getRuleCategories(rule, ctx);
      if (categories && !categories.includes(expense.category)) return [];
      const limit = toNumber(rule.max) * toNumber(ctx.dailyBudget);
      const before = sumCategoryTotals(dayState, categories);
      if (!crossesLimit(before, amount, limit)) return [];
      const scope = getRuleScopeLabel(rule);
      return [
        `${scope ? `${scope[0].toUpperCase()}${scope.slice(1)}` : 'Today’s'} spending would reach ${peso(before + amount)}, over the ${peso(limit)} cap (${pct(rule.max)} of your daily budget).`,
      ];
    }

    // Level-wide cap on a category group (needs/wants) as a share of the
    // WEEKLY budget — the 50/30/20 rule. Group totals only ever grow within a
    // level, so crossing the cap is a real, irreversible fail. Reads the
    // level-scoped totals from ctx.levelGroupSpending ({ needs, wants }).
    case 'level_group_spending_pct_weekly_budget_max': {
      const categories = getRuleCategories(rule, ctx);
      if (categories && !categories.includes(expense.category)) return [];
      const limit = toNumber(rule.max) * toNumber(ctx.weeklyBudget);
      const before = toNumber(ctx.levelGroupSpending?.[rule.categoryGroup]);
      if (!crossesLimit(before, amount, limit)) return [];
      const scope = getRuleScopeLabel(rule);
      return [
        `${scope ? `${scope[0].toUpperCase()}${scope.slice(1)}` : 'Group'} spending would reach ${peso(before + amount)}, over the ${peso(limit)} cap (${pct(rule.max)} of your weekly budget).`,
      ];
    }

    // Absolute cap on today's total spend as a share of the weekly budget —
    // day totals only ever grow, so crossing it is a real, irreversible fail.
    case 'day_spending_pct_weekly_budget_max': {
      const limit = toNumber(rule.max) * toNumber(ctx.weeklyBudget);
      const before = toNumber(dayState?.expenseTotal);
      if (!crossesLimit(before, amount, limit)) return [];
      return [
        `Today's total spending would reach ${peso(before + amount)}, over the ${peso(limit)} day cap (${pct(rule.max)} of your weekly budget).`,
      ];
    }

    // Weekly savings floor (save ≥ min%) ⇒ spending ceiling of
    // (1 − min) × weeklyBudget. Weekly spending only grows within the level,
    // so once total spending passes the ceiling the savings goal is
    // mathematically unreachable — a fatal, irreversible break.
    case 'level_savings_rate_min': {
      const weeklyBudget = toNumber(ctx.weeklyBudget);
      const ceiling = (1 - toNumber(rule.min)) * weeklyBudget;
      const before = toNumber(ctx.weeklySpending);
      if (!crossesLimit(before, amount, ceiling)) return [];
      return [
        `Saving ${pct(rule.min)} of your ${peso(weeklyBudget)} budget means keeping total spending under ${peso(ceiling)} — this expense pushes it to ${peso(before + amount)}, making that savings goal impossible.`,
      ];
    }

    default:
      return [];
  }
};

/**
 * Full pre-log verdict for a proposed Story Mode expense.
 *
 * @param {Object} p
 * @param {Object} p.dayConfig    – getStoryDayTasks(level, day) result ({ tasks: [...] });
 *                                  may be null — the global budget check still runs.
 * @param {Object} p.dayState     – the active day's runtime (dailyTaskRuntimeByDayRef)
 * @param {Object} p.evalContext  – same shape evaluateActiveStoryDayTasks builds
 *                                  (weeklyBudget / weeklySpending / dailyBudget /
 *                                   needsCategories / wantsCategories / goal maps)
 * @param {Object} p.expense      – { category (normalized Title Case), amount }
 * @returns {{
 *   shouldWarn: boolean,
 *   budgetOverflow: null | { before: number, after: number, weeklyBudget: number, message: string },
 *   brokenTasks: Array<{ task: Object, messages: string[] }>,
 * }}
 *   budgetOverflow — the expense exceeds the global weekly budget (warning only;
 *   does not fail the day). brokenTasks — tasks whose failure limit THIS
 *   expense crosses, each with rule-specific messages for the modal.
 */
export const evaluateStoryExpense = ({ dayConfig, dayState, evalContext, expense }) => {
  const amount = toNumber(expense?.amount);
  const verdict = { shouldWarn: false, budgetOverflow: null, brokenTasks: [] };
  if (!(amount > 0)) return verdict;

  const ctx = { ...(evalContext || {}), dayState: dayState || {}, expense };

  // ── 1) Global weekly-funds check (independent of any task rule) ──
  // Strict spec: (current total spent + proposed amount) > weekly budget.
  // Deliberately NOT a crossing check — while already over budget, every
  // further expense keeps warning. A ₱0.00 weekly budget warns on any spend.
  const weeklyBudget = toNumber(ctx.weeklyBudget);
  const weeklySpending = toNumber(ctx.weeklySpending);
  if (weeklySpending + amount > weeklyBudget) {
    verdict.budgetOverflow = {
      before: weeklySpending,
      after: weeklySpending + amount,
      weeklyBudget,
      message: `This ${peso(amount)} expense pushes your weekly spending to ${peso(weeklySpending + amount)} — over your ${peso(weeklyBudget)} weekly budget.`,
    };
  }

  // ── 2) Simulate the expense against today's task rules ──
  (dayConfig?.tasks || []).forEach((task) => {
    const messages = ruleBreakMessages(task.validationLogic, ctx);
    if (messages.length > 0) {
      verdict.brokenTasks.push({ task, messages });
    }
  });

  verdict.shouldWarn = !!verdict.budgetOverflow || verdict.brokenTasks.length > 0;
  return verdict;
};

/**
 * Back-compat wrapper: just the task objects whose failure limit THIS expense
 * would cross (empty = no task breaks). Prefer evaluateStoryExpense — it also
 * carries the global budget overflow and per-rule messages.
 */
export const getTasksBrokenByExpense = ({ dayConfig, dayState, evalContext, expense }) =>
  evaluateStoryExpense({ dayConfig, dayState, evalContext, expense })
    .brokenTasks.map(({ task }) => task);
