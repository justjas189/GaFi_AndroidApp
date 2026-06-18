// src/services/PushTokenService.js
// Persists Expo push tokens to Supabase so the backend can send remote push
// via the Expo Push API. Pairs with src/hooks/usePushNotifications.js, which
// acquires the token and caches it in AsyncStorage under 'expoPushToken'.

import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import DebugUtils from '../utils/DebugUtils';

/**
 * Upsert the device's Expo push token for a user. Safe to call repeatedly —
 * conflicts on the unique `token` column simply refresh user_id/platform/time.
 */
export async function registerPushToken(userId, token) {
  if (!userId || !token) return;
  try {
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) DebugUtils.warn('PUSH', 'token upsert failed', error);
    else DebugUtils.log('PUSH', 'token registered', { userId });
  } catch (e) {
    DebugUtils.warn('PUSH', 'registerPushToken error', e?.message);
  }
}

/**
 * Delete a token row (call on logout so the device stops receiving pushes
 * for the signed-out account).
 */
export async function removePushToken(token) {
  if (!token) return;
  try {
    await supabase.from('push_tokens').delete().eq('token', token);
    DebugUtils.log('PUSH', 'token removed');
  } catch (e) {
    DebugUtils.warn('PUSH', 'removePushToken error', e?.message);
  }
}
