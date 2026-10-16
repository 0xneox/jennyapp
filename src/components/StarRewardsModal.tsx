import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { soundManager } from '../utils/soundManager';
import { CandyButton } from './candy/CandyButton';
import { CandyPanel } from './candy/CandyPanel';
import { CANDY_GOLD } from '../utils/theme';
import {
  getAllStarMilestones,
  getNextStarMilestone,
  StarMilestone,
} from '../utils/starRewards';
import { loadClaimedStarMilestones } from '../utils/storage';

interface StarRewardsModalProps {
  visible: boolean;
  totalStars: number;
  consumableHints: number;
  consumableUndos: number;
  onClose: () => void;
}

export const StarRewardsModal: React.FC<StarRewardsModalProps> = ({
  visible,
  totalStars,
  consumableHints,
  consumableUndos,
  onClose,
}) => {
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const starPulse = useRef(new Animated.Value(1)).current;
  const [claimedList, setClaimedList] = useState<number[]>([]);

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      soundManager.play('button');
      loadClaimedStarMilestones().then(setClaimedList).catch(() => {});

      cardScale.setValue(0.85);
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start();

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(starPulse, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(starPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.delay(1200),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [visible, cardScale, starPulse]);

  if (!visible) return null;

  const allMilestones = getAllStarMilestones().slice(0, 15); // Show first 15 milestones
  const nextMilestone = getNextStarMilestone(totalStars);
  const claimedSet = new Set(claimedList);

  // Progress to next milestone
  const prevRequired = (() => {
    const sortedClaimed = [...claimedList].sort((a, b) => b - a);
    return sortedClaimed[0] || 0;
  })();

  const nextRequired = nextMilestone ? nextMilestone.starsRequired : (allMilestones[allMilestones.length - 1]?.starsRequired || 100);
  const progressRatio = nextMilestone
    ? Math.min(1, Math.max(0, (totalStars - prevRequired) / Math.max(1, nextRequired - prevRequired)))
    : 1;

  return (
    <View style={styles.modalOverlay}>
      <Animated.View style={[styles.container, { transform: [{ scale: cardScale }] }]}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Animated.Text style={[styles.starHeroIcon, { transform: [{ scale: starPulse }] }]}>
            ⭐
          </Animated.Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerTitle}>Star Rewards</Text>
            <Text style={styles.headerSubtitle}>
              Earn stars on levels to unlock free hints & perks!
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

        {/* Current Stars & Progress Card */}
        <CandyPanel contentStyle={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.starsCountText}>{totalStars} ⭐</Text>
              <Text style={styles.starsCountLabel}>Total Stars Collected</Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.backpackCol}>
              <View style={styles.backpackPill}>
                <Text style={styles.backpackEmoji}>🎯</Text>
                <Text style={styles.backpackNum}>{consumableHints} hints</Text>
              </View>
              {consumableUndos > 0 && (
                <View style={[styles.backpackPill, { marginTop: 4 }]}>
                  <Text style={styles.backpackEmoji}>↩️</Text>
                  <Text style={styles.backpackNum}>{consumableUndos} undos</Text>
                </View>
              )}
            </View>
          </View>

          {/* Progress Bar toward next milestone */}
          {nextMilestone ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>
                  Next Reward: <Text style={{ fontWeight: '700', color: '#B45309' }}>{nextMilestone.starsRequired} ⭐</Text>
                </Text>
                <Text style={styles.progressRemaining}>
                  {Math.max(0, nextMilestone.starsRequired - totalStars)} more needed
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round(progressRatio * 100)}%` },
                  ]}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.allClaimedText}>🎉 All current star milestones achieved!</Text>
          )}
        </CandyPanel>

        {/* Scrollable Milestones Roadmap */}
        <Text style={styles.roadmapHeading}>Milestones Roadmap</Text>
        <ScrollView style={styles.milestoneList} showsVerticalScrollIndicator={false}>
          {allMilestones.map((m: StarMilestone) => {
            const isClaimed = claimedSet.has(m.starsRequired) || totalStars >= m.starsRequired;
            const isNext = nextMilestone && nextMilestone.starsRequired === m.starsRequired;

            return (
              <View
                key={m.starsRequired}
                style={[
                  styles.milestoneItem,
                  isClaimed && styles.milestoneClaimed,
                  isNext && styles.milestoneNext,
                ]}
              >
                <View style={styles.milestoneIconCol}>
                  <Text style={styles.milestoneBadgeEmoji}>{m.badgeEmoji}</Text>
                  <Text style={styles.milestoneReqStars}>{m.starsRequired} ⭐</Text>
                </View>

                <View style={styles.milestoneInfoCol}>
                  <Text style={[styles.milestoneTitle, isClaimed && styles.titleClaimed]}>
                    {m.title}
                  </Text>
                  <View style={styles.rewardsRow}>
                    <Text style={styles.rewardText}>+{m.hints} Hints 🎯</Text>
                    {m.undos > 0 && <Text style={[styles.rewardText, { marginLeft: 8 }]}>+{m.undos} Undo ↩️</Text>}
                  </View>
                </View>

                <View style={styles.milestoneStatusCol}>
                  {isClaimed ? (
                    <View style={styles.statusBadgeClaimed}>
                      <Text style={styles.statusTextClaimed}>Claimed ✅</Text>
                    </View>
                  ) : isNext ? (
                    <View style={styles.statusBadgeNext}>
                      <Text style={styles.statusTextNext}>Next Up 🌟</Text>
                    </View>
                  ) : (
                    <View style={styles.statusBadgeLocked}>
                      <Text style={styles.statusTextLocked}>Locked 🔒</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Footer Button */}
        <View style={styles.footer}>
          <CandyButton
            block
            size="md"
            skin="green"
            label="Awesome!"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              soundManager.play('button');
              onClose();
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FDE68A',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  starHeroIcon: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#78350F',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 2,
  },
  closeIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9CA3AF',
    padding: 4,
  },
  summaryCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsCountText: {
    fontSize: 24,
    fontWeight: '900',
    color: CANDY_GOLD.base,
  },
  starsCountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
    marginTop: 2,
  },
  backpackCol: {
    alignItems: 'flex-end',
  },
  backpackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  backpackEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  backpackNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  progressContainer: {
    marginTop: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: '#78350F',
  },
  progressRemaining: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#FDE68A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  allClaimedText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center',
  },
  roadmapHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#78350F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  milestoneList: {
    maxHeight: 250,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  milestoneClaimed: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  milestoneNext: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1.5,
  },
  milestoneIconCol: {
    alignItems: 'center',
    width: 48,
  },
  milestoneBadgeEmoji: {
    fontSize: 18,
  },
  milestoneReqStars: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 2,
  },
  milestoneInfoCol: {
    flex: 1,
    marginLeft: 8,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  titleClaimed: {
    color: '#065F46',
  },
  rewardsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  milestoneStatusCol: {
    marginLeft: 8,
  },
  statusBadgeClaimed: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusTextClaimed: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  statusBadgeNext: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusTextNext: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  statusBadgeLocked: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusTextLocked: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  footer: {
    marginTop: 12,
  },
});
