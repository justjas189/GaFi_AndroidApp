// src/screens/main/BoutiqueScreen.js
//
// Koin's Boutique — the first real Sprouts sink. Browse character skins, buy them
// with Sprouts (EconomyService.spendSprouts), and equip one as your in-game buddy.
//
// State model (no new tables): cosmetics already live on `character_customizations`:
//   • unlocked_characters  → the skins you OWN  (defaults: girl + jasper)
//   • selected_character   → the skin you have EQUIPPED
// We read/write them through gameDatabaseService, the same plumbing the Game tab's
// Closet uses, so a skin equipped here shows up on the player character in the Game.
//
// Button states per card: Buy (price 🌱) → Equip → Equipped (disabled).

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { FONTS } from '../../theme/typography';
import EconomyService from '../../services/EconomyService';
import gameDatabaseService from '../../services/GameDatabaseService';
import { toast } from '../../utils/toast';
import { COSMETICS, DEFAULT_OWNED_KEYS } from '../../data/cosmetics';

const { width } = Dimensions.get('window');
// 2-column grid: 20px page padding each side + 14px gap between cards.
const CARD_WIDTH = (width - 54) / 2;

// Skins owned by everyone from day one — equippable but never bought. Sourced from
// the shared catalogue so the Boutique, Store, and Closet agree on the defaults.
const DEFAULT_OWNED = DEFAULT_OWNED_KEYS;

// The Boutique catalogue now lives in src/data/cosmetics.js (single source of truth
// for all three skin surfaces). `characterKey` maps each item to GameScreen's
// CHARACTER_SPRITES and to character_customizations.selected_character, which is
// what makes an equipped skin actually appear on the player.

// --- Card (module scope + memo → only re-renders when its own props change) -----

const SkinCard = React.memo(function SkinCard({
  item,
  theme,
  status,      // 'equipped' | 'owned' | 'locked'
  canAfford,
  busy,
  onBuy,
  onEquip,
}) {
  const equipped = status === 'equipped';
  const owned = status === 'owned';

  // One CTA that morphs by status. Each branch is its own button so the styling
  // and accessibility state stay honest (no half-disabled mystery buttons).
  let cta;
  if (busy) {
    cta = (
      <View style={[styles.cta, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  } else if (equipped) {
    cta = (
      <View
        style={[styles.cta, { backgroundColor: theme.colors.success + '22' }]}
        accessibilityRole="button"
        accessibilityState={{ disabled: true, selected: true }}
        accessibilityLabel={`${item.name} equipped`}
      >
        <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
        <Text style={[styles.ctaText, { color: theme.colors.success }]}>Equipped</Text>
      </View>
    );
  } else if (owned) {
    cta = (
      <Pressable
        onPress={() => onEquip(item)}
        android_ripple={{ color: theme.colors.primary + '22' }}
        style={[styles.cta, styles.ctaOutline, { borderColor: theme.colors.primary }]}
        accessibilityRole="button"
        accessibilityLabel={`Equip ${item.name}`}
      >
        <Text style={[styles.ctaText, { color: theme.colors.primary }]}>Equip</Text>
      </Pressable>
    );
  } else {
    // Locked → buy. Dimmed when unaffordable, but still pressable so the tap can
    // explain the shortfall instead of being a dead button.
    cta = (
      <Pressable
        onPress={() => onBuy(item)}
        android_ripple={{ color: '#FFFFFF22' }}
        style={[
          styles.cta,
          { backgroundColor: theme.colors.primary, opacity: canAfford ? 1 : 0.45 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Buy ${item.name} for ${item.price} Sprouts`}
      >
        <Ionicons name="leaf" size={14} color="#FFFFFF" />
        <Text style={styles.ctaText}>Buy · {item.price}</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: equipped ? theme.colors.success : theme.colors.border,
          borderWidth: equipped ? 2 : 1,
        },
      ]}
    >
      {/* Pedestal — the signature: each skin stands on a plinth tinted with its
          own character colour, displaying the real in-game walk sprite. */}
      <View style={[styles.pedestal, { backgroundColor: item.color + '1F' }]}>
        <Image
          source={item.sprite}
          style={styles.sprite}
          contentFit="cover"
          accessibilityRole="image"
          accessibilityLabel={`${item.name} preview`}
        />
        {item.price === 0 && status !== 'equipped' ? (
          <View style={[styles.starterTag, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.starterTagText, { color: theme.colors.textSecondary }]}>
              STARTER
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
        {item.icon} {item.name}
      </Text>
      <Text
        style={[styles.blurb, { color: theme.colors.textSecondary }]}
        numberOfLines={2}
      >
        {item.description}
      </Text>

      {cta}
    </View>
  );
});

// --- Screen ---------------------------------------------------------------------

const BoutiqueScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [sprouts, setSprouts] = useState(0);
  const [owned, setOwned] = useState(DEFAULT_OWNED);
  const [equipped, setEquipped] = useState('girl');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // item id mid buy/equip

  // Refresh balance + ownership every time the screen gains focus, so the wallet
  // reflects Sprouts earned elsewhere and ownership stays in sync with the Closet.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!user?.id) {
          if (active) setLoading(false);
          return;
        }
        try {
          const [balance, custom] = await Promise.all([
            EconomyService.getSproutsBalance(user.id),
            gameDatabaseService.loadCharacterCustomization(),
          ]);
          if (!active) return;
          setSprouts(balance);
          const unlocked = Array.isArray(custom?.unlocked_characters)
            ? custom.unlocked_characters
            : [];
          setOwned(Array.from(new Set([...DEFAULT_OWNED, ...unlocked])));
          setEquipped(custom?.selected_character || 'girl');
        } catch (err) {
          console.warn('⚠️ Boutique refresh failed:', err?.message);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [user?.id]),
  );

  const handleBuy = useCallback(
    async (item) => {
      if (!user?.id || owned.includes(item.characterKey) || busyId) return;

      if (sprouts < item.price) {
        toast.error(
          'Not enough Sprouts',
          `You need ${item.price - sprouts} more to unlock ${item.name}.`,
        );
        return;
      }

      setBusyId(item.id);

      // Deduct first — the Sprouts balance is the source of truth. Never grant the
      // skin if the spend didn't go through.
      const res = await EconomyService.spendSprouts(user.id, item.price, `skin:${item.id}`);
      if (!res.success) {
        setBusyId(null);
        toast.error(
          'Purchase failed',
          res.error === 'insufficient_funds'
            ? 'Not enough Sprouts.'
            : 'Something went wrong. Please try again.',
        );
        return;
      }

      const newOwned = Array.from(new Set([...owned, item.characterKey]));
      setSprouts(res.balance);
      setOwned(newOwned);

      // Persist ownership. Leaving selectedCharacter undefined keeps the current
      // equip untouched (buying ≠ equipping). The Closet/AchievementDashboard read
      // ownership from this same unlocked_characters list.
      await gameDatabaseService.saveCharacterCustomization({ unlockedCharacters: newOwned });

      setBusyId(null);
      toast.success(`Unlocked ${item.name}`, 'Tap Equip to wear it now.');
    },
    [user?.id, owned, sprouts, busyId],
  );

  const handleEquip = useCallback(
    async (item) => {
      if (!user?.id || equipped === item.characterKey || busyId) return;
      if (!owned.includes(item.characterKey)) return;

      setBusyId(item.id);
      setEquipped(item.characterKey); // optimistic — the constraint migration makes the write reliable

      await gameDatabaseService.saveCharacterCustomization({
        selectedCharacter: item.characterKey,
        unlockedCharacters: owned,
      });

      setBusyId(null);
      toast.success(`${item.name} equipped`, 'Your buddy is updated in the Game tab.');
    },
    [user?.id, owned, equipped, busyId],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Header — modal-presented screen, so it owns its own back affordance. */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          android_ripple={{ color: theme.colors.text + '15', borderless: true, radius: 22 }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Koin's Boutique</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Dress up your buddy
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Wallet banner — Koin minding the counter. The balance is the hero: it
              gates everything below it. */}
          <View style={[styles.wallet, { backgroundColor: theme.colors.primary }]}>
            <View style={[styles.walletGlow, { backgroundColor: theme.colors.secondary }]} />
            <Image
              source={require('../../../assets/mascot/Koin.png')}
              style={styles.walletKoin}
              contentFit="contain"
              accessibilityRole="image"
              accessibilityLabel="Koin"
            />
            <View style={styles.walletBody}>
              <Text style={styles.walletEyebrow}>YOUR WALLET</Text>
              <View style={styles.walletAmountRow}>
                <Ionicons name="leaf" size={22} color="#FFFFFF" />
                <Text style={styles.walletAmount}>{sprouts}</Text>
                <Text style={styles.walletUnit}>Sprouts</Text>
              </View>
              <Text style={styles.walletHint}>
                Earn more by logging expenses and passing weeks.
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTick, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              Characters
            </Text>
          </View>

          <View style={styles.grid}>
            {COSMETICS.map((item) => {
              const isEquipped = equipped === item.characterKey;
              const isOwned = owned.includes(item.characterKey);
              const status = isEquipped ? 'equipped' : isOwned ? 'owned' : 'locked';
              return (
                <SkinCard
                  key={item.id}
                  item={item}
                  theme={theme}
                  status={status}
                  canAfford={sprouts >= item.price}
                  busy={busyId === item.id}
                  onBuy={handleBuy}
                  onEquip={handleEquip}
                />
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 4,
  },
  title: {
    fontFamily: FONTS.headingBold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    marginTop: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  // Wallet banner
  wallet: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 28,
    minHeight: 132,
  },
  walletGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    right: -40,
    top: -60,
    opacity: 0.35,
  },
  walletKoin: {
    position: 'absolute',
    width: 116,
    height: 116,
    right: 8,
    bottom: -4,
  },
  walletBody: {
    width: '66%',
  },
  walletEyebrow: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  walletAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletAmount: {
    fontFamily: FONTS.numberBold,
    fontSize: 34,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  walletUnit: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
  },
  walletHint: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
  },
  // Section header (mirrors ExploreScreen)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
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
  // Grid + cards
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  card: {
    width: CARD_WIDTH,
    padding: 12,
    borderRadius: 18,
  },
  pedestal: {
    height: 96,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  sprite: {
    width: 72,
    height: 72,
  },
  starterTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  starterTagText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 8,
    letterSpacing: 0.8,
  },
  name: {
    fontFamily: FONTS.headingSemiBold,
    fontSize: 15,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  blurb: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    marginBottom: 12,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 12,
    marginTop: 'auto',
  },
  ctaOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    minHeight: 38,
  },
  ctaText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
    
  },
});

export default BoutiqueScreen;
