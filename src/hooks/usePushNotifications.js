// src/hooks/usePushNotifications.js
// Single source of truth for Expo push setup:
//   • sets the global foreground notification handler (once, at module load)
//   • creates the Android notification channel
//   • requests permission + checks for a physical device (expo-device)
//   • acquires the ExpoPushToken (with explicit EAS projectId) and caches it
//   • registers received + tap (response) listeners
//   • persists the token to Supabase once a userId is available
//
// Mount once on the authenticated surface: usePushNotifications(userInfo?.id).

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DebugUtils from '../utils/DebugUtils';
import { registerPushToken } from '../services/PushTokenService';
import { navigationRef } from '../navigation/navigationRef';

// ── Global foreground handler (set ONCE, at module scope) ───────────────────
// SDK 54 / expo-notifications 0.32: shouldShowAlert is deprecated → use
// shouldShowBanner + shouldShowList so foreground notifications still appear.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android requires an explicit channel for heads-up display + sound on API 26+.
// All local notifications fall back to this 'default' channel.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B00',
    sound: 'default',
  });
}

async function registerForPush() {
  await ensureAndroidChannel();

  // Push tokens are only issued to real hardware, not simulators/emulators.
  if (!Device.isDevice) {
    DebugUtils.warn('PUSH', 'Not a physical device — skipping push token');
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    DebugUtils.warn('PUSH', 'Notification permission not granted');
    return null;
  }

  // projectId is required in dev-client / bare builds for token generation.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await AsyncStorage.setItem('expoPushToken', token);
    DebugUtils.log('PUSH', 'Expo push token acquired', { token });
    return token;
  } catch (e) {
    DebugUtils.error('PUSH', 'getExpoPushTokenAsync failed', e);
    return null;
  }
}

export function usePushNotifications(userId) {
  const [expoPushToken, setExpoPushToken] = useState(null);
  const [notification, setNotification] = useState(null);
  const receivedSub = useRef(null);
  const responseSub = useRef(null);

  // Acquire the token once on mount.
  useEffect(() => {
    registerForPush().then((token) => token && setExpoPushToken(token));
  }, []);

  // Persist whenever we have BOTH a token and a signed-in user.
  useEffect(() => {
    if (expoPushToken && userId) registerPushToken(userId, expoPushToken);
  }, [expoPushToken, userId]);

  // Listeners: foreground receive + tap-to-open.
  useEffect(() => {
    receivedSub.current = Notifications.addNotificationReceivedListener((n) => {
      setNotification(n);
      DebugUtils.log('PUSH', 'notification received', n?.request?.content?.title);
    });

    responseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      DebugUtils.log('PUSH', 'notification tapped', data);
      // Tap routing — extend per data.type as screens are wired up, e.g.:
      // if (data.type === 'goal_deadline' && navigationRef.isReady()) {
      //   navigationRef.navigate('Goals');
      // }
    });

    return () => {
      receivedSub.current?.remove();
      responseSub.current?.remove();
    };
  }, []);

  return { expoPushToken, notification };
}

export default usePushNotifications;
