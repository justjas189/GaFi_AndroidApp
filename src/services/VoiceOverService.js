/**
 * Voice over narration (panel revision) — reads story/tutorial text aloud
 * through the device TTS engine (expo-speech).
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'voiceOverEnabled';

// Cartoon-Koin voice: higher pitch + slightly faster rate.
const KOIN_VOICE = Platform.select({
  android: { rate: 1.2, pitch: 1.45 },
  ios: { rate: 1.1, pitch: 1.5 },
  default: { rate: 1.1, pitch: 1.4 },
});

let enabled = false;
let loadPromise = null;
let maleVoiceId = null; // Store the selected male voice ID
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn(enabled));

// Function to find a male voice installed on the device
const initMaleVoice = async () => {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    
    // Look for voices explicitly labeled as male or known male system voices
    const maleVoice = voices.find(v => {
      const name = v.name.toLowerCase();
      const identifier = v.identifier.toLowerCase();
      // 'daniel' is a common default male iOS voice, 'male' covers Android variations
      return (name.includes('male') || identifier.includes('male') || name.includes('daniel')) 
             && v.language.startsWith('en');
    });

    if (maleVoice) {
      maleVoiceId = maleVoice.identifier;
    }
  } catch (error) {
    console.log("Could not load custom voices", error);
  }
};

/** Resolve the persisted toggle once; safe to call repeatedly. */
export const loadVoiceOverSetting = () => {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then(async (value) => {
        enabled = value === 'true';
        notify();
        await initMaleVoice(); // Fetch the voices when settings load
        return enabled;
      })
      .catch(() => enabled);
  }
  return loadPromise;
};

export const isVoiceOverEnabled = () => enabled;

export const setVoiceOverEnabled = async (value) => {
  enabled = !!value;
  notify();
  if (!enabled) Speech.stop();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Non-fatal
  }
};

/** Subscribe to toggle changes (returns unsubscribe). */
export const onVoiceOverChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// TTS engines read emoji out loud — strip them, keep the words.
const cleanForSpeech = (text) =>
  String(text)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Narrate `text` if voice over is enabled.
 */
export const speak = (text, options = {}) => {
  if (!enabled || !text) return;
  const cleaned = cleanForSpeech(text);
  if (!cleaned) return;
  Speech.stop();
  
  // Apply the male voice if we found one
  const speechOptions = { 
    language: 'en-US', 
    ...KOIN_VOICE, 
    ...options 
  };
  
  if (maleVoiceId) {
    speechOptions.voice = maleVoiceId;
  }

  Speech.speak(cleaned, speechOptions);
};

export const stop = () => Speech.stop();

export default { loadVoiceOverSetting, isVoiceOverEnabled, setVoiceOverEnabled, onVoiceOverChange, speak, stop };