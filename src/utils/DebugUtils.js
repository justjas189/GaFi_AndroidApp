// Enhanced debugging utility for MoneyTrack
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DebugUtils {
  static isDev = __DEV__;
  static logs = [];
  static maxLogs = 100;
  static logLevels = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  };
  static currentLogLevel = this.isDev ? this.logLevels.DEBUG : this.logLevels.ERROR;

  // Enhanced logging with log levels
  static log(category, message, data = null, level = this.logLevels.INFO) {
    if (level > this.currentLogLevel) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      category,
      message,
      data,
      level,
      platform: Platform.OS,
      memory: this.getMemoryUsage()
    };

    this.logs.push(logEntry);
    
    if (this.isDev) {
      const levelName = Object.keys(this.logLevels)[level] || 'INFO';
      console.log(`[${levelName}][${category}] ${message}`, data || '');
    }

    // Keep only last maxLogs to prevent memory issues
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Auto-persist critical logs
    if (level <= this.logLevels.WARN) {
      this.persistLog(logEntry);
    }
  }

  // Get memory usage (if available)
  static getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
      };
    }
    return null;
  }

  // Persist critical logs to storage
  static async persistLog(logEntry) {
    try {
      const existingLogs = await AsyncStorage.getItem('debug_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(logEntry);
      
      // Keep only last 50 critical logs
      if (logs.length > 50) {
        logs.splice(0, logs.length - 50);
      }
      
      await AsyncStorage.setItem('debug_logs', JSON.stringify(logs));
    } catch (error) {
      // Silently fail to avoid infinite loops
    }
  }

  // Enhanced error tracking with stack traces
  static error(category, message, error = null) {
    const timestamp = new Date().toISOString();
    const errorEntry = {
      timestamp,
      category,
      message,
      error: error?.message || error,
      stack: error?.stack,
      platform: Platform.OS,
      level: this.logLevels.ERROR,
      memory: this.getMemoryUsage()
    };

    this.logs.push(errorEntry);
    
    console.error(`[ERROR][${category}] ${message}`, error || '');
    
    // Always persist errors
    this.persistLog(errorEntry);
  }

  // Warning level logging
  static warn(category, message, data = null) {
    this.log(category, message, data, this.logLevels.WARN);
  }

  // Debug level logging
  static debug(category, message, data = null) {
    this.log(category, message, data, this.logLevels.DEBUG);
  }

  // Performance timing
  static startTimer(label) {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-start`);
    }
    return Date.now();
  }

  static endTimer(label, startTime) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-end`);
      try {
        performance.measure(label, `${label}-start`, `${label}-end`);
      } catch (e) {
        // Ignore measurement errors
      }
    }
    
    this.debug('PERFORMANCE', `${label} took ${duration}ms`);
    return duration;
  }

  // Enhanced chatbot debugging with performance metrics
  static logChatbotAction(action, input, output, error = null, timing = null) {
    const logData = {
      input: typeof input === 'string' ? input.substring(0, 100) : input, // Truncate long inputs
      output: typeof output === 'string' ? output.substring(0, 200) : output,
      timing,
      inputLength: typeof input === 'string' ? input.length : 0,
      outputLength: typeof output === 'string' ? output.length : 0
    };

    if (error) {
      this.error('CHATBOT', `Failed to ${action}`, { ...logData, error });
    } else {
      this.log('CHATBOT', `Successfully ${action}`, logData);
    }
  }

  // Network request logging
  static logNetworkRequest(url, method, status, duration, error = null) {
    const logData = {
      url: url.replace(/api_key=[^&]+/g, 'api_key=***'), // Hide API keys
      method,
      status,
      duration,
      timestamp: new Date().toISOString()
    };

    if (error || status >= 400) {
      this.error('NETWORK', `${method} ${url} failed`, { ...logData, error });
    } else {
      this.debug('NETWORK', `${method} ${url} completed`, logData);
    }
  }

  // User action tracking
  static logUserAction(action, context = {}) {
    this.log('USER_ACTION', action, {
      ...context,
      sessionId: this.getSessionId(),
      timestamp: new Date().toISOString()
    });
  }

  // Get or create session ID
  static getSessionId() {
    if (!this.sessionId) {
      this.sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    return this.sessionId;
  }

  // Enhanced debug info with analytics
  static showDebugInfo() {
    const recentErrors = this.logs.filter(log => log.level === this.logLevels.ERROR).slice(-5);
    const performanceLogs = this.logs.filter(log => log.category === 'PERFORMANCE').slice(-10);
    const memoryInfo = this.getMemoryUsage();
    
    Alert.alert(
      'Debug Information',
      `Recent Errors: ${recentErrors.length}\nTotal Logs: ${this.logs.length}\nPlatform: ${Platform.OS}\nMemory: ${memoryInfo?.used || 'N/A'}MB`,
      [
        { text: 'Export Logs', onPress: () => this.exportDebugReport() },
        { text: 'Clear Logs', onPress: () => this.clearLogs() },
        { text: 'Performance', onPress: () => this.showPerformanceInfo(performanceLogs) },
        { text: 'Close', style: 'cancel' }
      ]
    );
  }

  // Show performance information
  static showPerformanceInfo(performanceLogs) {
    const avgTimes = performanceLogs.reduce((acc, log) => {
      const operation = log.message.split(' took ')[0];
      if (!acc[operation]) acc[operation] = [];
      acc[operation].push(parseInt(log.message.match(/(\d+)ms/)?.[1] || 0));
      return acc;
    }, {});

    const performanceText = Object.entries(avgTimes)
      .map(([op, times]) => {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        return `${op}: ${avg.toFixed(1)}ms avg`;
      })
      .join('\n');

    Alert.alert('Performance Metrics', performanceText || 'No performance data available');
  }

  // Clear logs
  static clearLogs() {
    this.logs = [];
    this.log('SYSTEM', 'Logs cleared');
    AsyncStorage.removeItem('debug_logs');
  }

  // Export comprehensive debug report
  static async exportDebugReport() {
    try {
      const persistedLogs = await AsyncStorage.getItem('debug_logs');
      const report = {
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        sessionId: this.getSessionId(),
        memoryUsage: this.getMemoryUsage(),
        currentLogs: this.logs,
        persistedLogs: persistedLogs ? JSON.parse(persistedLogs) : [],
        logLevelStats: this.getLogLevelStats(),
        categoryStats: this.getCategoryStats()
      };
      
      console.log('Debug Report:', JSON.stringify(report, null, 2));
      return report;
    } catch (error) {
      console.error('Failed to export debug report:', error);
    }
  }

  // Get log level statistics
  static getLogLevelStats() {
    return this.logs.reduce((stats, log) => {
      const level = Object.keys(this.logLevels)[log.level] || 'UNKNOWN';
      stats[level] = (stats[level] || 0) + 1;
      return stats;
    }, {});
  }

  // Get category statistics
  static getCategoryStats() {
    return this.logs.reduce((stats, log) => {
      stats[log.category] = (stats[log.category] || 0) + 1;
      return stats;
    }, {});
  }

  // Export logs
  static exportLogs() {
    return this.exportDebugReport();
  }
}

export default DebugUtils;
