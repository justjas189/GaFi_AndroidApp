import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';

// Handle base64 encoding/decoding
let encode, decode;
try {
  const base64 = require('base-64');
  encode = base64.encode;
  decode = base64.decode;
} catch (error) {
  // Fallback implementation if base-64 is not available
  encode = (input) => Buffer.from(input).toString('base64');
  decode = (input) => Buffer.from(input, 'base64').toString();
}

// Required for Supabase Auth in React Native
global.Buffer = Buffer;
if (!global.btoa) global.btoa = encode;
if (!global.atob) global.atob = decode;

// Set up crypto polyfill using expo-crypto
if (typeof crypto === 'undefined') {
  global.crypto = {
    getRandomValues: function (buffer) {
      const randomBytes = Crypto.getRandomValues(buffer);
      buffer.set(randomBytes);
      return buffer;
    }
  };
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://dfhhocaenejltfxxzaky.supabase.co'
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmaGhvY2FlbmVqbHRmeHh6YWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4MjkzNzIsImV4cCI6MjA2NTQwNTM3Mn0.eLc1Qt0AIkLIeTaQDnai6aoxT0scYOClaLLIvXusvf4'

// Memory-cached storage adapter — prevents stale reads during token refresh.
// Wraps AsyncStorage but always serves the most recent in-memory value.
// Includes diagnostic logging for the auth token key to debug session loss.
const supabaseRefMatch = supabaseUrl.match(/https?:\/\/([^.]*)\.supabase\.co/i)
const supabaseRef = supabaseRefMatch ? supabaseRefMatch[1] : null
const AUTH_TOKEN_KEY = supabaseRef ? `sb-${supabaseRef}-auth-token` : 'sb-auth-token'
const memoryCache = new Map();

const normalizeStorageValue = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch (_) {
    return String(value)
  }
};

const isValidAuthSessionString = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) return false
  try {
    const parsed = JSON.parse(value)
    return Boolean(parsed?.access_token && (parsed?.expires_at || parsed?.expires_in))
  } catch (_) {
    return false
  }
};

const memoryCachedStorage = {
  async getItem(key) {
    if (memoryCache.has(key)) {
      const cachedValue = memoryCache.get(key)
      if (cachedValue === null || cachedValue === undefined) {
        return null
      }

      if (key === AUTH_TOKEN_KEY && !isValidAuthSessionString(cachedValue)) {
        memoryCache.delete(key)
        await AsyncStorage.removeItem(key)
        return null
      }

      return cachedValue
    }

    try {
      const value = normalizeStorageValue(await AsyncStorage.getItem(key))
      if (key === AUTH_TOKEN_KEY && value && !isValidAuthSessionString(value)) {
        await AsyncStorage.removeItem(key)
        memoryCache.delete(key)
        return null
      }
      memoryCache.set(key, value)
      if (key === AUTH_TOKEN_KEY) {
        console.log('[SUPABASE_STORAGE] getItem auth-token ->', value ? `exists (${value.length} chars)` : 'NULL');
      }
      return value
    } catch (e) {
      console.error('[SUPABASE_STORAGE] getItem failed for key:', key, e.message);
      return null
    }
  },
  async setItem(key, value) {
    const normalizedValue = normalizeStorageValue(value)
    memoryCache.set(key, normalizedValue)
    try {
      if (key === AUTH_TOKEN_KEY) {
        console.log('[SUPABASE_STORAGE] setItem auth-token <-', normalizedValue ? `storing (${normalizedValue.length} chars)` : 'NULL VALUE');
        if (__DEV__) {
          console.log('[SUPABASE_STORAGE] setItem caller stack:', new Error().stack?.split('\n').slice(1, 5).join('\n'));
        }
      }
      if (normalizedValue === null) {
        await AsyncStorage.removeItem(key)
        return
      }
      await AsyncStorage.setItem(key, normalizedValue)
    } catch (e) {
      console.error('[SUPABASE_STORAGE] setItem failed for key:', key, e.message);
    }
  },
  async removeItem(key) {
    memoryCache.set(key, null)
    try {
      if (key === AUTH_TOKEN_KEY) {
        console.warn('[SUPABASE_STORAGE] removeItem auth-token - SESSION BEING DELETED');
        if (__DEV__) {
          console.warn('[SUPABASE_STORAGE] removeItem caller stack:', new Error().stack?.split('\n').slice(1, 8).join('\n'));
        }
      }
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error('[SUPABASE_STORAGE] removeItem failed for key:', key, e.message);
    }
  },
};

const supabaseConfig = {
  auth: {
    storage: memoryCachedStorage,
    storageKey: AUTH_TOKEN_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit', // Change from 'pkce' to 'implicit' to avoid WebCrypto requirement
    debug: __DEV__
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'GaFI React Native'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseClient = global.__supabaseClient || createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);

if (!global.__supabaseClient) {
  global.__supabaseClient = supabaseClient;
}

export const supabase = supabaseClient;

// Helper function to check if error is a Supabase error
export const isSupabaseError = (error) => {
  return error && typeof error === 'object' && 'message' in error;
};

// Helper function to format error message
export const formatSupabaseError = (error) => {
  if (isSupabaseError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}; 