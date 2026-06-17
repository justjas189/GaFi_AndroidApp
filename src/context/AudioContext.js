// AudioContext.js — Global background-music owner (real low-pass "distant room").
//
// The Web Audio graph lives HERE, not inside any screen. The provider is mounted
// around MainNavigator (see MainNavigator.js), so it survives every tab switch
// and screen unmount. It is torn down only on logout, when MainNavigator
// unmounts — at which point the audio graph is closed.
//
// Signal chain (react-native-audio-api / Web Audio):
//
//   bufferSource → sourceGain → BiquadFilter(lowpass) → masterGain → destination
//
// Each track owns its OWN sourceGain. On a switch the new track fades in while
// the outgoing one fades out (equal-power-ish linear crossfade) — no click, no
// silent gap. The shared filter + masterGain (the live room preset) persist
// across switches, so changing the song never disturbs the muffle/level state.
//
// "Distant room" is a REAL acoustic muffle, not a pitch trick: the low-pass
// filter throws away the high frequencies (what a wall does to sound) while the
// gain node drops the level. Screens drive it via enterRoom()/exitRoom():
//   • focused   → cutoff open (~20 kHz), gain 0.70  (in the room)
//   • unfocused → cutoff low  (~500 Hz), gain 0.50  (muffled, next room over)
//
// Both transitions are ramped by AudioParam automation, which runs on the
// native audio thread — no JS setInterval, no main-thread jank.
//
// Track selection (changeBgmTrack) is persisted to AsyncStorage, so the user's
// choice is restored on the next app launch.

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioContext as WebAudioContext, AudioManager } from 'react-native-audio-api';

// The selectable BGM library. `source` is a require()'d asset id (number);
// decodeAudioData accepts it directly — no expo-asset resolution needed. If a
// future RN version regresses this, resolve with
// Asset.fromModule(source).downloadAsync() and decode the localUri instead.
//
// `key` is the stable identifier persisted to storage — never rename a key
// without a migration, or saved selections silently fall back to the default.
export const BGM_TRACKS = [
  { key: 'cherry_tree', title: 'A Lonely Cherry Tree', source: require('../../assets/audio/A Lonely Cherry Tree.mp3') },
  { key: 'melancholic_walk', title: 'Melancholic Walk', source: require('../../assets/audio/Melancholic Walk.mp3') },
  { key: 'run_as_fast', title: 'Run As Fast As You Can', source: require('../../assets/audio/Run As Fast As You Can.mp3') },
  { key: 'no_muscle', title: 'No Muscle No Problem', source: require('../../assets/audio/No Muscle No Problem.mp3') },
  { key: 'ninja_toad', title: 'Ninja Toad', source: require('../../assets/audio/Ninja Toad.mp3') },
];

const DEFAULT_TRACK_KEY = BGM_TRACKS[0].key;
const STORAGE_KEY = 'bgmTrackKey';

// Two acoustic presets. Tune to taste.
const FULL = { gain: 0.70, cutoff: 20000 }; // in the room — filter wide open
const DISTANT = { gain: 0.50, cutoff: 500 }; // through the wall — highs gone
const FILTER_Q = 0.7; // ~Butterworth, no resonant peak
const RAMP_SEC = 0.45; // room-preset fade length
const CROSSFADE_SEC = 0.6; // track-switch crossfade length

const GameAudioContext = createContext(null);

export function AudioProvider({ children }) {
  const ctxRef = useRef(null);
  const gainRef = useRef(null); // shared master gain — carries the room preset
  const filterRef = useRef(null);
  const sourceRef = useRef(null); // current bufferSource
  const sourceGainRef = useRef(null); // current track's own gain (crossfade leg)

  // Decoded AudioBuffers, keyed by track key. Decoding is the expensive part of
  // a switch; caching makes re-selecting a previously-played track instant.
  const bufferCacheRef = useRef(new Map());
  // Bumped on every startTrack() call (and on teardown). An in-flight decode
  // compares its captured token against this and aborts if it has been
  // superseded by a newer switch — prevents two tracks racing to start.
  const switchTokenRef = useRef(0);

  // What the UI last asked for. Honoured once the graph exists, so a focus that
  // lands before the parent effect builds the nodes is not lost.
  const desiredRef = useRef(DISTANT);

  // The only piece of React state here: drives the Settings selector UI. Track
  // switches are rare (a user tap), so the resulting consumer re-render is
  // negligible — enterRoom/exitRoom never touch state, so focus changes stay
  // re-render-free.
  const [currentTrackKey, setCurrentTrackKey] = useState(DEFAULT_TRACK_KEY);

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
    applyPreset(FULL); // no-op if the graph isn't built yet; mount effect snaps later
  }, [applyPreset]);

  const exitRoom = useCallback(() => {
    desiredRef.current = DISTANT;
    applyPreset(DISTANT);
  }, [applyPreset]);

  // Crossfade to `trackKey`: bring up a new source on its own gain while fading
  // the outgoing one down over the same window, then retire the old nodes.
  // Decode happens BEFORE anything is touched, so a failed/asset-missing decode
  // never silences what's already playing. Safe to call before the graph exists
  // (no-ops). On the very first call there's no outgoing track, so it's a plain
  // fade-in from silence.
  const startTrack = useCallback(async (trackKey) => {
    const ctx = ctxRef.current;
    const filter = filterRef.current;
    if (!ctx || !filter) return;

    const track = BGM_TRACKS.find((t) => t.key === trackKey);
    if (!track) return;

    const token = ++switchTokenRef.current;

    // Decode first (cache by key). Re-check the token/ctx after every await: a
    // newer switch or a provider teardown may have happened mid-decode.
    let buffer = bufferCacheRef.current.get(trackKey);
    if (!buffer) {
      try {
        buffer = await ctx.decodeAudioData(track.source);
      } catch {
        return; // decode failed — leave the current track playing
      }
      if (token !== switchTokenRef.current || !ctxRef.current) return;
      bufferCacheRef.current.set(trackKey, buffer);
    }
    if (token !== switchTokenRef.current || !ctxRef.current) return;

    const now = ctx.currentTime;
    const end = now + CROSSFADE_SEC;

    // Incoming leg: source → its own gain → shared filter. Start at 0, ramp up.
    const nextSource = ctx.createBufferSource();
    nextSource.buffer = buffer;
    nextSource.loop = true;
    const nextGain = ctx.createGain();
    nextGain.gain.value = 0;
    nextSource.connect(nextGain);
    nextGain.connect(filter);
    try { nextSource.start(0); } catch {}
    nextGain.gain.linearRampToValueAtTime(1, end);

    // Outgoing leg: ramp its gain to 0, stop at the crossfade end, then drop the
    // nodes. A JS timer (not onended) does the disconnect so it's robust even if
    // the engine doesn't surface the ended event; disconnect is idempotent.
    const prevSource = sourceRef.current;
    const prevGain = sourceGainRef.current;
    if (prevSource && prevGain) {
      try { prevGain.gain.cancelAndHoldAtTime(now); } catch {}
      prevGain.gain.linearRampToValueAtTime(0, end);
      try { prevSource.stop(end); } catch {}
      setTimeout(() => {
        try { prevSource.disconnect(); } catch {}
        try { prevGain.disconnect(); } catch {}
      }, CROSSFADE_SEC * 1000 + 80);
    }

    sourceRef.current = nextSource;
    sourceGainRef.current = nextGain;
  }, []);

  // Public selector API. Updates the UI immediately, persists the choice, then
  // swaps the audio — order chosen so the highlight never lags the tap.
  const changeBgmTrack = useCallback(
    (trackKey) => {
      if (!BGM_TRACKS.some((t) => t.key === trackKey)) return;
      setCurrentTrackKey(trackKey);
      AsyncStorage.setItem(STORAGE_KEY, trackKey).catch(() => {});
      startTrack(trackKey);
    },
    [startTrack]
  );

  // Build the persistent graph once, then start the saved (or default) track.
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

    // Persistent chain: (source) → filter → gain → destination.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = FILTER_Q;

    const gain = ctx.createGain();

    filter.connect(gain);
    gain.connect(ctx.destination);

    filterRef.current = filter;
    gainRef.current = gain;

    // Honour whatever preset a child screen requested before this parent effect
    // ran (child effects fire first). Snap, don't ramp — there's no audio yet.
    applyPreset(desiredRef.current, false);

    (async () => {
      let startKey = DEFAULT_TRACK_KEY;
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && BGM_TRACKS.some((t) => t.key === saved)) startKey = saved;
      } catch {}
      if (cancelled) return;
      setCurrentTrackKey(startKey);
      startTrack(startKey);
    })();

    return () => {
      cancelled = true;
      switchTokenRef.current++; // invalidate any in-flight decode
      try { sourceRef.current?.stop(); } catch {}
      try { sourceRef.current?.disconnect(); } catch {}
      try { sourceGainRef.current?.disconnect(); } catch {}
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      gainRef.current = null;
      filterRef.current = null;
      sourceRef.current = null;
      sourceGainRef.current = null;
      bufferCacheRef.current.clear();
    };
  }, [applyPreset, startTrack]);

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

  // enterRoom/exitRoom/changeBgmTrack are stable; only currentTrackKey moves the
  // identity, and only on an explicit track switch.
  const value = useMemo(
    () => ({
      enterRoom,
      exitRoom,
      changeBgmTrack,
      currentBgmTrack: currentTrackKey,
      tracks: BGM_TRACKS,
    }),
    [enterRoom, exitRoom, changeBgmTrack, currentTrackKey]
  );

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
