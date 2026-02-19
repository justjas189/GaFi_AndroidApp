/**
 * TensorFlow.js Initialization Module
 * 
 * This module handles the async initialization of TensorFlow.js
 * for React Native. It MUST be called once at app startup before
 * any ML predictions are made.
 * 
 * Used by: App.js (initialization), PredictionEngine.js (model training)
 */

import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';

let _isReady = false;

/**
 * Initialize TensorFlow.js backend for React Native.
 * Call this once in App.js during app startup.
 * Safe to call multiple times — will skip if already initialized.
 */
export const initializeTensorFlow = async () => {
  if (_isReady) return true;

  try {
    await tf.ready();
    _isReady = true;
    console.log('[TensorFlow] Initialized successfully, backend:', tf.getBackend());
    return true;
  } catch (error) {
    console.warn('[TensorFlow] Initialization failed, ML predictions will use fallback:', error.message);
    return false;
  }
};

/**
 * Check if TensorFlow.js is ready for use.
 */
export const isTFReady = () => _isReady;

export { tf };
