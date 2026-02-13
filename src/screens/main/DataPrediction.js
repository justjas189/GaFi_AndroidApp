import React, { useState, useContext, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { DataContext } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { analyzeExpenses, getRecommendations } from '../../config/nvidia';

const screenWidth = Dimensions.get('window').width;

// Category colors for charts - matching GameScreen.js EXPENSE_CATEGORIES
const CATEGORY_COLORS = {
  // GameScreen category names
  'food & dining': '#FF9800',
  'transport': '#2196F3',
  'shopping': '#E91E63',
  'groceries': '#8BC34A',
  'entertainment': '#9C27B0',
  'electronics': '#00BCD4',
  'school supplies': '#3F51B5',
  'utilities': '#607D8B',
  'health': '#4CAF50',
  'education': '#673AB7',
  'other': '#795548',
  // Legacy/ExpenseScreen category names (for backward compatibility)
  'food': '#FF6B6B',
  'transportation': '#4ECDC4',
  'others': '#DDA0DD',
  'no spend day': '#2ECC71',
};

// Helper function to get category color (case-insensitive)
const getCategoryColor = (category) => {
  if (!category) return '#888888';
  const normalizedCategory = category.toLowerCase().trim();
  return CATEGORY_COLORS[normalizedCategory] || '#888888';
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
  } = extras;

  // Year-over-year comparison insight
  if (hasYearOverYearData && sameMonthLastYear > 0) {
    const yoyChange = yoyGrowthRate >= 0
      ? `${Math.round(yoyGrowthRate * 100)}% more`
      : `${Math.abs(Math.round(yoyGrowthRate * 100))}% less`;
    insights.push({
      icon: 'calendar',
      color: '#5856D6',
      title: `Last Year's ${targetMonth}`,
      message: `You spent ₱${Math.round(sameMonthLastYear).toLocaleString()} in ${targetMonth} last year. Your predicted spending this year is ${yoyChange} when adjusted for habits and inflation.`,
    });
  }

  // Inflation insight
  if (inflationRate) {
    insights.push({
      icon: 'analytics',
      color: '#FF9800',
      title: 'Inflation Adjustment Applied',
      message: `A ${(inflationRate * 100).toFixed(1)}% annual inflation rate has been factored into this prediction to reflect rising costs of goods and services.`,
    });
  }

  // Seasonal insight
  if (seasonalMultiplier && seasonalMultiplier !== 1) {
    const seasonDir = seasonalMultiplier > 1 ? 'higher' : 'lower';
    const seasonPct = Math.abs(Math.round((seasonalMultiplier - 1) * 100));
    insights.push({
      icon: seasonalMultiplier > 1 ? 'arrow-up-circle' : 'arrow-down-circle',
      color: seasonalMultiplier > 1 ? '#FF6B6B' : '#4CD964',
      title: `Seasonal Pattern: ${targetMonth}`,
      message: `${targetMonth} historically sees ~${seasonPct}% ${seasonDir} spending than average. This seasonal pattern has been factored into your prediction.`,
    });
  }

  // Trend insight
  if (trend === 'increasing') {
    insights.push({
      icon: 'trending-up',
      color: '#FF6B6B',
      title: 'Spending Trend Rising',
      message: `Your spending has been increasing over the past months. Based on this trend, we've adjusted the prediction ${Math.round((predicted / average - 1) * 100)}% higher than your historical average.`,
    });
  } else if (trend === 'decreasing') {
    insights.push({
      icon: 'trending-down',
      color: '#4CD964',
      title: 'Spending Trend Decreasing',
      message: `Great job! Your spending has been decreasing. We've adjusted the prediction ${Math.round((1 - predicted / average) * 100)}% lower based on this positive trend.`,
    });
  }

  // Top spending category insight
  if (categoryBreakdown.length > 0) {
    const topCategory = categoryBreakdown[0];
    insights.push({
      icon: 'pie-chart',
      color: topCategory.color,
      title: `${topCategory.category} is Your Biggest Expense`,
      message: `${topCategory.category} accounts for ${topCategory.percentage}% of your spending. You're predicted to spend ₱${topCategory.predictedAmount.toLocaleString()} in this category next month.`,
    });
  }

  // Categories with increasing trend
  const increasingCategories = categoryBreakdown.filter(c => c.trend === 'increasing');
  if (increasingCategories.length > 0) {
    const names = increasingCategories.map(c => c.category).join(', ');
    insights.push({
      icon: 'alert-circle',
      color: '#FFCC00',
      title: 'Watch These Categories',
      message: `Your spending in ${names} has been increasing recently. Consider setting budget limits for these areas.`,
    });
  }

  // Specific seasonal hints (PH context)
  const currentMonthNum = new Date().getMonth();
  if (currentMonthNum === 11) {
    insights.push({
      icon: 'gift',
      color: '#FF6B00',
      title: 'Holiday Season Alert',
      message: 'December typically sees 20-30% higher spending due to holidays, gift-giving, and celebrations. Budget accordingly!',
    });
  } else if (currentMonthNum === 0) {
    insights.push({
      icon: 'calendar',
      color: '#5856D6',
      title: 'New Year, New Budget',
      message: 'January is a great time to set new financial goals. Your post-holiday spending might be lower than usual.',
    });
  }

  // Data confidence insight
  if (monthlyHistory.length < 3) {
    insights.push({
      icon: 'information-circle',
      color: '#888888',
      title: 'Limited Data Available',
      message: `Predictions are based on ${monthlyHistory.length} month(s) of data. Continue tracking expenses for more accurate predictions over time.`,
    });
  }

  // Multi-year data insight
  if (yearsOfData && yearsOfData > 1) {
    insights.push({
      icon: 'time',
      color: '#00BCD4',
      title: `${yearsOfData} Years of Data Used`,
      message: `Your prediction leverages ${yearsOfData} years of spending history, comparing the same month across years for higher accuracy.`,
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
    const category = expense.category || 'Others';
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

    // Monthly totals
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { total: 0, month: date.getMonth(), year: date.getFullYear() };
    }
    monthlyData[monthKey].total += amount;

    // Category totals
    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += amount;

    // Category by month
    if (!categoryMonthlyData[category]) categoryMonthlyData[category] = {};
    if (!categoryMonthlyData[category][monthKey]) categoryMonthlyData[category][monthKey] = 0;
    categoryMonthlyData[category][monthKey] += amount;
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

  // SIGNAL 1: Weighted Recent Average
  const weights = [0.35, 0.25, 0.20, 0.10, 0.05, 0.05];
  let weightedSum = 0;
  let totalWeight = 0;
  monthlyHistory.forEach((month, index) => {
    const weight = weights[Math.min(index, weights.length - 1)];
    weightedSum += month.total * weight;
    totalWeight += weight;
  });

  const historicalAverage = sortedMonths.length > 0
    ? Object.values(monthlyData).reduce((sum, m) => sum + m.total, 0) / sortedMonths.length
    : 0;

  let recentWeightedPrediction = totalWeight > 0 ? weightedSum / totalWeight : historicalAverage;

  // Trend detection
  let trend = 'stable';
  if (monthlyHistory.length >= 2) {
    const recentAvg = monthlyHistory.slice(-2).reduce((sum, m) => sum + m.total, 0) / 2;
    const olderAvg = monthlyHistory.slice(0, -2).reduce((sum, m) => sum + m.total, 0) / Math.max(1, monthlyHistory.length - 2);
    if (recentAvg > olderAvg * 1.15) {
      trend = 'increasing';
      recentWeightedPrediction *= 1.1;
    } else if (recentAvg < olderAvg * 0.85) {
      trend = 'decreasing';
      recentWeightedPrediction *= 0.9;
    }
  }

  // SIGNAL 2: Same-Month Previous Year(s) + Inflation
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
    const yearGap = targetYear - mostRecentPrevYear;
    sameMonthPrediction = sameMonthLastYear * Math.pow(1 + inflationRate, yearGap);
    if (yoyGrowthRate !== 0) {
      const personalGrowthAdjusted = sameMonthLastYear * (1 + yoyGrowthRate);
      sameMonthPrediction = personalGrowthAdjusted * 0.6 + sameMonthPrediction * 0.4;
    }
  }

  // SIGNAL 3: Seasonal Multiplier
  const seasonalMultiplier = SEASONAL_MULTIPLIERS[targetMonthIdx] || 1;

  // BLEND ALL SIGNALS
  let totalPredicted;
  const yearsOfData = yearsSet.size;

  if (hasYearOverYearData && monthlyHistory.length >= 3) {
    // YoY is the primary signal; recent trend and seasonal act as secondary adjustments
    const seasonalAdjustedAvg = historicalAverage * seasonalMultiplier;
    totalPredicted = recentWeightedPrediction * 0.25 + sameMonthPrediction * 0.55 + seasonalAdjustedAvg * 0.20;
  } else if (hasYearOverYearData) {
    // Limited recent data — lean even more heavily on YoY
    const seasonalAdjustedAvg = historicalAverage * seasonalMultiplier;
    totalPredicted = recentWeightedPrediction * 0.15 + sameMonthPrediction * 0.65 + seasonalAdjustedAvg * 0.20;
  } else if (monthlyHistory.length >= 3) {
    totalPredicted = recentWeightedPrediction * seasonalMultiplier;
  } else {
    totalPredicted = recentWeightedPrediction;
  }

  if (!hasYearOverYearData && monthlyHistory.length > 0) {
    totalPredicted *= (1 + inflationRate / 12);
  }

  // For current month: blend model prediction with actual pace
  let projectedRemaining = 0;
  const daysInMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
  const daysElapsed = isCurrentMonth ? currentDate.getDate() : 0;

  if (isCurrentMonth && daysElapsed > 0 && spentSoFar > 0) {
    // Pace-based projection: (daily avg so far) * remaining days
    const dailyRate = spentSoFar / daysElapsed;
    const daysRemaining = daysInMonth - daysElapsed;
    const paceProjection = spentSoFar + (dailyRate * daysRemaining);
    projectedRemaining = dailyRate * daysRemaining;

    // Blend: 55% pace-based (actual data), 45% model prediction
    totalPredicted = paceProjection * 0.55 + totalPredicted * 0.45;
  }

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
          // Prioritize YoY category data over proportional allocation
          predictedAmount = predictedAmount * 0.40 + inflationAdjustedCat * 0.60;
        }
      }

      const categoryHistory = Object.values(categoryMonthlyData[category] || {});
      let categoryTrend = 'stable';
      if (categoryHistory.length >= 2) {
        const recent = categoryHistory[categoryHistory.length - 1];
        const previous = categoryHistory[categoryHistory.length - 2];
        if (recent > previous * 1.2) categoryTrend = 'increasing';
        else if (recent < previous * 0.8) categoryTrend = 'decreasing';
      }

      return {
        category,
        total,
        percentage: Math.round(percentage * 10) / 10,
        predictedAmount: Math.round(predictedAmount * 100) / 100,
        color: getCategoryColor(category),
        trend: categoryTrend,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Confidence Score
  let confidence = Math.min(100, Math.round((sortedMonths.length / 6) * 60));
  if (hasYearOverYearData) confidence += 20;
  if (sameMonthYears.length >= 2) confidence += 10;
  if (monthlyHistory.length >= 4) confidence += 10;
  if (isCurrentMonth && daysElapsed >= 7) confidence += 10; // actual data this month boosts confidence
  confidence = Math.min(100, confidence);

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
    }
  );

  // For current month, add a spent-so-far insight at the top
  if (isCurrentMonth && spentSoFar > 0) {
    const completionPct = Math.round((daysElapsed / daysInMonth) * 100);
    const spendPct = Math.round((spentSoFar / totalPredicted) * 100);
    const isOverPace = spendPct > completionPct;
    insights.unshift({
      icon: isOverPace ? 'warning' : 'checkmark-circle',
      color: isOverPace ? '#FF6B6B' : '#4CD964',
      title: `${completionPct}% of ${targetMonthName} Elapsed`,
      message: `You've spent ₱${Math.round(spentSoFar).toLocaleString()} so far (${spendPct}% of predicted total). ` +
        (isOverPace
          ? `You're spending faster than projected — consider slowing down for the remaining ${daysInMonth - daysElapsed} days.`
          : `You're on track or under pace. Keep it up for the remaining ${daysInMonth - daysElapsed} days!`),
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
  const [refreshing, setRefreshing] = useState(false);
  const [chartType, setChartType] = useState('pie'); // 'pie' or 'bar'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current'); // 'current' or 'next'
  
  // AI Insights States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState([]);

  // Get current month and year
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const nextMonthName = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    .toLocaleString('default', { month: 'long' });

  // Compute predictions for current month
  const currentMonthPredictions = useMemo(() => {
    return computePredictionForMonth(
      expenses,
      currentDate.getMonth(),
      currentDate.getFullYear(),
      currentDate
    );
  }, [expenses]);

  // Compute predictions for next month
  const nextMonthPredictions = useMemo(() => {
    const nextMonthIdx = currentDate.getMonth() + 1 > 11 ? 0 : currentDate.getMonth() + 1;
    const nextYear = nextMonthIdx === 0 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
    return computePredictionForMonth(expenses, nextMonthIdx, nextYear, currentDate);
  }, [expenses]);

  // Active predictions based on toggle
  const predictions = selectedPeriod === 'current' ? currentMonthPredictions : nextMonthPredictions;
  const displayMonth = selectedPeriod === 'current' ? currentMonth : nextMonthName;
  const displayYear = selectedPeriod === 'current' ? currentYear
    : (currentDate.getMonth() + 1 > 11 ? currentYear + 1 : currentYear);

  // Fetch AI-powered recommendations
  useEffect(() => {
    const fetchAIRecommendations = async () => {
      if (!expenses || expenses.length === 0) {
        setAiRecommendations([]);
        return;
      }

      setAiLoading(true);
      setAiError(null);

      try {
        // Try to get AI recommendations
        const recommendations = await getRecommendations(expenses);
        
        if (recommendations && recommendations.length > 0) {
          setAiRecommendations(recommendations);
        } else {
          // Fallback recommendations based on data analysis
          const fallbackRecs = generateFallbackRecommendations(predictions);
          setAiRecommendations(fallbackRecs);
        }
      } catch (error) {
        console.log('AI recommendations error:', error);
        // Use fallback recommendations on error
        const fallbackRecs = generateFallbackRecommendations(predictions);
        setAiRecommendations(fallbackRecs);
        setAiError('Using offline recommendations');
      } finally {
        setAiLoading(false);
      }
    };

    fetchAIRecommendations();
  }, [expenses, predictions, selectedPeriod]);

  // Generate fallback recommendations when AI is unavailable
  const generateFallbackRecommendations = (predictionsData) => {
    const recs = [];
    const topCategory = predictionsData.categoryBreakdown[0];
    
    if (topCategory) {
      recs.push({
        icon: 'alert-circle',
        color: '#FF6B6B',
        title: `High ${topCategory.category} Spending`,
        message: `${topCategory.category} accounts for ${topCategory.percentage}% of your predicted spending. Consider setting a budget limit for this category.`,
      });
    }

    if (predictionsData.trend === 'increasing') {
      recs.push({
        icon: 'trending-up',
        color: '#FFCC00',
        title: 'Spending Increasing',
        message: 'Your spending has been trending upward. Review your recent purchases and identify areas where you can cut back.',
      });
    } else if (predictionsData.trend === 'decreasing') {
      recs.push({
        icon: 'trending-down',
        color: '#4CD964',
        title: 'Great Progress!',
        message: 'Your spending is trending down. Keep up the good work and consider putting the savings toward your goals.',
      });
    }

    // Category-specific tips
    const categoryTips = {
      'Food': 'Try meal prepping or cooking at home more often to reduce food expenses.',
      'Shopping': 'Create a wishlist and wait 24 hours before making non-essential purchases.',
      'Transportation': 'Consider carpooling or using public transit to save on transportation costs.',
      'Entertainment': 'Look for free events or use streaming services instead of multiple subscriptions.',
      'Utilities': 'Turn off lights and unplug devices when not in use to lower utility bills.',
    };

    if (topCategory && categoryTips[topCategory.category]) {
      recs.push({
        icon: 'bulb',
        color: '#00D4FF',
        title: `${topCategory.category} Tip`,
        message: categoryTips[topCategory.category],
      });
    }

    // Savings recommendation
    if (predictionsData.totalPredicted > 0) {
      const suggestedSavings = Math.round(predictionsData.totalPredicted * 0.2);
      recs.push({
        icon: 'wallet',
        color: '#4CD964',
        title: 'Savings Goal',
        message: `Based on your predicted spending, aim to save ₱${suggestedSavings.toLocaleString()} (20% of your predicted expenses) this month.`,
      });
    }

    return recs;
  };

  // Prepare pie chart data
  const pieChartData = useMemo(() => {
    return predictions.categoryBreakdown.map(item => ({
      name: item.category,
      population: item.predictedAmount,
      color: item.color,
      legendFontColor: colors?.text || '#FFF',
      legendFontSize: 12,
    }));
  }, [predictions.categoryBreakdown, colors]);

  // Prepare bar chart data
  const barChartData = useMemo(() => {
    const labels = predictions.categoryBreakdown.map(item => 
      item.category.length > 6 ? item.category.substring(0, 6) + '.' : item.category
    );
    const data = predictions.categoryBreakdown.map(item => item.predictedAmount);
    
    return {
      labels,
      datasets: [{
        data: data.length > 0 ? data : [0],
      }],
    };
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
        <TouchableOpacity 
          style={styles.chartToggleButton}
          onPress={() => setChartType(chartType === 'pie' ? 'bar' : 'pie')}
        >
          <Ionicons 
            name={chartType === 'pie' ? 'bar-chart' : 'pie-chart'} 
            size={24} 
            color={colors?.primary || '#FF6B00'} 
          />
        </TouchableOpacity>
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
          {predictions.isCurrentMonth && predictions.spentSoFar > 0 && selectedPeriod === 'current' && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
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
        {/* Prediction Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryLabel}>
              {predictions.isCurrentMonth ? 'Projected Spending for' : 'Predicted Spending for'} {displayMonth}
            </Text>
            <View style={[styles.confidenceBadge, { backgroundColor: predictions.confidence >= 70 ? '#4CD964' : '#FFCC00' }]}>
              <Text style={styles.confidenceText}>{predictions.confidence}% Confidence</Text>
            </View>
          </View>
          
          <Text style={styles.predictedAmount}>₱{predictions.totalPredicted.toLocaleString()}</Text>

          {/* Current month: spent so far + remaining */}
          {predictions.isCurrentMonth && predictions.spentSoFar > 0 && (
            <View style={styles.currentMonthProgress}>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(100, Math.round((predictions.spentSoFar / predictions.totalPredicted) * 100))}%` },
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
              <Ionicons name="analytics-outline" size={16} color="#FF9800" />
              <Text style={styles.factorLabel}>Inflation Applied:</Text>
              <Text style={styles.factorValue}>{((predictions.inflationRate || 0) * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.factorRow}>
              <Ionicons name="leaf-outline" size={16} color="#4CAF50" />
              <Text style={styles.factorLabel}>Seasonal Factor:</Text>
              <Text style={styles.factorValue}>
                {predictions.seasonalMultiplier > 1 ? '+' : ''}
                {(((predictions.seasonalMultiplier || 1) - 1) * 100).toFixed(0)}%
              </Text>
            </View>
            {predictions.hasYearOverYearData && predictions.yoyGrowthRate !== 0 && (
              <View style={styles.factorRow}>
                <Ionicons name="swap-vertical-outline" size={16} color="#00BCD4" />
                <Text style={styles.factorLabel}>Year-over-Year:</Text>
                <Text style={[styles.factorValue, { color: predictions.yoyGrowthRate > 0 ? '#FF6B6B' : '#4CD964' }]}>
                  {predictions.yoyGrowthRate > 0 ? '+' : ''}{(predictions.yoyGrowthRate * 100).toFixed(1)}%
                </Text>
              </View>
            )}
            <View style={styles.factorRow}>
              <Ionicons name="layers-outline" size={16} color="#00D4FF" />
              <Text style={styles.factorLabel}>Data Span:</Text>
              <Text style={styles.factorValue}>
                {predictions.yearsOfData || 1} year{(predictions.yearsOfData || 1) > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart Section */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Category Breakdown</Text>
          
          {predictions.categoryBreakdown.length > 0 ? (
            <View style={styles.chartContainer}>
              {chartType === 'pie' ? (
                <PieChart
                  data={pieChartData}
                  width={screenWidth - 40}
                  height={220}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              ) : (
                <BarChart
                  data={barChartData}
                  width={screenWidth - 40}
                  height={220}
                  yAxisLabel="₱"
                  chartConfig={{
                    backgroundColor: colors?.card || '#2C2C2C',
                    backgroundGradientFrom: colors?.card || '#2C2C2C',
                    backgroundGradientTo: colors?.card || '#2C2C2C',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255, 107, 0, ${opacity})`,
                    labelColor: (opacity = 1) => colors?.text || '#FFF',
                    style: {
                      borderRadius: 16,
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: '',
                      stroke: colors?.border || '#3C3C3C',
                    },
                  }}
                  style={{
                    borderRadius: 16,
                  }}
                />
              )}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Ionicons name="analytics-outline" size={64} color={colors?.textSecondary || '#888'} />
              <Text style={styles.noDataText}>No expense data available</Text>
              <Text style={styles.noDataSubtext}>Start tracking expenses to see predictions</Text>
            </View>
          )}
        </View>

        {/* Category Details */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>Predicted by Category</Text>
          
          {predictions.categoryBreakdown.map((item, index) => (
            <TouchableOpacity 
              key={item.category}
              style={[
                styles.categoryCard,
                selectedCategory === item.category && styles.categoryCardSelected
              ]}
              onPress={() => setSelectedCategory(
                selectedCategory === item.category ? null : item.category
              )}
            >
              <View style={styles.categoryLeft}>
                <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{item.category}</Text>
                  <View style={styles.categoryStats}>
                    <Text style={styles.categoryPercentage}>{item.percentage}%</Text>
                    <Ionicons 
                      name={getTrendIcon(item.trend)} 
                      size={14} 
                      color={getTrendColor(item.trend)} 
                    />
                  </View>
                </View>
              </View>
              <View style={styles.categoryRight}>
                <Text style={styles.categoryAmount}>₱{item.predictedAmount.toLocaleString()}</Text>
                <Text style={styles.categoryPrevious}>
                  Historical: ₱{Math.round(item.total / Math.max(1, predictions.monthlyHistory.length)).toLocaleString()}/mo
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Insights Section */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="bulb" size={20} color="#FFCC00" /> Predictive Insights
          </Text>
          
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

        {/* Historical Trend */}
        {predictions.monthlyHistory.length > 1 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Monthly Spending History</Text>
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

        {/* Algorithm Explanation */}
        <View style={styles.algorithmSection}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="code-slash" size={18} color={colors?.textSecondary || '#888'} /> How We Calculate
          </Text>
          <View style={styles.algorithmCard}>
            <Text style={styles.algorithmText}>
              Our prediction uses a <Text style={styles.algorithmHighlight}>multi-signal blending algorithm</Text> that combines:{"\n\n"}
              • <Text style={styles.algorithmHighlight}>Weighted Recent History</Text> – Recent months are weighted more heavily (35% for last month){"\n"}
              • <Text style={styles.algorithmHighlight}>Previous Year Same-Month</Text> – Spending from the same month in prior years, adjusted for inflation{"\n"}
              • <Text style={styles.algorithmHighlight}>Inflation Adjustment</Text> – Annual inflation rate applied to account for rising costs{"\n"}
              • <Text style={styles.algorithmHighlight}>Seasonal Patterns</Text> – Month-specific spending patterns (e.g., December holidays){"\n"}
              • <Text style={styles.algorithmHighlight}>Trend Detection</Text> – Whether your spending is increasing, decreasing, or stable{"\n"}
              • <Text style={styles.algorithmHighlight}>Year-over-Year Growth</Text> – Your personal spending growth rate across years
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
        </View>

        {/* AI Powered Insights & Recommendations */}
        <View style={styles.aiInsightsSection}>
          <View style={styles.aiInsightsHeader}>
            <View style={styles.aiTitleContainer}>
              <Ionicons name="sparkles" size={22} color="#00D4FF" />
              <Text style={styles.sectionTitle}>AI Powered Insights</Text>
            </View>
            {aiError && (
              <View style={styles.offlineBadge}>
                <Ionicons name="cloud-offline" size={12} color="#FFCC00" />
                <Text style={styles.offlineText}>Offline</Text>
              </View>
            )}
          </View>
          
          {aiLoading ? (
            <View style={styles.aiLoadingContainer}>
              <ActivityIndicator size="large" color={colors?.primary || '#FF6B00'} />
              <Text style={styles.aiLoadingText}>Analyzing your spending patterns...</Text>
            </View>
          ) : aiRecommendations.length > 0 ? (
            <View style={styles.aiRecommendationsList}>
              {aiRecommendations.map((rec, index) => (
                <View key={index} style={styles.aiRecommendationCard}>
                  <View style={[styles.aiRecIconContainer, { backgroundColor: (rec.color || '#00D4FF') + '20' }]}>
                    <Ionicons name={rec.icon || 'bulb'} size={24} color={rec.color || '#00D4FF'} />
                  </View>
                  <View style={styles.aiRecContent}>
                    <Text style={styles.aiRecTitle}>{rec.title}</Text>
                    <Text style={styles.aiRecMessage}>{rec.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noAiDataContainer}>
              <Ionicons name="analytics-outline" size={48} color={colors?.textSecondary || '#888'} />
              <Text style={styles.noAiDataText}>Add more expenses to get AI-powered insights</Text>
            </View>
          )}
        </View>

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
  chartToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors?.surface || '#2C2C2C',
    justifyContent: 'center',
    alignItems: 'center',
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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CD96430',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
    gap: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CD964',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4CD964',
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
  chartSection: {
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors?.text || '#FFF',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
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
  // AI Insights Styles
  aiInsightsSection: {
    backgroundColor: colors?.card || '#2C2C2C',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#00D4FF30',
  },
  aiInsightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFCC0020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offlineText: {
    fontSize: 11,
    color: '#FFCC00',
    fontWeight: '500',
  },
  aiLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  aiLoadingText: {
    fontSize: 14,
    color: colors?.textSecondary || '#888',
    marginTop: 12,
  },
  aiRecommendationsList: {
    gap: 12,
  },
  aiRecommendationCard: {
    flexDirection: 'row',
    backgroundColor: colors?.surface || '#1C1C1C',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
  },
  aiRecIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aiRecContent: {
    flex: 1,
  },
  aiRecTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors?.text || '#FFF',
    marginBottom: 4,
  },
  aiRecMessage: {
    fontSize: 13,
    color: colors?.textSecondary || '#888',
    lineHeight: 19,
  },
  noAiDataContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noAiDataText: {
    fontSize: 14,
    color: colors?.textSecondary || '#888',
    marginTop: 12,
    textAlign: 'center',
  },
});

export default DataPredictionScreen;