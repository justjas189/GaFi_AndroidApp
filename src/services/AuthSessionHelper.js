import { supabase } from '../config/supabase';

const SESSION_CACHE_TTL_MS = 4000;
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

const state = {
  session: null,
  sessionExpiresAt: 0,
  inFlight: null,
  rateLimitUntil: 0,
  backoffMs: MIN_BACKOFF_MS,
};

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

export const updateSessionCache = (session) => {
  state.session = session || null;
  state.sessionExpiresAt = session ? Date.now() + SESSION_CACHE_TTL_MS : 0;
};

export const clearSessionCache = () => {
  state.session = null;
  state.sessionExpiresAt = 0;
  state.rateLimitUntil = 0;
  state.backoffMs = MIN_BACKOFF_MS;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSessionOnce = async (force) => {
  const now = Date.now();
  if (!force && state.session && now < state.sessionExpiresAt) {
    return { session: state.session, error: null, fromCache: true };
  }

  if (state.inFlight) return state.inFlight;

  if (now < state.rateLimitUntil) {
    emit('rate_limit', {
      retryInMs: state.rateLimitUntil - now,
      until: state.rateLimitUntil,
    });
    return { session: state.session, error: new Error('Rate limited'), rateLimited: true };
  }

  state.inFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      updateSessionCache(data?.session || null);
      state.backoffMs = MIN_BACKOFF_MS;
      return { session: data?.session || null, error: null };
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
      state.inFlight = null;
    }
  })();

  return state.inFlight;
};

export const getSessionSafe = async ({ force = false, retry = 0, retryDelayMs = 500 } = {}) => {
  const result = await getSessionOnce(force);
  if (result.rateLimited || result.error || result.session || retry <= 0) {
    return result;
  }

  await sleep(retryDelayMs);
  return getSessionSafe({
    force: true,
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
