// AudioContext.js — Global background-music owner (real low-pass "distant room").
//
// The Web Audio graph lives HERE, not inside any screen. The provider is mounted
// around MainNavigator (see MainNavigator.js), so it survives every tab switch
// and screen unmount. It is torn down only on logout, when MainNavigator
// unmounts — at which point the audio graph is closed.
//
// Signal chain (react-native-audio-api / Web Audio):
//
//   bufferSource → BiquadFilter(lowpass) → Gain → destination
//
// "Distant room" is a REAL acoustic muffle, not a pitch trick: the low-pass
// filter throws away the high frequencies (what a wall does to sound) while the
// gain node drops the level. Screens drive it via enterRoom()/exitRoom():
//   • focused   → cutoff open (~20 kHz), gain 0.45  (in the room)
//   • unfocused → cutoff low  (~500 Hz), gain 0.10  (muffled, next room over)
//
// Both transitions are ramped by AudioParam automation, which runs on the
// native audio thread — no JS setInterval, no main-thread jank.

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import { AudioContext as WebAudioContext, AudioManager } from 'react-native-audio-api';

// decodeAudioData accepts a require()'d asset id (number) directly — no
// expo-asset resolution needed. If a future RN version regresses this, resolve
// with Asset.fromModule(...).downloadAsync() and pass localUri instead.
const BGM_SOURCE = require('../../assets/audio/bgm-placeholder.mp3');

// Two acoustic presets. Tune to taste.
const FULL = { gain: 0.70, cutoff: 20000 }; // in the room — filter wide open
const DISTANT = { gain: 0.50, cutoff: 500 }; // through the wall — highs gone
const FILTER_Q = 0.7; // ~Butterworth, no resonant peak
const RAMP_SEC = 0.45; // fade length

const GameAudioContext = createContext(null);

export function AudioProvider({ children }) {
  const ctxRef = useRef(null);
  const gainRef = useRef(null);
  const filterRef = useRef(null);
  const sourceRef = useRef(null);
  const readyRef = useRef(false);
  // What the UI last asked for. Honoured once the graph finishes loading, so a
  // focus that lands mid-decode is not lost.
  const desiredRef = useRef(DISTANT);

  // Drive the graph toward a preset. ramp=false snaps (used for initial state).
  const applyPreset = useCallback((preset, ramp = true) => {
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    const filter = filterRef.current;
    if (!ctx || !gain || !filter) return;

    if (!ramp) {
      gain.gain.value = preset.gain;
      filter.frequency.value = preset.cutoff;
      return;
    }

    const now = ctx.currentTime;
    const end = now + RAMP_SEC;

    // Hold each param at its live value, then ramp from there — clean even if a
    // previous fade is still in flight (fast tab toggling).
    gain.gain.cancelAndHoldAtTime(now);
    gain.gain.linearRampToValueAtTime(preset.gain, end);

    filter.frequency.cancelAndHoldAtTime(now);
    // Exponential for frequency: pitch/cutoff is perceived logarithmically, so
    // this sounds like a natural sweep rather than a linear lurch. Safe because
    // cutoff is always > 0.
    filter.frequency.exponentialRampToValueAtTime(preset.cutoff, end);
  }, []);

  const enterRoom = useCallback(() => {
    desiredRef.current = FULL;
    if (readyRef.current) applyPreset(FULL);
  }, [applyPreset]);

  const exitRoom = useCallback(() => {
    desiredRef.current = DISTANT;
    if (readyRef.current) applyPreset(DISTANT);
  }, [applyPreset]);

  // Build the graph once.
  useEffect(() => {
    let cancelled = false;

    // iOS only (no-op on Android); guarded so a missing API never crashes.
    try {
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playback',
        iosMode: 'default',
        iosOptions: ['mixWithOthers'],
      });
    } catch {}

    const ctx = new WebAudioContext();
    ctxRef.current = ctx;

    (async () => {
      try {
        const buffer = await ctx.decodeAudioData(BGM_SOURCE);
        if (cancelled) return;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = FILTER_Q;

        const gain = ctx.createGain();

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        sourceRef.current = source;
        filterRef.current = filter;
        gainRef.current = gain;

        // Snap to whatever state was requested while we were decoding, then go.
        applyPreset(desiredRef.current, false);
        source.start(0);
        readyRef.current = true;
      } catch {
        // Decode/build failed — leave the app silent rather than crash.
      }
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      try {
        sourceRef.current?.stop();
      } catch {}
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      gainRef.current = null;
      filterRef.current = null;
      sourceRef.current = null;
    };
  }, [applyPreset]);

  // Suspend the audio clock when backgrounded; resume on return. Keeps the
  // source position and preset intact (no node teardown).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (state === 'active') ctx.resume().catch(() => {});
      else ctx.suspend().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // Imperative API — calling these never touches React state, so no consumer
  // re-renders from this context.
  const value = useMemo(() => ({ enterRoom, exitRoom }), [enterRoom, exitRoom]);

  return (
    <GameAudioContext.Provider value={value}>{children}</GameAudioContext.Provider>
  );
}

export function useGameAudio() {
  const ctx = useContext(GameAudioContext);
  if (!ctx) {
    throw new Error('useGameAudio must be used within an AudioProvider');
  }
  return ctx;
}
