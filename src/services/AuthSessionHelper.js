import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Configuration ──────────────────────────────────────────────────────────
// After a TOKEN_REFRESHED event, AuthContext calls updateSessionCache() which
// sets sessionExpiresAt = now + TTL.  During this window, ALL callers get the
// cached session instantly — zero network requests.  30 s is long enough to
// absorb the burst of re-renders that follow a token refresh.
const SESSION_CACHE_TTL_MS = 30_000;
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

// ─── Module-level state (singleton) ─────────────────────────────────────────
const state = {
  session: null,
  sessionExpiresAt: 0,
  rateLimitUntil: 0,
  backoffMs: MIN_BACKOFF_MS,
};

// ─── Promise Lock (Mutex) ───────────────────────────────────────────────────
// Prevents multiple concurrent network requests to supabase.auth.getSession().
// If a fetch is already in-flight, all subsequent callers piggy-back on the
// same promise and share its result.
let sessionFetchPromise = null;

// ─── Event Emitter ──────────────────────────────────────────────────────────
const listeners = new Set();

const emit = (event, payload) => {
  listeners.forEach((listener) => {
    try {
      listener(event, payload);
    } catch (_) {
      // Ignore listener errors so auth flow is not interrupted.
    }
  });
};

export const onAuthHelperEvent = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// ─── Utilities ──────────────────────────────────────────────────────────────

export const isRateLimitError = (error) => {
  const status = error?.status || error?.statusCode;
  if (status === 429) return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('rate limit');
};

export const getRateLimitInfo = () => {
  const now = Date.now();
  return {
    isRateLimited: now < state.rateLimitUntil,
    rateLimitUntil: state.rateLimitUntil,
    backoffMs: state.backoffMs,
  };
};

/**
 * Immediately update the in-memory session cache.
 *
 * AuthContext MUST call this from its TOKEN_REFRESHED and SIGNED_IN handlers
 * so that the 30-second cache window starts the moment the fresh token arrives
 * — guaranteeing zero network requests during the post-refresh burst.
 */
export const updateSessionCache = (session) => {
  state.session = session || null;
  state.sessionExpiresAt = session ? Date.now() + SESSION_CACHE_TTL_MS : 0;
};

export const clearSessionCache = () => {
  state.session = null;
  state.sessionExpiresAt = 0;
  state.rateLimitUntil = 0;
  state.backoffMs = MIN_BACKOFF_MS;
  sessionFetchPromise = null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Core: Single-flight session fetch ──────────────────────────────────────

/**
 * Fetch the Supabase session *once*, with in-flight deduplication.
 *
 * 1. If the in-memory cache is still valid → return instantly.
 * 2. If a fetch is already in-flight → return the existing promise (mutex).
 * 3. Otherwise, call supabase.auth.getSession() and cache the result.
 *
 * ⚠️  `force` has been **removed** — nothing should bypass the cache.
 *     This is the core change that prevents 429 rate-limit storms.
 */
const getSessionOnce = async () => {
  const now = Date.now();

  // ① Cache hit — return instantly, zero network.
  if (state.session && now < state.sessionExpiresAt) {
    return { session: state.session, error: null, fromCache: true };
  }

  // ② In-flight deduplication — return the same promise.
  if (sessionFetchPromise) return sessionFetchPromise;

  // ③ Rate-limit guard — don't even attempt the request.
  if (now < state.rateLimitUntil) {
    emit('rate_limit', {
      retryInMs: state.rateLimitUntil - now,
      until: state.rateLimitUntil,
    });
    return { session: state.session, error: new Error('Rate limited'), rateLimited: true };
  }

  // ④ Fire the request and lock the mutex.
  sessionFetchPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const newSession = data?.session || null;
      // Don't overwrite a valid cached session with null during token refresh
      if (newSession || !state.session) {
        updateSessionCache(newSession);
      }
      state.backoffMs = MIN_BACKOFF_MS;
      return { session: newSession || state.session, error: null };
    } catch (error) {
      if (isRateLimitError(error)) {
        const retryInMs = Math.max(state.backoffMs, MIN_BACKOFF_MS);
        state.rateLimitUntil = Date.now() + retryInMs;
        state.backoffMs = Math.min(retryInMs * 2, MAX_BACKOFF_MS);
        emit('rate_limit', { retryInMs, until: state.rateLimitUntil, error });
        return { session: state.session, error, rateLimited: true };
      }
      return { session: state.session, error };
    } finally {
      sessionFetchPromise = null;
    }
  })();

  return sessionFetchPromise;
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Safe session fetch with optional retry.
 *
 * NOTE: The `force` option is now **ignored** to prevent cache-bypassing
 * network requests that trigger Supabase 429 rate limits.  If you need
 * the latest session after a token refresh, AuthContext should call
 * `updateSessionCache(session)` from its onAuthStateChange handler.
 */
export const getSessionSafe = async ({ retry = 0, retryDelayMs = 500 } = {}) => {
  const result = await getSessionOnce();
  if (result.rateLimited || result.error || result.session || retry <= 0) {
    return result;
  }

  await sleep(retryDelayMs);
  return getSessionSafe({
    retry: retry - 1,
    retryDelayMs: Math.min(retryDelayMs * 2, 4000),
  });
};

export const getUserIdSafe = async (options = {}) => {
  const result = await getSessionSafe(options);
  return {
    ...result,
    userId: result.session?.user?.id || null,
  };
};

/**
 * Resilient session / userId lookup for mutations and data fetching.
 *
 * Uses a 3-layer fallback with full mutex protection:
 *   1. In-memory session cache (instant, <1 ms)
 *   2. supabase.auth.getSession() — **deduplicated** via the promise lock
 *   3. AsyncStorage backup userInfo (covers token-refresh gap and cold starts)
 *
 * Returns { session: Session|null, userId: string|null }
 */
export const getSessionForMutation = async () => {
  // Layer 1: In-memory cache (fastest path, no network)
  if (state.session?.user?.id && Date.now() < state.sessionExpiresAt) {
    return { session: state.session, userId: state.session.user.id };
  }

  // Layer 2: Deduplicated live Supabase session lookup via getSessionOnce()
  // This shares the in-flight promise if another caller is already fetching.
  try {
    const result = await getSessionOnce();
    if (result.session?.user?.id) {
      return { session: result.session, userId: result.session.user.id };
    }
  } catch (e) {
    // Fall through to backup layer
  }

  // Layer 3: AsyncStorage backup — AuthContext persists userInfo on every login/refresh
  try {
    const userInfoStr = await AsyncStorage.getItem('userInfo');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      if (userInfo?.id) {
        console.warn('[AuthSessionHelper] getSessionForMutation: using AsyncStorage fallback userId:', userInfo.id);
        return { session: null, userId: userInfo.id };
      }
    }
  } catch (e) {
    // All recovery layers exhausted
  }

  return { session: null, userId: null };
};
