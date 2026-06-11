import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

/**
 * Plays looping background music for a screen.
 *
 * @param {number} source - The require()'d audio asset.
 * @param {{ enabled?: boolean }} options
 *   enabled – Set to false to silence playback (e.g. user mute toggle). Defaults to true.
 * @returns {import('expo-audio').AudioPlayer} The underlying player (for volume adjustments etc.)
 *
 * Lifecycle:
 *   • Screen focused  → play
 *   • Screen blurred  → pause
 *   • App backgrounded/inactive → pause
 *   • App foregrounded          → resume (only when screen is still focused)
 */
export default function useBackgroundMusic(source, { enabled = true } = {}) {
  const player = useAudioPlayer(source);
  const isFocused = useRef(false);

  // Track screen focus and drive playback.
  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      if (enabled) {
        player.loop = true;
        player.play();
      }
      return () => {
        isFocused.current = false;
        player.pause();
      };
    }, [enabled, player]),
  );

  // Pause when the app leaves the foreground; resume when it returns.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (!isFocused.current) return;
      if (nextState === 'active' && enabled) {
        player.loop = true;
        player.play();
      } else if (nextState === 'background' || nextState === 'inactive') {
        player.pause();
      }
    });
    return () => subscription.remove();
  }, [enabled, player]);

  // Respect runtime changes to the `enabled` flag while screen is focused.
  useEffect(() => {
    if (!isFocused.current) return;
    if (enabled) {
      player.loop = true;
      player.play();
    } else {
      player.pause();
    }
  }, [enabled, player]);

  return player;
}
