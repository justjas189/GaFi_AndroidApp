// src/utils/appEnvironment.js
// Single source of truth for the active build variant at RUNTIME.
//
// Why not just read process.env.APP_VARIANT?
//   Expo only inlines env vars prefixed with EXPO_PUBLIC_ into the JS bundle.
//   APP_VARIANT is consumed by app.config.js at config-eval time (Node) to flip
//   package ids / names, but it is NOT present in the running app's process.env.
//   We forward it through expo Constants.extra.appVariant (set in app.config.js)
//   so the value is reliably available on-device.

import Constants from 'expo-constants';

/** 'development' | 'production' — resolved from app.config.js extra. */
export const APP_VARIANT =
  Constants?.expoConfig?.extra?.appVariant ||
  Constants?.manifest?.extra?.appVariant || // older Expo manifest shape fallback
  'production';

/**
 * True when running the dev variant. Also true under a local dev bundle (__DEV__)
 * so developers still see Test tooling when running `expo start` without the
 * APP_VARIANT env var set. Production release bundles run with __DEV__ === false,
 * so Test tooling stays stripped there.
 */
export const IS_DEVELOPMENT = APP_VARIANT === 'development' || __DEV__ === true;

/** Convenience inverse — use to hide/strip dev-only affordances in prod. */
export const IS_PRODUCTION = !IS_DEVELOPMENT;

export default { APP_VARIANT, IS_DEVELOPMENT, IS_PRODUCTION };
