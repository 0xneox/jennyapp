import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { SettingsModal } from '../components/SettingsModal';
import { PuppySprite } from '../components/assets/PuppySprite';
import { getTotalStats, getTotalStars, GameStats } from '../utils/statistics';
import { StarRewardsModal } from '../components/StarRewardsModal';
import { checkAndClaimStarMilestones } from '../utils/starRewards';
import { getChapterForLevel } from '../data/chapterData';
import { MAX_LEVEL } from '../game/types';
import { soundManager } from '../utils/soundManager';
import { JennyAvatar } from '../components/assets/JennyAvatar';
import { StoryComicModal } from '../components/StoryComicModal';
import { getStorySeen } from '../utils/storage';
import {
  getDailyChallengeState,
  getTimeUntilNextPuzzle,
  getFormattedTodayDisplay,
  DailyChallengeState,
} from '../utils/dailyChallenge';
import { CandyBackground } from '../components/candy/CandyBackground';
import { CandyButton } from '../components/candy/CandyButton';
import { CandyPanel } from '../components/candy/CandyPanel';
import { AdBanner } from '../components/AdBanner';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ProfileModal } from '../components/ProfileModal';
import { formatPlayerName } from '../data/profileOptions';
import { LeaderboardProfile, getOrCreateProfile } from '../utils/leaderboard';
import {
  APP_NAME,
  APP_TAGLINE,
  CANDY_GOLD,
  CANDY_SURFACE,
  CANDY_TEXT,
  CANDY_METRICS,
} from '../utils/theme';

export const HomeScreen: React.FC = () => {
  const {
    currentLevel,
    unlockedLevels,
    startLevel,
    startDailyChallenge,
    setActiveScreen,
    redeemStreakShopItem,
    refreshStreakHintsCache,
    consumableHints,
    consumableUndos,
    awardConsumables,
  } = useGameStore();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [showSettings, setShowSettings] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showStarRewards, setShowStarRewards] = useState(false);
  const [storyChecked, setStoryChecked] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [dailyState, setDailyState] = useState<DailyChallengeState | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  // Y2 #3: Proactive streak-broken repair modal on app open.
  const [showStreakBrokenModal, setShowStreakBrokenModal] = useState(false);
  const [profile, setProfile] = useState<LeaderboardProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [streakRepairBusy, setStreakRepairBusy] = useState(false);

  // ---- Responsive sizing based on viewport (defense-in-depth across devices)
  // Baseline reference: iPhone 13 mini / Pixel 5 = 390×844 logical density-independent pixels.
  const isShortScreen = screenHeight < 700;
  const isNarrowWidth = screenWidth < 360;
  const scale = Math.min(1.1, Math.max(0.78, screenWidth / 390));
  // Font sizes are clamped: never below ~78% (320dp SE-style) and never above 110% (tablets).
  const fs = (base: number) => Math.round(base * scale);
  // Vertical chrome compaction on short phones so every card fits above the fold.
  const vGap = (base: number) => (isShortScreen ? Math.round(base * 0.7) : base);

  // Avatar size shrinks noticeably on short/very-narrow combos (iPhone SE 2nd gen landscape).
  const jennyAvatarSize = Math.max(48, Math.round(62 * (isShortScreen ? 0.85 : 1) * (isNarrowWidth ? 0.9 : 1)));
  const mascotWrapperSize = Math.max(62, Math.round(76 * (jennyAvatarSize / 62)));

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const storyRef = useRef({ pending: true, shouldShow: false });
  const floatLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Atomic story-seen check — never show the HomeScreen until we know,
    // so the story modal and Home UI appear together on first paint (no pop-in flash)
    getStorySeen()
      .then(seen => {
        if (cancelled) return;
        const shouldShow = !seen;
        storyRef.current = { pending: false, shouldShow };
        // Set both states atomically together — no intermediate render without story
        if (shouldShow) setShowStory(true);
        setStoryChecked(true);

        // Only start entrance animations AFTER we know the story state
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();

        // Start puppy float loop
        const floatLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: -8,
              duration: 1600,
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 1600,
              useNativeDriver: true,
            }),
          ])
        );
        floatLoopRef.current = floatLoop;
        floatLoop.start();
      })
      .catch(() => {
        if (cancelled) return;
        storyRef.current = { pending: false, shouldShow: false };
        setStoryChecked(true);

        // Still animate in even on error path
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();

        const floatLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, {
              toValue: -8,
              duration: 1600,
              useNativeDriver: true,
            }),
            Animated.timing(floatAnim, {
              toValue: 0,
              duration: 1600,
              useNativeDriver: true,
            }),
          ])
        );
        floatLoopRef.current = floatLoop;
        floatLoop.start();
      });

    // Load persisted stats
    getTotalStats().then(s => {
      if (!cancelled) {
        setStats(s);
        const stars = getTotalStars(s);
        checkAndClaimStarMilestones(stars).then(claimRes => {
          if (claimRes.newlyClaimed.length > 0) {
            awardConsumables(claimRes.totalNewHints, claimRes.totalNewUndos);
          }
        }).catch(() => {});
      }
    }).catch(() => {});

    // Local-only profile (nothing uploads until the player joins the leaderboard)
    getOrCreateProfile().then(p => { if (!cancelled) setProfile(p); }).catch(() => {});

    // Load daily challenge state
    getDailyChallengeState().then(d => {
      if (cancelled) return;
      setDailyState(d);
      // Y2 #3: AUTO-POP the repair modal immediately on app-open when the
      // player missed yesterday AND had a real streak (>=3 days, so it hurts).
      // Must fire BEFORE the player taps any level button — silent resets kill D30 retention.
      if (d.streakMissedYesterday && (d.bestStreak || 0) >= 3) {
        setTimeout(() => {
          if (!cancelled) setShowStreakBrokenModal(true);
        }, 450);
      }
    }).catch(() => {});

    // Live countdown timer to next daily puzzle
    const updateCountdown = () => {
      if (!cancelled) setCountdown(getTimeUntilNextPuzzle().formatted);
    };
    updateCountdown();
    const countdownTimer = setInterval(updateCountdown, 1000);

    return () => {
      cancelled = true;
      if (floatLoopRef.current) {
        floatLoopRef.current.stop();
        floatLoopRef.current = null;
      }
      clearInterval(countdownTimer);
      fadeAnim.stopAnimation();
      scaleAnim.stopAnimation();
      floatAnim.stopAnimation();
    };
  }, []);

  const handlePlayDaily = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    soundManager.play('button');
    startDailyChallenge();
  };

  const currentChapter = getChapterForLevel(currentLevel);

  // Compute stats
  const solvedCount = stats
    ? Object.keys(stats.levelStats).filter(k => (stats.levelStats[Number(k)]?.completions || 0) > 0).length
    : Math.max(0, currentLevel - 1);

  const totalPlayTimeFormatted = stats
    ? (() => {
        const totalMinutes = Math.floor(stats.totalPlayTime / 60);
        if (totalMinutes < 60) return `${totalMinutes}m`;
        return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
      })()
    : '0m';

  const totalStars = stats ? getTotalStars(stats) : solvedCount * 3;

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    soundManager.play('button');
    startLevel(currentLevel);
  };

  const handleOpenMap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    soundManager.play('button');
    setActiveScreen('map');
  };

  if (!storyChecked) {
    return (
      <CandyBackground>
        <SafeAreaView style={styles.safeArea} />
      </CandyBackground>
    );
  }

  return (
    <CandyBackground>
    <SafeAreaView style={styles.safeArea}>
      {/* Y2 #3: PROACTIVE streak-broken repair modal on app-open.
           Silent 30-day streak resets are #1 rage-uninstall trigger. */}
      {showStreakBrokenModal && dailyState && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(14, 6, 32, 0.92)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: 20,
          }}
          pointerEvents="auto"
        >
          <View style={styles.streakBrokenCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
              <Text style={{ fontSize: 34, marginRight: 12 }}>💔</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.streakBrokenTitle}>You missed a walk yesterday</Text>
                <Text style={styles.streakBrokenSub}>
                  Your {dailyState.bestStreak || ''}-day streak is asleep — but a quick ad will wake it right up.
                </Text>
              </View>
            </View>
            <View style={styles.streakBrokenBodyCard}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#7A4F01', marginBottom: 6 }}>
                🛠️ Streak Repair Shop
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#9C7536', lineHeight: 17 }}>
                Watch one 30s ad → restore your ENTIRE streak, all permanent hint bonuses, and best-streak trophy. Zero days lost.
              </Text>
            </View>
            <View style={{ width: '100%', marginTop: 14 }}>
              <CandyButton
                block
                size="lg"
                skin="red"
                label={streakRepairBusy ? undefined : '📺 Watch & Restore My Streak'}
                disabled={streakRepairBusy}
                style={{ marginBottom: 10 }}
                onPress={async () => {
                  if (streakRepairBusy) return;
                  setStreakRepairBusy(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  try { soundManager.play('button'); } catch {}
                  const { adsAvailable: av, showRewardedAd: show } = await import('../ads/adManager').catch(() => ({ adsAvailable: () => false, showRewardedAd: () => Promise.resolve(false) }));
                  let earned = false;
                  if (av()) earned = await show().catch(() => false);
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
                  setStreakRepairBusy(false);
                  setShowStreakBrokenModal(false);
                }}
              >
                {streakRepairBusy ? <ActivityIndicator color="#fff" size="small" /> : null}
              </CandyButton>
              <CandyButton
                block
                skin="neutral"
                label="Start a new streak instead"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  try { soundManager.play('button'); } catch {}
                  setShowStreakBrokenModal(false);
                }}
              />
            </View>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Top Bar with Settings */}
          <View style={[styles.topBar, { marginBottom: vGap(16), marginTop: vGap(8) }]}>
            {profile ? (
              <TouchableOpacity
                style={[styles.appPill, styles.profilePill]}
                activeOpacity={0.8}
                accessibilityLabel="Edit your profile"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  soundManager.play('button');
                  setShowProfile(true);
                }}
              >
                <PlayerAvatar avatar={profile.avatar} size={fs(26)} />
                <Text style={[styles.appPillText, { fontSize: fs(13), marginLeft: 8, flexShrink: 1 }]} numberOfLines={1}>
                  {formatPlayerName(profile)}
                </Text>
                <Text style={{ fontSize: fs(12), marginLeft: 6 }}>✏️</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.appPill}>
                <Text style={[styles.appPillText, { fontSize: fs(13) }]}>🐾 {APP_NAME}</Text>
              </View>
            )}
            <CandyButton
              skin="grape"
              size="sm"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                soundManager.play('button');
                setShowSettings(true);
              }}
              style={styles.settingsButton}
            >
              <Text style={[styles.settingsIcon, { fontSize: fs(18) }]}>⚙️</Text>
            </CandyButton>
          </View>

          {/* Title & Branding */}
          <View style={[styles.titleContainer, { marginBottom: vGap(20) }]}>
            <View style={styles.logoRow}>
              <Text
                style={[
                  styles.logoWord,
                  styles.logoWordJenny,
                  { fontSize: fs(52) },
                ]}
              >
                Jenny
              </Text>
              <Text
                style={[
                  styles.logoWord,
                  styles.logoWordDoko,
                  { fontSize: fs(52) },
                ]}
              >
                Doko
              </Text>
            </View>
            <Text style={[styles.subtitle, { fontSize: fs(16), marginTop: vGap(4) }]}>
              {APP_TAGLINE}
            </Text>
          </View>

          {/* Mascot Hero Card featuring Jenny & Pups */}
          <CandyPanel style={[styles.mascotCard, { marginBottom: vGap(24) }]} contentStyle={styles.mascotCardFace}>
            <Animated.View
              style={[
                styles.mascotAvatarWrapper,
                {
                  width: mascotWrapperSize,
                  height: mascotWrapperSize,
                  borderRadius: mascotWrapperSize / 2,
                  marginRight: isNarrowWidth ? 10 : 16,
                },
                { transform: [{ translateY: floatAnim }] },
              ]}
            >
              <View
                style={[
                  styles.mascotGlow,
                  {
                    width: mascotWrapperSize + 12,
                    height: mascotWrapperSize + 12,
                    borderRadius: (mascotWrapperSize + 12) / 2,
                  },
                ]}
              />
              <JennyAvatar size={jennyAvatarSize} mood="friendly" />
            </Animated.View>

            <View style={styles.mascotSpeechBubble}>
              <Text style={[styles.mascotQuote, { fontSize: fs(16) }]}>
                "Welcome to Greenbark Meadow!"
              </Text>
              <Text
                style={[
                  styles.mascotSubquote,
                  { fontSize: fs(13), lineHeight: Math.round(fs(18)) },
                ]}
              >
                Can you help Jenny ensure every puppy gets their own sunny spot?
              </Text>
            </View>
          </CandyPanel>

          {/* Primary Actions */}
          <View style={[styles.actionGroup, { marginBottom: vGap(24) }]}>
            <View style={{ marginBottom: vGap(14) }}>
              <CandyButton
                block
                size="lg"
                skin="green"
                onPress={handleContinue}
              >
                <View style={styles.continueContent}>
                  <View
                    style={[
                      styles.continueIconCircle,
                      {
                        width: fs(44),
                        height: fs(44),
                        borderRadius: fs(22),
                        marginRight: isNarrowWidth ? 10 : 14,
                      },
                    ]}
                  >
                    <Text style={[styles.continuePlayIcon, { fontSize: fs(18) }]}>▶️</Text>
                  </View>
                  <View style={styles.continueTextGroup}>
                    <Text style={[styles.continueMainText, { fontSize: fs(18) }]}>
                      Continue (Level {currentLevel})
                    </Text>
                    {/* flexWrap + minWidth:0 on the chapter flex so the badge
                        never pushes siblings off-screen; row wraps on narrow widths. */}
                    <View
                      style={[
                        styles.continueSubRow,
                        { flexWrap: 'wrap', marginTop: 4 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.continueChapterText,
                          { fontSize: fs(13), flexShrink: 1, minWidth: 0 },
                        ]}
                        numberOfLines={1}
                      >
                        {currentChapter.icon} {currentChapter.title}
                      </Text>
                      <View
                        style={[
                          styles.difficultyBadge,
                          { backgroundColor: currentChapter.accentColor },
                        ]}
                      >
                        <Text style={[styles.difficultyBadgeText, { fontSize: fs(11) }]}>
                          {currentChapter.difficultyBadge}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </CandyButton>
            </View>

            {/* Daily Challenge Featured Card */}
            <View style={{ marginBottom: vGap(14) }}>
              <TouchableOpacity onPress={handlePlayDaily} activeOpacity={0.88}>
                <CandyPanel
                  contentStyle={[
                    styles.dailyCardFace,
                    dailyState?.isCompletedToday && styles.dailyCardFaceCompleted,
                  ]}
                >
                  {/* flexWrap:wrap so the streak pill drops BELOW the
                      calendar+title on narrow 320/340dp phones instead of
                      clipping off the right edge. */}
                  <View style={[styles.dailyCardHeader, { flexWrap: 'wrap', rowGap: 10 }]}>
                    <View style={[styles.dailyHeaderLeft, { flex: 1, minWidth: 0 }]}>
                      <Text style={[styles.dailyCalendarEmoji, { fontSize: fs(26) }]}>📅</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            styles.dailyCardTitle,
                            { fontSize: fs(16), flexShrink: 1 },
                          ]}
                          numberOfLines={1}
                        >
                          Daily Garden Puzzle
                        </Text>
                        <Text style={[styles.dailyCardDate, { fontSize: fs(12), marginTop: 1 }]}>
                          {getFormattedTodayDisplay()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.dailyStreakPill}>
                      <Text style={[styles.dailyStreakFire, { fontSize: fs(14) }]}>🔥</Text>
                      <Text style={[styles.dailyStreakNumber, { fontSize: fs(14) }]}>
                        {dailyState?.currentStreak || 0}
                      </Text>
                      <Text style={[styles.dailyStreakLabel, { fontSize: fs(11) }]}>Streak</Text>
                    </View>
                  </View>

                  <View style={styles.dailyCardDivider} />

                  {/* Bottom wraps on very narrow widths so the CTA button
                      drops below the countdown instead of clipping. */}
                  <View style={[styles.dailyCardBottom, { flexWrap: 'wrap', rowGap: 12 }]}>
                    <View style={[styles.dailyCountdownGroup, { flexShrink: 1, minWidth: 0 }]}>
                      <Text style={[styles.dailyCountdownLabel, { fontSize: fs(11) }]}>
                        {dailyState?.isCompletedToday ? 'Next Garden in:' : 'Resets in:'}
                      </Text>
                      <Text style={[styles.dailyCountdownTime, { fontSize: fs(14), marginTop: 2 }]}>
                        {countdown || '24h 00m 00s'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.dailyPlayBtn,
                        {
                          paddingHorizontal: isNarrowWidth ? 12 : 16,
                          paddingVertical: isNarrowWidth ? 7 : 9,
                        },
                        dailyState?.isCompletedToday && styles.dailyPlayBtnDone,
                      ]}
                    >
                      <Text style={[styles.dailyPlayBtnText, { fontSize: fs(13) }]}>
                        {dailyState?.isCompletedToday ? '✅ Replay 🐕' : 'Play Today 🐾'}
                      </Text>
                    </View>
                  </View>
                </CandyPanel>
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: vGap(14) }}>
              <CandyButton
                block
                skin="orange"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  soundManager.play('button');
                  setShowStory(true);
                }}
              >
                <View style={styles.rowButtonContent}>
                  <Text style={[styles.storyButtonIcon, { fontSize: fs(22), marginRight: 12 }]}>📖</Text>
                  <Text style={[styles.rowButtonText, { fontSize: fs(16) }]}>The Story of Jenny</Text>
                  <View style={styles.rowButtonBadge}>
                    <Text style={[styles.rowButtonBadgeText, { fontSize: fs(12) }]}>Comic</Text>
                  </View>
                </View>
              </CandyButton>
            </View>

            <View style={{ marginBottom: vGap(14) }}>
              <CandyButton block skin="blue" onPress={handleOpenMap}>
                <View style={styles.rowButtonContent}>
                  <Text style={[styles.storyButtonIcon, { fontSize: fs(22), marginRight: 12 }]}>🗺️</Text>
                  <Text style={[styles.rowButtonText, { fontSize: fs(16) }]}>Chapters & Levels</Text>
                  <View style={styles.rowButtonBadge}>
                    <Text style={[styles.rowButtonBadgeText, { fontSize: fs(12) }]}>{unlockedLevels} / {MAX_LEVEL}</Text>
                  </View>
                </View>
              </CandyButton>
            </View>

            <CandyButton
              block
              skin="grape"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                soundManager.play('button');
                setActiveScreen('leaderboard');
              }}
            >
              <View style={styles.rowButtonContent}>
                <Text style={[styles.storyButtonIcon, { fontSize: fs(22), marginRight: 12 }]}>🏆</Text>
                <Text style={[styles.rowButtonText, { fontSize: fs(16) }]}>Leaderboard</Text>
                <View style={styles.rowButtonBadge}>
                  <Text style={[styles.rowButtonBadgeText, { fontSize: fs(12) }]}>Global</Text>
                </View>
              </View>
            </CandyButton>
          </View>

          {/* Player Stats Card */}
          <CandyPanel style={[styles.statsCard, { marginBottom: vGap(20) }]} contentStyle={styles.statsCardFace}>
            <Text style={[styles.statsCardTitle, { fontSize: fs(14), marginBottom: 14 }]}>
              🏆 Your Journey Progress
            </Text>
            {/* wrap + justify center: on ultra-narrow widths (<340dp) the
                3rd stat drops to a centered 2nd row instead of overlapping the
                dividers with unreadable tiny numbers. */}
            <View style={[styles.statsGrid, { flexWrap: 'wrap', rowGap: 14 }]}>
              <View style={styles.statItem}>
                <PuppySprite size={fs(24)} breed="golden" />
                <Text style={[styles.statNumber, { fontSize: fs(22) }]}>{solvedCount}</Text>
                <Text style={[styles.statLabel, { fontSize: fs(11), marginTop: 2 }]}>Puppies Saved</Text>
              </View>

              {!isNarrowWidth && <View style={styles.statDivider} />}

              <TouchableOpacity
                style={styles.statItem}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  soundManager.play('button');
                  setShowStarRewards(true);
                }}
              >
                <Text style={[styles.statEmoji, { fontSize: fs(20), marginBottom: 2 }]}>⭐</Text>
                <Text style={[styles.statNumber, { fontSize: fs(22) }]}>{totalStars}</Text>
                <Text style={[styles.statLabel, { fontSize: fs(11), marginTop: 2 }]}>Stars Earned</Text>
                <Text style={[styles.statRewardHint, { fontSize: fs(9), color: '#D97706', marginTop: 2 }]}>
                  Rewards 🎁
                </Text>
              </TouchableOpacity>

              {!isNarrowWidth && <View style={styles.statDivider} />}

              <View style={styles.statItem}>
                <Text style={[styles.statEmoji, { fontSize: fs(20), marginBottom: 2 }]}>⏱️</Text>
                <Text style={[styles.statNumber, { fontSize: fs(22) }]}>{totalPlayTimeFormatted}</Text>
                <Text style={[styles.statLabel, { fontSize: fs(11), marginTop: 2 }]}>Time Played</Text>
              </View>
            </View>
          </CandyPanel>

        </Animated.View>
      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenStory={() => setShowStory(true)}
      />

      {/* 3-Screen Illustrated Story Comic Modal */}
      <StoryComicModal
        visible={showStory}
        onClose={() => setShowStory(false)}
        onStartGame={() => {
          setShowStory(false);
          startLevel(currentLevel);
        }}
      />

      <ProfileModal
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onSaved={setProfile}
      />

      {/* Star Milestone Rewards Modal */}
      <StarRewardsModal
        visible={showStarRewards}
        totalStars={totalStars}
        consumableHints={consumableHints}
        consumableUndos={consumableUndos}
        onClose={() => setShowStarRewards(false)}
      />

      {/* AdMob banner — collapses to nothing until ads are ready */}
      <AdBanner />
    </SafeAreaView>
    </CandyBackground>
  );
};

const streakBrokenOverlayStyle = () => ({});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  appPill: {
    backgroundColor: 'rgba(20, 10, 44, 0.45)',
    borderWidth: 1.5,
    borderColor: CANDY_SURFACE.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingVertical: 3,
    maxWidth: '78%',
  },
  appPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: CANDY_TEXT.onDarkSoft,
  },
  settingsButton: {
    minWidth: 42,
  },
  settingsIcon: {
    fontSize: 18,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  logoWord: {
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 2,
  },
  logoWordJenny: {
    color: CANDY_GOLD.base,
  },
  logoWordDoko: {
    color: '#7FD4FF',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkSoft,
    marginTop: 4,
    textAlign: 'center',
  },

  /* Mascot Hero Card */
  mascotCard: {
    width: '100%',
    marginBottom: 24,
  },
  mascotCardFace: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mascotAvatarWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(20, 10, 44, 0.5)',
    borderWidth: 3,
    borderColor: CANDY_GOLD.base,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginRight: 16,
  },
  mascotGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 201, 60, 0.28)',
  },
  mascotSpeechBubble: {
    flex: 1,
  },
  mascotQuote: {
    fontSize: 16,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
    marginBottom: 4,
  },
  mascotSubquote: {
    fontSize: 13,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkSoft,
    lineHeight: 18,
  },

  /* Primary Actions */
  actionGroup: {
    width: '100%',
    // Spacing between buttons is applied explicitly in JSX (marginBottom
    // wrappers). Older Android RN builds (≤0.70) and some Web targets don't
    // render `gap` consistently in flex column containers.
    // gap: 14 intentionally removed.
    marginBottom: 24,
  },
  continueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  continueIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  continuePlayIcon: {
    fontSize: 18,
  },
  continueTextGroup: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  continueMainText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 0,
  },
  continueSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap intentionally removed; explicit margins plus flexWrap in JSX.
  },
  continueChapterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DFFFE8',
    marginRight: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  difficultyBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  /* Shared row-style candy buttons (story / map) */
  rowButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  storyButtonIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  rowButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    flex: 1,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 0,
  },
  rowButtonBadge: {
    backgroundColor: 'rgba(20, 10, 44, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rowButtonBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  /* Player Stats Card */
  statsCard: {
    width: '100%',
    marginBottom: 20,
  },
  statsCardFace: {
    padding: 18,
  },
  statsCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: CANDY_GOLD.base,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 0,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkMuted,
    marginTop: 2,
  },
  statRewardHint: {
    fontSize: 9,
    fontWeight: '800',
    color: CANDY_GOLD.base,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: CANDY_SURFACE.border,
  },

  /* Daily Challenge Card */
  dailyCardFace: {
    padding: 16,
    borderColor: CANDY_GOLD.base,
  },
  dailyCardFaceCompleted: {
    borderColor: '#7FE9A8',
  },
  dailyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Wrapping + shrink safeties added in JSX via array-style. CSS here
    // keeps baseline defaults for very wide (tablet) layouts.
  },
  dailyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap: 10 → explicit margin on date-text column for older RN/Android compat.
  },
  dailyCalendarEmoji: {
    fontSize: 26,
    marginRight: 10,
  },
  dailyCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
    letterSpacing: 0.1,
  },
  dailyCardDate: {
    fontSize: 12,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkSoft,
    marginTop: 1,
  },
  dailyStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 10, 44, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: CANDY_GOLD.dark,
    // gap replaced with explicit element margins.
  },
  dailyStreakFire: {
    fontSize: 14,
    marginRight: 4,
  },
  dailyStreakNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: CANDY_GOLD.light,
    marginRight: 4,
  },
  dailyStreakLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: CANDY_GOLD.base,
  },
  dailyCardDivider: {
    height: 1,
    backgroundColor: CANDY_SURFACE.border,
    marginVertical: 12,
  },
  dailyCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Wrapping + shrink safeties applied inline in JSX.
  },
  dailyCountdownGroup: {
    flexDirection: 'column',
    flexShrink: 1,
    minWidth: 0,
    // Keep label/time readable on the left; if wrapped it'll sit above CTA.
    marginRight: 8,
  },
  dailyCountdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CANDY_TEXT.onDarkMuted,
  },
  dailyCountdownTime: {
    fontSize: 14,
    fontWeight: '900',
    color: CANDY_TEXT.onDark,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  dailyPlayBtn: {
    backgroundColor: '#F79000',
    borderWidth: 1.5,
    borderColor: '#B25400',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: CANDY_METRICS.radiusChip,
    shadowColor: '#B25400',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  dailyPlayBtnDone: {
    backgroundColor: '#1FA98A',
    borderColor: '#0F6B57',
    shadowColor: '#0F6B57',
  },
  dailyPlayBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },

  /* Y2 #3: Proactive streak-broken repair modal on app open */
  streakBrokenCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFDF7',
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#E67E22',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 16,
  },
  streakBrokenTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#C0392B',
    lineHeight: 22,
    marginBottom: 4,
  },
  streakBrokenSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6F5E8E',
    lineHeight: 18,
  },
  streakBrokenBodyCard: {
    backgroundColor: 'rgba(253, 224, 130, 0.3)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#F2B76F',
    padding: 14,
    marginTop: 6,
  },
});
