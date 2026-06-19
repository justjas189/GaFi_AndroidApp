import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../../context/ThemeContext';
import { useGameAudio, PLAYBACK_MODE } from '../../context/AudioContext';
import { FONTS } from '../../theme/typography';

// Music attribution — all BGM tracks are composed by Pix.
const PIX_YOUTUBE_URL = 'https://www.youtube.com/@Pixverses';

// Segmented playback-mode control. Hoisted so the array identity is stable
// across renders. `list` reads as "the whole tracklist"; `repeat` as "this one
// again" — the two universal music-player glyphs for these behaviours.
const PLAYBACK_OPTIONS = [
  { mode: PLAYBACK_MODE.LOOP, label: 'Loop', icon: 'repeat' },
  { mode: PLAYBACK_MODE.ALL, label: 'Play All', icon: 'list' },
];

const BackgroundMusicScreen = ({ navigation }) => {
  const { theme } = useContext(ThemeContext);
  const { tracks, currentBgmTrack, changeBgmTrack, playbackMode, changePlaybackMode } = useGameAudio();

  const handleOpenPix = () => {
    Linking.openURL(PIX_YOUTUBE_URL).catch(() => {
      Alert.alert('Error', 'Could not open the link. Find Pix on YouTube: @Pixverses');
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with back arrow */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Background Music</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Track selector ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Choose a Track</Text>

          {/* Playback mode — Loop this track vs. play the whole list in order */}
          <View style={[styles.segmented, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            {PLAYBACK_OPTIONS.map((option) => {
              const selected = playbackMode === option.mode;
              return (
                <TouchableOpacity
                  key={option.mode}
                  style={[styles.segment, selected && { backgroundColor: theme.colors.primary }]}
                  onPress={() => changePlaybackMode(option.mode)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={selected ? '#fff' : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: selected ? '#fff' : theme.colors.textSecondary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tracks.map((track) => {
            const active = track.key === currentBgmTrack;
            return (
              <TouchableOpacity
                key={track.key}
                style={[
                  styles.settingItem,
                  {
                    backgroundColor: theme.colors.card,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
                  },
                ]}
                onPress={() => changeBgmTrack(track.key)}
                activeOpacity={0.7}
              >
                <View style={styles.settingItemLeft}>
                  <View
                    style={[
                      styles.settingIconContainer,
                      { backgroundColor: active ? theme.colors.primary : `${theme.colors.primary}20` },
                    ]}
                  >
                    <Ionicons
                      name={active ? 'musical-notes' : 'musical-notes-outline'}
                      size={20}
                      color={active ? '#fff' : theme.colors.primary}
                    />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingText, { color: theme.colors.text }]}>{track.title}</Text>
                    <Text
                      style={[
                        styles.settingValue,
                        { color: active ? theme.colors.primary : theme.colors.text },
                      ]}
                    >
                      {active ? 'Now playing' : 'Tap to play'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={active ? theme.colors.primary : theme.colors.border}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Credits & Acknowledgements ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Credits & Acknowledgements</Text>

          <View style={[styles.creditsCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.creditsIconCircle, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Ionicons name="musical-notes" size={28} color={theme.colors.primary} />
            </View>

            <Text style={[styles.creditsLabel, { color: theme.colors.textSecondary }]}>Music by</Text>
            <Text style={[styles.creditsArtist, { color: theme.colors.text }]}>Pix</Text>
            <Text style={[styles.creditsHandle, { color: theme.colors.primary }]}>@Pixverses</Text>

            <Text style={[styles.creditsBlurb, { color: theme.colors.textSecondary }]}>
              Every background track in GaFI is composed by Pix. If you enjoy the music, show some
              love and support the artist on YouTube.
            </Text>

            <TouchableOpacity
              style={[styles.creditsButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleOpenPix}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-youtube" size={18} color="#fff" />
              <Text style={styles.creditsButtonText}>Visit YouTube Channel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
    marginHorizontal: 16,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 24,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },

  // Playback-mode segmented control (nested-pill: a track-card-style shell with
  // two equal segments; the active one fills with the brand orange).
  segmented: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  segmentText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    letterSpacing: 0.2,
  },

  // Track rows (mirrors SettingsScreen's settingItem styling)
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
    marginBottom: 2,
  },
  settingValue: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 18,
  },

  // Credits & Acknowledgements
  creditsCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  creditsIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  creditsLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  creditsArtist: {
    fontFamily: FONTS.headingBold,
    fontSize: 24,
    letterSpacing: -0.3,
  },
  creditsHandle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    marginTop: 2,
  },
  creditsBlurb: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  creditsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  creditsButtonText: {
    fontFamily: FONTS.bodySemiBold,
    color: '#fff',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});

export default BackgroundMusicScreen;
