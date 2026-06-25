// src/screens/main/TradingPostScreen.js
//
// The Trading Post — the second real Sprouts sink (after Koin's Boutique). Where the
// Boutique sells one-time character skins, the Trading Post sells CONSUMABLE power-ups
// the user can stack: buying one deducts Sprouts (EconomyService) and adds +1 to the
// inventory count (InventoryService). Each card shows how many you already own.
//
// Design language carries over from the Boutique — same Koin wallet banner and section
// header — but the wares sit on full-width "shelf" cards (vs. the Boutique's skin grid)
// to signal a different kind of good: a tinted tile per item, a live "Owned · X" stock
// pill, and a per-item-coloured Buy button.

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { FONTS } from '../../theme/typography';
import EconomyService from '../../services/EconomyService';
import InventoryService from '../../services/InventoryService';
import { useSproutMultiplier } from '../../hooks/useSproutMultiplier';
import { toast } from '../../utils/toast';
import { POWERUPS } from '../../data/powerups';

// --- Card (module scope + memo → only re-renders when its own props change) -----

const PowerUpCard = React.memo(function PowerUpCard({
  item,
  theme,
  owned,
  canAfford,
  busy,
  onBuy,
  multiplierActive,
  boostLabel,
  activating,
  onActivate,
}) {
  // The "Use" affordance shows only for wired, owned consumables (today: the Double
  // Sprout Token). While its buff runs it flips to a live status chip instead.
  const showUse = item.activatable && (multiplierActive || owned > 0);
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.cardTop}>
        {/* Tinted tile — each ware wears its own colour, turning the list into a
            shelf of distinct goods rather than a row of identical chips. */}
        <View style={[styles.iconTile, { backgroundColor: item.color + '1F' }]}>
          <Ionicons name={item.icon} size={26} color={item.color} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {/* Stock pill — the live "Owned · X" the brief calls for. Tinted when
                you hold at least one so a stocked item reads at a glance. */}
            <View
              style={[
                styles.ownedPill,
                owned > 0
                  ? { backgroundColor: item.color + '22' }
                  : { backgroundColor: theme.colors.textSecondary + '14' },
              ]}
            >
              <Text
                style={[
                  styles.ownedText,
                  { color: owned > 0 ? item.color : theme.colors.textSecondary },
                ]}
              >
                Owned · {owned}
              </Text>
            </View>
          </View>
          <Text style={[styles.blurb, { color: theme.colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        </View>
      </View>

      {/* Actions — an optional "Use" (left) sits beside the always-present Buy (right).
          Both flex:1, so a lone Buy fills the row. */}
      <View style={styles.actions}>
        {showUse ? (
          multiplierActive ? (
            // Buff live → status chip, not a button. Reads at a glance, no tap.
            <View style={[styles.useChip, { backgroundColor: item.color + '22' }]}>
              <Ionicons name="flash" size={14} color={item.color} />
              <Text style={[styles.useChipText, { color: item.color }]} numberOfLines={1}>
                2× · {boostLabel}
              </Text>
            </View>
          ) : activating ? (
            <View style={[styles.useBtn, { borderColor: item.color }]}>
              <ActivityIndicator size="small" color={item.color} />
            </View>
          ) : (
            <Pressable
              onPress={() => onActivate(item)}
              android_ripple={{ color: item.color + '22' }}
              style={[styles.useBtn, { borderColor: item.color }]}
              accessibilityRole="button"
              accessibilityLabel={`Use one ${item.name}`}
            >
              <Ionicons name="flash" size={14} color={item.color} />
              <Text style={[styles.useBtnText, { color: item.color }]}>Use</Text>
            </Pressable>
          )
        ) : null}

        {/* Buy — consumables are always buyable (stack multiples). Dimmed, but still
            pressable, when short so the tap can explain the shortfall. */}
        {busy ? (
          <View style={[styles.cta, { backgroundColor: theme.colors.surface }]}>
            <ActivityIndicator size="small" color={item.color} />
          </View>
        ) : (
          <Pressable
            onPress={() => onBuy(item)}
            android_ripple={{ color: '#FFFFFF22' }}
            style={[styles.cta, { backgroundColor: item.color, opacity: canAfford ? 1 : 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel={`Buy ${item.name} for ${item.price} Sprouts`}
          >
            <Ionicons name="leaf" size={14} color="#FFFFFF" />
            <Text style={styles.ctaText}>Buy · {item.price}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

// --- Screen ---------------------------------------------------------------------

const TradingPostScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [sprouts, setSprouts] = useState(0);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null); // item id mid-purchase
  const [activatingId, setActivatingId] = useState(null); // item id mid-activation

  // Live 2x buff status (shared with the Explore wallet via the same hook).
  const boost = useSproutMultiplier(user?.id);

  // Refresh balance + inventory on every focus, so the wallet reflects Sprouts earned
  // elsewhere and the owned counts stay correct after returning to the screen.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!user?.id) {
          if (active) setLoading(false);
          return;
        }
        try {
          const [balance, inv] = await Promise.all([
            EconomyService.getSproutsBalance(user.id),
            InventoryService.getInventory(user.id),
          ]);
          if (!active) return;
          setSprouts(balance);
          setInventory(inv || {});
        } catch (err) {
          console.warn('⚠️ Trading Post refresh failed:', err?.message);
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
      if (!user?.id || busyId) return;

      if (sprouts < item.price) {
        toast.error(
          'Not enough Sprouts',
          `You need ${item.price - sprouts} more to buy ${item.name}.`,
        );
        return;
      }

      setBusyId(item.id);

      const res = await InventoryService.buyItem(user.id, item);
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

      setSprouts(res.balance);
      setInventory(res.inventory);
      setBusyId(null);

      const count = res.inventory[item.id] || 0;
      toast.success(`${item.name} added`, `You now have ${count} in your inventory.`);
    },
    [user?.id, sprouts, busyId],
  );

  const refreshBoost = boost.refresh;
  const handleActivate = useCallback(
    async (item) => {
      if (!user?.id || activatingId) return;

      setActivatingId(item.id);
      // The service is the authority on whether a buff is already running, so no
      // local guard here — it keeps this handler off the fast-changing boost object.
      const res = await InventoryService.activateDoubleSprouts(user.id);
      setActivatingId(null);

      if (res.inventory) setInventory(res.inventory);

      if (!res.success) {
        if (res.error === 'already_active') {
          await refreshBoost();
          toast.info('Already boosted', '2× earning is already running.');
        } else if (res.error === 'not_owned') {
          toast.error('None to use', `Buy a ${item.name} first.`);
        } else {
          toast.error("Couldn't activate", 'Something went wrong. Please try again.');
        }
        return;
      }

      await refreshBoost();
      toast.success('2× Sprouts active!', 'Everything you earn is doubled for 24 hours.');
    },
    [user?.id, activatingId, refreshBoost],
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
          <Text style={[styles.title, { color: theme.colors.text }]}>Trading Post</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Spend Sprouts on power-ups
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
          {/* Wallet banner — Koin minding the counter; the balance gates every Buy. */}
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
              {boost.active ? (
                // Buff running → swap the generic hint for a live boost pill so the
                // 24h window is impossible to miss while it counts down.
                <View style={styles.walletBoost}>
                  <Ionicons name="flash" size={13} color="#1C1C1C" />
                  <Text style={styles.walletBoostText}>2× earning · {boost.label} left</Text>
                </View>
              ) : (
                <Text style={styles.walletHint}>
                  Stock up to protect your streak and keep your progress on track.
                </Text>
              )}
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={[styles.sectionTick, { backgroundColor: theme.colors.primary }]} />
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              Power-ups
            </Text>
          </View>

          <View style={styles.list}>
            {POWERUPS.map((item) => (
              <PowerUpCard
                key={item.id}
                item={item}
                theme={theme}
                owned={inventory[item.id] || 0}
                canAfford={sprouts >= item.price}
                busy={busyId === item.id}
                onBuy={handleBuy}
                multiplierActive={item.id === 'double_sprouts' && boost.active}
                boostLabel={item.activatable ? boost.label : undefined}
                activating={activatingId === item.id}
                onActivate={handleActivate}
              />
            ))}
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
  // Wallet banner (shared design with the Boutique)
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
  // Section header (mirrors ExploreScreen / Boutique)
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
  // Shelf list + cards
  list: {
    gap: 14,
  },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 14,
  },
  iconTile: {
    width: 54,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontFamily: FONTS.headingSemiBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  ownedPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  ownedText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  blurb: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  // Action row — Use (optional) + Buy share the width.
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
  },
  ctaText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  useBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  useBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
  useChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
  },
  useChipText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  // Wallet boost pill (replaces the hint while the 2x buff runs)
  walletBoost: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFD54A',
  },
  walletBoostText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: '#1C1C1C',
    fontVariant: ['tabular-nums'],
  },
});

export default TradingPostScreen;
