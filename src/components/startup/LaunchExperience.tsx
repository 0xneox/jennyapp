import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Easing,
  useWindowDimensions,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CANDY_BACKDROP,
  CANDY_GOLD,
  CANDY_TEXT,
  APP_TAGLINE,
} from '../../utils/theme';

export {
  PUBLISHER_NAME,
  PUBLISHER_TRADEMARK,
  LAUNCH_QUOTE_TEXT,
  LAUNCH_QUOTE_AUTHOR,
  LAUNCH_LOADING_LABEL,
} from './launchConstants';
import {
  PUBLISHER_NAME,
  PUBLISHER_TRADEMARK,
  LAUNCH_QUOTE_TEXT,
  LAUNCH_QUOTE_AUTHOR,
  LAUNCH_LOADING_LABEL,
} from './launchConstants';

const JENNY_IMAGE = require('../../../assets/jennyim.png');

interface LaunchExperienceProps {
  onComplete: () => void;
  isInitReady: boolean;
}

type LaunchPhase = 'publisher' | 'loading' | 'finishing';

export const LaunchExperience: React.FC<LaunchExperienceProps> = ({
  onComplete,
  isInitReady,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<LaunchPhase>('publisher');
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animation values
  const publisherOpacity = useRef(new Animated.Value(0)).current;
  const publisherScale = useRef(new Animated.Value(0.96)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const jennyBobAnim = useRef(new Animated.Value(0)).current;
  const screenFadeAnim = useRef(new Animated.Value(1)).current;

  // Track progress and init completion
  const progressValueRef = useRef(0);
  const isInitReadyRef = useRef(isInitReady);
  const finishedRef = useRef(false);

  isInitReadyRef.current = isInitReady;

  // Responsive metrics for small Android devices (e.g. 360x640) up to tablets
  const isShortScreen = screenHeight < 700;
  const isNarrowWidth = screenWidth < 360;

  const barWidth = Math.min(Math.max(screenWidth - 80, 240), 320);
  const jennySize = isShortScreen || isNarrowWidth ? 48 : 54;
  const maxTravel = Math.max(0, barWidth - jennySize);

  // Check system reduced-motion accessibility preference
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (alive && enabled) setReduceMotion(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const finishFlow = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('finishing');

    Animated.timing(screenFadeAnim, {
      toValue: 0,
      duration: reduceMotion ? 100 : 280,
      useNativeDriver: true,
    }).start(() => {
      onComplete();
    });
  };

  // Phase 1: Publisher Splash (21B Games™)
  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(publisherOpacity, {
        toValue: 1,
        duration: reduceMotion ? 150 : 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(publisherScale, {
        toValue: 1,
        duration: reduceMotion ? 150 : 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Brief display then smooth transition to game loading
    const timer = setTimeout(() => {
      Animated.timing(publisherOpacity, {
        toValue: 0,
        duration: reduceMotion ? 100 : 300,
        useNativeDriver: true,
      }).start(() => {
        setPhase('loading');
      });
    }, reduceMotion ? 600 : 1300);

    return () => clearTimeout(timer);
  }, [reduceMotion]);

  // Phase 2: Jennydoku Loading Screen
  useEffect(() => {
    if (phase !== 'loading') return;

    // Fade in loading screen
    Animated.timing(loadingOpacity, {
      toValue: 1,
      duration: reduceMotion ? 100 : 320,
      useNativeDriver: true,
    }).start();

    // Jenny bobbing trot animation
    let bobLoop: Animated.CompositeAnimation | null = null;
    if (!reduceMotion) {
      bobLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(jennyBobAnim, {
            toValue: -3,
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(jennyBobAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      bobLoop.start();
    }

    // Natural progress bar animation
    const progressAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: reduceMotion ? 600 : 1800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    const listenerId = progressAnim.addListener(({ value }) => {
      progressValueRef.current = value;
      if (value >= 0.999 && isInitReadyRef.current) {
        finishFlow();
      }
    });

    progressAnimation.start(() => {
      progressValueRef.current = 1;
      if (isInitReadyRef.current) {
        finishFlow();
      }
    });

    // Safety watchdog: never get stuck on loading screen
    const safetyTimer = setTimeout(() => {
      finishFlow();
    }, 4200);

    return () => {
      progressAnim.removeListener(listenerId);
      progressAnimation.stop();
      if (bobLoop) bobLoop.stop();
      clearTimeout(safetyTimer);
    };
  }, [phase, reduceMotion]);

  // If init finishes after progress has completed, finish immediately
  useEffect(() => {
    if (isInitReady && progressValueRef.current >= 0.98 && phase === 'loading') {
      finishFlow();
    }
  }, [isInitReady, phase]);

  const jennyTranslateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxTravel],
  });

  const progressBarTranslateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenFadeAnim }]}>
      {/* SCREEN 1: Publisher Splash */}
      {phase === 'publisher' && (
        <View style={styles.publisherBackdrop}>
          <Animated.View
            style={[
              styles.publisherContent,
              {
                opacity: publisherOpacity,
                transform: [{ scale: publisherScale }],
              },
            ]}
          >
            <View style={styles.publisherLogoRow}>
              <Text
                style={[
                  styles.publisherTitle,
                  { fontSize: isNarrowWidth ? 26 : isShortScreen ? 28 : 32 },
                ]}
              >
                {PUBLISHER_NAME}
              </Text>
              <Text style={styles.trademark}>{PUBLISHER_TRADEMARK}</Text>
            </View>
            <View style={styles.publisherAccentLine} />
          </Animated.View>
        </View>
      )}

      {/* SCREEN 2: Jennydoku Loading */}
      {phase !== 'publisher' && (
        <Animated.View style={[styles.loadingBackdrop, { opacity: loadingOpacity }]}>
          <LinearGradient
            colors={[CANDY_BACKDROP.top, CANDY_BACKDROP.mid, CANDY_BACKDROP.bottom]}
            locations={[0, 0.55, 1]}
            style={styles.gradientFill}
          >
            {/* Center ambient glow */}
            <View
              pointerEvents="none"
              style={[styles.ambientGlow, { backgroundColor: CANDY_BACKDROP.glowCenter }]}
            />

            <View
              style={[
                styles.contentContainer,
                {
                  paddingTop: Math.max(insets.top + 24, 40),
                  paddingBottom: Math.max(insets.bottom + 24, 32),
                },
              ]}
            >
              {/* Top/Middle: Motivational Quote */}
              <View style={styles.quoteSection}>
                <Text
                  style={[
                    styles.quoteText,
                    {
                      fontSize: isNarrowWidth ? 15 : isShortScreen ? 16 : 18,
                      lineHeight: isNarrowWidth ? 22 : isShortScreen ? 24 : 26,
                    },
                  ]}
                >
                  {LAUNCH_QUOTE_TEXT}
                </Text>
                <Text style={styles.quoteAuthor}>{LAUNCH_QUOTE_AUTHOR}</Text>
              </View>

              {/* Middle: Interactive Jenny & Progress Bar */}
              <View style={styles.progressSection}>
                <View style={[styles.progressTrackWrapper, { width: barWidth }]}>
                  {/* Jenny moving along progress bar */}
                  <Animated.View
                    style={[
                      styles.jennyContainer,
                      {
                        width: jennySize,
                        height: jennySize,
                        transform: [
                          { translateX: jennyTranslateX },
                          { translateY: jennyBobAnim },
                        ],
                      },
                    ]}
                  >
                    <Image
                      source={JENNY_IMAGE}
                      style={styles.jennyImage}
                      resizeMode="contain"
                    />
                  </Animated.View>

                  {/* Candy Progress Track */}
                  <View style={styles.progressBarTrack}>
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          transform: [{ translateX: progressBarTranslateX }],
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={['#13B0FA', '#7FD4FF', '#FFC93C']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.progressGradient}
                      >
                        {/* Glossy top shine */}
                        <View style={styles.progressShine} />
                      </LinearGradient>
                    </Animated.View>
                  </View>
                </View>

                {/* Subtle loading label */}
                <Text style={styles.loadingLabel}>{LAUNCH_LOADING_LABEL}</Text>
              </View>

              {/* Lower Portion: Official Jennydoku Logo & Tagline */}
              <View style={styles.logoSection}>
                <View style={styles.logoRow}>
                  <Text
                    style={[
                      styles.logoWord,
                      styles.logoWordJenny,
                      { fontSize: isNarrowWidth ? 38 : isShortScreen ? 42 : 46 },
                    ]}
                  >
                    Jenny
                  </Text>
                  <Text
                    style={[
                      styles.logoWord,
                      styles.logoWordDoku,
                      { fontSize: isNarrowWidth ? 38 : isShortScreen ? 42 : 46 },
                    ]}
                  >
                    doku
                  </Text>
                </View>
                <Text
                  style={[
                    styles.tagline,
                    { fontSize: isNarrowWidth ? 13 : 15 },
                  ]}
                >
                  {APP_TAGLINE}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },

  /* Screen 1: Publisher Splash */
  publisherBackdrop: {
    flex: 1,
    backgroundColor: '#0F091C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publisherContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  publisherLogoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  publisherTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  trademark: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
    marginTop: 3,
  },
  publisherAccentLine: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFC93C',
    marginTop: 12,
    opacity: 0.85,
  },

  /* Screen 2: Jennydoku Loading */
  loadingBackdrop: {
    flex: 1,
  },
  gradientFill: {
    flex: 1,
  },
  ambientGlow: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    height: 280,
    borderRadius: 140,
    opacity: 0.65,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  /* Upper/Middle: Quote */
  quoteSection: {
    alignItems: 'center',
    maxWidth: 320,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  quoteText: {
    color: CANDY_TEXT.onDark,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  quoteAuthor: {
    color: CANDY_GOLD.base,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  /* Middle: Progress & Character */
  progressSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrackWrapper: {
    position: 'relative',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    height: 72,
  },
  jennyContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jennyImage: {
    width: '100%',
    height: '100%',
  },
  progressBarTrack: {
    width: '100%',
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16092B',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  progressBarFill: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressGradient: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  progressShine: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  loadingLabel: {
    color: CANDY_TEXT.onDarkSoft,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  /* Lower Portion: Jennydoku Logo */
  logoSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  logoWord: {
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 3,
  },
  logoWordJenny: {
    color: CANDY_GOLD.base,
  },
  logoWordDoku: {
    color: '#7FD4FF',
  },
  tagline: {
    fontWeight: '700',
    color: CANDY_TEXT.onDarkSoft,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
