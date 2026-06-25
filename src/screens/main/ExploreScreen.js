// src/screens/main/ExploreScreen.js
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Image } from 'expo-image';
import { FONTS } from '../../theme/typography';
import EconomyService from '../../services/EconomyService';
import { useSproutMultiplier } from '../../hooks/useSproutMultiplier';

const { width } = Dimensions.get('window');
// 2-column grid: 20px page padding each side + 16px gap between cards.
const CARD_WIDTH = (width - 56) / 2;

// --- Content -----------------------------------------------------------------
// The hub is grouped so structure carries meaning: a live event up top, the new
// gamified surfaces in the middle, the existing social/competitive tools last.

const SPOTLIGHT = {
  id: 'saga',
  eyebrow: 'Limited event',
  title: 'Harvest of Thrift',
  subtitle: 'Beat your budget this week to earn season-only rewards.',
  cta: 'Join the Saga',
  screen: 'SeasonalSaga',
};

const ADVENTURE_ITEMS = [
  {
    id: 'boutique',
    title: "Koin's Boutique",
    subtitle: 'Dress up your buddy',
    icon: 'shirt',
    color: '#E91E63',
    screen: 'KoinBoutique',
  },
  {
    id: 'guilds',
    title: 'Savings Guilds',
    subtitle: 'Save with friends',
    icon: 'shield',
    color: '#2EC4B6',
    screen: 'SavingsGuilds',
    badge: 'SOON',
  },
  {
    id: 'chronicle',
    title: 'The Chronicle',
    subtitle: 'Unlock the lore',
    icon: 'book',
    color: '#7C5CFC',
    screen: 'Chronicle',
    badge: 'SOON',
  },
  {
    id: 'trading',
    title: 'Trading Post',
    subtitle: 'Spend your Sprouts',
    icon: 'storefront',
    color: '#F5A623',
    screen: 'TradingPost',
  },
];

const COMPETE_ITEMS = [
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    subtitle: 'Compare savings',
    icon: 'podium',
    color: '#9C27B0',
    screen: 'Leaderboard',
  },
  {
    id: 'achievements',
    title: 'Achievements',
    subtitle: 'Your milestones',
    icon: 'ribbon',
    color: '#F2B705',
    screen: 'Achievements',
  },
  {
    id: 'friends',
    title: 'Manage Friends',
    subtitle: 'Add & view friends',
    icon: 'people',
    color: '#2196F3',
    screen: 'ManageFriends',
  },
];

// --- Presentational pieces (module scope → not re-created per render) ---------

const SectionHeader = ({ label, theme }) => (
  <View style={styles.sectionHeader}>
    <View style={[styles.sectionTick, { backgroundColor: theme.colors.primary }]} />
    <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
      {label}
    </Text>
  </View>
);

const FeatureCard = ({ item, theme, onPress }) => (
  <Pressable
    onPress={onPress}
    android_ripple={{ color: item.color + '22', borderless: false }}
    style={[
      styles.card,
      { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
    ]}
  >
    <View style={styles.cardTopRow}>
      <View style={[styles.iconChip, { backgroundColor: item.color + '1F' }]}>
        <Ionicons name={item.icon} size={22} color={item.color} />
      </View>
      {item.badge ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.textSecondary + '1A' }]}>
          <Text style={[styles.badgeText, { color: theme.colors.textSecondary }]}>
            {item.badge}
          </Text>
        </View>
      ) : null}
    </View>
    <Text style={[styles.cardTitle, { color: theme.colors.text }]} numberOfLines={1}>
      {item.title}
    </Text>
    <Text
      style={[styles.cardSubtitle, { color: theme.colors.textSecondary }]}
      numberOfLines={1}
    >
      {item.subtitle}
    </Text>
  </Pressable>
);

// --- Screen ------------------------------------------------------------------

const ExploreScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  // Live Sprouts balance. useFocusEffect (not useEffect) so it re-reads every time
  // the user returns to this tab — e.g. after earning Sprouts in the Game or
  // spending them in the Boutique, the wallet is correct without a manual refresh.
  const [sprouts, setSprouts] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const balance = await EconomyService.getSproutsBalance(user?.id);
        if (active) setSprouts(balance);
      })();
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  // Live 2x buff (Double Sprout Token) → drives the glowing badge on the wallet.
  const boost = useSproutMultiplier(user?.id);

  const go = useCallback(
    (screen) => {
      if (screen) navigation.navigate(screen);
    },
    [navigation],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerTop}>
          <Image
            source={require('../../../assets/GaFi_Logo_Mark.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityRole="image"
            accessibilityLabel="GaFi logo"
          />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Explore</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Your adventure hub
            </Text>
          </View>
          {/* Sprouts wallet — the spine of the in-game economy. Taps through to the
              Boutique, the live place to actually spend the balance. */}
          <Pressable
            onPress={() => go('KoinBoutique')}
            android_ripple={{ color: theme.colors.primary + '22', borderless: false }}
            style={[
              styles.wallet,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              boost.active
                ? `${sprouts} Sprouts, 2x earning active with ${boost.label} left. Open Koin's Boutique`
                : `${sprouts} Sprouts. Open Koin's Boutique`
            }
          >
            <Ionicons name="leaf" size={15} color={theme.colors.success} />
            <Text style={[styles.walletValue, { color: theme.colors.text }]}>
              {sprouts}
            </Text>
            {/* 2x glow — the one place we spend boldness: a warm, lit chip that says
                real-world logging is currently boosted. */}
            {boost.active ? (
              <View style={styles.boostBadge}>
                <Text style={styles.boostBadgeText}>2×</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* SPOTLIGHT — the hero. Opens with Koin: the most characteristic thing
            in GaFi's world, framed as a live, time-boxed reason to come back. */}
        <SectionHeader label="Spotlight" theme={theme} />
        <Pressable
          onPress={() => go(SPOTLIGHT.screen)}
          android_ripple={{ color: '#FFFFFF22', borderless: false }}
          style={[styles.hero, { backgroundColor: theme.colors.primary }]}
        >
          {/* Soft glow behind Koin → reads as a spotlight, no gradient dep. */}
          <View style={[styles.heroGlow, { backgroundColor: theme.colors.secondary }]} />
          <Image
            source={require('../../../assets/mascot/Koin.png')}
            style={styles.heroKoin}
            contentFit="contain"
            accessibilityRole="image"
            accessibilityLabel="Koin"
          />
          <View style={styles.heroBody}>
            <Text style={styles.heroEyebrow}>{SPOTLIGHT.eyebrow.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{SPOTLIGHT.title}</Text>
            <Text style={styles.heroSubtitle}>{SPOTLIGHT.subtitle}</Text>
            <View style={styles.heroCta}>
              <Text style={[styles.heroCtaText, { color: theme.colors.primary }]}>
                {SPOTLIGHT.cta}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
            </View>
          </View>
        </Pressable>

        {/* ADVENTURE — the new gamified surfaces. */}
        <SectionHeader label="Adventure" theme={theme} />
        <View style={styles.grid}>
          {ADVENTURE_ITEMS.map((item) => (
            <FeatureCard
              key={item.id}
              item={item}
              theme={theme}
              onPress={() => go(item.screen)}
            />
          ))}
        </View>

        {/* COMPETE — the existing social / competitive tools. */}
        <SectionHeader label="Compete" theme={theme} />
        <View style={styles.grid}>
          {COMPETE_ITEMS.map((item) => (
            <FeatureCard
              key={item.id}
              item={item}
              theme={theme}
              onPress={() => go(item.screen)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 26,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    marginTop: 1,
  },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  walletValue: {
    fontFamily: FONTS.numberBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  boostBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFD54A',
    // Warm glow so it reads as "lit" — Android elevation + iOS shadow.
    shadowColor: '#F5A623',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  boostBadgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: '#1C1C1C',
    fontVariant: ['tabular-nums'],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTick: {
    width: 4,
    height: 14,
    borderRadius: 2,
  },
  sectionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // Hero
  hero: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 28,
    minHeight: 150,
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -40,
    top: -60,
    opacity: 0.35,
  },
  heroKoin: {
    position: 'absolute',
    width: 130,
    height: 130,
    right: 6,
    bottom: -6,
  },
  heroBody: {
    width: '68%',
  },
  heroEyebrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: FONTS.headingBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 14,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroCtaText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
  // Grid + cards
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 132,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  iconChip: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  cardSubtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },
});

export default ExploreScreen;
