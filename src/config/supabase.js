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

const supabaseConfig = {
  auth: {
    storage: AsyncStorage,
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseConfig);

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