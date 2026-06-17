// src/hooks/useAppFonts.js
import { useFonts } from 'expo-font';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

// Loads every face the typography system references. The keys here ARE the
// fontFamily strings used in src/theme/typography.js — keep them in sync.
export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Fail open: if a font fails to load, still render (RN falls back to system
  // font) instead of bricking startup on a CDN hiccup.
  return { fontsLoaded: fontsLoaded || !!fontError, fontError };
}
