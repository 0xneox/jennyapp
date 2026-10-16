import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, StyleSheet } from 'react-native';
import { soundManager } from './src/utils/soundManager';
import { useGameStore, ScreenName } from './src/store/gameStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { WorldMapScreen } from './src/screens/WorldMapScreen';
import { GameScreen } from './src/screens/GameScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { syncLeaderboard } from './src/utils/leaderboard';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { CANDY_BACKDROP } from './src/utils/theme';
import { initAds } from './src/ads/adManager';
import {
  LegalAcceptanceModal,
} from './src/components/LegalAcceptanceModal';
import {
  getLegalAccepted,
  setLegalAccepted,
  storageReady,
} from './src/utils/storage';
import {
  initNotificationsOnAppLaunch,
  registerNotificationTapListener,
} from './src/utils/notifications';
import { LaunchExperience } from './src/components/startup/LaunchExperience';

export default function App() {
  const { activeScreen } = useGameStore();
  const [renderedScreen, setRenderedScreen] = useState<ScreenName>(activeScreen);
  const [showLegalAcceptance, setShowLegalAcceptance] = useState(false);
  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [isInitReady, setIsInitReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // One-time legal acceptance gate: on launch, read persistent flag.
  // If not yet accepted, show the blocking modal immediately. The user
  // cannot begin their first game until they Accept. Already-accepted
  // installs skip this entirely (no re-prompt on subsequent cold boots).
  useEffect(() => {
    let alive = true;
    (async () => {
      await storageReady;
      const accepted = await getLegalAccepted();
      // Catch up anything completed while offline (no-op unless joined).
      syncLeaderboard().catch(() => {});
      if (alive) {
        if (!accepted) {
          setShowLegalAcceptance(true);
        } else {
          initNotificationsOnAppLaunch();
        }
        setIsInitReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleAcceptLegal = async () => {
    await setLegalAccepted(true);
    setShowLegalAcceptance(false);
    initNotificationsOnAppLaunch();
  };

  // Open daily puzzle when a daily notification is tapped
  useEffect(() => {
    const unsub = registerNotificationTapListener(() => {
      const { activeScreen: currentScreen, isDailyChallenge, startDailyChallenge } = useGameStore.getState();
      if (currentScreen === 'game' && isDailyChallenge) {
        return;
      }
      startDailyChallenge();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Note: soundManager.init() fires eagerly inside SoundManager's constructor at
    // module load — do NOT duplicate init() calls here (the await lock de-dups so it's
    // harmless, but omitting it keeps boot 1-tick cleaner).
    soundManager.startBgm();
    initAds();
    return () => {
      soundManager.cleanup();
    };
  }, []);

  // Android hardware back: step back through screens instead of exiting the app
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const { activeScreen, isDailyChallenge, setActiveScreen } = useGameStore.getState();
      if (activeScreen === 'game') {
        setActiveScreen(isDailyChallenge ? 'home' : 'map');
        return true;
      }
      if (activeScreen === 'map' || activeScreen === 'leaderboard') {
        setActiveScreen('home');
        return true;
      }
      return false; // home → default behavior (exit)
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (activeScreen !== renderedScreen) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        setRenderedScreen(activeScreen);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [activeScreen, renderedScreen]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {!isAppLoaded && (
          <LaunchExperience
            onComplete={() => setIsAppLoaded(true)}
            isInitReady={isInitReady}
          />
        )}
        {isAppLoaded && (
          <Animated.View style={[styles.screenContainer, { opacity: fadeAnim }]}>
            <ErrorBoundary>
              {renderedScreen === 'home' && <HomeScreen />}
              {renderedScreen === 'map' && <WorldMapScreen />}
              {renderedScreen === 'game' && <GameScreen />}
              {renderedScreen === 'leaderboard' && <LeaderboardScreen />}
            </ErrorBoundary>
          </Animated.View>
        )}
        <StatusBar style="light" />
        {/* One-time first-launch gate. Rendered OUTSIDE the fade anim so the
             modal never flashes in/out during a screen transition. Absolute
             positioning lets it sit on top of everything without clipping. */}
        <LegalAcceptanceModal
          visible={isAppLoaded && showLegalAcceptance}
          onAccept={handleAcceptLegal}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  // Deep grape matches CANDY_BACKDROP.bottom. The cross-fade between screens
  // drops the outgoing screen to opacity 0, so a light root here flashed white
  // on every navigation.
  root: {
    flex: 1,
    backgroundColor: CANDY_BACKDROP.bottom,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: CANDY_BACKDROP.bottom,
  },
});
