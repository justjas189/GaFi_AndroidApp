/**
 * PredictionEngine.js — Prophet ML API-Based Expense Prediction Engine
 *
 * This module calls a FastAPI backend that loads a pre-trained Facebook
 * Prophet time-series model (.pkl) to predict future monthly spending.
 * If the API is unreachable, it falls back to a local heuristic engine.
 *
 * ─── ARCHITECTURE ───────────────────────────────────────────────────────
 * Primary:  FastAPI + Prophet .pkl model (backend)
 * Fallback: Weighted average + YoY + seasonal heuristic (local)
 *
 * ─── API ENDPOINT ───────────────────────────────────────────────────────
 * POST /predict  →  { user_id, month, year, monthly_budget }
 *                ←  { totalPredicted, categoryPredictions, ... }
 *
 * ─── COLD-START / OFFLINE STRATEGY ──────────────────────────────────────
 * API reachable        → Prophet ML prediction (primary)
 * API unreachable      → Local heuristic (weighted avg + YoY + seasonality)
 * 0-2 months of data   → Simple average only
 * ────────────────────────────────────────────────────────────────────────
 */

import { normalizeCategory } from '../utils/categoryUtils';

// ── Configuration ──────────────────────────────────────────────────────
// Change this to your FastAPI server address:
//   - Android Emulator:  http://10.0.2.2:8000
//   - Physical device:   http://<YOUR_PC_IP>:8000
//   - iOS Simulator:     http://localhost:8000
const API_BASE_URL = 'http://192.168.100.7:8000';

// ── Philippine inflation rates (BSP data) ──────────────────────────────
const PH_INFLATION_RATES = {
  2020: 0.026,
  2021: 0.030,
  2022: 0.058,
  2023: 0.060,
  2024: 0.032,
  2025: 0.035,
  2026: 0.034,
};
const DEFAULT_INFLATION_RATE = 0.035;
const getInflationRate = (year) => PH_INFLATION_RATES[year] || DEFAULT_INFLATION_RATE;

const getMonthName = (monthIdx) =>
  new Date(2000, monthIdx, 1).toLocaleString('default', { month: 'long' });

// ── Seasonal multipliers (PH context) ──────────────────────────────────
const SEASONAL_MULTIPLIERS = {
  0: 0.90, 1: 0.88, 2: 0.92, 3: 0.95, 4: 0.93, 5: 0.95,
  6: 0.92, 7: 0.95, 8: 0.97, 9: 1.02, 10: 1.08, 11: 1.25,
};

/**
 * ════════════════════════════════════════════════════════════════════════
 *  CLASS: PredictionEngine
 * ════════════════════════════════════════════════════════════════════════
 */
class PredictionEngine {
  constructor() {
    this.apiAvailable = null;   // null = unknown, true/false after first call
    this.lastApiCheck = 0;
    this.apiCacheTTL = 60000;   // Re-check API availability every 60s
    this.modelMetrics = null;   // Cached model accuracy metrics from API
  }

  // ────────────────────────────────────────────────────────────────────
  //  API COMMUNICATION
  // ────────────────────────────────────────────────────────────────────

  /**
   * Check if the FastAPI backend is reachable.
   */
  async checkApiHealth() {
    const now = Date.now();
    if (this.apiAvailable !== null && now - this.lastApiCheck < this.apiCacheTTL) {
      return this.apiAvailable;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        this.apiAvailable = data.model_loaded === true;
        this.lastApiCheck = now;
        console.log(`[PredictionEngine] API health check: ${this.apiAvailable ? 'OK' : 'no model'}`);
        return this.apiAvailable;
      }
    } catch (err) {
      console.log('[PredictionEngine] API unreachable, using heuristic fallback');
      this.apiAvailable = false;
      this.lastApiCheck = now;
    }
    return false;
  }

  /**
   * Call the FastAPI /predict endpoint.
   * Returns the API response or null if failed.
   */
  async fetchPrediction(userId, month, year, budget = 10000) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          user_id: userId,
          month: month + 1,  // API expects 1-12, JS months are 0-11
          year: year,
          monthly_budget: budget,
        }),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[PredictionEngine] API returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      this.modelMetrics = data.modelMetrics || null;
      console.log(`[PredictionEngine] API prediction received: ₱${data.totalPredicted?.toLocaleString()}`);
      return data;
    } catch (err) {
      console.warn('[PredictionEngine] API call failed:', err.message);
      return null;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  //  GROUP EXPENSES BY MONTH  →  { '2025-2': { total, month, year } }
  // ────────────────────────────────────────────────────────────────────
  groupExpensesByMonth(expenses) {
    const grouped = {};
    expenses.forEach((exp) => {
      const d = new Date(exp.date || exp.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!grouped[key]) grouped[key] = { total: 0, month: d.getMonth(), year: d.getFullYear() };
      grouped[key].total += parseFloat(exp.amount) || 0;
    });
    return Object.values(grouped).sort((a, b) => a.year - b.year || a.month - b.month);
  }

  // ────────────────────────────────────────────────────────────────────
  //  MAIN PREDICTION METHODS
  // ────────────────────────────────────────────────────────────────────
  async predictNextMonth(expenses, budget, userId) {
    const currentDate = new Date();
    const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const targetMonthIdx = nextMonthDate.getMonth();
    const targetYear = nextMonthDate.getFullYear();
    return this._predict(expenses, targetMonthIdx, targetYear, currentDate, budget, userId);
  }

  async predictCurrentMonth(expenses, budget, userId) {
    const currentDate = new Date();
    return this._predict(expenses, currentDate.getMonth(), currentDate.getFullYear(), currentDate, budget, userId);
  }

  // ────────────────────────────────────────────────────────────────────
  //  CORE PREDICTION LOGIC
  //
  //  1. Try Prophet API first (primary)
  //  2. Fall back to local heuristic if API fails
  //  3. Always compute UI fields (insights, trends, etc.) locally
  // ────────────────────────────────────────────────────────────────────
  async _predict(expenses, targetMonthIdx, targetYear, currentDate, budget, userId) {
    const targetMonthName = getMonthName(targetMonthIdx);
    const isCurrentMonth =
      targetMonthIdx === currentDate.getMonth() && targetYear === currentDate.getFullYear();

    // ── Empty‐data fallback ──────────────────────────────────────────
    const emptyResult = {
      totalPredicted: 0,
      categoryBreakdown: [],
      insights: [],
      confidence: 0,
      historicalAverage: 0,
      trend: 'stable',
      monthlyHistory: [],
      sameMonthLastYear: 0,
      hasYearOverYearData: false,
      yoyGrowthRate: 0,
      inflationRate: DEFAULT_INFLATION_RATE,
      seasonalMultiplier: 1,
      targetMonth: targetMonthName,
      yearsOfData: 0,
      sameMonthYears: [],
      predictionMethod: 'none',
      mlConfidence: 0,
      spentSoFar: 0,
      projectedRemaining: 0,
      daysElapsed: 0,
      daysInMonth: 0,
      isCurrentMonth,
      currentMonthCategorySpent: {},
    };

    if (!expenses || expenses.length === 0) return emptyResult;

    // ── Group & sort by month ────────────────────────────────────────
    const monthlyTotals = this.groupExpensesByMonth(expenses);
    const numMonths = monthlyTotals.length;

    // ── Gather same-month data, category data, etc. ──────────────────
    const categoryTotals = {};
    const categoryMonthlyData = {};
    const sameMonthYearlyData = {};
    const sameMonthCategoryData = {};
    let spentSoFar = 0;
    const currentMonthCategorySpent = {};

    expenses.forEach((exp) => {
      const d = new Date(exp.date || exp.created_at);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const category = normalizeCategory(exp.category);
      const amount = parseFloat(exp.amount) || 0;
      const expYear = d.getFullYear();
      const expMonth = d.getMonth();

      if (isCurrentMonth && expMonth === targetMonthIdx && expYear === targetYear) {
        spentSoFar += amount;
        currentMonthCategorySpent[category] = (currentMonthCategorySpent[category] || 0) + amount;
      }

      if (expMonth === targetMonthIdx && expYear < targetYear) {
        sameMonthYearlyData[expYear] = (sameMonthYearlyData[expYear] || 0) + amount;
        if (!sameMonthCategoryData[expYear]) sameMonthCategoryData[expYear] = {};
        sameMonthCategoryData[expYear][category] =
          (sameMonthCategoryData[expYear][category] || 0) + amount;
      }

      categoryTotals[category] = (categoryTotals[category] || 0) + amount;

      if (!categoryMonthlyData[category]) categoryMonthlyData[category] = {};
      categoryMonthlyData[category][monthKey] =
        (categoryMonthlyData[category][monthKey] || 0) + amount;
    });

    // ── Monthly history (last 6 months for UI chart) ─────────────────
    const sixMonthsCutoff = new Date(targetYear, targetMonthIdx - 6, 1);
    const monthlyHistory = monthlyTotals
      .filter((m) => new Date(m.year, m.month, 1) >= sixMonthsCutoff)
      .slice(-6)
      .map((m) => ({
        month: new Date(m.year, m.month, 1).toLocaleString('default', { month: 'short' }),
        year: m.year,
        total: m.total,
        key: `${m.year}-${m.month}`,
      }));

    // ── Data span calculation ────────────────────────────────────────
    const allDates = expenses.map((e) => new Date(e.date || e.created_at));
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    const dataSpanYears = Math.max(
      1,
      Math.round(((maxDate - minDate) / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10
    );
    const yearsOfData = dataSpanYears;

    // ── Same-month YoY data ──────────────────────────────────────────
    const sameMonthYears = Object.keys(sameMonthYearlyData).map(Number).sort();
    const hasYearOverYearData = sameMonthYears.length > 0;
    let sameMonthLastYear = 0;
    let yoyGrowthRate = 0;
    const inflationRate = getInflationRate(targetYear);

    if (hasYearOverYearData) {
      const mostRecent = sameMonthYears[sameMonthYears.length - 1];
      sameMonthLastYear = sameMonthYearlyData[mostRecent];
      if (sameMonthYears.length >= 2) {
        const prev = sameMonthYears[sameMonthYears.length - 2];
        const prevAmt = sameMonthYearlyData[prev];
        yoyGrowthRate = prevAmt > 0 ? (sameMonthLastYear - prevAmt) / prevAmt : 0;
      }
    }

    // ── Historical average & trend ───────────────────────────────────
    const historicalAverage =
      monthlyTotals.reduce((s, m) => s + m.total, 0) / Math.max(numMonths, 1);
    let trend = 'stable';
    if (monthlyHistory.length >= 2) {
      const recentAvg =
        monthlyHistory.slice(-2).reduce((s, m) => s + m.total, 0) / 2;
      const olderAvg =
        monthlyHistory.slice(0, -2).reduce((s, m) => s + m.total, 0) /
        Math.max(1, monthlyHistory.length - 2);
      if (recentAvg > olderAvg * 1.15) trend = 'increasing';
      else if (recentAvg < olderAvg * 0.85) trend = 'decreasing';
    }

    // ════════════════════════════════════════════════════════════════
    //  TRY PROPHET ML API FIRST
    // ════════════════════════════════════════════════════════════════
    let totalPredicted = 0;
    let predictionMethod = 'heuristic';
    let apiCategoryPredictions = null;
    let mlConfidence = 0;

    const apiIsUp = await this.checkApiHealth();

    if (apiIsUp && userId) {
      const apiResult = await this.fetchPrediction(userId, targetMonthIdx, targetYear, budget);

      if (apiResult && apiResult.totalPredicted > 0 && !isNaN(apiResult.totalPredicted)) {
        totalPredicted = apiResult.totalPredicted;
        predictionMethod = 'Prophet ML Model';
        apiCategoryPredictions = apiResult.categoryPredictions || null;
        mlConfidence = apiResult.confidenceLevel === 'high' ? 90 :
                       apiResult.confidenceLevel === 'medium' ? 70 : 50;

        // If current month and API returned spentSoFar, use API's value
        if (isCurrentMonth && apiResult.spentSoFar > 0) {
          spentSoFar = apiResult.spentSoFar;
        }

        console.log(`[PredictionEngine] Using Prophet ML prediction: ₱${totalPredicted.toLocaleString()}`);
      }
    }

    // ════════════════════════════════════════════════════════════════
    //  FALLBACK: LOCAL HEURISTIC (if API failed)
    // ════════════════════════════════════════════════════════════════
    if (predictionMethod === 'heuristic') {
      console.log('[PredictionEngine] Using local heuristic fallback');

      // Weighted recent average
      const weights = [0.35, 0.25, 0.20, 0.10, 0.05, 0.05];
      let weightedSum = 0, totalWeight = 0;
      const recentMonths = monthlyTotals.slice(-6);
      recentMonths.forEach((m, i) => {
        const w = weights[Math.min(i, weights.length - 1)];
        weightedSum += m.total * w;
        totalWeight += w;
      });
      let recentWeightedPred = totalWeight > 0 ? weightedSum / totalWeight : historicalAverage;

      if (trend === 'increasing') recentWeightedPred *= 1.1;
      else if (trend === 'decreasing') recentWeightedPred *= 0.9;

      // Same-month YoY prediction
      let sameMonthPred = 0;
      if (hasYearOverYearData) {
        const mostRecent = sameMonthYears[sameMonthYears.length - 1];
        const yearGap = targetYear - mostRecent;
        sameMonthPred = sameMonthLastYear * Math.pow(1 + inflationRate, yearGap);
        if (yoyGrowthRate !== 0) {
          const personalAdj = sameMonthLastYear * (1 + yoyGrowthRate);
          sameMonthPred = personalAdj * 0.6 + sameMonthPred * 0.4;
        }
      }

      // Blend heuristic signals
      if (hasYearOverYearData && monthlyHistory.length >= 3) {
        totalPredicted = recentWeightedPred * 0.35 + sameMonthPred * 0.65;
      } else if (hasYearOverYearData) {
        totalPredicted = recentWeightedPred * 0.20 + sameMonthPred * 0.80;
      } else {
        totalPredicted = recentWeightedPred;
      }
      if (!hasYearOverYearData && monthlyHistory.length > 0) {
        totalPredicted *= 1 + inflationRate / 12;
      }

      if (isNaN(totalPredicted) || !isFinite(totalPredicted)) {
        totalPredicted = historicalAverage || 0;
      }
    }

    // ── Current month: simple tally ──────────────────────────────────
    const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
    const daysElapsed = isCurrentMonth ? currentDate.getDate() : 0;

    // Projected remaining = totalPredicted - spentSoFar (simple subtraction)
    const projectedRemaining = isCurrentMonth && spentSoFar > 0
      ? Math.max(0, totalPredicted - spentSoFar)
      : 0;

    // ── Category predictions ─────────────────────────────────────────
    const totalSpent = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([category, total]) => {
        const percentage = totalSpent > 0 ? (total / totalSpent) * 100 : 0;
        let predictedAmount;

        // Use API category prediction if available
        if (apiCategoryPredictions && apiCategoryPredictions[category] !== undefined) {
          predictedAmount = apiCategoryPredictions[category];
        } else {
          // Local fallback: proportional + YoY adjustment
          predictedAmount = (percentage / 100) * totalPredicted;
          if (hasYearOverYearData) {
            const mostRecent = sameMonthYears[sameMonthYears.length - 1];
            const prevYearCatAmt = sameMonthCategoryData[mostRecent]?.[category] || 0;
            if (prevYearCatAmt > 0) {
              const yearGap = targetYear - mostRecent;
              const inflAdj = prevYearCatAmt * Math.pow(1 + inflationRate, yearGap);
              predictedAmount = predictedAmount * 0.40 + inflAdj * 0.60;
            }
          }
        }

        // Category trend
        let categoryTrend = 'stable';
        let comparisonLabel = '';
        let comparisonAmount = 0;
        const catMonthlyVals = Object.values(categoryMonthlyData[category] || {});
        const allTimeAvg =
          catMonthlyVals.length > 0
            ? catMonthlyVals.reduce((s, v) => s + v, 0) / catMonthlyVals.length
            : 0;

        if (hasYearOverYearData) {
          const mostRecent = sameMonthYears[sameMonthYears.length - 1];
          const prevCatAmt = sameMonthCategoryData[mostRecent]?.[category] || 0;
          if (prevCatAmt > 0) {
            const yearGap = targetYear - mostRecent;
            const adj = prevCatAmt * Math.pow(1 + inflationRate, yearGap);
            const chg = (predictedAmount - adj) / adj;
            if (chg > 0.10) categoryTrend = 'increasing';
            else if (chg < -0.10) categoryTrend = 'decreasing';
            comparisonLabel = `${targetMonthName.substring(0, 3)} ${mostRecent}`;
            comparisonAmount = Math.round(prevCatAmt);
          } else {
            if (allTimeAvg > 0) {
              const chg = (predictedAmount - allTimeAvg) / allTimeAvg;
              if (chg > 0.10) categoryTrend = 'increasing';
              else if (chg < -0.10) categoryTrend = 'decreasing';
            }
            comparisonLabel = 'All-time avg';
            comparisonAmount = Math.round(allTimeAvg);
          }
        } else {
          if (allTimeAvg > 0) {
            const chg = (predictedAmount - allTimeAvg) / allTimeAvg;
            if (chg > 0.10) categoryTrend = 'increasing';
            else if (chg < -0.10) categoryTrend = 'decreasing';
          }
          comparisonLabel = 'All-time avg';
          comparisonAmount = Math.round(allTimeAvg);
        }

        const historicalAvgForCategory = Math.round(allTimeAvg);
        const showHistoricalLine =
          comparisonLabel !== 'All-time avg' && historicalAvgForCategory > 0;

        const CATEGORY_COLORS = {
          'Food & Dining': '#FF9800', Transport: '#2196F3', Shopping: '#E91E63',
          Groceries: '#8BC34A', Entertainment: '#9C27B0', Electronics: '#00BCD4',
          'School Supplies': '#3F51B5', Utilities: '#607D8B', Health: '#4CAF50',
          Education: '#673AB7', Other: '#795548', 'No Spend Day': '#2ECC71',
        };

        return {
          category,
          total,
          percentage: Math.round(percentage * 10) / 10,
          predictedAmount: Math.round(predictedAmount * 100) / 100,
          color: CATEGORY_COLORS[category] || '#888888',
          trend: categoryTrend,
          comparisonLabel,
          comparisonAmount,
          historicalAvg: historicalAvgForCategory,
          showHistoricalLine,
        };
      })
      .sort((a, b) => b.total - a.total);

    // ── Confidence score ─────────────────────────────────────────────
    let confidence;
    if (predictionMethod === 'Prophet ML Model') {
      confidence = mlConfidence;
      if (hasYearOverYearData) confidence = Math.min(100, confidence + 5);
      if (isCurrentMonth && daysElapsed >= 7) confidence = Math.min(100, confidence + 5);
    } else {
      confidence = Math.min(100, Math.round((numMonths / 6) * 60));
      if (hasYearOverYearData) confidence += 20;
      if (sameMonthYears.length >= 2) confidence += 10;
      if (monthlyHistory.length >= 4) confidence += 10;
      if (isCurrentMonth && daysElapsed >= 7) confidence += 10;
      confidence = Math.min(100, confidence);
    }

    // ── Insights ─────────────────────────────────────────────────────
    const insights = [];

    // ML Model insight
    if (predictionMethod === 'Prophet ML Model') {
      const metrics = this.modelMetrics || {};
      const mape = metrics.mape ? `${metrics.mape.toFixed(1)}%` : 'N/A';
      const r2 = metrics.r2 ? metrics.r2.toFixed(3) : 'N/A';
      insights.push({
        icon: 'hardware-chip',
        color: '#00D4FF',
        title: 'Prophet ML Model Active',
        message: `A trained Facebook Prophet model is generating this prediction. Model accuracy: MAPE ${mape}, R² ${r2}. The model captures seasonal patterns and Philippine holiday effects.`,
      });
    } else {
      if (numMonths < 3) {
        insights.push({
          icon: 'information-circle',
          color: '#888888',
          title: 'Building Your Model',
          message: `You have ${numMonths} month(s) of data. Keep tracking expenses — predictions improve with more data!`,
        });
      } else {
        insights.push({
          icon: 'information-circle',
          color: '#FFAA00',
          title: 'Using Heuristic Prediction',
          message: `The ML server is currently offline. Showing heuristic predictions based on your spending patterns.`,
        });
      }
    }

    // YoY insight
    if (hasYearOverYearData && sameMonthLastYear > 0) {
      const yoyChange = yoyGrowthRate >= 0
        ? `${Math.round(yoyGrowthRate * 100)}% more`
        : `${Math.abs(Math.round(yoyGrowthRate * 100))}% less`;
      insights.push({
        icon: 'calendar',
        color: '#5856D6',
        title: `Last Year's ${targetMonthName}`,
        message: `You spent ₱${Math.round(sameMonthLastYear).toLocaleString()} in ${targetMonthName} last year. Predicted spending this year is ${yoyChange} adjusted for habits and inflation.`,
      });
    }

    // Inflation
    insights.push({
      icon: 'analytics',
      color: '#FF9800',
      title: 'Inflation Adjustment Applied',
      message: `A ${(inflationRate * 100).toFixed(1)}% annual inflation rate has been factored into this prediction.`,
    });

    // Trend
    if (trend === 'increasing') {
      insights.push({
        icon: 'trending-up',
        color: '#FF6B6B',
        title: 'Spending Trend Rising',
        message: `Your spending has been increasing. The prediction is adjusted ${Math.round((totalPredicted / historicalAverage - 1) * 100)}% higher than your average.`,
      });
    } else if (trend === 'decreasing') {
      insights.push({
        icon: 'trending-down',
        color: '#4CD964',
        title: 'Spending Trend Decreasing',
        message: `Great job! Your spending is going down. Prediction adjusted ${Math.round((1 - totalPredicted / historicalAverage) * 100)}% lower.`,
      });
    }

    // Top category
    if (categoryBreakdown.length > 0) {
      const top = categoryBreakdown[0];
      insights.push({
        icon: 'pie-chart',
        color: top.color,
        title: `${top.category} is Your Biggest Expense`,
        message: `${top.category} accounts for ${top.percentage}% of spending. Predicted: ₱${top.predictedAmount.toLocaleString()}.`,
      });
    }

    // Increasing categories
    const incCats = categoryBreakdown.filter((c) => c.trend === 'increasing');
    if (incCats.length > 0) {
      insights.push({
        icon: 'alert-circle',
        color: '#FFCC00',
        title: 'Watch These Categories',
        message: `Spending in ${incCats.map((c) => c.category).join(', ')} has been increasing. Consider setting limits.`,
      });
    }

    // Seasonal
    const curMonth = currentDate.getMonth();
    if (curMonth === 11) {
      insights.push({ icon: 'gift', color: '#FF6B00', title: 'Holiday Season Alert', message: 'December typically sees 20-30% higher spending. Budget accordingly!' });
    } else if (curMonth === 0) {
      insights.push({ icon: 'calendar', color: '#5856D6', title: 'New Year, New Budget', message: 'January is a great time to set new financial goals.' });
    }

    // Data confidence
    if (monthlyHistory.length < 3) {
      insights.push({
        icon: 'information-circle',
        color: '#888888',
        title: 'Limited Data Available',
        message: `Predictions based on ${monthlyHistory.length} month(s). Continue tracking for more accuracy.`,
      });
    }

    // Multi-year
    if (yearsOfData > 1) {
      insights.push({
        icon: 'time',
        color: '#00BCD4',
        title: `${yearsOfData} Years of Data Used`,
        message: `Your prediction leverages ${yearsOfData} years of history, comparing same months across years.`,
      });
    }

    // Current-month pace insight
    if (isCurrentMonth && spentSoFar > 0) {
      const completionPct = Math.round((daysElapsed / daysInMonth) * 100);
      const spendPct = Math.round((spentSoFar / totalPredicted) * 100);
      const isOverPace = spendPct > completionPct;
      insights.unshift({
        icon: isOverPace ? 'warning' : 'checkmark-circle',
        color: isOverPace ? '#FF6B6B' : '#4CD964',
        title: `${completionPct}% of ${targetMonthName} Elapsed`,
        message: `You've spent ₱${Math.round(spentSoFar).toLocaleString()} so far (${spendPct}% of predicted). ` +
          (isOverPace
            ? `You're spending faster than projected — slow down for the remaining ${daysInMonth - daysElapsed} days.`
            : `On track! Keep it up for the remaining ${daysInMonth - daysElapsed} days.`),
      });
    }

    // ── Return result ────────────────────────────────────────────────
    return {
      totalPredicted: Math.round(totalPredicted * 100) / 100,
      categoryBreakdown,
      insights,
      confidence,
      historicalAverage: Math.round(historicalAverage * 100) / 100,
      trend,
      monthlyHistory,
      sameMonthLastYear: Math.round(sameMonthLastYear * 100) / 100,
      hasYearOverYearData,
      yoyGrowthRate: Math.round(yoyGrowthRate * 1000) / 1000,
      inflationRate,
      seasonalMultiplier: 1,
      targetMonth: targetMonthName,
      yearsOfData,
      sameMonthYears,
      // ML-specific fields
      predictionMethod,
      mlConfidence,
      modelMetrics: this.modelMetrics,
      // Current-month
      isCurrentMonth,
      spentSoFar: Math.round(spentSoFar * 100) / 100,
      projectedRemaining: Math.round(projectedRemaining * 100) / 100,
      daysElapsed,
      daysInMonth,
      currentMonthCategorySpent,
    };
  }

  // ────────────────────────────────────────────────────────────────────
  //  COMPATIBILITY: trainModel is now a no-op (model lives on server)
  // ────────────────────────────────────────────────────────────────────
  async trainModel(_expenses) {
    // Model training happens in Jupyter → .pkl → loaded by FastAPI
    // This method kept for backward compatibility with existing code
    const isUp = await this.checkApiHealth();
    console.log(`[PredictionEngine] trainModel called — API ${isUp ? 'available' : 'offline'}, model lives on server`);
    return isUp;
  }

  // ────────────────────────────────────────────────────────────────────
  //  CLEANUP (no local model to dispose anymore)
  // ────────────────────────────────────────────────────────────────────
  dispose() {
    this.apiAvailable = null;
    this.modelMetrics = null;
  }
}

// Export a singleton instance
export default new PredictionEngine();
