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

// Playback behaviour. 'loop' repeats the current track forever; 'all' plays the
// library top-to-bottom then wraps to the first track. Persisted alongside the
// track selection so the choice survives an app relaunch.
export const PLAYBACK_MODE = { LOOP: 'loop', ALL: 'all' };
const DEFAULT_MODE = PLAYBACK_MODE.LOOP;
const STORAGE_KEY_MODE = 'bgmPlaybackMode';

// Two acoustic presets. Tune to taste.
const FULL = { gain: 0.85, cutoff: 20000 }; // in the room — filter wide open
const DISTANT = { gain: 0.65, cutoff: 500 }; // through the wall — highs gone
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

  // ── Play-All queueing ──
  // Mirror of playbackMode in a ref so the stable startTrack/scheduleAdvance
  // callbacks can read the mode WITHOUT a state dependency — taking one would
  // change their identity and re-run the graph-build effect, tearing the audio
  // down on every mode toggle.
  const playbackModeRef = useRef(DEFAULT_MODE);
  // Pending wall-clock timer that crossfades into the next track. Always routed
  // through clearAdvanceTimer so a switch / mode change / suspend cancels it.
  const advanceTimerRef = useRef(null);
  // Audio-clock timestamp of the current track's first natural buffer end, and
  // its duration (= the loop period). scheduleAdvance derives the fire time from
  // these against ctx.currentTime, so a suspend/resume never drifts the queue.
  const trackEndsAtRef = useRef(0);
  const trackDurationRef = useRef(0);
  // Latest selected key, so advanceToNextTrack can step the array from a timer
  // without subscribing to state.
  const currentTrackKeyRef = useRef(DEFAULT_TRACK_KEY);
  // Holds the latest advanceToNextTrack so scheduleAdvance's timer can call it
  // without a declaration cycle (schedule → advance → startTrack → schedule).
  const advanceRef = useRef(null);

  // What the UI last asked for. Honoured once the graph exists, so a focus that
  // lands before the parent effect builds the nodes is not lost.
  const desiredRef = useRef(DISTANT);

  // The only piece of React state here: drives the Settings selector UI. Track
  // switches are rare (a user tap), so the resulting consumer re-render is
  // negligible — enterRoom/exitRoom never touch state, so focus changes stay
  // re-render-free.
  const [currentTrackKey, setCurrentTrackKey] = useState(DEFAULT_TRACK_KEY);

  // Drives the segmented Loop / Play-All control on BackgroundMusicScreen. Like
  // the track key, this is the only other slice of React state here; it moves
  // only on an explicit user toggle.
  const [playbackMode, setPlaybackModeState] = useState(DEFAULT_MODE);

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

  // Cancel a pending auto-advance. Idempotent — safe to call when nothing is armed.
  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // Arm the crossfade into the next track. No-op unless in Play-All mode. Fires
  // CROSSFADE_SEC *before* the current track's natural end so the next one fades
  // up over the outgoing tail — seamless, and it reuses startTrack's existing
  // crossfade rather than waiting for silence. The fire time is computed from
  // the audio clock (ctx.currentTime), which freezes on suspend, so re-arming
  // after a resume lands at the right spot with no wall-clock drift.
  const scheduleAdvance = useCallback(() => {
    clearAdvanceTimer();
    const ctx = ctxRef.current;
    const period = trackDurationRef.current;
    if (!ctx || playbackModeRef.current !== PLAYBACK_MODE.ALL || !period) return;

    const t = ctx.currentTime;
    let endsAt = trackEndsAtRef.current;
    // If the track already looped past its first end (mode flipped mid-play),
    // target the next buffer boundary instead of scheduling in the past.
    if (endsAt <= t) {
      const cycles = Math.ceil((t - endsAt) / period) || 1;
      endsAt += cycles * period;
    }
    const fireInSec = Math.max(0, endsAt - t - CROSSFADE_SEC);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      advanceRef.current?.();
    }, fireInSec * 1000);
  }, [clearAdvanceTimer]);

  // Pre-decode the track that Play-All will advance to next, into the shared
  // cache, while the current one is still playing. Decoding a multi-minute MP3
  // can outlast the 0.6 s crossfade lead, so without this the first pass through
  // the list could gap; a warm cache makes the advance-time decode a cache hit.
  // Fire-and-forget and side-effect-free (doesn't touch the switch token).
  const prewarmNextBuffer = useCallback((fromKey) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const idx = BGM_TRACKS.findIndex((t) => t.key === fromKey);
    const next = BGM_TRACKS[(idx + 1) % BGM_TRACKS.length];
    if (!next || bufferCacheRef.current.has(next.key)) return;
    ctx
      .decodeAudioData(next.source)
      .then((buf) => { if (ctxRef.current) bufferCacheRef.current.set(next.key, buf); })
      .catch(() => {});
  }, []);

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
    // Loop mode repeats this source natively; Play-All plays it once and the
    // scheduled advance crossfades to the next track at the end.
    nextSource.loop = playbackModeRef.current === PLAYBACK_MODE.LOOP;
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

    // Record the loop period + natural end for the Play-All queue, then (re)arm.
    // A new track always supersedes any pending advance.
    trackDurationRef.current = buffer.duration;
    trackEndsAtRef.current = now + buffer.duration;
    clearAdvanceTimer();
    if (playbackModeRef.current === PLAYBACK_MODE.ALL) {
      scheduleAdvance();
      prewarmNextBuffer(trackKey);
    }
  }, [clearAdvanceTimer, scheduleAdvance, prewarmNextBuffer]);

  // Select a track: update the UI highlight immediately, persist it, then swap
  // the audio — order chosen so the highlight never lags the tap. Shared by the
  // user's tap (changeBgmTrack) and the Play-All auto-advance, so the persisted
  // "last track" doubles as resume-where-you-left-off on the next launch.
  const goToTrack = useCallback(
    (trackKey) => {
      if (!BGM_TRACKS.some((t) => t.key === trackKey)) return;
      currentTrackKeyRef.current = trackKey;
      setCurrentTrackKey(trackKey);
      AsyncStorage.setItem(STORAGE_KEY, trackKey).catch(() => {});
      startTrack(trackKey);
    },
    [startTrack]
  );

  // Step to the next track in BGM_TRACKS, wrapping past the end back to the top.
  // Driven by the auto-advance timer in Play-All mode.
  const advanceToNextTrack = useCallback(() => {
    const idx = BGM_TRACKS.findIndex((t) => t.key === currentTrackKeyRef.current);
    const next = BGM_TRACKS[(idx + 1) % BGM_TRACKS.length];
    if (next) goToTrack(next.key);
  }, [goToTrack]);

  // Keep the ref scheduleAdvance's timer calls pointed at the latest advance fn.
  useEffect(() => {
    advanceRef.current = advanceToNextTrack;
  }, [advanceToNextTrack]);

  // Public selector API — unchanged contract, now an alias for goToTrack.
  const changeBgmTrack = goToTrack;

  // Switch playback behaviour and apply it to the live source at once: 'loop'
  // flips the current source to repeat and cancels any pending advance; 'all'
  // un-loops it and arms the crossfade to the next track. Persisted for launch.
  const changePlaybackMode = useCallback(
    (mode) => {
      if (mode !== PLAYBACK_MODE.LOOP && mode !== PLAYBACK_MODE.ALL) return;
      playbackModeRef.current = mode;
      setPlaybackModeState(mode);
      AsyncStorage.setItem(STORAGE_KEY_MODE, mode).catch(() => {});

      const src = sourceRef.current;
      if (src) {
        try { src.loop = mode === PLAYBACK_MODE.LOOP; } catch {}
      }
      if (mode === PLAYBACK_MODE.ALL) {
        scheduleAdvance();
        prewarmNextBuffer(currentTrackKeyRef.current);
      } else {
        clearAdvanceTimer();
      }
    },
    [scheduleAdvance, clearAdvanceTimer, prewarmNextBuffer]
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
      let startMode = DEFAULT_MODE;
      try {
        // Independent reads — fetch in parallel, not as a waterfall.
        const [savedKey, savedMode] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(STORAGE_KEY_MODE),
        ]);
        if (savedKey && BGM_TRACKS.some((t) => t.key === savedKey)) startKey = savedKey;
        if (savedMode === PLAYBACK_MODE.LOOP || savedMode === PLAYBACK_MODE.ALL) startMode = savedMode;
      } catch {}
      if (cancelled) return;
      // Prime the mode BEFORE the first startTrack so the initial source loops
      // (or arms its advance) according to the saved preference.
      playbackModeRef.current = startMode;
      setPlaybackModeState(startMode);
      currentTrackKeyRef.current = startKey;
      setCurrentTrackKey(startKey);
      startTrack(startKey);
    })();

    return () => {
      cancelled = true;
      switchTokenRef.current++; // invalidate any in-flight decode
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
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
      if (state === 'active') {
        ctx.resume().catch(() => {});
        // The audio clock froze while suspended; re-arm the Play-All advance
        // from where the clock actually is so the queue stays aligned.
        if (playbackModeRef.current === PLAYBACK_MODE.ALL) scheduleAdvance();
      } else {
        ctx.suspend().catch(() => {});
        // Audio is frozen — don't let the wall-clock timer advance in the dark.
        clearAdvanceTimer();
      }
    });
    return () => sub.remove();
  }, [scheduleAdvance, clearAdvanceTimer]);

  // enterRoom/exitRoom/changeBgmTrack are stable; only currentTrackKey moves the
  // identity, and only on an explicit track switch.
  const value = useMemo(
    () => ({
      enterRoom,
      exitRoom,
      changeBgmTrack,
      changePlaybackMode,
      currentBgmTrack: currentTrackKey,
      playbackMode,
      tracks: BGM_TRACKS,
    }),
    [enterRoom, exitRoom, changeBgmTrack, changePlaybackMode, currentTrackKey, playbackMode]
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
