import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { soundManager } from '../utils/soundManager';
import { CandyButton } from './candy/CandyButton';
import { CandyPanel } from './candy/CandyPanel';
import { showRewardedAd, adsAvailable } from '../ads/adManager';
import { CANDY_GOLD } from '../utils/theme';
import { DailyChallengeState } from '../utils/dailyChallenge';

export interface StreakShopResult {
  kind: 'hint' | 'undo' | 'skip' | 'repair';
  spentTierDays: number;
}

interface StreakShopModalProps {
  visible: boolean;
  dailyState: DailyChallengeState | null;
  consumables: { hints: number; undos: number; skipsUsed: number };
  canSkipHere: boolean;
  onClose: () => void;
  onPurchase: (item: StreakShopResult) => Promise<boolean>;
}

interface ShopItem {
  id: 'hint' | 'undo' | 'skip';
  tierCost: 1 | 3 | 5;
  label: string;
  subLabel: string;
  emoji: string;
  skin: 'grape' | 'blue' | 'orange';
}

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'hint',
    tierCost: 1,
    label: 'Free Hint',
    subLabel: 'Instant hint on ANY level, no ad',
    emoji: '🎯',
    skin: 'grape',
  },
  {
    id: 'undo',
    tierCost: 3,
    label: 'Undo a Mistake',
    subLabel: 'Wipe your last wrong tap + +1 heart',
    emoji: '↩️',
    skin: 'blue',
  },
  {
    id: 'skip',
    tierCost: 5,
    label: 'Skip This Level',
    subLabel: 'Progress forward (no stars earned)',
    emoji: '⏭️',
    skin: 'orange',
  },
];

export const StreakShopModal: React.FC<StreakShopModalProps> = ({
  visible,
  dailyState,
  consumables,
  canSkipHere,
  onClose,
  onPurchase,
}) => {
  const cardScale = useRef(new Animated.Value(0.82)).current;
  const flamePulse = useRef(new Animated.Value(1)).current;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streak = dailyState?.currentStreak || 0;
  const missedYesterday = useMemo(() => {
    if (!dailyState || !dailyState.lastPlayedDate) return false;
    if (dailyState.isCompletedToday) return false;
    const now = new Date();
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    return dailyState.lastPlayedDate !== yStr && dailyState.currentStreak === 0 && (dailyState.bestStreak || 0) >= 3;
  }, [dailyState]);

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      soundManager.play('button');
      cardScale.setValue(0.82);
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(flamePulse, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(flamePulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.delay(1400),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      setBusyId(null);
    }
  }, [visible, cardScale, flamePulse]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const canAfford = (tierCost: number) => streak >= tierCost;

  const handleBuy = async (item: ShopItem) => {
    if (busyId) return;
    if (item.id === 'skip' && !canSkipHere) {
      showToast('Enter a level first to skip it 🐾');
      return;
    }
    if (!canAfford(item.tierCost)) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      soundManager.play('wrong');
      showToast(`Need ${item.tierCost} day streak first — come back tomorrow!`);
      return;
    }
    setBusyId(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await onPurchase({
      kind: item.id,
      spentTierDays: item.tierCost,
    }).catch(() => false);
    if (ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      soundManager.play('combo');
      showToast(`${item.emoji} ${item.label} redeemed! 🐾`);
    } else {
      showToast('Streak update failed — try again.');
    }
    setBusyId(null);
  };

  const handleRepairStreak = async () => {
    if (busyId) return;
    setBusyId('repair');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    soundManager.play('button');

    let earned = false;
    if (adsAvailable()) {
      earned = await showRewardedAd().catch(() => false);
    }
    // Web / Expo Go fallback: simulate a watch reward so the UX isn't dead-ended.
    if (!earned && Platform.OS === 'web') {
      earned = new Promise<boolean>(r => setTimeout(() => r(true), 1600)).then(() => true) as unknown as boolean;
    }

    if (earned) {
      const ok = await onPurchase({ kind: 'repair', spentTierDays: 0 }).catch(() => false);
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        soundManager.play('complete');
        showToast('🔥 Streak repaired — welcome back!');
      } else {
        showToast('Couldn\'t restore streak now.');
      }
    } else {
      showToast('No ad available right now.');
    }
    setBusyId(null);
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <Animated.View
        style={[styles.shopContainer, { transform: [{ scale: cardScale }] }]}
      >
        <View style={styles.headerBar}>
          <Animated.Text
            style={[styles.flameIcon, { transform: [{ scale: flamePulse }] }]}
          >
            🔥
          </Animated.Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Streak Shop</Text>
            <Text style={styles.headerSubtitle}>
              Spend your daily streak for boosts. Never lose what you earned!
            </Text>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              soundManager.play('button');
              onClose();
            }}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        <CandyPanel contentStyle={[styles.streakSummary, styles.peachPanelBg]}>
          <View style={styles.streakMainRow}>
            <Text style={styles.streakBigNumber}>{streak}</Text>
            <View>
              <Text style={styles.streakBigLabel}>Day Streak</Text>
              <Text style={styles.streakBestEver}>
                Best ever {dailyState?.bestStreak || 0} days
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.consumablesColumn}>
              <View style={styles.consumableRow}>
                <Text style={[styles.consumableEmoji, styles.consumableSibling]}>🎯</Text>
                <Text style={styles.consumableCount}>{consumables.hints}</Text>
              </View>
              <View style={[styles.consumableRow, styles.consumableRowSecond]}>
                <Text style={[styles.consumableEmoji, styles.consumableSibling]}>↩️</Text>
                <Text style={styles.consumableCount}>{consumables.undos}</Text>
              </View>
            </View>
          </View>
        </CandyPanel>

        <View style={styles.shopItems}>
          {SHOP_ITEMS.map((item, idx) => {
            const affordable = canAfford(item.tierCost);
            const isSkipBlocked = item.id === 'skip' && !canSkipHere;
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                onPress={() => handleBuy(item)}
                disabled={!!busyId}
                style={idx > 0 ? styles.shopItemCardGap : undefined}
              >
                <CandyPanel
                  contentStyle={[
                    styles.shopItem,
                    !affordable && styles.shopItemDim,
                    isSkipBlocked && styles.shopItemDim,
                  ]}
                >
                  <Text style={[styles.itemEmoji, styles.itemEmojiSpacer]}>{item.emoji}</Text>
                  <View style={[styles.shopItemMiddleCol, { flex: 1 }]}>
                    <Text style={styles.itemTitle}>{item.label}</Text>
                    <Text style={styles.itemSub}>{item.subLabel}</Text>
                    <View style={costPillStyle(affordable)}>
                      <Text style={styles.costFire}>🔥</Text>
                      <Text style={[styles.costNum, affordable ? styles.costNumGood : styles.costNumBad]}>
                        {item.tierCost} days
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.shopItemButtonCol, { alignItems: 'center' }]}>
                    <CandyButton
                      size="md"
                      skin={item.skin}
                      label={busyId === item.id ? '...' : 'Redeem'}
                      disabled={!affordable || isSkipBlocked || !!busyId}
                    />
                  </View>
                </CandyPanel>
              </TouchableOpacity>
            );
          })}
        </View>

        {missedYesterday && (
          <CandyPanel contentStyle={[styles.repairCard, styles.goldPanelBg]}>
            <View style={styles.repairLeft}>
              <Text style={[styles.repairIcon, styles.repairIconSpacer]}>🛠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.repairTitle}>Broken streak yesterday?</Text>
                <Text style={styles.repairSub}>
                  Watch a quick ad → get your {dailyState?.bestStreak || ''}+ day streak back.
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'center' }}>
              <CandyButton
                size="md"
                skin="red"
                label={busyId === 'repair' ? undefined : 'Watch & Repair'}
                disabled={!!busyId}
              >
                {busyId === 'repair' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : null}
              </CandyButton>
            </View>
          </CandyPanel>
        )}

        {toast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

/** Dynamic style helper for the cost pill (cannot live inside StyleSheet.create
 *  since it accepts an affordable boolean param; applied directly inline). */
const costPillStyle = (affordable: boolean): React.ComponentProps<typeof View>['style'] => ({
  flexDirection: 'row',
  alignItems: 'center',
  alignSelf: 'flex-start',
  marginTop: 7,
  paddingVertical: 3,
  paddingHorizontal: 9,
  borderRadius: 10,
  backgroundColor: affordable ? '#FDECD6' : '#ECECF0',
  borderWidth: 1,
  borderColor: affordable ? '#F2B76F' : '#D0CCDA',
});

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14, 6, 32, 0.88)',
    justifyContent: 'center',
    alignItems: 'stretch',
    zIndex: 9000,
    paddingHorizontal: 14,
  },
  shopContainer: {
    backgroundColor: '#FFFDF7',
    borderRadius: 26,
    borderWidth: 3,
    borderColor: CANDY_GOLD.base,
    padding: 14,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 12,
    maxHeight: '88%',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    columnGap: 10,
  },
  flameIcon: { fontSize: 34 },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#3A2465',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6F5E8E',
    marginTop: 1,
    lineHeight: 16,
  },
  closeIcon: {
    fontSize: 18,
    color: '#6F5E8E',
    fontWeight: '800',
    paddingHorizontal: 6,
  },
  streakSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,230,210,0.55)',
    borderRadius: 14,
  },
  streakMainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  streakBigNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: '#C0392B',
    lineHeight: 44,
  },
  streakBigLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#8B3A00',
  },
  streakBestEver: {
    fontSize: 11,
    color: '#A26534',
    marginTop: 2,
  },
  consumablesColumn: {
    alignItems: 'center',
  },
  consumableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8D8BB',
  },
  consumableRowSecond: {
    // replaces consumablesColumn rowGap: 6 for legacy Android compat.
    marginTop: 6,
  },
  consumableSibling: {
    // replaces consumableRow columnGap: 4 for legacy Android compat.
    marginRight: 4,
  },
  consumableEmoji: { fontSize: 13 },
  consumableCount: {
    fontSize: 13,
    fontWeight: '900',
    color: '#402E5C',
  },
  shopItems: {
    marginTop: 10,
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopItemCardGap: {
    // Replaces .shopItems rowGap: 8 — applied to every TouchableOpacity card
    // AFTER the first via inline idx>0 style. Legacy Android compatible.
    marginTop: 8,
  },
  itemEmojiSpacer: {
    // replaces shopItem columnGap: 12 between emoji and middle column.
    marginRight: 12,
  },
  shopItemMiddleCol: {
    // replaces shopItem columnGap: 12 between middle column and right button.
    marginRight: 12,
  },
  shopItemButtonCol: {
    // no-op placeholder for symmetry; gap was consumed by middle/right spacer.
  },
  shopItemDim: { opacity: 0.52 },
  itemEmoji: { fontSize: 34 },
  itemTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#3A2465',
  },
  itemSub: {
    fontSize: 12,
    color: '#6F5E8E',
    lineHeight: 16,
    marginTop: 2,
  },
  costFire: { fontSize: 13, marginRight: 3 },
  costNum: { fontSize: 12, fontWeight: '900' },
  costNumGood: { color: '#B5530C' },
  costNumBad: { color: '#7F798A' },
  /** Background tint applied to the streak summary panel (replaces the unused
   *  `skin="peach"` prop that CandyPanel never implemented). */
  peachPanelBg: {
    backgroundColor: 'rgba(255, 227, 186, 0.55)',
  },
  /** Tint for the broken-streak repair panel (replaces `skin="gold"`). */
  goldPanelBg: {
    backgroundColor: 'rgba(253, 224, 130, 0.25)',
  },
  repairCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(253, 216, 92, 0.35)',
    paddingHorizontal: 2,
  },
  repairLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  repairIcon: { fontSize: 32 },
  repairIconSpacer: {
    // replaces repairLeft columnGap: 10 for legacy Android compat.
    marginRight: 10,
  },
  repairTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#7A4F01',
  },
  repairSub: {
    fontSize: 12,
    color: '#9C7536',
    lineHeight: 16,
    marginTop: 2,
  },
  toast: {
    marginTop: 10,
    alignSelf: 'center',
    backgroundColor: '#2A9D8F',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
