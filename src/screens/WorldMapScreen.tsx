import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
import { CHAPTERS, getChapterIndexForLevel } from '../data/chapterData';
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
import { Chapter } from '../data/chapterData';
import { CANDY_GOLD, CANDY_SURFACE, CANDY_TEXT } from '../utils/theme';

export const WorldMapScreen: React.FC = () => {
  const { currentLevel, unlockedLevels, startLevel, setActiveScreen, redeemStreakShopItem, refreshStreakHintsCache } = useGameStore();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [dailyState, setDailyState] = useState<DailyChallengeState | null>(null);
  const [streakCountdown, setStreakCountdown] = useState<string>('');
  const [graceRepairBusy, setGraceRepairBusy] = useState(false);
  const { redeemStreakShopItem: _skip, refreshStreakHintsCache: _skip2 } = useGameStore();

  // Initialize selected chapter to the one containing currentLevel
  const initialChapterIndex = getChapterIndexForLevel(currentLevel);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(initialChapterIndex);
  const [inspectedStamp, setInspectedStamp] = useState<Chapter | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    getTotalStats().then(s => { if (!cancelled) setStats(s); }).catch(() => {});
    getDailyChallengeState().then(d => { if (!cancelled) setDailyState(d); }).catch(() => {});

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

  const activeChapter = CHAPTERS[selectedChapterIndex];
  const totalScore = stats ? getTotalScore(stats) : 0;

  // Helper to test if a level has been completed
  const isLevelCompleted = (lvl: number): boolean => {
    if (stats?.levelStats[lvl] && stats.levelStats[lvl].completions > 0) {
      return true;
    }
    return lvl < currentLevel;
  };

  // Calculate completed chapters (stamps earned)
  const stampsCollected = CHAPTERS.filter(ch => {
    for (let l = ch.start; l <= ch.end; l++) {
      if (!isLevelCompleted(l)) return false;
    }
    return true;
  }).length;

  const handleSelectLevel = (level: number) => {
    if (level > unlockedLevels) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    soundManager.play('button');
    startLevel(level);
  };

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
          label="Home"
          icon={<Text style={styles.backButtonIcon}>⬅️</Text>}
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

          {/* Horizontal Chapter Selector Cards */}
          <Text style={styles.sectionHeader}>PASSPORT DESTINATIONS 🧭</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chapterCarousel}
          >
            {CHAPTERS.map((chapter, idx) => {
              const isSelected = idx === selectedChapterIndex;
              const chapterUnlocked = unlockedLevels >= chapter.start;
              
              // Calculate completion in this chapter
              let chapterCompletedCount = 0;
              for (let l = chapter.start; l <= chapter.end; l++) {
                if (isLevelCompleted(l)) chapterCompletedCount++;
              }
              const progressPct = Math.round(
                (chapterCompletedCount / (chapter.end - chapter.start + 1)) * 100
              );

              return (
                <TouchableOpacity
                  key={chapter.id}
                  style={[
                    styles.chapterCard,
                    isSelected && [
                      styles.chapterCardSelected,
                      { borderColor: chapter.accentColor },
                    ],
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedChapterIndex(idx);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.chapterCardHeader}>
                    <Text style={styles.chapterIcon}>{chapter.icon}</Text>
                    <View
                      style={[
                        styles.diffBadge,
                        { backgroundColor: chapter.accentColor },
                      ]}
                    >
                      <Text style={styles.diffBadgeText}>
                        {chapter.difficultyBadge}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.chapterCardTitle,
                      isSelected && { color: chapter.accentColor },
                    ]}
                    numberOfLines={1}
                  >
                    Stamp #{chapter.id}
                  </Text>
                  <Text style={styles.chapterCardSub} numberOfLines={1}>
                    {chapter.title}
                  </Text>

                  {/* Stamp Seal if 100% completed */}
                  {progressPct === 100 ? (
                    <TouchableOpacity
                      style={styles.stampSealInteractive}
                      activeOpacity={0.75}
                      onPress={(e) => {
                        e.stopPropagation();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        soundManager.play('button');
                        setInspectedStamp(chapter);
                      }}
                    >
                      <PostageStamp chapter={chapter} size="sm" isStamped={true} />
                    </TouchableOpacity>
                  ) : (
                    <>
                      {/* Mini Progress Bar */}
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressBar,
                            {
                              width: `${progressPct}%`,
                              backgroundColor: chapter.accentColor,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {chapterCompletedCount}/20 ({progressPct}%)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Chapter Details Hero Card */}
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
                  let allDone = true;
                  for (let l = activeChapter.start; l <= activeChapter.end; l++) {
                    if (!isLevelCompleted(l)) {
                      allDone = false;
                      break;
                    }
                  }
                  if (allDone) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    soundManager.play('button');
                    setInspectedStamp(activeChapter);
                  }
                }}
              >
                <PostageStamp
                  chapter={activeChapter}
                  size="sm"
                  isStamped={CHAPTERS.filter(ch => ch.id === activeChapter.id).every(ch => {
                    for (let l = ch.start; l <= ch.end; l++) {
                      if (!isLevelCompleted(l)) return false;
                    }
                    return true;
                  })}
                />
              </TouchableOpacity>
              <View style={styles.chapterHeroTextCol}>
                <Text style={styles.chapterHeroTitle}>
                  Stamp #{activeChapter.id}: {activeChapter.title}
                </Text>
                <Text style={styles.chapterHeroGridSize}>
                  Grid: {activeChapter.gridSizes} • {activeChapter.subtitle}
                </Text>
              </View>
            </View>
            <Text style={styles.chapterHeroDesc}>{activeChapter.description}</Text>
          </CandyPanel>

          {/* Level Nodes Grid */}
          <CandyPanel contentStyle={styles.levelsSection}>
            <View style={styles.levelsSectionHeader}>
              <Text style={styles.levelsSectionTitle}>Levels</Text>
              <Text style={styles.levelsSectionHint}>
                ⭐ Completed • 📍 Current • 🔒 Locked
              </Text>
            </View>

            <View style={styles.levelGrid}>
              {Array.from(
                { length: activeChapter.end - activeChapter.start + 1 },
                (_, i) => activeChapter.start + i
              ).map(lvl => {
                const completed = isLevelCompleted(lvl);
                const isCurrent = lvl === currentLevel;
                const isLocked = lvl > unlockedLevels;

                return (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.levelNode,
                      completed && styles.levelNodeCompleted,
                      isCurrent && [
                        styles.levelNodeCurrent,
                        { borderColor: activeChapter.accentColor },
                      ],
                      isLocked && styles.levelNodeLocked,
                    ]}
                    onPress={() => handleSelectLevel(lvl)}
                    disabled={isLocked}
                    activeOpacity={0.7}
                  >
                    {isLocked ? (
                      <Text style={styles.lockIcon}>🔒</Text>
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.levelNumber,
                            completed && styles.levelNumberCompleted,
                            isCurrent && styles.levelNumberCurrent,
                          ]}
                        >
                          {lvl}
                        </Text>
                        {completed && <Text style={styles.starBadge}>⭐</Text>}
                        {isCurrent && !completed && (
                          <View
                            style={[
                              styles.currentDot,
                              { backgroundColor: activeChapter.accentColor },
                            ]}
                          />
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </CandyPanel>
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
  backButtonIcon: {
    fontSize: 14,
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
    width: 70,
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
  stampSealInteractive: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  stampSealBadge: {
    borderWidth: 2,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    backgroundColor: 'rgba(20, 10, 44, 0.5)',
    marginTop: 2,
  },
  stampSealText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* Chapter Hero Card */
  chapterHeroCard: {
    marginTop: 16,
    marginBottom: 18,
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
  },
  chapterHeroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
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
  levelNodeCompleted: {
    backgroundColor: '#26B85B',
    borderColor: '#12692F',
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
  levelNumberCompleted: {
    color: '#FFFFFF',
  },
  levelNumberCurrent: {
    fontWeight: '900',
    color: '#4A3000',
  },
  lockIcon: {
    fontSize: 16,
  },
  starBadge: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    fontSize: 11,
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
