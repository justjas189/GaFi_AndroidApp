// context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Alert, AppState } from 'react-native';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAdmin, formatSupabaseError } from '../config/supabase';
import { removePushToken } from '../services/PushTokenService';
import {
  clearSessionCache,
  getRateLimitInfo,
  getSessionSafe,
  isRateLimitError,
  onAuthHelperEvent,
  updateSessionCache,
} from '../services/AuthSessionHelper';
import { signInWithGoogle, signOutGoogle } from '../services/GoogleAuthService';

export const AuthContext = createContext();

// ── Shared user-info builders (used by applySession + checkLoginStatus) ──
// Avatar precedence: stored profile -> Google metadata (avatar_url / picture).
const resolveAvatar = (user, profileData) =>
  profileData?.avatar_url ||
  user?.user_metadata?.avatar_url ||
  user?.user_metadata?.picture ||
  null;

// First word of the full name — the profiles table only stores full_name, so
// "First Name" is a derived, front-end-only concept used for UI greetings.
const deriveFirstName = (value) => {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed.split(/\s+/)[0] : null;
};

const VALID_USER_TYPES = ['student', 'employee'];

const buildUserInfo = (user, profileData) => {
  const fullName =
    profileData?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'User';
  return {
    ...user,
    name: fullName,
    firstName: deriveFirstName(fullName) || 'there',
    username: profileData?.username || user.user_metadata?.username || null,
    // Metadata fallback closes the first-session gap: on the very first login
    // the profiles row may not exist yet (syncProfileFromMetadata inserts AFTER
    // this runs) and BudgetGoalsScreen needs userType for its presets.
    userType:
      profileData?.user_type ||
      (VALID_USER_TYPES.includes(user.user_metadata?.user_type)
        ? user.user_metadata.user_type
        : null),
    avatarUrl: resolveAvatar(user, profileData),
    email: user.email,
  };
};

// ── Auto-username generation (for blank optional username at sign-up) ──
// Build a valid base from the email local-part: lowercase, keep only the chars
// the username constraint allows ([a-z0-9_], per ProfileService.validateUsername),
// drop dots / plus-tags / everything else. Guarantee >= 3 chars and leave room
// for a 4-digit suffix under the 30-char cap.
const slugifyEmailLocalPart = (email) => {
  const local = (email || '').split('@')[0] || '';
  let base = local.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) base = `user${base}`; // e.g. "a.b" -> "ab" -> "userab"
  return base.slice(0, 26); // 26 + 4-digit suffix = 30 max
};

const randomSuffix = () => Math.floor(1000 + Math.random() * 9000); // 4 digits

// Generate a username that's free. The profiles row is written LATER by
// syncProfileFromMetadata; a UNIQUE collision there throws 23505 and silently
// drops the username, so pre-check via the SECURITY DEFINER RPC (works for the
// still-unauthenticated sign-up caller, same as check_email_exists). Fail-open:
// an RPC error means assume-free, since the DB UNIQUE index is the final guard.
const generateUniqueUsername = async (email) => {
  const base = slugifyEmailLocalPart(email);
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}${randomSuffix()}`;
    try {
      const { data, error } = await supabase.rpc('is_username_available', {
        check_username: candidate,
      });
      if (error || data === true) return candidate;
    } catch {
      return candidate;
    }
  }
  // Exhausted (rare): widen entropy with a 6-digit time-based tail, still <= 30.
  return `${base.slice(0, 24)}${Date.now().toString().slice(-6)}`;
};

// Self-heal the profiles row from OAuth metadata. OAuth users have no DB
// insert-trigger, so the row may not exist yet; create it, and backfill
// avatar_url / username when missing. Fire-and-forget, never blocks auth.
const syncProfileFromMetadata = async (user, profileData) => {
  try {
    const meta = user.user_metadata || {};
    const googleAvatar = meta.avatar_url || meta.picture || null;

    if (!profileData) {
      // INSERT path. id is the PK and equals auth.uid(), so the row passes the
      // RLS INSERT policy (WITH CHECK auth.uid() = id). We deliberately OMIT
      // `email` here: profiles.email is UNIQUE, and re-inserting an email that
      // already exists on another row throws 23505 and surfaces as a 400.
      // avatar_url lives behind migration 20260615. If the deployed schema is
      // stale (column missing), PostgREST rejects the whole upsert with a 400
      // (PGRST204 schema-cache miss / 42703 undefined column). Detect that and
      // retry without the optional column so the row is still created — the
      // avatar backfills later once the migration is applied.
      //
      // username: password sign-ups carry it in user_metadata (register() passes
      // options.data.username). OAuth (Google) sign-ups have NO username in
      // metadata, so generate one from the email here. There is NO DB insert-
      // trigger — THIS upsert is the only writer of the profiles row, so it must
      // carry username through or profiles.username stays NULL forever (it shows
      // in the app only because buildUserInfo falls back to user_metadata).
      // username is a core column (since 20250806), not drift-prone, so it stays
      // in the minimal retry payload too.
      const username = meta.username || (await generateUniqueUsername(user.email));
      // user_type rides sign-up metadata (register() passes options.data.user_type)
      // so the selection made on SignUpScreen survives email verification and is
      // persisted here on the first authenticated session. Conditional spread —
      // an explicit null would trip the CHECK (user_type IN ('student','employee')).
      const metaUserType = VALID_USER_TYPES.includes(meta.user_type) ? meta.user_type : null;
      const fullPayload = {
        id: user.id,
        full_name: meta.full_name || meta.name || null,
        username,
        ...(metaUserType ? { user_type: metaUserType } : {}),
        avatar_url: googleAvatar, // column added in migration 20260615
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase
        .from('profiles')
        .upsert(fullPayload, { onConflict: 'id' });

      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        console.warn('Profile upsert: optional column missing, retrying minimal payload:', error.message);
        const { avatar_url, ...minimalPayload } = fullPayload;
        ({ error } = await supabase
          .from('profiles')
          .upsert(minimalPayload, { onConflict: 'id' }));
      }

      if (error) {
        // Full PostgREST detail so the exact 400 cause is visible in logs.
        console.warn('Profile insert failed:', error.code, error.message, error.details, error.hint);
      }
      return;
    }

    // UPDATE path — backfill the avatar AND username when missing. The username
    // backfill self-heals any row whose profiles.username is still NULL: password
    // accounts get it from user_metadata, OAuth (Google) accounts (no metadata
    // username) get a freshly generated one. Runs once per affected user — the
    // next session sees a non-null username and skips. A UNIQUE collision here
    // throws 23505 and is logged below — non-fatal, auth still proceeds.
    const patch = {};
    if (!profileData.avatar_url && googleAvatar) patch.avatar_url = googleAvatar;
    if (!profileData.username) {
      patch.username = meta.username || (await generateUniqueUsername(user.email));
    }
    // Backfill user_type from sign-up metadata when the row predates the
    // selection (e.g. profile row created before the metadata arrived).
    const backfillUserType = VALID_USER_TYPES.includes(meta.user_type) ? meta.user_type : null;
    if (!profileData.user_type && backfillUserType) patch.user_type = backfillUserType;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      console.warn('Profile backfill failed:', error.code, error.message, error.details, error.hint);
    }
  } catch (e) {
    console.warn('Profile metadata sync failed (non-critical):', e?.message);
  }
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);
  const isResettingPasswordRef = React.useRef(false);
  const isLoggingOutRef = React.useRef(false);
  const lastRateLimitNoticeRef = React.useRef(0);
  const lastTokenRefreshAtRef = React.useRef(0);
  const unexpectedSignOutTimerRef = React.useRef(null);

  const SIGNED_OUT_GRACE_MS = 30000;
  const RATE_LIMIT_NOTICE_COOLDOWN_MS = 30000;
  const TOKEN_REFRESH_DEBOUNCE_MS = 2000;

  // Helper: build enhanced user info from a Supabase session
  const applySession = async (session) => {
    // ── 1. SESSION FIRST: cache + token before ANY network await ──
    // Guarantees getSessionForMutation() Layer-1 cache hits the instant a
    // screen mounts, so services don't throw "User not authenticated" in the
    // window between the navigator swap and the profile fetch resolving.
    updateSessionCache(session);
    setUserToken(session.access_token);
    await AsyncStorage.setItem('userToken', session.access_token);
    if (session.refresh_token) {
      await AsyncStorage.setItem('userRefreshToken', session.refresh_token);
    }

    // Minimal userInfo immediately — `id` is what downstream services need.
    setUserInfo((prev) => prev ?? buildUserInfo(session.user, null));

    // ── 2. ENRICH AFTER: profile fetch must not block the auth gate ──
    let profileData = null;
    try {
      // select('*') is deliberate: naming a column that doesn't yet exist on
      // the deployed schema makes PostgREST return 400 (42703). '*' only ever
      // returns the columns that DO exist, so this query survives schema drift.
      // buildUserInfo reads every field with optional chaining.
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      profileData = data;

      const enhancedUserInfo = buildUserInfo(session.user, profileData);
      setUserInfo(enhancedUserInfo);
      await AsyncStorage.setItem('userInfo', JSON.stringify(enhancedUserInfo));

      // Reconcile the onboarding cache from the DB for EVERY session. This is
      // the single funnel for password AND Google (OAuth) sign-ins. The root
      // navigator routes off hasOnboarded_<id>; OAuth users never pass through
      // login(), so without this seed an existing user who already completed
      // onboarding would be wrongly sent back to the Welcome screen.
      if (profileData?.onboarding_completed) {
        await AsyncStorage.setItem(`hasOnboarded_${session.user.id}`, 'true');
      }
    } catch (e) {
      console.warn('Profile enrich failed (non-critical):', e?.message);
    }

    // Create/backfill the profile row from OAuth metadata (non-blocking).
    syncProfileFromMetadata(session.user, profileData);

    // Push token registration is handled by usePushNotifications, keyed on
    // userInfo.id, so it runs for both password and Google (OAuth) sign-ins.
  };

  const clearUnexpectedSignOutTimer = () => {
    if (unexpectedSignOutTimerRef.current) {
      clearTimeout(unexpectedSignOutTimerRef.current);
      unexpectedSignOutTimerRef.current = null;
    }
  };

  const scheduleUnexpectedSignOutCheck = () => {
    if (unexpectedSignOutTimerRef.current) return;

    const now = Date.now();
    const rateInfo = getRateLimitInfo();
    const waitMs = Math.max(SIGNED_OUT_GRACE_MS, rateInfo.rateLimitUntil - now + 1000);

    unexpectedSignOutTimerRef.current = setTimeout(async () => {
      try {
        const result = await getSessionSafe({ retry: 1, retryDelayMs: 1000 });
        if (result.rateLimited) {
          clearUnexpectedSignOutTimer();
          scheduleUnexpectedSignOutCheck();
          return;
        }
        if (result.session) {
          await applySession(result.session);
        } else {
          const backupToken = await AsyncStorage.getItem('userToken');
          const backupRefreshToken = await AsyncStorage.getItem('userRefreshToken');
          if (backupToken && backupRefreshToken) {
            const { data: recoverySession, error: recoveryError } = await supabase.auth.setSession({
              access_token: backupToken,
              refresh_token: backupRefreshToken,
            });

            if (recoveryError && isRateLimitError(recoveryError)) {
              clearUnexpectedSignOutTimer();
              scheduleUnexpectedSignOutCheck();
              return;
            }

            if (recoverySession?.session && !recoveryError) {
              await applySession(recoverySession.session);
              return;
            }
          }

          setUserToken(null);
          setUserInfo(null);
          updateSessionCache(null);
        }
      } catch (e) {
        console.warn('Unexpected sign-out recovery failed:', e?.message || e);
        setUserToken(null);
        setUserInfo(null);
        updateSessionCache(null);
      } finally {
        clearUnexpectedSignOutTimer();
      }
    }, Math.max(0, waitMs));
  };

  useEffect(() => {
    // ── DO NOT call getSession() prematurely ──
    // GoTrueClient loads the session from AsyncStorage asynchronously.
    // We rely on onAuthStateChange's INITIAL_SESSION event, which fires
    // only AFTER the session is fully restored (or confirmed missing).
    // This prevents the race condition where getSession() returns null
    // while the JWT is still being loaded from storage.

    let initialResolved = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);

      // ── INITIAL_SESSION: GoTrueClient finished loading from storage ──
      if (event === 'INITIAL_SESSION') {
        if (session) {
          initialResolved = true;
          await applySession(session);
          clearUnexpectedSignOutTimer();
          setIsLoading(false);
          return;
        }

        // ── SESSION RECOVERY: Supabase lost the session, but do we have a backup? ──
        try {
          const backupToken = await AsyncStorage.getItem('userToken');
          const backupRefreshToken = await AsyncStorage.getItem('userRefreshToken');
          // If we have a backup token but no session, the Supabase storage key was wiped
          if (backupToken) {
            console.warn('Auth: Native Supabase session missing, but backup token found. Attempting recovery...');

            // Re-hydrate the Supabase session using the refresh token if available.
            try {
              if (backupRefreshToken) {
                const { data: recoverySession, error: recoveryError } = await supabase.auth.setSession({
                  access_token: backupToken,
                  refresh_token: backupRefreshToken,
                });
                if (recoverySession?.session && !recoveryError) {
                  console.log('Auth: Session successfully recovered with refresh token.');
                  await applySession(recoverySession.session);
                  initialResolved = true;
                  setIsLoading(false);
                  return;
                }
                if (recoveryError && isRateLimitError(recoveryError)) {
                  console.warn('Auth: Recovery hit rate limit, delaying logout.');
                  scheduleUnexpectedSignOutCheck();
                  initialResolved = true;
                  setIsLoading(false);
                  return;
                }
              }

              const { data: recoveryData, error: recoveryError } = await supabase.auth.getUser(backupToken);
              if (recoveryData?.user && !recoveryError) {
                console.log('Auth: Access token still valid, restoring local auth state.');
                const backupUserInfo = await AsyncStorage.getItem('userInfo');
                if (backupUserInfo) {
                  setUserToken(backupToken);
                  setUserInfo(JSON.parse(backupUserInfo));
                  initialResolved = true;
                  setIsLoading(false);
                  return;
                }
              } else {
                console.warn('Auth: Backup token invalid or expired. Recovery failed.', recoveryError?.message);
              }
            } catch (recoveryErr) {
              console.error('Auth: Session recovery error:', recoveryErr);
            }
          }
        } catch (recoveryErr) {
          console.error('Auth: Session recovery error:', recoveryErr);
        }

        // If recovery failed or there was no backup token, proceed with normal unauthenticated state
        initialResolved = true;
        setIsLoading(false);
        return;
      }

      // Ignore PASSWORD_RECOVERY events — these fire during the password
      // reset OTP flow and must NOT set userToken, otherwise the navigator
      // would swap from AuthNavigator to MainNavigator mid-reset.
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery event — ignoring to stay on auth screens');
        return;
      }

      // Ignore SIGNED_IN events that fire as a side effect of verifyOtp
      // during an active password reset flow
      if (event === 'SIGNED_IN' && isResettingPasswordRef.current) {
        console.log('SIGNED_IN during password reset — ignoring transient session');
        return;
      }

      // ── TOKEN_REFRESHED: keep stored access token in sync ──
      if (event === 'TOKEN_REFRESHED' && session) {
        const now = Date.now();
        if (now - lastTokenRefreshAtRef.current < TOKEN_REFRESH_DEBOUNCE_MS) {
          updateSessionCache(session);
          return;
        }
        lastTokenRefreshAtRef.current = now;
        console.log('Auth: Token refreshed successfully for user:', session.user.id);
        setUserToken(session.access_token);
        await AsyncStorage.setItem('userToken', session.access_token);
        if (session.refresh_token) {
          await AsyncStorage.setItem('userRefreshToken', session.refresh_token);
        }
        updateSessionCache(session);
        return;
      }
      
      if (event === 'SIGNED_IN' && session) {
        await applySession(session);
        clearUnexpectedSignOutTimer();
        // If INITIAL_SESSION somehow didn't fire, resolve loading here
        if (!initialResolved) {
          initialResolved = true;
          setIsLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        // Diagnostic: was this logout user-initiated or unexpected?
        const isManual = isLoggingOutRef.current;
        console.warn(`Auth: SIGNED_OUT event received. Manual logout: ${isManual}`);

        if (isManual) {
          // Stop remote push for this device on the signed-out account.
          try {
            const pushToken = await AsyncStorage.getItem('expoPushToken');
            if (pushToken) await removePushToken(pushToken);
          } catch (e) {
            console.warn('Push token cleanup failed (non-critical):', e.message);
          }

          setUserToken(null);
          setUserInfo(null);
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('userInfo');
          await AsyncStorage.removeItem('userRefreshToken');
          updateSessionCache(null);
          // Clear any cached data
          await AsyncStorage.removeItem('onboardingComplete');
          await AsyncStorage.removeItem('isFirstLogin');
          
          isLoggingOutRef.current = false;
        } else {
          const rateInfo = getRateLimitInfo();
          if (rateInfo.isRateLimited) {
            console.warn('Auth: SIGNED_OUT during rate limit. Ignoring and retrying.');
            scheduleUnexpectedSignOutCheck();
            return;
          }

          console.warn('Auth: Unexpected SIGNED_OUT event. Keeping backup tokens for recovery attempt.');
          scheduleUnexpectedSignOutCheck();
        }

        if (!initialResolved) {
          initialResolved = true;
          setIsLoading(false);
        }
      }
    });

    // Safety timeout: if INITIAL_SESSION never fires (edge case), fall back
    const timeout = setTimeout(() => {
      if (!initialResolved) {
        console.warn('Auth: INITIAL_SESSION never fired after 5s — falling back to getSession()');
        (async () => {
          try {
            const result = await getSessionSafe({ retry: 1, retryDelayMs: 1000 });
            if (result.rateLimited) {
              scheduleUnexpectedSignOutCheck();
            } else if (result.session) {
              await applySession(result.session);
            }
          } catch (e) {
            console.error('Fallback getSession error:', e);
            setError(formatSupabaseError(e));
          } finally {
            initialResolved = true;
            setIsLoading(false);
          }
        })();
      }
    }, 5000);

    return () => {
      clearTimeout(timeout);
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const startAutoRefresh = () => {
      if (typeof supabase?.auth?.startAutoRefresh === 'function') {
        supabase.auth.startAutoRefresh();
      }
    };

    const stopAutoRefresh = () => {
      if (typeof supabase?.auth?.stopAutoRefresh === 'function') {
        supabase.auth.stopAutoRefresh();
      }
    };

    const handleAppStateChange = (nextState) => {
      if (nextState === 'active') {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    };

    if (AppState.currentState === 'active') {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthHelperEvent((event, payload) => {
      if (event !== 'rate_limit') return;
      const now = Date.now();
      if (now - lastRateLimitNoticeRef.current < RATE_LIMIT_NOTICE_COOLDOWN_MS) return;
      lastRateLimitNoticeRef.current = now;
      Alert.alert(
        'Network Busy',
        'Authentication requests are being rate limited. We will retry automatically.'
      );
      if (payload?.retryInMs) {
        scheduleUnexpectedSignOutCheck();
      }
    });

    return () => {
      unsubscribe();
      clearUnexpectedSignOutTimer();
    };
  }, []);

  const checkLoginStatus = async () => {
    try {
      const result = await getSessionSafe({ retry: 1, retryDelayMs: 1000 });
      if (result.rateLimited) {
        setError('Network busy. Retrying authentication...');
        return;
      }
      if (result.error) throw result.error;

      if (result.session) {
        // Get user profile data from database to get the full name, username, type and avatar
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*') // schema-drift-safe; see applySession note
          .eq('id', result.session.user.id)
          .maybeSingle();

        // Create enhanced user info object with name/avatar from profile or metadata
        const enhancedUserInfo = buildUserInfo(result.session.user, profileData);

        setUserToken(result.session.access_token);
        setUserInfo(enhancedUserInfo);
        updateSessionCache(result.session);
        await AsyncStorage.setItem('userToken', result.session.access_token);
        await AsyncStorage.setItem('userInfo', JSON.stringify(enhancedUserInfo));
        if (result.session.refresh_token) {
          await AsyncStorage.setItem('userRefreshToken', result.session.refresh_token);
        }
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      setError(formatSupabaseError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name, email, password, username = null, userType = null) => {
    try {
      setError(null);
      setIsLoading(true);

      // Attempt to sign up directly - let Supabase handle duplicate email checking.
      // username is stored in user_metadata and synced to profiles on first
      // authenticated session (see syncProfileFromMetadata).
      // emailRedirectTo deep-links the confirmation link back into the app
      // (gafi:// in standalone, exp:// in Expo Go) via the "gafi" scheme.
      // Username is optional on the form. When blank, auto-generate one from the
      // email local-part + random suffix so the profiles row always carries a
      // username (the Friends feature keys on it). A user-supplied username was
      // already format-validated and availability-checked on the SignUpScreen.
      const finalUsername = username && username.trim()
        ? username.trim()
        : await generateUniqueUsername(email);

      // user_type travels in sign-up metadata so it survives the email-verify
      // round trip; syncProfileFromMetadata persists it to profiles on the
      // first authenticated session.
      const safeUserType = VALID_USER_TYPES.includes(userType) ? userType : null;

      const redirectUrl = Linking.createURL('');
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: name,
            username: finalUsername,
            ...(safeUserType ? { user_type: safeUserType } : {}),
          },
        }
      });

      if (signUpError) {
        throw signUpError;
      }

      if (!data?.user) {
        throw new Error('Registration failed - no user data returned');
      }

      // If email is not confirmed, prompt user to check email
      if (!data.user.email_confirmed_at) {
        return {
          success: true,
          user: data.user,
          needsVerification: true
        };
      }

      // If email is already confirmed (rare), proceed to login
      return {
        success: true,
        user: data.user,
        needsVerification: false
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: formatSupabaseError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      setIsLoading(true);

      // Attempt to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If error message indicates email not confirmed, show custom message
        if (error.message && error.message.toLowerCase().includes('email') && error.message.toLowerCase().includes('confirm')) {
          return {
            success: false,
            error: 'Please verify your email before logging in. Check your inbox for a verification link.',
            needsVerification: true
          };
        }
        throw error;
      }

      if (data?.session) {
        // Check if user has confirmed their email
        const user = data.session.user;
        if (!user.email_confirmed_at && !user.confirmed_at) {
          return {
            success: false,
            error: 'Please verify your email before logging in. Check your inbox for a verification link.',
            needsVerification: true
          };
        }

        // Check if user profile exists and determine if onboarding is needed
        let needsOnboarding = false;
        try {
          // First check AsyncStorage for onboarding completion
          const hasOnboarded = await AsyncStorage.getItem(`hasOnboarded_${user.id}`);
          if (hasOnboarded === 'true') {
            needsOnboarding = false;
          } else {
            // Check database profile as fallback
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*') // includes onboarding_completed only if the column exists
              .eq('id', user.id)
              .maybeSingle();

            if (profileError && profileError.code !== 'PGRST116') {
              console.warn('Error checking profile:', profileError);
            }

            // If database says onboarding is complete, sync with AsyncStorage
            if (profileData?.onboarding_completed) {
              await AsyncStorage.setItem(`hasOnboarded_${user.id}`, 'true');
              needsOnboarding = false;
            } else if (!profileData) {
              // No profile exists, this is likely a new user who needs onboarding
              needsOnboarding = true;
            } else {
              // Check if this is a very recent account (created within last 10 minutes)
              const profileCreated = new Date(profileData.created_at);
              const now = new Date();
              const diffMinutes = (now - profileCreated) / (1000 * 60);
              
              // If profile was created recently, likely needs onboarding
              needsOnboarding = diffMinutes < 10;
            }
          }
        } catch (error) {
          console.warn('Could not check profile for onboarding:', error);
          // If we can't check, assume existing user (safer default)
          needsOnboarding = false;
        }

        return { 
          success: true, 
          session: data.session,
          needsOnboarding
        };
      }

      return { 
        success: false, 
        error: 'Login failed - no session data' 
      };
    } catch (error) {
      // Log simplified message without exposing error details
      console.log('Login attempt failed');
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    try {
      setError(null);
      setIsLoading(true);

      const result = await signInWithGoogle();

      if (result.cancelled) {
        return { success: false, cancelled: true };
      }

      if (!result.success) {
        setError(result.error);
        return { success: false, error: result.error };
      }

      // The SIGNED_IN auth event handles applySession (which seeds the
      // hasOnboarded_<id> cache from profiles.onboarding_completed) + the
      // navigator swap. The root navigator's gate also consults the DB on a
      // cache miss, so EXISTING Google users land on Main and only genuinely
      // new ones hit Onboarding.
      return { success: true, session: result.session };
    } catch (error) {
      console.error('Google login error:', error);
      const message = formatSupabaseError(error);
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      isLoggingOutRef.current = true;
      clearUnexpectedSignOutTimer();
      clearSessionCache();
      // ── IMMEDIATE: nuke React state so the navigator swaps to Auth instantly ──
      setUserToken(null);
      setUserInfo(null);

      // ── BACKGROUND: Supabase sign-out + AsyncStorage wipe (fire-and-forget) ──
      // We don't await this — the user sees the login screen right away.
      (async () => {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn('Supabase signOut error (non-critical):', e.message);
        }
        // Clear the cached native Google account so the picker re-prompts.
        await signOutGoogle();
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const keysToRemove = allKeys.filter(k =>
            k.startsWith('userToken') ||
            k.startsWith('userInfo') ||
            k.startsWith('userRefreshToken') ||
            k.startsWith('onboardingComplete') ||
            k.startsWith('isFirstLogin') ||
            k.startsWith('hasOnboarded_') ||
            k.startsWith('unlocked_skins_') ||
            k.startsWith('chat_') ||
            k.startsWith('game_')
          );
          if (keysToRemove.length > 0) {
            await AsyncStorage.multiRemove(keysToRemove);
          }
        } catch (e) {
          console.warn('AsyncStorage cleanup error (non-critical):', e.message);
        }
      })();

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    }
  };

  const sendPasswordResetEmail = async (email) => {
    try {
      setError(null);
      // NOTE: Do NOT set global isLoading here — AppNavigator uses it to
      // swap to <LoadingScreen>, which unmounts the auth navigator and
      // destroys the navigation stack.  Screens use local loading state.

      // resetPasswordForEmail's 2nd arg is the options object and the key is
      // `redirectTo` (NOT a nested options/emailRedirectTo like signUp). This
      // only affects the magic-link email variant; the app's OTP-code flow
      // (verifyOtp type:'recovery') is unaffected, so it's a safe addition.
      const redirectUrl = Linking.createURL('');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Send reset email error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    }
  };

  const resetPassword = async (code, newPassword, email) => {
    try {
      setError(null);
      // NOTE: Do NOT set global isLoading here — same reason as above.
      isResettingPasswordRef.current = true; // Prevent auth listener from processing transient session

      // Step 1: Verify the OTP code to establish a recovery session
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      // Step 2: Now that we have an authenticated session, update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Step 3: Sign out so the user can log in fresh with the new password
      await supabase.auth.signOut();

      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    } finally {
      isResettingPasswordRef.current = false;
    }
  };

  const markOnboardingComplete = async (userId) => {
    try {
      // Mark onboarding as complete in AsyncStorage
      await AsyncStorage.setItem(`hasOnboarded_${userId}`, 'true');
      await AsyncStorage.setItem('onboardingComplete', 'true');
      
      // Update profile in database if possible
      try {
        await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);
      } catch (dbError) {
        console.warn('Could not update onboarding status in database:', dbError);
        // Continue anyway - AsyncStorage is sufficient
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
      return { success: false, error: error.message };
    }
  };

  const setUserType = async (userType) => {
    try {
      // Update in-memory state immediately
      const updatedUserInfo = { ...userInfo, userType };
      setUserInfo(updatedUserInfo);
      await AsyncStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
      return { success: true };
    } catch (error) {
      console.error('Error setting user type:', error);
      return { success: false, error: error.message };
    }
  };

  // DB-backed twin of setUserType. Upserts profiles.user_type WITHOUT the email
  // column (profiles.email is UNIQUE — re-sending it can 23505; see the
  // syncProfileFromMetadata INSERT-path comment). Never blocks the caller's flow:
  // a failed DB write still updates in-memory state and is backfilled by
  // syncProfileFromMetadata on a later session.
  const persistUserType = async (userType) => {
    if (!VALID_USER_TYPES.includes(userType)) {
      return { success: false, error: 'Invalid user type' };
    }
    try {
      if (userInfo?.id) {
        const { error } = await supabase
          .from('profiles')
          .upsert(
            { id: userInfo.id, user_type: userType, updated_at: new Date().toISOString() },
            { onConflict: 'id' },
          );
        if (error) {
          console.warn('persistUserType DB write failed:', error.code, error.message);
        }
      }
      await AsyncStorage.setItem('userType', userType); // legacy key kept in sync
      return await setUserType(userType);
    } catch (error) {
      console.error('Error persisting user type:', error);
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!userInfo?.id) {
        throw new Error('User not logged in');
      }

      // Prepare update data
      const updateData = {
        full_name: profileData.name,
        updated_at: new Date().toISOString()
      };

      // Add username if provided
      if (profileData.username) {
        updateData.username = profileData.username;
      }

      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userInfo.id);

      if (updateError) {
        // Handle unique constraint violation for username
        if (updateError.code === '23505' && updateError.message.includes('username')) {
          throw new Error('Username already taken. Please choose a different one.');
        }
        throw updateError;
      }

      // Update local user info (firstName is derived from name — keep in sync)
      const updatedUserInfo = {
        ...userInfo,
        name: profileData.name,
        firstName: deriveFirstName(profileData.name) || 'there',
        ...(profileData.username && { username: profileData.username })
      };

      setUserInfo(updatedUserInfo);
      await AsyncStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));

      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(formatSupabaseError(error));
      return { 
        success: false, 
        error: formatSupabaseError(error)
      };
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue = {
    isLoading,
    userToken,
    userInfo,
    user: userInfo, // Add user property for compatibility
    error,
    login,
    loginWithGoogle,
    logout,
    register,
    checkLoginStatus,
    sendPasswordResetEmail,
    resetPassword,
    markOnboardingComplete,
    updateProfile,
    setUserType,
    persistUserType,
    isAuthenticated: !!userToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};