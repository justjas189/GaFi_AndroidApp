/**
 * GoogleAuthService
 * Native Google Sign-In (@react-native-google-signin/google-signin) bridged
 * into Supabase via supabase.auth.signInWithIdToken.
 *
 * Flow: Google native account picker -> idToken -> Supabase session.
 * The resulting SIGNED_IN auth event is handled in AuthContext (applySession),
 * which flips the navigator from Auth -> Main/Onboarding.
 *
 * Requires a custom dev client / native build — does NOT run in Expo Go.
 */

import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { supabase } from '../config/supabase';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let configured = false;

export function configureGoogleSignIn() {
  if (configured) return;
  GoogleSignin.configure({
    // Web client id is what Supabase validates the idToken against.
    webClientId: WEB_CLIENT_ID,
    scopes: ['profile', 'email'],
    offlineAccess: true,
  });
  configured = true;
}

/**
 * Trigger the native Google account picker and exchange the idToken for a
 * Supabase session.
 * @returns {Promise<{success: boolean, cancelled?: boolean, error?: string, session?: object, user?: object}>}
 */
export async function signInWithGoogle() {
  if (!WEB_CLIENT_ID) {
    return {
      success: false,
      error: 'Google Sign-In is not configured (missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).',
    };
  }

  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    // v13+ returns a discriminated union: { type: 'success' | 'cancelled', data }.
    // Older versions return the user payload directly — handle both.
    if (response?.type === 'cancelled') {
      return { success: false, cancelled: true };
    }

    const idToken = response?.data?.idToken ?? response?.idToken;
    if (!idToken) {
      return { success: false, error: 'Google did not return an ID token.' };
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    if (isErrorWithCode?.(err)) {
      switch (err.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          return { success: false, cancelled: true };
        case statusCodes.IN_PROGRESS:
          return { success: false, error: 'A sign-in is already in progress.' };
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          return { success: false, error: 'Google Play Services are unavailable or out of date.' };
        default:
          break;
      }
    }
    console.error('Google sign-in error:', err);
    return { success: false, error: err?.message || 'Google sign-in failed. Please try again.' };
  }
}

/**
 * Sign out of the native Google session. Non-critical — Supabase sign-out is
 * the source of truth; this just clears the cached Google account.
 */
export async function signOutGoogle() {
  try {
    if (configured) {
      await GoogleSignin.signOut();
    }
  } catch (e) {
    console.warn('Google signOut failed (non-critical):', e?.message);
  }
}
