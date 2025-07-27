// Real-time Budget Alert System
// Provides intelligent budget monitoring and proactive alerts
import DebugUtils from '../utils/DebugUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class BudgetAlertManager {
  constructor() {
    this.alertThresholds = {
      warning: 0.8,    // 80% of budget used
      critical: 0.95,  // 95% of budget used
      exceeded: 1.0    // 100% of budget exceeded
    };
    
    this.alertCooldowns = {
      warning: 6 * 60 * 60 * 1000,     // 6 hours
      critical: 3 * 60 * 60 * 1000,    // 3 hours
      exceeded: 1 * 60 * 60 * 1000     // 1 hour
    };
    
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.subscribers = new Set();
    this.isMonitoring = false;
    
    this.initializeAlertSystem();
  }

  /**
   * Initialize the alert system
   */
  async initializeAlertSystem() {
    try {
      // Load existing alert states
      await this.loadAlertStates();
      
      // Start monitoring
      this.startMonitoring();
      
      DebugUtils.log('BUDGET_ALERTS', 'Alert system initialized');
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Failed to initialize alert system', error);
    }
  }

  /**
   * Initialize alert system for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Initialization result
   */
  async initializeForUser(userId) {
    try {
      DebugUtils.log('BUDGET_ALERTS', 'Initializing alerts for user', { userId });
      
      // Load user-specific alert preferences
      const userPrefs = await this.loadUserPreferences(userId);
      
      // Set up default thresholds if none exist
      if (!userPrefs) {
        await this.setDefaultPreferences(userId);
      }
      
      // Subscribe user to alerts
      this.subscribe((alert) => {
        DebugUtils.log('BUDGET_ALERTS', 'Alert triggered for user', { userId, alertType: alert.type || alert.action });
      });
      
      DebugUtils.log('BUDGET_ALERTS', 'User alert system initialized', { userId });
      
      return {
        success: true,
        message: 'Alert system initialized for user'
      };
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Failed to initialize user alerts', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load user preferences for alerts
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User preferences
   */
  async loadUserPreferences(userId) {
    try {
      const prefsKey = `budget_alert_prefs_${userId}`;
      const prefs = await AsyncStorage.getItem(prefsKey);
      return prefs ? JSON.parse(prefs) : null;
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error loading user preferences', error);
      return null;
    }
  }

  /**
   * Set default preferences for a user
   * @param {string} userId - User ID
   */
  async setDefaultPreferences(userId) {
    try {
      const defaultPrefs = {
        thresholds: this.alertThresholds,
        cooldowns: this.alertCooldowns,
        enabledAlerts: {
          budget: true,
          category: true,
          velocity: true
        },
        lastUpdated: Date.now()
      };
      
      const prefsKey = `budget_alert_prefs_${userId}`;
      await AsyncStorage.setItem(prefsKey, JSON.stringify(defaultPrefs));
      
      DebugUtils.log('BUDGET_ALERTS', 'Default preferences set', { userId });
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error setting default preferences', error);
    }
  }

  /**
   * Start budget monitoring
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Check budgets every 5 minutes
    this.monitoringInterval = setInterval(() => {
      this.performBudgetCheck();
    }, 5 * 60 * 1000);
    
    DebugUtils.log('BUDGET_ALERTS', 'Budget monitoring started');
  }

  /**
   * Stop budget monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    DebugUtils.log('BUDGET_ALERTS', 'Budget monitoring stopped');
  }

  /**
   * Subscribe to budget alerts
   * @param {Function} callback - Alert callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Process new expense and check for alerts
   * @param {string} userId - User ID
   * @param {Object} expense - Expense object
   * @param {Object} currentBudget - Current budget data
   * @param {Object} categorySpending - Category spending data
   * @returns {Promise<Array>} Array of triggered alerts
   */
  async processExpenseAlert(userId, expense, currentBudget, categorySpending) {
    try {
      DebugUtils.log('BUDGET_ALERTS', 'Processing expense for alerts', {
        userId,
        expenseAmount: expense.amount,
        category: expense.category
      });

      const alerts = [];
      
      // Check category-specific alerts
      if (expense.category && currentBudget.categories?.[expense.category]) {
        const categoryAlert = await this.checkCategoryAlert(
          userId, 
          expense.category, 
          categorySpending[expense.category] || 0,
          currentBudget.categories[expense.category]
        );
        
        if (categoryAlert) {
          alerts.push(categoryAlert);
        }
      }

      // Check overall budget alert
      const totalSpent = Object.values(categorySpending).reduce((sum, amount) => sum + amount, 0);
      const overallAlert = await this.checkOverallBudgetAlert(
        userId,
        totalSpent,
        currentBudget.monthly || currentBudget.total || 0
      );
      
      if (overallAlert) {
        alerts.push(overallAlert);
      }

      // Check for spending velocity alerts
      const velocityAlert = await this.checkSpendingVelocityAlert(userId, expense, categorySpending);
      if (velocityAlert) {
        alerts.push(velocityAlert);
      }

      // Notify subscribers
      if (alerts.length > 0) {
        this.notifySubscribers(alerts);
      }

      return alerts;
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error processing expense alert', error);
      return [];
    }
  }

  /**
   * Check category-specific budget alert
   * @param {string} userId - User ID
   * @param {string} category - Expense category
   * @param {number} spent - Amount spent in category
   * @param {Object} categoryBudget - Category budget configuration
   * @returns {Promise<Object|null>} Alert object or null
   */
  async checkCategoryAlert(userId, category, spent, categoryBudget) {
    const budgetLimit = categoryBudget.limit || categoryBudget.amount || 0;
    if (budgetLimit <= 0) return null;

    const spentPercentage = spent / budgetLimit;
    const alertKey = `${userId}_${category}`;

    // Determine alert level
    let alertLevel = null;
    if (spentPercentage >= this.alertThresholds.exceeded) {
      alertLevel = 'exceeded';
    } else if (spentPercentage >= this.alertThresholds.critical) {
      alertLevel = 'critical';
    } else if (spentPercentage >= this.alertThresholds.warning) {
      alertLevel = 'warning';
    }

    if (!alertLevel) return null;

    // Check cooldown
    if (await this.isInCooldown(alertKey, alertLevel)) {
      return null;
    }

    // Create alert
    const alert = this.createCategoryAlert(category, spent, budgetLimit, spentPercentage, alertLevel);
    
    // Set cooldown
    await this.setCooldown(alertKey, alertLevel);
    
    // Log alert
    this.logAlert(userId, alert);

    return alert;
  }

  /**
   * Check overall budget alert
   * @param {string} userId - User ID
   * @param {number} totalSpent - Total amount spent
   * @param {number} monthlyBudget - Monthly budget limit
   * @returns {Promise<Object|null>} Alert object or null
   */
  async checkOverallBudgetAlert(userId, totalSpent, monthlyBudget) {
    if (monthlyBudget <= 0) return null;

    const spentPercentage = totalSpent / monthlyBudget;
    const alertKey = `${userId}_overall`;

    // Determine alert level
    let alertLevel = null;
    if (spentPercentage >= this.alertThresholds.exceeded) {
      alertLevel = 'exceeded';
    } else if (spentPercentage >= this.alertThresholds.critical) {
      alertLevel = 'critical';
    } else if (spentPercentage >= this.alertThresholds.warning) {
      alertLevel = 'warning';
    }

    if (!alertLevel) return null;

    // Check cooldown
    if (await this.isInCooldown(alertKey, alertLevel)) {
      return null;
    }

    // Create alert
    const alert = this.createOverallAlert(totalSpent, monthlyBudget, spentPercentage, alertLevel);
    
    // Set cooldown
    await this.setCooldown(alertKey, alertLevel);
    
    // Log alert
    this.logAlert(userId, alert);

    return alert;
  }

  /**
   * Check spending velocity (rate of spending)
   * @param {string} userId - User ID
   * @param {Object} expense - Current expense
   * @param {Object} categorySpending - Category spending data
   * @returns {Promise<Object|null>} Alert object or null
   */
  async checkSpendingVelocityAlert(userId, expense, categorySpending) {
    try {
      // Get spending history for the current day
      const today = new Date().toISOString().split('T')[0];
      const todayKey = `spending_velocity_${userId}_${today}`;
      
      let todaySpending = await AsyncStorage.getItem(todayKey);
      todaySpending = todaySpending ? JSON.parse(todaySpending) : [];
      
      // Add current expense
      todaySpending.push({
        amount: parseFloat(expense.amount),
        timestamp: Date.now(),
        category: expense.category
      });
      
      // Save updated spending
      await AsyncStorage.setItem(todayKey, JSON.stringify(todaySpending));
      
      // Calculate daily spending rate
      const todayTotal = todaySpending.reduce((sum, exp) => sum + exp.amount, 0);
      
      // Check if spending is unusually high compared to recent days
      const recentAverage = await this.getRecentDailyAverage(userId);
      
      if (recentAverage > 0 && todayTotal > recentAverage * 2) {
        const alertKey = `${userId}_velocity_${today}`;
        
        if (!(await this.isInCooldown(alertKey, 'warning'))) {
          await this.setCooldown(alertKey, 'warning');
          
          const alert = {
            id: `velocity_${Date.now()}`,
            type: 'velocity',
            level: 'warning',
            title: 'High Spending Alert! 🚨',
            message: `You've spent ₱${todayTotal.toLocaleString()} today, which is ${(todayTotal / recentAverage).toFixed(1)}x your daily average.`,
            icon: 'speedometer-outline',
            color: '#FF9800',
            timestamp: new Date(),
            data: {
              todaySpending: todayTotal,
              averageSpending: recentAverage,
              multiplier: todayTotal / recentAverage
            },
            actions: [
              { id: 'review_expenses', text: 'Review Today\'s Expenses', type: 'primary' },
              { id: 'set_daily_limit', text: 'Set Daily Limit', type: 'secondary' }
            ]
          };
          
          this.logAlert(userId, alert);
          return alert;
        }
      }

      return null;
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error checking velocity alert', error);
      return null;
    }
  }

  /**
   * Create category-specific alert
   */
  createCategoryAlert(category, spent, limit, percentage, level) {
    const remaining = limit - spent;
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    
    const alerts = {
      warning: {
        title: `${categoryName} Budget Warning ⚠️`,
        message: `You've used ${(percentage * 100).toFixed(0)}% of your ${category} budget. ₱${remaining.toLocaleString()} remaining.`,
        icon: 'warning-outline',
        color: '#FF9800'
      },
      critical: {
        title: `${categoryName} Budget Critical! 🚨`,
        message: `You've used ${(percentage * 100).toFixed(0)}% of your ${category} budget. Only ₱${remaining.toLocaleString()} left!`,
        icon: 'alert-circle-outline',
        color: '#F44336'
      },
      exceeded: {
        title: `${categoryName} Budget Exceeded! 💸`,
        message: `You've exceeded your ${category} budget by ₱${Math.abs(remaining).toLocaleString()}!`,
        icon: 'close-circle-outline',
        color: '#D32F2F'
      }
    };

    const alertConfig = alerts[level];
    
    return {
      id: `category_${category}_${Date.now()}`,
      type: 'category',
      level,
      category,
      title: alertConfig.title,
      message: alertConfig.message,
      icon: alertConfig.icon,
      color: alertConfig.color,
      timestamp: new Date(),
      data: {
        category,
        spent,
        limit,
        percentage,
        remaining
      },
      actions: this.getCategoryAlertActions(category, level, remaining)
    };
  }

  /**
   * Create overall budget alert
   */
  createOverallAlert(spent, budget, percentage, level) {
    const remaining = budget - spent;
    
    const alerts = {
      warning: {
        title: 'Monthly Budget Warning ⚠️',
        message: `You've used ${(percentage * 100).toFixed(0)}% of your monthly budget. ₱${remaining.toLocaleString()} remaining.`,
        icon: 'warning-outline',
        color: '#FF9800'
      },
      critical: {
        title: 'Monthly Budget Critical! 🚨',
        message: `You've used ${(percentage * 100).toFixed(0)}% of your monthly budget. Only ₱${remaining.toLocaleString()} left!`,
        icon: 'alert-circle-outline',
        color: '#F44336'
      },
      exceeded: {
        title: 'Monthly Budget Exceeded! 💸',
        message: `You've exceeded your monthly budget by ₱${Math.abs(remaining).toLocaleString()}!`,
        icon: 'close-circle-outline',
        color: '#D32F2F'
      }
    };

    const alertConfig = alerts[level];
    
    return {
      id: `overall_${Date.now()}`,
      type: 'overall',
      level,
      title: alertConfig.title,
      message: alertConfig.message,
      icon: alertConfig.icon,
      color: alertConfig.color,
      timestamp: new Date(),
      data: {
        spent,
        budget,
        percentage,
        remaining
      },
      actions: this.getOverallAlertActions(level, remaining)
    };
  }

  /**
   * Get action buttons for category alerts
   */
  getCategoryAlertActions(category, level, remaining) {
    const actions = [
      { id: 'view_category', text: `View ${category} expenses`, type: 'primary' }
    ];

    if (level === 'exceeded') {
      actions.push(
        { id: 'increase_budget', text: 'Increase Budget', type: 'secondary' },
        { id: 'review_expenses', text: 'Review & Cut Back', type: 'destructive' }
      );
    } else if (level === 'critical') {
      actions.push(
        { id: 'set_spending_limit', text: 'Set Daily Limit', type: 'secondary' }
      );
    } else {
      actions.push(
        { id: 'get_tips', text: `${category} Saving Tips`, type: 'secondary' }
      );
    }

    return actions;
  }

  /**
   * Get action buttons for overall alerts
   */
  getOverallAlertActions(level, remaining) {
    const actions = [
      { id: 'view_budget', text: 'View Budget Overview', type: 'primary' }
    ];

    if (level === 'exceeded') {
      actions.push(
        { id: 'emergency_mode', text: 'Enable Emergency Mode', type: 'destructive' },
        { id: 'review_all', text: 'Review All Expenses', type: 'secondary' }
      );
    } else if (level === 'critical') {
      actions.push(
        { id: 'spending_freeze', text: 'Freeze Non-Essential Spending', type: 'secondary' }
      );
    } else {
      actions.push(
        { id: 'optimize_budget', text: 'Optimize Budget', type: 'secondary' }
      );
    }

    return actions;
  }

  /**
   * Check if alert is in cooldown period
   */
  async isInCooldown(alertKey, level) {
    try {
      const cooldownKey = `alert_cooldown_${alertKey}_${level}`;
      const lastAlert = await AsyncStorage.getItem(cooldownKey);
      
      if (!lastAlert) return false;
      
      const lastAlertTime = parseInt(lastAlert);
      const cooldownPeriod = this.alertCooldowns[level];
      
      return (Date.now() - lastAlertTime) < cooldownPeriod;
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error checking cooldown', error);
      return false;
    }
  }

  /**
   * Set cooldown for alert type
   */
  async setCooldown(alertKey, level) {
    try {
      const cooldownKey = `alert_cooldown_${alertKey}_${level}`;
      await AsyncStorage.setItem(cooldownKey, Date.now().toString());
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error setting cooldown', error);
    }
  }

  /**
   * Get recent daily spending average
   */
  async getRecentDailyAverage(userId) {
    try {
      const recentDays = [];
      const today = new Date();
      
      // Get last 7 days of spending
      for (let i = 1; i <= 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayKey = `spending_velocity_${userId}_${dateStr}`;
        const daySpending = await AsyncStorage.getItem(dayKey);
        
        if (daySpending) {
          const expenses = JSON.parse(daySpending);
          const dayTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);
          recentDays.push(dayTotal);
        }
      }
      
      if (recentDays.length === 0) return 0;
      
      return recentDays.reduce((sum, day) => sum + day, 0) / recentDays.length;
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error calculating daily average', error);
      return 0;
    }
  }

  /**
   * Perform periodic budget check
   */
  async performBudgetCheck() {
    try {
      DebugUtils.log('BUDGET_ALERTS', 'Performing periodic budget check');
      
      // This would typically check all active users
      // For now, we'll emit a check event that subscribers can handle
      this.notifySubscribers([{
        type: 'system',
        action: 'periodic_check',
        timestamp: new Date()
      }]);
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error in periodic budget check', error);
    }
  }

  /**
   * Notify all subscribers of alerts
   */
  notifySubscribers(alerts) {
    this.subscribers.forEach(callback => {
      try {
        if (typeof callback === 'function') {
          callback(alerts);
        } else {
          DebugUtils.error('BUDGET_ALERTS', 'Invalid subscriber - not a function', { 
            callback: typeof callback, 
            value: callback 
          });
          // Remove invalid subscriber
          this.subscribers.delete(callback);
        }
      } catch (error) {
        DebugUtils.error('BUDGET_ALERTS', 'Error notifying subscriber', error);
      }
    });
  }

  /**
   * Log alert for history tracking
   */
  logAlert(userId, alert) {
    const logEntry = {
      userId,
      alert,
      timestamp: Date.now()
    };
    
    this.alertHistory.push(logEntry);
    
    // Keep only last 100 alerts
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }
    
    DebugUtils.log('BUDGET_ALERTS', 'Alert logged', {
      userId,
      alertType: alert.type,
      alertLevel: alert.level
    });
  }

  /**
   * Load alert states from storage
   */
  async loadAlertStates() {
    try {
      const alertStates = await AsyncStorage.getItem('budget_alert_states');
      if (alertStates) {
        const parsed = JSON.parse(alertStates);
        // Restore any necessary state
        DebugUtils.log('BUDGET_ALERTS', 'Alert states loaded');
      }
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error loading alert states', error);
    }
  }

  /**
   * Save alert states to storage
   */
  async saveAlertStates() {
    try {
      const alertStates = {
        lastCheck: Date.now(),
        activeAlerts: Array.from(this.activeAlerts.entries())
      };
      
      await AsyncStorage.setItem('budget_alert_states', JSON.stringify(alertStates));
      DebugUtils.log('BUDGET_ALERTS', 'Alert states saved');
    } catch (error) {
      DebugUtils.error('BUDGET_ALERTS', 'Error saving alert states', error);
    }
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    const stats = {
      totalAlerts: this.alertHistory.length,
      alertsByType: {},
      alertsByLevel: {},
      recentAlerts: this.alertHistory.slice(-10)
    };

    this.alertHistory.forEach(entry => {
      const type = entry.alert.type;
      const level = entry.alert.level;
      
      stats.alertsByType[type] = (stats.alertsByType[type] || 0) + 1;
      stats.alertsByLevel[level] = (stats.alertsByLevel[level] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clear alert history
   */
  clearAlertHistory() {
    this.alertHistory = [];
    DebugUtils.log('BUDGET_ALERTS', 'Alert history cleared');
  }

  /**
   * Destroy the alert manager
   */
  destroy() {
    this.stopMonitoring();
    this.subscribers.clear();
    this.activeAlerts.clear();
    this.saveAlertStates();
    DebugUtils.log('BUDGET_ALERTS', 'BudgetAlertManager destroyed');
  }
}

// Export singleton instance
export const budgetAlertManager = new BudgetAlertManager();
