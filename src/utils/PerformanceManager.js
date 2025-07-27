/**
 * Memory and Performance Management for MoneyTrack
 * Handles memory optimization, performance monitoring, and resource cleanup
 */

import React from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import DebugUtils from './DebugUtils';

class PerformanceManager {
  constructor() {
    this.performanceMetrics = new Map();
    this.memoryWarningThreshold = 100; // MB
    this.isMonitoring = false;
    this.cleanupTasks = new Set();
    this.intervals = new Set();
    this.timeouts = new Set();
    
    this.initializeMonitoring();
  }

  /**
   * Initialize performance monitoring
   */
  async initialize() {
    if (this.isMonitoring) return;

    try {
      // Monitor app state changes
      AppState.addEventListener('change', this.handleAppStateChange.bind(this));
      
      // Monitor memory usage
      this.startMemoryMonitoring();
      
      // Monitor performance metrics
      this.startPerformanceMonitoring();
      
      this.isMonitoring = true;
      DebugUtils.debug('PERFORMANCE', 'Performance monitoring initialized');
    } catch (error) {
      DebugUtils.error('PERFORMANCE', 'Failed to initialize performance monitoring', error);
    }
  }

  /**
   * Initialize performance monitoring (legacy method name)
   */
  initializeMonitoring() {
    return this.initialize();
  }

  /**
   * Handle app state changes
   * @param {string} nextAppState - Next app state
   */
  handleAppStateChange(nextAppState) {
    if (nextAppState === 'background') {
      this.onAppBackground();
    } else if (nextAppState === 'active') {
      this.onAppForeground();
    }
  }

  /**
   * Handle app going to background
   */
  onAppBackground() {
    DebugUtils.debug('PERFORMANCE', 'App backgrounded, starting cleanup');
    
    // Clear non-essential caches
    this.clearNonEssentialCaches();
    
    // Pause non-essential monitoring
    this.pauseNonEssentialMonitoring();
    
    // Run cleanup tasks
    this.runCleanupTasks();
  }

  /**
   * Handle app coming to foreground
   */
  onAppForeground() {
    DebugUtils.debug('PERFORMANCE', 'App foregrounded, resuming monitoring');
    
    // Resume monitoring
    this.resumeMonitoring();
    
    // Check memory usage
    this.checkMemoryUsage();
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    const checkMemory = () => {
      if (typeof performance !== 'undefined' && performance.memory) {
        const memoryUsage = {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };

        this.performanceMetrics.set('memory', {
          ...memoryUsage,
          timestamp: Date.now()
        });

        // Check for memory warnings
        if (memoryUsage.used > this.memoryWarningThreshold) {
          this.handleMemoryWarning(memoryUsage);
        }

        DebugUtils.debug('MEMORY', 'Memory usage', memoryUsage);
      }
    };

    // Check memory every 30 seconds
    const interval = setInterval(checkMemory, 30000);
    this.intervals.add(interval);
    
    // Initial check
    checkMemory();
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    // Monitor React render times
    if (typeof window !== 'undefined' && window.React) {
      this.monitorReactPerformance();
    }

    // Monitor network requests
    this.monitorNetworkPerformance();

    // Monitor database queries
    this.monitorDatabasePerformance();
  }

  /**
   * Monitor React component performance
   */
  monitorReactPerformance() {
    const originalRender = React.Component.prototype.render;
    
    React.Component.prototype.render = function() {
      const startTime = performance.now();
      const result = originalRender.call(this);
      const endTime = performance.now();
      
      const renderTime = endTime - startTime;
      
      // Log slow renders
      if (renderTime > 16) { // 16ms = 60fps threshold
        DebugUtils.warn('REACT_PERFORMANCE', 'Slow render detected', {
          component: this.constructor.name,
          renderTime: renderTime.toFixed(2)
        });
      }
      
      return result;
    };
  }

  /**
   * Monitor network request performance
   */
  monitorNetworkPerformance() {
    const originalFetch = global.fetch;
    
    global.fetch = async function(url, options) {
      const startTime = performance.now();
      
      try {
        const response = await originalFetch(url, options);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        DebugUtils.logNetworkRequest(
          url, 
          options?.method || 'GET', 
          response.status, 
          duration
        );
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        DebugUtils.logNetworkRequest(
          url, 
          options?.method || 'GET', 
          0, 
          duration, 
          error
        );
        
        throw error;
      }
    };
  }

  /**
   * Monitor database query performance
   */
  monitorDatabasePerformance() {
    // This would be integrated with DatabaseManager
    // to track query execution times
  }

  /**
   * Handle memory warning
   * @param {Object} memoryUsage - Current memory usage
   */
  handleMemoryWarning(memoryUsage) {
    DebugUtils.warn('MEMORY', 'Memory usage high', memoryUsage);
    
    // Trigger immediate cleanup
    this.clearNonEssentialCaches();
    this.runCleanupTasks();
    
    // Reduce monitoring frequency temporarily
    this.reduceMonitoringFrequency();
    
    // Emit memory warning event
    DeviceEventEmitter.emit('memoryWarning', memoryUsage);
  }

  /**
   * Clear non-essential caches
   */
  clearNonEssentialCaches() {
    // Clear image caches (if using react-native-fast-image)
    if (global.FastImage) {
      global.FastImage.clearMemoryCache();
    }
    
    // Clear custom caches
    if (global.DatabaseManager) {
      global.DatabaseManager.clearCache();
    }
    
    DebugUtils.debug('PERFORMANCE', 'Non-essential caches cleared');
  }

  /**
   * Pause non-essential monitoring
   */
  pauseNonEssentialMonitoring() {
    // Keep only essential intervals
    this.intervals.forEach(interval => {
      if (interval.isEssential !== true) {
        clearInterval(interval);
        this.intervals.delete(interval);
      }
    });
  }

  /**
   * Resume monitoring
   */
  resumeMonitoring() {
    this.startMemoryMonitoring();
    this.startPerformanceMonitoring();
  }

  /**
   * Reduce monitoring frequency
   */
  reduceMonitoringFrequency() {
    // Temporarily reduce monitoring frequency to save resources
    setTimeout(() => {
      this.resumeMonitoring();
    }, 60000); // Resume normal monitoring after 1 minute
  }

  /**
   * Run cleanup tasks
   */
  runCleanupTasks() {
    this.cleanupTasks.forEach(task => {
      try {
        task();
      } catch (error) {
        DebugUtils.error('PERFORMANCE', 'Cleanup task failed', error);
      }
    });
    
    DebugUtils.debug('PERFORMANCE', 'Cleanup tasks completed', {
      tasksRun: this.cleanupTasks.size
    });
  }

  /**
   * Register cleanup task
   * @param {Function} task - Cleanup function
   */
  registerCleanupTask(task) {
    this.cleanupTasks.add(task);
  }

  /**
   * Unregister cleanup task
   * @param {Function} task - Cleanup function
   */
  unregisterCleanupTask(task) {
    this.cleanupTasks.delete(task);
  }

  /**
   * Register interval for cleanup
   * @param {number} interval - Interval ID
   * @param {boolean} isEssential - Whether interval is essential
   */
  registerInterval(interval, isEssential = false) {
    interval.isEssential = isEssential;
    this.intervals.add(interval);
  }

  /**
   * Register timeout for cleanup
   * @param {number} timeout - Timeout ID
   */
  registerTimeout(timeout) {
    this.timeouts.add(timeout);
  }

  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const memoryUsage = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };

      return memoryUsage;
    }

    return null;
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    return {
      memory: this.performanceMetrics.get('memory'),
      activeIntervals: this.intervals.size,
      activeTimeouts: this.timeouts.size,
      cleanupTasks: this.cleanupTasks.size,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Create optimized timeout
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timeout ID
   */
  createTimeout(callback, delay) {
    const timeout = setTimeout(() => {
      this.timeouts.delete(timeout);
      callback();
    }, delay);
    
    this.registerTimeout(timeout);
    return timeout;
  }

  /**
   * Create optimized interval
   * @param {Function} callback - Callback function
   * @param {number} delay - Delay in milliseconds
   * @param {boolean} isEssential - Whether interval is essential
   * @returns {number} Interval ID
   */
  createInterval(callback, delay, isEssential = false) {
    const interval = setInterval(callback, delay);
    this.registerInterval(interval, isEssential);
    return interval;
  }

  /**
   * Clear optimized timeout
   * @param {number} timeout - Timeout ID
   */
  clearOptimizedTimeout(timeout) {
    clearTimeout(timeout);
    this.timeouts.delete(timeout);
  }

  /**
   * Clear optimized interval
   * @param {number} interval - Interval ID
   */
  clearOptimizedInterval(interval) {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    
    // Clear all timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    // Run cleanup tasks
    this.runCleanupTasks();
    this.cleanupTasks.clear();
    
    // Clear performance metrics
    this.performanceMetrics.clear();
    
    this.isMonitoring = false;
    
    DebugUtils.debug('PERFORMANCE', 'Performance manager cleaned up');
  }
}

// Export singleton instance
export default new PerformanceManager();
