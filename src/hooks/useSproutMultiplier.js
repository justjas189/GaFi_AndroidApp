// src/hooks/useSproutMultiplier.js
//
// Shared read of the Double Sprout Token buff so every wallet surface (Explore,
// Trading Post) shows the same "2x" indicator from one source. Re-reads on focus
// and ticks every 60s while the screen is focused so the countdown stays fresh
// without a render-per-frame. The buff itself lives in EconomyService (a single
// AsyncStorage expiry timestamp); this hook only reflects it.

import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import EconomyService from '../services/EconomyService';

// "23h 4m" / "4m" — minute granularity is enough for a 24h buff and avoids a
// per-second timer. Floors to nothing once expired.
export function formatRemaining(ms) {
  if (!ms || ms <= 0) return '';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const IDLE = { active: false, expiry: 0, remainingMs: 0 };

export function useSproutMultiplier(userId) {
  const [status, setStatus] = useState(IDLE);
  const timerRef = useRef(null);

  // Imperative refresh for right after activation (don't wait for the next tick).
  const refresh = useCallback(async () => {
    const s = await EconomyService.getMultiplierStatus(userId);
    setStatus(s);
    return s;
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const tick = async () => {
        const s = await EconomyService.getMultiplierStatus(userId);
        if (active) setStatus(s);
      };
      tick();
      timerRef.current = setInterval(tick, 60000);
      return () => {
        active = false;
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [userId]),
  );

  return {
    active: status.active,
    expiry: status.expiry,
    remainingMs: status.remainingMs,
    label: formatRemaining(status.remainingMs),
    refresh,
  };
}

export default useSproutMultiplier;
