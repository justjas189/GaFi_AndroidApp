/**
 * Voice over narration (panel revision) — reads story/tutorial text aloud
 * through the device TTS engine (expo-speech).
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'voiceOverEnabled';

// Koin tone when a real male voice is selected: keep energy, stay masculine.
// Pushing pitch past ~1.1 on a male voice turns it chipmunk/feminine again.
const KOIN_VOICE_MALE = Platform.select({
  android: { rate: 1.15, pitch: 1.05 },
  ios: { rate: 1.1, pitch: 1.1 },
  default: { rate: 1.1, pitch: 1.05 },
});

// Fallback tone when no male voice exists on the device: deepen whatever
// the engine defaults to (usually female) into a lower "mascot" register.
const KOIN_VOICE_FALLBACK = Platform.select({
  android: { rate: 0.95, pitch: 0.85 },
  ios: { rate: 0.95, pitch: 0.8 },
  default: { rate: 0.95, pitch: 0.85 },
});

// Known Google TTS male voice identifiers (substring match). Ordered by
// preference — US English first. Android engines vary wildly per device,
// so we match on identifier fragments rather than exact names.
const ANDROID_MALE_VOICE_KEYS = [
  'en-us-x-tpd', // Google US English male 1
  'en-us-x-iom', // Google US English male 2
  'en-us-x-iol', // Google US English male 3
  'en-gb-x-rjs', // Google UK English male
  'en-gb-x-gbb',
  'en-gb-x-gbd',
  'en-au-x-aub', // Google AU English male
  'en-ng-x-tfe', // Google Nigerian English male
  'en-in-x-ene', // Google Indian English male
];

// Common male voice names on iOS.
const IOS_MALE_VOICE_NAMES = ['daniel', 'aaron', 'fred', 'alex', 'arthur', 'gordon'];

let enabled = false;
let loadPromise = null;
let maleVoiceId = null;
let voiceLookupDone = false; // true once we got a non-empty voice list back
let voiceLookupInFlight = false;
const listeners = new Set();

const notify = () => listeners.forEach((fn) => fn(enabled));

const isEnglish = (v) => (v.language || '').toLowerCase().startsWith('en');

// NOTE: 'female'.includes('male') is true — always reject 'female' first.
const isExplicitlyMale = (text) => text.includes('male') && !text.includes('female');

const pickMaleVoice = (voices) => {
  const english = voices.filter(isEnglish);

  // 1. Known Google TTS male identifiers, in preference order.
  for (const key of ANDROID_MALE_VOICE_KEYS) {
    const match = english.find((v) => (v.identifier || '').toLowerCase().includes(key));
    if (match) return match;
  }

  // 2. Anything explicitly labeled male (Samsung/other OEM engines).
  const labeled = english.find((v) =>
    isExplicitlyMale(`${v.name || ''} ${v.identifier || ''}`.toLowerCase())
  );
  if (labeled) return labeled;

  // 3. iOS system male voices.
  return english.find((v) =>
    IOS_MALE_VOICE_NAMES.some((name) => (v.name || '').toLowerCase().includes(name))
  );
};

/**
 * Resolve a male voice from the device TTS engine. Android can return an
 * empty list while the engine is still binding, so an empty result leaves
 * `voiceLookupDone` false and we retry on the next speak().
 */
const initMaleVoice = async () => {
  if (voiceLookupDone || voiceLookupInFlight) return;
  voiceLookupInFlight = true;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    if (voices && voices.length > 0) {
      voiceLookupDone = true;
      const match = pickMaleVoice(voices);
      maleVoiceId = match ? match.identifier : null;
    }
  } catch (error) {
    console.log('Could not load custom voices', error);
  } finally {
    voiceLookupInFlight = false;
  }
};

/**
 * Resolve the persisted toggle once; safe to call repeatedly.
 * First launch (no stored value) defaults to ENABLED and persists that.
 */
export const loadVoiceOverSetting = () => {
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEY)
      .then(async (value) => {
        if (value === null) {
          enabled = true;
          AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
        } else {
          enabled = value === 'true';
        }
        notify();
        await initMaleVoice();
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

  // If the engine wasn't ready at load time, retry the lookup in the
  // background — this utterance uses the fallback tone, later ones upgrade.
  if (!voiceLookupDone) initMaleVoice();

  const tone = maleVoiceId ? KOIN_VOICE_MALE : KOIN_VOICE_FALLBACK;
  const speechOptions = {
    language: 'en-US',
    ...tone,
    ...options,
  };

  if (maleVoiceId) {
    speechOptions.voice = maleVoiceId;
  }

  Speech.speak(cleaned, speechOptions);
};

export const stop = () => Speech.stop();

export default { loadVoiceOverSetting, isVoiceOverEnabled, setVoiceOverEnabled, onVoiceOverChange, speak, stop };
