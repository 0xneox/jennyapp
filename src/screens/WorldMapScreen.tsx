import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { CHAPTERS } from '../data/chapterData';
import { getTotalStats, getTotalScore, GameStats } from '../utils/statistics';
import { soundManager } from '../utils/soundManager';
import {
  DailyChallengeState,
  getDailyChallengeState,
} from '../utils/dailyChallenge';
import { showRewardedAd, adsAvailable } from '../ads/adManager';
import { CandyBackground } from '../components/candy/CandyBackground';
import { CandyButton } from '../components/candy/CandyButton';
import { CandyPanel } from '../components/candy/CandyPanel';
import { AdBanner } from '../components/AdBanner';
import { PostageStamp } from '../components/PostageStamp';
import { ChapterStampModal } from '../components/ChapterStampModal';
import { AdoptionModal } from '../components/AdoptionModal';
import { PUPPY_MILESTONES, loadClaimedAdoptions, PuppyMilestone } from '../utils/storage';
import { getPuppyMilestoneImage } from '../utils/puppyImages';
import { Chapter } from '../data/chapterData';
import { CANDY_GOLD, CANDY_SURFACE, CANDY_TEXT } from '../utils/theme';

export const WorldMapScreen: React.FC = () => {
  const { currentLevel, unlockedLevels, startLevel, setActiveScreen, redeemStreakShopItem, refreshStreakHintsCache } = useGameStore();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [dailyState, setDailyState] = useState<DailyChallengeState | null>(null);
  const [streakCountdown, setStreakCountdown] = useState<string>('');
  const [graceRepairBusy, setGraceRepairBusy] = useState(false);
  const { redeemStreakShopItem: _skip, refreshStreakHintsCache: _skip2 } = useGameStore();

  const [inspectedStamp, setInspectedStamp] = useState<Chapter | null>(null);
  const [claimedAdoptions, setClaimedAdoptions] = useState<number[]>([]);
  const [viewedMilestone, setViewedMilestone] = useState<PuppyMilestone | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    getTotalStats().then(s => { if (!cancelled) setStats(s); }).catch(() => {});
    getDailyChallengeState().then(d => { if (!cancelled) setDailyState(d); }).catch(() => {});
    loadClaimedAdoptions().then(c => { if (!cancelled) setClaimedAdoptions(c); }).catch(() => {});

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // Y2: live countdown to streak-break deadline — re-reads state every 30s
    // so the banner updates even if the player camps on World Map all day.
    const tickCountdown = () => {
      if (cancelled) return;
      getDailyChallengeState()
        .then(d => {
          if (cancelled) return;
          setDailyState(d);
          if (d.nextPlayDueDate) {
            const ms = new Date(d.nextPlayDueDate).getTime() - Date.now();
            const total = Math.max(0, Math.floor(ms / 60000));
            const h = Math.floor(total / 60);
            const m = total % 60;
            setStreakCountdown(`${h}h ${String(m).padStart(2, '0')}m`);
          }
        })
        .catch(() => {});
    };
    tickCountdown();
    const countdownTimer = setInterval(tickCountdown, 30 * 1000);

    return () => {
      cancelled = true;
      fadeAnim.stopAnimation();
      clearInterval(countdownTimer);
    };
  }, []);

  const totalScore = stats ? getTotalScore(stats) : 0;

  // Helper to test if a level has been completed
  const isLevelCompleted = (lvl: number): boolean => {
    if (stats?.levelStats[lvl] && stats.levelStats[lvl].completions > 0) {
      return true;
    }
    return lvl < currentLevel;
  };

  // Option 1 — Focused Horizon:
  // 1. Earned chapters live permanently in the Stamp Album.
  // 2. The first unfinished chapter is featured front-and-center as Current Destination.
  // 3. At most one immediately following chapter is teased as Next Destination.
  const collectedChapters = CHAPTERS.filter(ch => {
    for (let l = ch.start; l <= ch.end; l++) {
      if (!isLevelCompleted(l)) return false;
    }
    return true;
  });
  const stampsCollected = collectedChapters.length;

  const uncompletedChapters = CHAPTERS.filter(
    ch => !collectedChapters.some(c => c.id === ch.id)
  );
  const activeChapter = uncompletedChapters[0] ?? null;
  const nextChapter = uncompletedChapters[1] ?? null;
  const adoptedPuppies = PUPPY_MILESTONES.filter(m => claimedAdoptions.includes(m.level));

  // First unfinished, reachable level of the current active chapter
  const nextPlayableLevel = activeChapter
    ? (() => {
        for (let l = activeChapter.start; l <= activeChapter.end; l++) {
          if (!isLevelCompleted(l)) return l <= unlockedLevels ? l : null;
        }
        return null;
      })()
    : null;

  // Progress within the current active chapter
  let activeCompletedCount = 0;
  if (activeChapter) {
    for (let l = activeChapter.start; l <= activeChapter.end; l++) {
      if (isLevelCompleted(l)) activeCompletedCount++;
    }
  }
  const activeTotalLevels = activeChapter
    ? activeChapter.end - activeChapter.start + 1
    : 20;
  const activeProgressPct = Math.round(
    (activeCompletedCount / activeTotalLevels) * 100
  );

  const handleBackHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    soundManager.play('button');
    setActiveScreen('home');
  };

  return (
    <CandyBackground>
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <CandyButton
          skin="grape"
          size="sm"
          accessibilityLabel="Home"
          style={styles.backButton}
          icon={<Text style={styles.backButtonIcon}>🏠</Text>}
          onPress={handleBackHome}
        />

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Puppy Passport 🐾</Text>
          <Text style={styles.headerSubtitle}>
            {stampsCollected} of 50 Garden Stamps Collected
          </Text>
          {totalScore > 0 && (
            <Text style={styles.headerScore}>🏆 {totalScore.toLocaleString()} pts</Text>
          )}
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.mainWrapper, { opacity: fadeAnim }]}>
          {/* Y2: Streak countdown banner — always visible when there is a streak,
               turns RED + offers one-tap repair during the grace window. */}
          {dailyState && (dailyState.currentStreak >= 1 || dailyState.streakInGraceWindow) && (
            <CandyPanel
              contentStyle={[
                styles.streakBanner,
                dailyState.streakInGraceWindow ? styles.streakBannerDanger : styles.streakBannerSafe,
              ]}
            >
              <TouchableOpacity
                style={styles.streakBannerInner}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  try { soundManager.play('button'); } catch {}
                  setActiveScreen('home');
                }}
              >
                <Text style={styles.streakBannerIcon}>
                  {dailyState.streakInGraceWindow ? '⚠️' : '🔥'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.streakBannerTitle,
                    dailyState.streakInGraceWindow ? styles.streakBannerTitleDanger : styles.streakBannerTitleSafe,
                  ]}>
                    {dailyState.streakInGraceWindow
                      ? 'STREAK AT RISK'
                      : `${dailyState.currentStreak} Day Streak`}
                  </Text>
                  <Text style={styles.streakBannerSub}>
                    {dailyState.streakInGraceWindow
                      ? `${streakCountdown} left — your streak is in the grace window!`
                      : `Streak safe for ${streakCountdown}`}
                  </Text>
                </View>
                {dailyState.streakInGraceWindow && (
                  <View style={{ marginTop: 8, width: '100%' }}>
                    <CandyButton
                      size="sm"
                      skin="red"
                      label={graceRepairBusy ? undefined : '📺 Watch & Keep My Streak'}
                      disabled={graceRepairBusy}
                      onPress={async () => {
                        if (graceRepairBusy) return;
                        setGraceRepairBusy(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        try { soundManager.play('button'); } catch {}
                        let earned = false;
                        if (adsAvailable()) {
                          earned = await showRewardedAd().catch(() => false);
                        }
                        if (!earned && Platform.OS === 'web') {
                          earned = await new Promise<boolean>(r => setTimeout(() => r(true), 1600));
                        }
                        if (earned) {
                          const ok = await redeemStreakShopItem({ kind: 'repair', spentTierDays: 0 }).catch(() => false);
                          if (ok) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                            try { soundManager.play('complete'); } catch {}
                            await refreshStreakHintsCache();
                            getDailyChallengeState().then(d => setDailyState(d)).catch(() => {});
                          }
                        }
                        setGraceRepairBusy(false);
                      }}
                    >
                      {graceRepairBusy ? <ActivityIndicator color="#fff" size="small" /> : null}
                    </CandyButton>
                  </View>
                )}
              </TouchableOpacity>
            </CandyPanel>
          )}

          {/* Current Active Chapter Hero Card */}
          {activeChapter && (
            <>
              <Text style={styles.sectionHeader}>CURRENT DESTINATION 🧭</Text>
              <CandyPanel
                style={styles.chapterHeroCard}
                contentStyle={[
                  styles.chapterHeroFace,
                  { borderLeftColor: activeChapter.accentColor },
                ]}
              >
                <View style={styles.chapterHeroHeader}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (activeCompletedCount === activeTotalLevels) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        soundManager.play('button');
                        setInspectedStamp(activeChapter);
                      }
                    }}
                  >
                    <PostageStamp
                      chapter={activeChapter}
                      size="sm"
                      isStamped={activeCompletedCount === activeTotalLevels}
                    />
                  </TouchableOpacity>
                  <View style={styles.chapterHeroTextCol}>
                    <View style={styles.chapterTitleRow}>
                      <Text style={styles.chapterHeroTitle} numberOfLines={1}>
                        Stamp #{activeChapter.id}: {activeChapter.title}
                      </Text>
                      <View
                        style={[
                          styles.diffBadge,
                          { backgroundColor: activeChapter.accentColor },
                        ]}
                      >
                        <Text style={styles.diffBadgeText}>
                          {activeChapter.difficultyBadge}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.chapterHeroGridSize}>
                      Grid: {activeChapter.gridSizes} • {activeChapter.subtitle}
                    </Text>
                  </View>
                </View>

                <Text style={styles.chapterHeroDesc}>{activeChapter.description}</Text>

                {/* Progress Bar inside Current Chapter Card */}
                <View style={styles.heroProgressSection}>
                  <View style={styles.heroProgressHeader}>
                    <Text style={styles.heroProgressLabel}>Meadow Progress</Text>
                    <Text style={styles.heroProgressPercent}>
                      {activeCompletedCount}/{activeTotalLevels} ({activeProgressPct}%)
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${activeProgressPct}%`,
                          backgroundColor: activeChapter.accentColor,
                        },
                      ]}
                    />
                  </View>
                </View>

                <CandyButton
                  block
                  size="lg"
                  skin="green"
                  label={nextPlayableLevel ? `Play Level ${nextPlayableLevel} 🐾` : '🔒 Locked'}
                  disabled={!nextPlayableLevel}
                  onPress={() => {
                    if (!nextPlayableLevel) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    soundManager.play('button');
                    startLevel(nextPlayableLevel);
                  }}
                />
              </CandyPanel>
            </>
          )}

          {/* Next Destination Preview Teaser */}
          {nextChapter && (
            <>
              <Text style={styles.sectionHeader}>NEXT DESTINATION 🗺️</Text>
              <CandyPanel
                style={styles.teaserCard}
                contentStyle={styles.teaserFace}
              >
                <View style={styles.teaserHeader}>
                  <View style={styles.teaserTitleRow}>
                    <Text style={styles.teaserLockIcon}>🔒</Text>
                    <Text style={styles.teaserTitle} numberOfLines={1}>
                      Stamp #{nextChapter.id}: {nextChapter.title}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.diffBadge,
                      { backgroundColor: nextChapter.accentColor, opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.diffBadgeText}>
                      {nextChapter.difficultyBadge}
                    </Text>
                  </View>
                </View>
                <Text style={styles.teaserSub}>
                  Unlocks at Level {nextChapter.start} • Grid: {nextChapter.gridSizes}
                </Text>
                <Text style={styles.teaserDesc} numberOfLines={2}>
                  {nextChapter.subtitle}
                </Text>
              </CandyPanel>
            </>
          )}

          {!activeChapter && (
            <Text style={styles.allCollectedText}>
              🏆 All 50 stamps collected — you cleared every meadow!
            </Text>
          )}

          {/* Stamp Album — earned stamps stay viewable forever */}
          <Text style={styles.sectionHeader}>STAMP ALBUM 📮</Text>
          {collectedChapters.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chapterCarousel}
            >
              {collectedChapters.map(chapter => (
                <TouchableOpacity
                  key={chapter.id}
                  activeOpacity={0.8}
                  style={styles.albumStamp}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    soundManager.play('button');
                    setInspectedStamp(chapter);
                  }}
                >
                  <PostageStamp chapter={chapter} size="sm" isStamped={true} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyCollectionBox}>
              <Text style={styles.emptyCollectionText}>
                Complete all 20 levels in Chapter 1 to earn your first passport stamp!
              </Text>
            </View>
          )}

          {/* Adopted Puppies — earned certificates stay viewable forever */}
          <Text style={styles.sectionHeader}>ADOPTED PUPPIES 🐕</Text>
          {adoptedPuppies.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chapterCarousel}
            >
              {adoptedPuppies.map(m => {
                const photo = getPuppyMilestoneImage(m);
                return (
                  <TouchableOpacity
                    key={m.level}
                    activeOpacity={0.8}
                    style={styles.pupCard}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      soundManager.play('button');
                      setViewedMilestone(m);
                    }}
                  >
                    <Image
                      source={photo}
                      style={[styles.pupCardPhoto, { borderColor: m.color || CANDY_GOLD.base }]}
                      resizeMode="cover"
                    />
                    <Text style={styles.pupCardName} numberOfLines={1}>
                      {m.breedName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyCollectionBox}>
              <Text style={styles.emptyCollectionText}>
                Reach level milestones (like Level 10, 50...) to adopt puppies and collect certificates!
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* AdMob banner — collapses to nothing until ads are ready */}
      <AdBanner />

      {/* Chapter Stamp Inspection Modal */}
      <ChapterStampModal
        visible={!!inspectedStamp}
        chapter={inspectedStamp}
        onClose={() => setInspectedStamp(null)}
      />

      {/* Adopted puppy certificate re-view */}
      <AdoptionModal
        visible={!!viewedMilestone}
        milestone={viewedMilestone}
        onClose={() => setViewedMilestone(null)}
      />
    </SafeAreaView>
    </CandyBackground>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: CANDY_SURFACE.border,
    backgroundColor: 'rgba(20, 10, 44, 0.35)',
  },
  backButton: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonIcon: {
    fontSize: 16,
    textAlign: 'center',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: CANDY_GOLD.light,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkSoft,
    marginTop: 1,
  },
  headerScore: {
    fontSize: 12,
    fontWeight: '900',
    color: CANDY_GOLD.base,
    marginTop: 2,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  headerPlaceholder: {
    width: 44,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mainWrapper: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '900',
    color: CANDY_GOLD.base,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },

  /* Stamp Album + Adopted Puppies collections */
  albumStamp: {
    marginRight: 14,
  },
  pupCard: {
    width: 96,
    backgroundColor: CANDY_SURFACE.top,
    borderRadius: 16,
    padding: 10,
    borderWidth: 2,
    borderColor: CANDY_SURFACE.bevel,
    alignItems: 'center',
    marginRight: 12,
  },
  pupCardIcon: {
    fontSize: 34,
    marginBottom: 6,
  },
  pupCardPhoto: {
    width: 62,
    height: 62,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: CANDY_GOLD.base,
  },
  pupCardName: {
    fontSize: 11,
    fontWeight: '800',
    color: CANDY_TEXT.onDark,
    textAlign: 'center',
  },
  allCollectedText: {
    fontSize: 14,
    fontWeight: '800',
    color: CANDY_TEXT.onDark,
    textAlign: 'center',
    marginVertical: 16,
  },

  /* Chapter Carousel */
  chapterCarousel: {
    paddingBottom: 8,
    // Y3: replaced gap: 12 — each chapter card after the first has an inline
    // left margin of 12 applied via parent horizontal ScrollView padding
    // bleed. Simplest compat: marginRight on every individual chapterCard.
  },
  chapterCard: {
    width: 140,
    backgroundColor: CANDY_SURFACE.top,
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: CANDY_SURFACE.bevel,
    shadowColor: '#0E0620',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    // Y3: replaces chapterCarousel gap: 12 for legacy Android compat.
    marginRight: 12,
  },
  chapterCardSelected: {
    borderWidth: 2.5,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 7,
  },
  chapterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chapterIcon: {
    fontSize: 22,
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  diffBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  chapterCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
    marginBottom: 2,
  },
  chapterCardSub: {
    fontSize: 12,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkSoft,
    marginBottom: 10,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(20, 10, 44, 0.55)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: CANDY_SURFACE.bevel,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '800',
    color: CANDY_TEXT.onDarkMuted,
    textAlign: 'right',
  },
  /* Chapter Hero Card */
  chapterHeroCard: {
    marginTop: 8,
    marginBottom: 16,
  },
  chapterHeroFace: {
    padding: 16,
    borderLeftWidth: 6,
  },
  chapterHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chapterHeroEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  chapterHeroTextCol: {
    flex: 1,
    marginLeft: 10,
  },
  chapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterHeroTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
    flex: 1,
    marginRight: 6,
  },
  chapterHeroGridSize: {
    fontSize: 12,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkSoft,
    marginTop: 2,
  },
  chapterHeroDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkSoft,
    lineHeight: 18,
    marginBottom: 12,
  },
  heroProgressSection: {
    marginBottom: 16,
  },
  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroProgressLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: CANDY_TEXT.onDarkSoft,
  },
  heroProgressPercent: {
    fontSize: 12,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
  },

  /* Next Destination Teaser Card */
  teaserCard: {
    marginTop: 6,
    marginBottom: 16,
  },
  teaserFace: {
    padding: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(20, 10, 44, 0.55)',
  },
  teaserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  teaserTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  teaserLockIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  teaserTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: CANDY_TEXT.onDarkSoft,
  },
  teaserSub: {
    fontSize: 12,
    fontWeight: '700',
    color: CANDY_GOLD.base,
    marginTop: 2,
    marginBottom: 4,
  },
  teaserDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkMuted,
    fontStyle: 'italic',
    lineHeight: 16,
  },

  /* Empty Collections Placeholder */
  emptyCollectionBox: {
    backgroundColor: 'rgba(20, 10, 44, 0.4)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  emptyCollectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  /* Level Nodes */
  levelsSection: {
    padding: 18,
  },
  levelsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: CANDY_SURFACE.border,
  },
  levelsSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: CANDY_GOLD.light,
  },
  levelsSectionHint: {
    fontSize: 11,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkSoft,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  levelNode: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#7C5CBF',
    borderWidth: 2,
    borderColor: '#3D2670',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#0E0620',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
    // Y3: replaces levelGrid gap: 12 for legacy Android compat.
    marginRight: 12,
    marginBottom: 12,
  },
  levelNodeCurrent: {
    borderWidth: 3,
    backgroundColor: '#F5B324',
  },
  levelNodeLocked: {
    backgroundColor: 'rgba(20, 10, 44, 0.5)',
    borderColor: '#3D2670',
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  levelNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 0,
  },
  levelNumberCurrent: {
    fontWeight: '900',
    color: '#4A3000',
  },
  lockIcon: {
    fontSize: 16,
  },
  currentDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* Y2: Streak countdown banner */
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  streakBannerSafe: {
    backgroundColor: 'rgba(37, 184, 78, 0.14)',
    borderColor: '#25B84E',
  },
  streakBannerDanger: {
    backgroundColor: 'rgba(231, 76, 60, 0.18)',
    borderColor: '#E74C3C',
  },
  streakBannerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  streakBannerIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  streakBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  streakBannerTitleSafe: {
    color: '#8CFFA8',
  },
  streakBannerTitleDanger: {
    color: '#FFB3A8',
  },
  streakBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkSoft,
    marginTop: 2,
    lineHeight: 16,
  },
});
