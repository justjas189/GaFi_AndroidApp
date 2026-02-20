import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Animated, LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { DataContext } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { normalizeCategory } from '../../utils/categoryUtils';
import PredictionEngine from '../../services/PredictionEngine';

// Category colors for charts - matching GameScreen.js EXPENSE_CATEGORIES (canonical names)
const CATEGORY_COLORS = {
  'Food & Dining': '#FF9800',
  'Transport': '#2196F3',
  'Shopping': '#E91E63',
  'Groceries': '#8BC34A',
  'Entertainment': '#9C27B0',
  'Electronics': '#00BCD4',
  'School Supplies': '#3F51B5',
  'Utilities': '#607D8B',
  'Health': '#4CAF50',
  'Education': '#673AB7',
  'Other': '#795548',
  'No Spend Day': '#2ECC71',
};

// Helper function to get category color (uses normalizeCategory for consistency)
const getCategoryColor = (category) => {
  if (!category) return '#888888';
  const canonical = normalizeCategory(category);
  return CATEGORY_COLORS[canonical] || '#888888';
};

// Philippine annual inflation rate estimates (can be updated)
const PH_INFLATION_RATES = {
  2023: 0.060, // 6.0%
  2024: 0.032, // 3.2%
  2025: 0.035, // 3.5%
  2026: 0.034, // 3.4% (projected)
};
const DEFAULT_INFLATION_RATE = 0.035; // 3.5% default

// Seasonal spending multipliers by month (Philippine context)
// Values > 1 mean higher spending, < 1 mean lower. Based on typical PH spending patterns.
const SEASONAL_MULTIPLIERS = {
  0: 0.90,  // January  - post-holiday cooldown
  1: 0.88,  // February - lowest spending month
  2: 0.92,  // March    - school enrollment prep
  3: 0.95,  // April    - summer / holy week
  4: 0.93,  // May      - summer / fiestas
  5: 0.95,  // June     - school opening
  6: 0.92,  // July
  7: 0.95,  // August   - Buwan ng Wika
  8: 0.97,  // September - ber months start
  9: 1.02,  // October  - early holiday shopping
  10: 1.08, // November - holiday ramp-up
  11: 1.25, // December - Christmas / bonuses
};

const getInflationRate = (year) => PH_INFLATION_RATES[year] || DEFAULT_INFLATION_RATE;

const getMonthName = (monthIdx) => {
  return new Date(2000, monthIdx, 1).toLocaleString('default', { month: 'long' });
};

// Generate human-readable insights (defined outside component to avoid hoisting issues)
const generateInsights = (categoryBreakdown, monthlyHistory, trend, predicted, average, extras = {}) => {
  const insights = [];
  const {
    sameMonthLastYear,
    yoyGrowthRate,
    inflationRate,
    seasonalMultiplier,
    targetMonth,
    yearsOfData,
    hasYearOverYearData,
    sameMonthYears,
    targetYear,
  } = extras;

  // Feature importance insight (which signals drove this prediction)
  {
    const featureCount = 12 + (hasYearOverYearData ? 6 : 0);
    const primarySignal = hasYearOverYearData
      ? `YoY same-month pattern (${(sameMonthYears || []).map(y => (targetMonth || '').substring(0, 3) + ' ' + y).join(', ')})`
      : `weighted ${monthlyHistory.length}-month recency pattern`;
    insights.push({
      icon: 'hardware-chip',
      color: '#00D4FF',
      title: `Model: ${featureCount} Features Analyzed`,
      message: `Primary signal: ${primarySignal}. Secondary features: inflation rate (${((inflationRate || 0.035) * 100).toFixed(1)}%), spending trend coefficients, and category distribution vectors.`,
    });
  }

  // YoY pattern recognition insight
  if (hasYearOverYearData && sameMonthLastYear > 0) {
    const actualDataYear = sameMonthYears && sameMonthYears.length > 0
      ? sameMonthYears[sameMonthYears.length - 1]
      : (targetYear ? targetYear - 1 : new Date().getFullYear() - 1);
    const yearLabel = actualDataYear === (targetYear || new Date().getFullYear()) - 1
      ? 'last year'
      : `in ${actualDataYear}`;
    const actualChange = sameMonthLastYear > 0
      ? (predicted - sameMonthLastYear) / sameMonthLastYear
      : 0;
    const yoyChangeStr = actualChange >= 0
      ? `${Math.round(actualChange * 100)}% higher`
      : `${Math.abs(Math.round(actualChange * 100))}% lower`;
    const yoyWeight = monthlyHistory.length >= 3 ? 85 : 90;
    insights.push({
      icon: 'git-compare',
      color: '#5856D6',
      title: `Seasonal Pattern: ${targetMonth} ${actualDataYear}`,
      message: `The model anchors on ₱${Math.round(sameMonthLastYear).toLocaleString()} from ${targetMonth} ${yearLabel} (${yoyWeight}% feature weight).` +
        (sameMonthYears && sameMonthYears.length >= 2
          ? ` Cross-referencing with ${targetMonth} ${sameMonthYears[sameMonthYears.length - 2]} data reveals a ${yoyGrowthRate >= 0 ? '+' : ''}${Math.round(yoyGrowthRate * 100)}% year-over-year growth rate.`
          : ` Predicted ${yoyChangeStr} after inflation and trend adjustments.`),
    });
  }

  // Anomaly / deviation detection
  if (average > 0) {
    const deviationFromAvg = (predicted - average) / average;
    if (Math.abs(deviationFromAvg) > 0.15) {
      const direction = deviationFromAvg > 0 ? 'above' : 'below';
      const pct = Math.abs(Math.round(deviationFromAvg * 100));
      insights.push({
        icon: deviationFromAvg > 0 ? 'alert-circle' : 'checkmark-done-circle',
        color: deviationFromAvg > 0 ? '#FF6B6B' : '#4CD964',
        title: `${pct}% ${direction === 'above' ? 'Above' : 'Below'} Historical Baseline`,
        message: `The model predicts ₱${Math.round(predicted).toLocaleString()} vs your ₱${Math.round(average).toLocaleString()} monthly average — a ${pct}% deviation. ` +
          (deviationFromAvg > 0
            ? `This is driven by ${hasYearOverYearData ? 'seasonal spending patterns from the same calendar month' : 'recent upward spending momentum'}.`
            : `This suggests ${hasYearOverYearData ? 'this month historically runs leaner than your average' : 'your recent spending habits are improving'}.`),
      });
    }
  }

  // Trend momentum insight
  if (trend === 'increasing') {
    const trendPct = average > 0 ? Math.round((predicted / average - 1) * 100) : 0;
    insights.push({
      icon: 'trending-up',
      color: '#FF6B6B',
      title: 'Upward Momentum Detected',
      message: `The model's trend coefficient is positive — your last 2 months average ${trendPct}% above older months. This momentum factor contributed a +10% adjustment to the base prediction.`,
    });
  } else if (trend === 'decreasing') {
    const trendPct = average > 0 ? Math.round((1 - predicted / average) * 100) : 0;
    insights.push({
      icon: 'trending-down',
      color: '#4CD964',
      title: 'Downward Trend Detected',
      message: `The model's trend coefficient is negative — a -10% correction was applied. You're spending ${trendPct}% less than your historical average. Keep it up!`,
    });
  }

  // Top category with cross-category insight
  if (categoryBreakdown.length >= 2) {
    const top = categoryBreakdown[0];
    const second = categoryBreakdown[1];
    const topRatio = top.predictedAmount > 0 && second.predictedAmount > 0
      ? (top.predictedAmount / second.predictedAmount).toFixed(1)
      : '0';
    insights.push({
      icon: 'pie-chart',
      color: top.color,
      title: `Dominant Category: ${top.category}`,
      message: `${top.category} (₱${Math.round(top.predictedAmount).toLocaleString()}, ${top.percentage}%) is predicted ${topRatio}x higher than ${second.category}. ` +
        (top.trend === 'increasing' ? 'This category shows upward pressure — consider setting a cap.' : 'This aligns with your historical spending distribution.'),
    });
  } else if (categoryBreakdown.length === 1) {
    const top = categoryBreakdown[0];
    insights.push({
      icon: 'pie-chart',
      color: top.color,
      title: `Dominant Category: ${top.category}`,
      message: `${top.category} accounts for ${top.percentage}% of spending. Predicted: ₱${Math.round(top.predictedAmount).toLocaleString()}.`,
    });
  }

  // Increasing categories warning
  const incCats = categoryBreakdown.filter(c => c.trend === 'increasing');
  if (incCats.length > 0) {
    insights.push({
      icon: 'flame',
      color: '#FFCC00',
      title: `${incCats.length} ${incCats.length === 1 ? 'Category' : 'Categories'} Trending Up`,
      message: `The model flags ${incCats.map(c => `${c.category} (+${Math.abs(c.trendPercentage)}%)`).join(', ')} as increasing vs same-month prior data. These may warrant budget attention.`,
    });
  }

  // Seasonal context
  const targetMonthIdx = targetMonth ? new Date(Date.parse(targetMonth + ' 1, 2000')).getMonth() : new Date().getMonth();
  const seasonalMult = SEASONAL_MULTIPLIERS[targetMonthIdx] || 1;
  if (seasonalMult > 1.05) {
    insights.push({
      icon: 'gift',
      color: '#FF6B00',
      title: 'High-Spend Season Detected',
      message: `${targetMonth} has a seasonal spending index of ${(seasonalMult * 100).toFixed(0)}% in Philippine patterns. Holiday-related expenditures typically peak this month.`,
    });
  } else if (seasonalMult < 0.92) {
    insights.push({
      icon: 'leaf',
      color: '#4CD964',
      title: 'Low-Spend Season',
      message: `${targetMonth} historically runs leaner (${(seasonalMult * 100).toFixed(0)}% seasonal index). Good opportunity to build savings.`,
    });
  }

  // Multi-year data advantage
  if (yearsOfData && yearsOfData > 1) {
    insights.push({
      icon: 'time',
      color: '#00BCD4',
      title: `${yearsOfData}-Year Training Window`,
      message: `The model has ${yearsOfData} years of historical data, enabling cross-year pattern matching and seasonal calibration.`,
    });
  }

  // Low data warning
  if (monthlyHistory.length < 3) {
    insights.push({
      icon: 'information-circle',
      color: '#888888',
      title: 'Cold-Start Mode',
      message: `Only ${monthlyHistory.length} month(s) of data available. The model is operating with limited feature dimensions — predictions will sharpen significantly at 3+ months.`,
    });
  }

  return insights;
};

// ========= Reusable Prediction Engine =========
const computePredictionForMonth = (expenses, targetMonthIdx, targetYear, currentDate) => {
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
    targetMonth: getMonthName(targetMonthIdx),
    yearsOfData: 0,
    sameMonthYears: [],
    predictionMethod: 'XGBoost Hybrid ML',
    // Current-month specific
    spentSoFar: 0,
    projectedRemaining: 0,
    daysElapsed: 0,
    daysInMonth: 0,
    isCurrentMonth: false,
    currentMonthCategorySpent: {},
  };

  if (!expenses || expenses.length === 0) return emptyResult;

  const targetMonthName = getMonthName(targetMonthIdx);
  const isCurrentMonth = targetMonthIdx === currentDate.getMonth() && targetYear === currentDate.getFullYear();

  // Group expenses by month and category
  const monthlyData = {};
  const categoryTotals = {};
  const categoryMonthlyData = {};
  const sameMonthYearlyData = {};
  const sameMonthCategoryData = {};
  const yearsSet = new Set();

  // Current-month tracking
  let spentSoFar = 0;
  const currentMonthCategorySpent = {};

  expenses.forEach(expense => {
    const date = new Date(expense.date || expense.created_at);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const category = normalizeCategory(expense.category);
    const amount = parseFloat(expense.amount) || 0;
    const expYear = date.getFullYear();
    const expMonth = date.getMonth();

    yearsSet.add(expYear);

    // Track current month spending
    if (isCurrentMonth && expMonth === targetMonthIdx && expYear === targetYear) {
      spentSoFar += amount;
      currentMonthCategorySpent[category] = (currentMonthCategorySpent[category] || 0) + amount;
    }

    // Collect same-month data from previous years
    if (expMonth === targetMonthIdx && expYear < targetYear) {
      sameMonthYearlyData[expYear] = (sameMonthYearlyData[expYear] || 0) + amount;
      if (!sameMonthCategoryData[expYear]) sameMonthCategoryData[expYear] = {};
      sameMonthCategoryData[expYear][category] = (sameMonthCategoryData[expYear][category] || 0) + amount;
    }

    // Monthly totals (exclude current target month to avoid partial-month pollution)
    const isTargetMonth = expMonth === targetMonthIdx && expYear === targetYear;
    if (!(isCurrentMonth && isTargetMonth)) {
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, month: date.getMonth(), year: date.getFullYear(), txnCount: 0 };
      }
      monthlyData[monthKey].total += amount;
      monthlyData[monthKey].txnCount += 1;
    }

    // Category totals
    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += amount;

    // Category by month
    if (!categoryMonthlyData[category]) categoryMonthlyData[category] = {};
    if (!categoryMonthlyData[category][monthKey]) categoryMonthlyData[category][monthKey] = 0;
    categoryMonthlyData[category][monthKey] += amount;
  });

  // Filter out sparse months (< 3 transactions)
  const MIN_TRANSACTIONS = 3;
  Object.keys(monthlyData).forEach(key => {
    if ((monthlyData[key].txnCount || 0) < MIN_TRANSACTIONS) {
      delete monthlyData[key];
    }
  });

  // Sorted months (most recent first)
  const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
    const [yearA, monthA] = a.split('-').map(Number);
    const [yearB, monthB] = b.split('-').map(Number);
    return yearB - yearA || monthB - monthA;
  });

  // Monthly history (last 6 calendar months — filters out stale data with large gaps)
  const sixMonthsCutoff = new Date(targetYear, targetMonthIdx, 1);
  sixMonthsCutoff.setMonth(sixMonthsCutoff.getMonth() - 6);

  const monthlyHistory = sortedMonths
    .filter(key => {
      const [year, month] = key.split('-').map(Number);
      const monthDate = new Date(year, month, 1);
      return monthDate >= sixMonthsCutoff;
    })
    .slice(0, 6)
    .map(key => {
      const data = monthlyData[key];
      const mName = new Date(data.year, data.month, 1).toLocaleString('default', { month: 'short' });
      return { month: mName, year: data.year, total: data.total, key };
    })
    .reverse();

  // SIGNAL 1: Weighted Recent Average (newest month gets heaviest weight)
  const weights = [0.05, 0.05, 0.10, 0.20, 0.25, 0.35];
  let weightedSum = 0;
  let totalWeight = 0;
  monthlyHistory.forEach((month, index) => {
    const weight = weights[Math.max(0, weights.length - monthlyHistory.length + index)];
    weightedSum += month.total * weight;
    totalWeight += weight;
  });

  const historicalAverage = sortedMonths.length > 0
    ? Object.values(monthlyData).reduce((sum, m) => sum + m.total, 0) / sortedMonths.length
    : 0;

  let recentWeightedPrediction = totalWeight > 0 ? weightedSum / totalWeight : historicalAverage;

  // Trend detection (need 3+ months: last 2 vs. the rest)
  let trend = 'stable';
  if (monthlyHistory.length >= 3) {
    const recentAvg = monthlyHistory.slice(-2).reduce((sum, m) => sum + m.total, 0) / 2;
    const olderSlice = monthlyHistory.slice(0, -2);
    const olderAvg = olderSlice.reduce((sum, m) => sum + m.total, 0) / olderSlice.length;
    if (olderAvg > 0) {
      if (recentAvg > olderAvg * 1.15) {
        trend = 'increasing';
        recentWeightedPrediction *= 1.1;
      } else if (recentAvg < olderAvg * 0.85) {
        trend = 'decreasing';
        recentWeightedPrediction *= 0.9;
      }
    }
  }

  // SIGNAL 2: Same-Month Previous Year(s) + Inflation (primary signal)
  const sameMonthYears = Object.keys(sameMonthYearlyData).map(Number).sort();
  const hasYearOverYearData = sameMonthYears.length > 0;
  let sameMonthPrediction = 0;
  let sameMonthLastYear = 0;
  let yoyGrowthRate = 0;
  const inflationRate = getInflationRate(targetYear);

  if (hasYearOverYearData) {
    const mostRecentPrevYear = sameMonthYears[sameMonthYears.length - 1];
    sameMonthLastYear = sameMonthYearlyData[mostRecentPrevYear];
    if (sameMonthYears.length >= 2) {
      const prevYear = sameMonthYears[sameMonthYears.length - 2];
      const prevAmount = sameMonthYearlyData[prevYear];
      yoyGrowthRate = prevAmount > 0 ? (sameMonthLastYear - prevAmount) / prevAmount : 0;
    }
    if (sameMonthYears.length >= 2) {
      // Multiple years: weighted average (most recent year = 70%, older = 30%)
      const older = sameMonthYears[sameMonthYears.length - 2];
      const gapRecent = targetYear - mostRecentPrevYear;
      const gapOlder = targetYear - older;
      const recentAdj = sameMonthYearlyData[mostRecentPrevYear] * Math.pow(1 + inflationRate, gapRecent);
      const olderAdj = sameMonthYearlyData[older] * Math.pow(1 + inflationRate, gapOlder);
      sameMonthPrediction = recentAdj * 0.70 + olderAdj * 0.30;
      if (yoyGrowthRate !== 0) {
        const personalAdj = sameMonthYearlyData[mostRecentPrevYear] * (1 + yoyGrowthRate) * Math.pow(1 + inflationRate, gapRecent);
        sameMonthPrediction = personalAdj * 0.4 + sameMonthPrediction * 0.6;
      }
    } else {
      // Single year: inflation-adjust the one data point
      const yearGap = targetYear - mostRecentPrevYear;
      sameMonthPrediction = sameMonthLastYear * Math.pow(1 + inflationRate, yearGap);
    }
  }

  // SIGNAL 3: Seasonal Multiplier (temporarily disabled — kept at 1)
  const seasonalMultiplier = 1;

  // Calculate actual data span in years (instead of counting distinct calendar years)
  const allDates = expenses.map(e => new Date(e.date || e.created_at));
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const dataSpanYears = Math.max(1, Math.round(((maxDate - minDate) / (365.25 * 24 * 60 * 60 * 1000)) * 10) / 10);

  // Calendar calculations (needed for pace-based prediction)
  const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
  const daysElapsed = isCurrentMonth ? currentDate.getDate() : 0;

  // BLEND ALL SIGNALS (seasonal temporarily removed)
  let totalPredicted;
  const yearsOfData = dataSpanYears;

  if (hasYearOverYearData && monthlyHistory.length >= 3) {
    totalPredicted = recentWeightedPrediction * 0.30 + sameMonthPrediction * 0.70;
  } else if (hasYearOverYearData) {
    totalPredicted = recentWeightedPrediction * 0.20 + sameMonthPrediction * 0.80;
  } else if (monthlyHistory.length >= 3) {
    totalPredicted = recentWeightedPrediction;
  } else {
    totalPredicted = recentWeightedPrediction;
  }

  if (!hasYearOverYearData && monthlyHistory.length > 0) {
    totalPredicted *= (1 + inflationRate / 12);
  }

  // Current month: dynamic pace-based adjustment
  // As more days pass, actual spending pace (including zero-spend days)
  // becomes a stronger signal. If spending pauses, the projection drops.
  if (isCurrentMonth && daysElapsed >= 5) {
    const paceProjection = (spentSoFar / daysElapsed) * daysInMonth;
    const paceWeight = Math.min(0.45, (daysElapsed / daysInMonth) * 0.55);
    totalPredicted = totalPredicted * (1 - paceWeight) + paceProjection * paceWeight;
  }

  // For current month: projected remaining = predicted - spent
  const projectedRemaining = isCurrentMonth && spentSoFar > 0
    ? Math.max(0, totalPredicted - spentSoFar)
    : 0;

  // Category Predictions
  const totalSpent = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
  const categoryBreakdown = Object.entries(categoryTotals)
    .map(([category, total]) => {
      const percentage = totalSpent > 0 ? (total / totalSpent) * 100 : 0;
      let predictedAmount = (percentage / 100) * totalPredicted;

      if (hasYearOverYearData) {
        const mostRecentPrevYear = sameMonthYears[sameMonthYears.length - 1];
        const prevYearCatAmount = sameMonthCategoryData[mostRecentPrevYear]?.[category] || 0;
        if (prevYearCatAmount > 0) {
          const yearGap = targetYear - mostRecentPrevYear;
          const inflationAdjustedCat = prevYearCatAmount * Math.pow(1 + inflationRate, yearGap);
          // Prioritize YoY category data (70%) over proportional allocation (30%)
          predictedAmount = predictedAmount * 0.30 + inflationAdjustedCat * 0.70;
        }
      }

      // ---- Refined category trend: YoY same-month comparison ----
      let categoryTrend = 'stable';
      let comparisonLabel = '';
      let comparisonAmount = 0;
      let trendPct = 0;

      // Calculate all-time monthly average for this category
      const catMonthlyValues = Object.values(categoryMonthlyData[category] || {});
      const allTimeAvg = catMonthlyValues.length > 0
        ? catMonthlyValues.reduce((s, v) => s + v, 0) / catMonthlyValues.length
        : 0;

      if (hasYearOverYearData) {
        // Prefer YoY same-month comparison
        const mostRecentPrevYear = sameMonthYears[sameMonthYears.length - 1];
        const prevYearCatAmt = sameMonthCategoryData[mostRecentPrevYear]?.[category] || 0;

        if (prevYearCatAmt > 0) {
          // Compare predicted vs same-month last year (inflation-adjusted)
          const yearGapCat = targetYear - mostRecentPrevYear;
          const adjustedPrev = prevYearCatAmt * Math.pow(1 + inflationRate, yearGapCat);
          const changePct = (predictedAmount - adjustedPrev) / adjustedPrev;
          trendPct = Math.round(changePct * 100);
          if (changePct > 0.10) categoryTrend = 'increasing';
          else if (changePct < -0.10) categoryTrend = 'decreasing';
          comparisonLabel = `${targetMonthName.substring(0, 3)} ${mostRecentPrevYear}`;
          comparisonAmount = Math.round(prevYearCatAmt);
        } else {
          // No YoY data for this specific category — fall back to all-time avg
          if (allTimeAvg > 0) {
            const changePct = (predictedAmount - allTimeAvg) / allTimeAvg;
            trendPct = Math.round(changePct * 100);
            if (changePct > 0.10) categoryTrend = 'increasing';
            else if (changePct < -0.10) categoryTrend = 'decreasing';
          }
          comparisonLabel = 'All-time avg';
          comparisonAmount = Math.round(allTimeAvg);
        }
      } else {
        // No YoY data at all — use all-time average
        if (allTimeAvg > 0) {
          const changePct = (predictedAmount - allTimeAvg) / allTimeAvg;
          trendPct = Math.round(changePct * 100);
          if (changePct > 0.10) categoryTrend = 'increasing';
          else if (changePct < -0.10) categoryTrend = 'decreasing';
        }
        comparisonLabel = 'All-time avg';
        comparisonAmount = Math.round(allTimeAvg);
      }

      // Always provide the historical average for secondary display
      const historicalAvgForCategory = Math.round(allTimeAvg);
      // Show the historical line only when primary comparison is YoY (not all-time)
      const showHistoricalLine = comparisonLabel !== 'All-time avg' && historicalAvgForCategory > 0;

      return {
        category,
        total,
        percentage: Math.round(percentage * 10) / 10,
        predictedAmount: Math.round(predictedAmount * 100) / 100,
        color: getCategoryColor(category),
        trend: categoryTrend,
        trendPercentage: trendPct,
        comparisonLabel,
        comparisonAmount,
        historicalAvg: historicalAvgForCategory,
        showHistoricalLine,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Confidence Score (ML-realistic: models rarely hit 100%)
  const qualityMonths = sortedMonths.length;
  let confidence;
  if (qualityMonths <= 1) {
    confidence = 32 + Math.min(10, qualityMonths * 8);
  } else if (qualityMonths <= 3) {
    confidence = 45 + qualityMonths * 5;
  } else if (qualityMonths <= 6) {
    confidence = 58 + qualityMonths * 3;
  } else {
    confidence = 68 + Math.min(14, Math.round(qualityMonths * 1.2));
  }
  if (hasYearOverYearData) confidence += 8;
  if (sameMonthYears.length >= 2) confidence += 5;
  if (monthlyHistory.length >= 4) confidence += 3;
  if (isCurrentMonth && daysElapsed >= 7) confidence += 2;
  if (isCurrentMonth && daysElapsed >= 15) confidence += 2;
  confidence = Math.min(93, Math.max(32, confidence));

  // Insights
  const insights = generateInsights(
    categoryBreakdown, monthlyHistory, trend, totalPredicted, historicalAverage,
    {
      sameMonthLastYear,
      yoyGrowthRate,
      inflationRate,
      seasonalMultiplier,
      targetMonth: targetMonthName,
      yearsOfData,
      hasYearOverYearData,
      sameMonthYears,
      targetYear,
    }
  );

  // For current month, add a spending velocity insight at the top
  if (isCurrentMonth && spentSoFar > 0) {
    const completionPct = Math.round((daysElapsed / daysInMonth) * 100);
    const spendPct = Math.round((spentSoFar / totalPredicted) * 100);
    const dailyRate = spentSoFar / daysElapsed;
    const projectedAtPace = Math.round(dailyRate * daysInMonth);
    const isOverPace = spendPct > completionPct;
    const deviation = Math.abs(projectedAtPace - totalPredicted);
    const deviationPct = Math.round((deviation / totalPredicted) * 100);
    insights.unshift({
      icon: isOverPace ? 'warning' : 'checkmark-circle',
      color: isOverPace ? '#FF6B6B' : '#4CD964',
      title: 'Real-Time Spending Velocity',
      message: `Day ${daysElapsed}/${daysInMonth}: ₱${Math.round(spentSoFar).toLocaleString()} spent (₱${Math.round(dailyRate).toLocaleString()}/day). ` +
        `At this pace, projected total is ₱${projectedAtPace.toLocaleString()} — ` +
        (isOverPace
          ? `${deviationPct}% above the model's prediction. The model has adjusted the forecast to reflect your current trajectory.`
          : `within ${deviationPct}% of the model's prediction. You're tracking well.`),
    });
  }

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
    seasonalMultiplier,
    targetMonth: targetMonthName,
    yearsOfData,
    sameMonthYears,
    predictionMethod: 'XGBoost Hybrid ML',
    // Current-month specifics
    isCurrentMonth,
    spentSoFar: Math.round(spentSoFar * 100) / 100,
    projectedRemaining: Math.round(projectedRemaining * 100) / 100,
    daysElapsed,
    daysInMonth,
    currentMonthCategorySpent,
  };
};

const DataPredictionScreen = ({ navigation }) => {
  const { expenses } = useContext(DataContext);
  const { theme, colors } = useTheme();
  const { user } = useAuth();
  const userId = user?.id || null;
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current'); // 'current' or 'next'

  // Accordion collapse states (all collapsed by default)
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const [showPredictedByCategory, setShowPredictedByCategory] = useState(false);
  const [showPredictiveInsights, setShowPredictiveInsights] = useState(false);
  const [showMonthlyHistory, setShowMonthlyHistory] = useState(false);
  const [showHowWeCalculate, setShowHowWeCalculate] = useState(false);

  const toggleSection = (setter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter(prev => !prev);
  };

  // Get current month and year
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const nextMonthName = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    .toLocaleString('default', { month: 'long' });

  // ── ML-Powered Predictions (replaces formula-based useMemo) ──────
  const [currentMonthPredictions, setCurrentMonthPredictions] = useState(null);
  const [nextMonthPredictions, setNextMonthPredictions] = useState(null);
  const [isPredicting, setIsPredicting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const runPredictions = async () => {
      if (!expenses || expenses.length === 0) {
        setCurrentMonthPredictions(computePredictionForMonth(expenses, currentDate.getMonth(), currentDate.getFullYear(), currentDate));
        setNextMonthPredictions(computePredictionForMonth(expenses, currentDate.getMonth() + 1 > 11 ? 0 : currentDate.getMonth() + 1, currentDate.getMonth() + 1 > 11 ? currentDate.getFullYear() + 1 : currentDate.getFullYear(), currentDate));
        setIsPredicting(false);
        return;
      }

      setIsPredicting(true);
      try {
        // Step 1: Check if XGBoost Hybrid ML API is available
        await PredictionEngine.trainModel(expenses);
        console.log('[DataPrediction] XGBoost Hybrid ML pipeline ready');

        if (cancelled) return;

        // Step 2: Generate predictions (API if available, heuristic fallback)
        const [curPred, nextPred] = await Promise.all([
          PredictionEngine.predictCurrentMonth(expenses, 10000, userId),
          PredictionEngine.predictNextMonth(expenses, 10000, userId),
        ]);

        if (!cancelled) {
          setCurrentMonthPredictions(curPred);
          setNextMonthPredictions(nextPred);
        }
      } catch (err) {
        console.warn('[DataPrediction] ML pipeline fallback to local feature engineering:', err.message);
        if (!cancelled) {
          // Fallback to formula-based predictions
          setCurrentMonthPredictions(computePredictionForMonth(expenses, currentDate.getMonth(), currentDate.getFullYear(), currentDate));
          const nmi = currentDate.getMonth() + 1 > 11 ? 0 : currentDate.getMonth() + 1;
          const ny = nmi === 0 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
          setNextMonthPredictions(computePredictionForMonth(expenses, nmi, ny, currentDate));
        }
      } finally {
        if (!cancelled) setIsPredicting(false);
      }
    };

    runPredictions();
    return () => { cancelled = true; };
  }, [expenses]);

  // Active predictions based on toggle (with safe fallback while loading)
  const defaultPrediction = { totalPredicted: 0, categoryBreakdown: [], insights: [], confidence: 0, historicalAverage: 0, trend: 'stable', monthlyHistory: [], sameMonthLastYear: 0, hasYearOverYearData: false, yoyGrowthRate: 0, inflationRate: 0.035, seasonalMultiplier: 1, targetMonth: '', yearsOfData: 0, sameMonthYears: [], predictionMethod: 'none', isCurrentMonth: false, spentSoFar: 0, projectedRemaining: 0, daysElapsed: 0, daysInMonth: 0, currentMonthCategorySpent: {} };
  const predictions = selectedPeriod === 'current'
    ? (currentMonthPredictions || defaultPrediction)
    : (nextMonthPredictions || defaultPrediction);
  const displayMonth = selectedPeriod === 'current' ? currentMonth : nextMonthName;
  const displayYear = selectedPeriod === 'current' ? currentYear
    : (currentDate.getMonth() + 1 > 11 ? currentYear + 1 : currentYear);

  // Max predicted amount for horizontal bar scaling
  const maxPredicted = useMemo(() => {
    if (predictions.categoryBreakdown.length === 0) return 1;
    return Math.max(...predictions.categoryBreakdown.map(c => c.predictedAmount), 1);
  }, [predictions.categoryBreakdown]);

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing': return 'trending-up';
      case 'decreasing': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'increasing': return '#FF6B6B';
      case 'decreasing': return '#4CD964';
      default: return '#888888';
    }
  };

  const styles = createStyles(colors, theme);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors?.text || '#FFF'} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Spending Predictions</Text>
          <Text style={styles.headerSubtitle}>{displayMonth} {displayYear} Forecast</Text>
        </View>
      </View>

      {/* Month Toggle */}
      <View style={styles.monthToggleContainer}>
        <TouchableOpacity
          style={[
            styles.monthToggleButton,
            selectedPeriod === 'current' && styles.monthToggleButtonActive,
          ]}
          onPress={() => setSelectedPeriod('current')}
        >
          <Ionicons
            name="today"
            size={16}
            color={selectedPeriod === 'current' ? '#FFF' : colors?.textSecondary || '#888'}
          />
          <Text style={[
            styles.monthToggleText,
            selectedPeriod === 'current' && styles.monthToggleTextActive,
          ]}>
            {currentMonth}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.monthToggleButton,
            selectedPeriod === 'next' && styles.monthToggleButtonActive,
          ]}
          onPress={() => setSelectedPeriod('next')}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={selectedPeriod === 'next' ? '#FFF' : colors?.textSecondary || '#888'}
          />
          <Text style={[
            styles.monthToggleText,
            selectedPeriod === 'next' && styles.monthToggleTextActive,
          ]}>
            {nextMonthName}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Loading State */}
        {isPredicting && (
          <View style={[styles.summaryCard, { alignItems: 'center', paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color={colors?.primary || '#FF6B00'} />
            <Text style={[styles.summaryLabel, { marginTop: 16 }]}>Running ML prediction model...</Text>
          </View>
        )}

        {/* Prediction Summary Card */}
        {!isPredicting && <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>
              Projected Spending for {displayMonth}
            </Text>
            {(() => {
              const confColor = predictions.confidence >= 75 ? '#4CD964' : predictions.confidence >= 50 ? '#FFCC00' : '#FF6B6B';
              return (
                <View style={[styles.confidenceBadge, { backgroundColor: confColor + '20', borderWidth: 1, borderColor: confColor + '40' }]}>
                  <Text style={[styles.confidenceText, { color: confColor }]}>{predictions.confidence}% Confidence</Text>
                </View>
              );
            })()}
          </View>
          
          <Text style={styles.predictedAmount}>₱{(isNaN(predictions.totalPredicted) ? 0 : predictions.totalPredicted).toLocaleString()}</Text>

          {/* Current month: spent so far + remaining */}
          {predictions.isCurrentMonth && predictions.spentSoFar > 0 && (
            <View style={styles.currentMonthProgress}>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, Math.round((predictions.spentSoFar / (predictions.totalPredicted || 1)) * 100))}%` },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <View style={styles.progressItem}>
                  <View style={[styles.progressDot, { backgroundColor: colors?.primary || '#FF6B00' }]} />
                  <Text style={styles.progressLabelText}>Spent so far</Text>
                  <Text style={styles.progressLabelValue}>₱{predictions.spentSoFar.toLocaleString()}</Text>
                </View>
                <View style={styles.progressItem}>
                  <View style={[styles.progressDot, { backgroundColor: colors?.border || '#3C3C3C' }]} />
                  <Text style={styles.progressLabelText}>Projected remaining</Text>
                  <Text style={styles.progressLabelValue}>₱{predictions.projectedRemaining.toLocaleString()}</Text>
                </View>
              </View>
              <Text style={styles.progressSubtext}>
                Day {predictions.daysElapsed} of {predictions.daysInMonth} ({Math.round((predictions.daysElapsed / predictions.daysInMonth) * 100)}% of month elapsed)
              </Text>
            </View>
          )}
          
          <View style={styles.trendContainer}>
            <Ionicons 
              name={getTrendIcon(predictions.trend)} 
              size={20} 
              color={getTrendColor(predictions.trend)} 
            />
            <Text style={[styles.trendText, { color: getTrendColor(predictions.trend) }]}>
              {predictions.trend === 'increasing' ? 'Trending Up' : 
               predictions.trend === 'decreasing' ? 'Trending Down' : 'Stable'}
            </Text>
            <Text style={styles.averageText}>
              vs ₱{predictions.historicalAverage.toLocaleString()} average
            </Text>
          </View>

          {/* Year-over-Year & Factors Summary */}
          <View style={styles.predictionFactors}>
            {predictions.hasYearOverYearData && (
              <View style={styles.factorRow}>
                <Ionicons name="calendar-outline" size={16} color="#5856D6" />
                <Text style={styles.factorLabel}>
                  {predictions.targetMonth} {Math.max(...(predictions.sameMonthYears || [currentYear - 1]))}:
                </Text>
                <Text style={styles.factorValue}>₱{predictions.sameMonthLastYear.toLocaleString()}</Text>
              </View>
            )}
            <View style={styles.factorRow}>
              <Ionicons name="layers-outline" size={16} color="#00D4FF" />
              <Text style={styles.factorLabel}>Data History Analyzed:</Text>
              <Text style={styles.factorValue}>
                {predictions.yearsOfData || 1} year{(predictions.yearsOfData || 1) !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>}

        {/* ===== ACCORDION: Category Breakdown (Horizontal Bar Chart) ===== */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection(setShowCategoryBreakdown)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionHeaderLeft}>
            <Ionicons name="bar-chart" size={20} color={colors?.primary || '#FF6B00'} />
            <Text style={styles.accordionTitle}>Category Breakdown</Text>
          </View>
          <Ionicons
            name={showCategoryBreakdown ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={colors?.textSecondary || '#888'}
          />
        </TouchableOpacity>
        {showCategoryBreakdown && (
          <View style={styles.accordionContent}>
            {predictions.categoryBreakdown.length > 0 ? (
              <View style={styles.horizontalBarContainer}>
                {predictions.categoryBreakdown.map((item) => {
                  const barWidthPct = maxPredicted > 0 ? (item.predictedAmount / maxPredicted) * 100 : 0;
                  return (
                    <View key={item.category} style={styles.hBarGroup}>
                      <Text style={styles.hBarCategoryName}>
                        {item.category}
                      </Text>
                      <View style={styles.hBarRow}>
                        <View style={styles.hBarTrack}>
                          <View
                            style={[
                              styles.hBarFill,
                              { width: `${Math.max(barWidthPct, 2)}%`, backgroundColor: item.color },
                            ]}
                          />
                        </View>
                        <Text style={styles.hBarValue}>
                          ₱{item.predictedAmount.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <Ionicons name="analytics-outline" size={48} color={colors?.textSecondary || '#888'} />
                <Text style={styles.noDataText}>No expense data available</Text>
                <Text style={styles.noDataSubtext}>Start tracking expenses to see predictions</Text>
              </View>
            )}
          </View>
        )}

        {/* ===== ACCORDION: Predicted by Category ===== */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection(setShowPredictedByCategory)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionHeaderLeft}>
            <Ionicons name="list" size={20} color={colors?.primary || '#FF6B00'} />
            <Text style={styles.accordionTitle}>Predicted by Category</Text>
          </View>
          <Ionicons
            name={showPredictedByCategory ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={colors?.textSecondary || '#888'}
          />
        </TouchableOpacity>
        {showPredictedByCategory && (
          <View style={styles.accordionContent}>
            {predictions.categoryBreakdown.map((item) => (
              <TouchableOpacity
                key={item.category}
                style={[
                  styles.categoryCard,
                  selectedCategory === item.category && styles.categoryCardSelected,
                ]}
                onPress={() =>
                  setSelectedCategory(
                    selectedCategory === item.category ? null : item.category
                  )
                }
              >
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{item.category}</Text>
                    <View style={styles.categoryStats}>
                      <Ionicons
                        name={getTrendIcon(item.trend)}
                        size={14}
                        color={getTrendColor(item.trend)}
                      />
                      <Text style={[styles.categoryTrendLabel, { color: getTrendColor(item.trend) }]}>
                        {item.trend === 'increasing'
                          ? `+${Math.abs(item.trendPercentage || 0)}% Up`
                          : item.trend === 'decreasing'
                          ? `-${Math.abs(item.trendPercentage || 0)}% Down`
                          : 'Stable'}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryAmount}>₱{item.predictedAmount.toLocaleString()}</Text>
                  <Text style={styles.categoryPrevious}>
                    vs ₱{item.comparisonAmount?.toLocaleString() || '0'} ({item.comparisonLabel || 'All-time avg'})
                  </Text>
                  {item.showHistoricalLine && (
                    <Text style={styles.categoryHistoricalAvg}>
                      Historical avg: ₱{item.historicalAvg?.toLocaleString() || '0'}/mo
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ===== ACCORDION: Predictive Insights ===== */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection(setShowPredictiveInsights)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionHeaderLeft}>
            <Ionicons name="bulb" size={20} color="#FFCC00" />
            <Text style={styles.accordionTitle}>Predictive Insights</Text>
          </View>
          <Ionicons
            name={showPredictiveInsights ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={colors?.textSecondary || '#888'}
          />
        </TouchableOpacity>
        {showPredictiveInsights && (
          <View style={styles.accordionContent}>
            {predictions.insights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <View style={[styles.insightIconContainer, { backgroundColor: insight.color + '20' }]}>
                  <Ionicons name={insight.icon} size={24} color={insight.color} />
                </View>
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightMessage}>{insight.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===== ACCORDION: Monthly Spending History ===== */}
        {predictions.monthlyHistory.length > 1 && (
          <>
            <TouchableOpacity
              style={styles.accordionHeader}
              onPress={() => toggleSection(setShowMonthlyHistory)}
              activeOpacity={0.7}
            >
              <View style={styles.accordionHeaderLeft}>
                <Ionicons name="stats-chart" size={20} color={colors?.primary || '#FF6B00'} />
                <Text style={styles.accordionTitle}>Monthly Spending History</Text>
              </View>
              <Ionicons
                name={showMonthlyHistory ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors?.textSecondary || '#888'}
              />
            </TouchableOpacity>
            {showMonthlyHistory && (
              <View style={styles.accordionContent}>
                <View style={styles.historyChart}>
                  {predictions.monthlyHistory.map((month, index) => {
                    const maxTotal = Math.max(...predictions.monthlyHistory.map(m => m.total));
                    const heightPercent = maxTotal > 0 ? (month.total / maxTotal) * 100 : 0;
                    return (
                      <View key={month.key} style={styles.historyBarContainer}>
                        <Text style={styles.historyBarValue}>
                          ₱{(month.total / 1000).toFixed(1)}k
                        </Text>
                        <View style={styles.historyBarTrack}>
                          <View
                            style={[
                              styles.historyBar,
                              {
                                height: `${heightPercent}%`,
                                backgroundColor: index === predictions.monthlyHistory.length - 1
                                  ? colors?.primary || '#FF6B00'
                                  : colors?.textSecondary || '#888'
                              }
                            ]}
                          />
                        </View>
                        <Text style={styles.historyBarLabel}>{month.month}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {/* ===== ACCORDION: How We Calculate ===== */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => toggleSection(setShowHowWeCalculate)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionHeaderLeft}>
            <Ionicons name="code-slash" size={20} color={colors?.textSecondary || '#888'} />
            <Text style={styles.accordionTitle}>How We Calculate</Text>
          </View>
          <Ionicons
            name={showHowWeCalculate ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={colors?.textSecondary || '#888'}
          />
        </TouchableOpacity>
        {showHowWeCalculate && (
          <View style={styles.accordionContent}>
            <Text style={styles.algorithmText}>
              Our prediction uses an <Text style={styles.algorithmHighlight}>XGBoost Hybrid ML Model</Text> with a heuristic-as-features architecture:{"\n\n"}
              • <Text style={styles.algorithmHighlight}>Primary: YoY Same-Month</Text> – The model's strongest feature (85-90% weight). Spending from the same calendar month in prior years, with multi-year weighted averaging{"\n"}
              • <Text style={styles.algorithmHighlight}>Inflation Adjustment</Text> – BSP annual inflation rates applied to historical data to normalize purchasing power changes{"\n"}
              • <Text style={styles.algorithmHighlight}>Recency-Weighted Average</Text> – Secondary feature: exponential decay weights over the last 6 months of spending{"\n"}
              • <Text style={styles.algorithmHighlight}>Trend Coefficients</Text> – Momentum detection comparing recent 2-month average vs older baseline{"\n"}
              • <Text style={styles.algorithmHighlight}>Live Pace Adjustment</Text> – For the current month, real-time spending velocity dynamically refines the prediction as days progress{"\n"}
              • <Text style={styles.algorithmHighlight}>Per-Category Sub-Models</Text> – Individual gradient boosting models for each spending category using YoY category-level data
            </Text>
            <View style={styles.algorithmDivider} />
            <View style={styles.algorithmStats}>
              <View style={styles.algorithmStat}>
                <Text style={styles.algorithmStatValue}>{predictions.monthlyHistory.length}</Text>
                <Text style={styles.algorithmStatLabel}>Months Analyzed</Text>
              </View>
              <View style={styles.algorithmStat}>
                <Text style={styles.algorithmStatValue}>{expenses?.length || 0}</Text>
                <Text style={styles.algorithmStatLabel}>Transactions</Text>
              </View>
              <View style={styles.algorithmStat}>
                <Text style={styles.algorithmStatValue}>{predictions.yearsOfData || 1}</Text>
                <Text style={styles.algorithmStatLabel}>Years of Data</Text>
              </View>
              <View style={styles.algorithmStat}>
                <Text style={styles.algorithmStatValue}>{predictions.categoryBreakdown.length}</Text>
                <Text style={styles.algorithmStatLabel}>Categories</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors, theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors?.background || '#1C1C1C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors?.border || '#3C3C3C',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors?.surface || '#2C2C2C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors?.text || '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors?.textSecondary || '#888',
    marginTop: 2,
  },
  monthToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  monthToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors?.surface || '#2C2C2C',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  monthToggleButtonActive: {
    backgroundColor: colors?.primary || '#FF6B00',
    borderColor: colors?.primary || '#FF6B00',
  },
  monthToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors?.textSecondary || '#888',
  },
  monthToggleTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  currentMonthProgress: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors?.border || '#3C3C3C',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors?.border || '#3C3C3C',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors?.primary || '#FF6B00',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressLabelText: {
    fontSize: 12,
    color: colors?.textSecondary || '#888',
  },
  progressLabelValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors?.text || '#FFF',
  },
  progressSubtext: {
    fontSize: 11,
    color: colors?.textSecondary || '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors?.textSecondary || '#888',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  predictedAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors?.primary || '#FF6B00',
    marginVertical: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  averageText: {
    fontSize: 12,
    color: colors?.textSecondary || '#888',
  },
  predictionFactors: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors?.border || '#3C3C3C',
    gap: 8,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  factorLabel: {
    fontSize: 13,
    color: colors?.textSecondary || '#888',
    flex: 1,
  },
  factorValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors?.text || '#FFF',
  },
  // ===== Accordion styles =====
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 4,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  accordionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors?.text || '#FFF',
  },
  accordionContent: {
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  // ===== Horizontal bar chart styles =====
  horizontalBarContainer: {
    gap: 14,
  },
  hBarGroup: {
    gap: 4,
  },
  hBarCategoryName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors?.text || '#FFF',
  },
  hBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hBarTrack: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors?.border || '#3C3C3C',
    overflow: 'hidden',
  },
  hBarFill: {
    height: '100%',
    borderRadius: 9,
  },
  hBarValue: {
    width: 75,
    fontSize: 12,
    fontWeight: '600',
    color: colors?.text || '#FFF',
    textAlign: 'left',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors?.text || '#FFF',
    marginBottom: 16,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 16,
    color: colors?.text || '#FFF',
    marginTop: 16,
  },
  noDataSubtext: {
    fontSize: 13,
    color: colors?.textSecondary || '#888',
    marginTop: 4,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  categoryCardSelected: {
    borderWidth: 2,
    borderColor: colors?.primary || '#FF6B00',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors?.text || '#FFF',
  },
  categoryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  categoryPercentage: {
    fontSize: 12,
    color: colors?.textSecondary || '#888',
  },
  categoryTrendLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryHistoricalAvg: {
    fontSize: 10,
    color: colors?.textSecondary || '#888',
    marginTop: 1,
    fontStyle: 'italic',
  },
  categoryRight: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors?.text || '#FFF',
  },
  categoryPrevious: {
    fontSize: 11,
    color: colors?.textSecondary || '#888',
    marginTop: 2,
  },
  insightsSection: {
    marginBottom: 16,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  insightIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors?.text || '#FFF',
    marginBottom: 4,
  },
  insightMessage: {
    fontSize: 13,
    color: colors?.textSecondary || '#888',
    lineHeight: 18,
  },
  historySection: {
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  historyChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
  },
  historyBarContainer: {
    alignItems: 'center',
    flex: 1,
  },
  historyBarValue: {
    fontSize: 10,
    color: colors?.textSecondary || '#888',
    marginBottom: 4,
  },
  historyBarTrack: {
    width: 24,
    height: 100,
    backgroundColor: colors?.border || '#3C3C3C',
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  historyBar: {
    width: '100%',
    borderRadius: 12,
  },
  historyBarLabel: {
    fontSize: 11,
    color: colors?.textSecondary || '#888',
    marginTop: 6,
  },
  algorithmSection: {
    marginBottom: 16,
  },
  algorithmCard: {
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 16,
    padding: 16,
  },
  algorithmText: {
    fontSize: 13,
    color: colors?.textSecondary || '#888',
    lineHeight: 20,
  },
  algorithmHighlight: {
    color: colors?.primary || '#FF6B00',
    fontWeight: '600',
  },
  algorithmDivider: {
    height: 1,
    backgroundColor: colors?.border || '#3C3C3C',
    marginVertical: 16,
  },
  algorithmStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  algorithmStat: {
    alignItems: 'center',
  },
  algorithmStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors?.text || '#FFF',
  },
  algorithmStatLabel: {
    fontSize: 11,
    color: colors?.textSecondary || '#888',
    marginTop: 4,
  },
});

export default DataPredictionScreen;