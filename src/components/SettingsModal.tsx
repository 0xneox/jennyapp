import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, useWindowDimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { soundManager } from '../utils/soundManager';
import {
  setNotificationsToggle,
  checkNotificationPermission,
} from '../utils/notifications';
import { getNotificationsEnabled, storageReady } from '../utils/storage';
import { CandyButton } from './candy/CandyButton';
import { CandyPanel } from './candy/CandyPanel';
import { CANDY_GOLD, CANDY_SURFACE, CANDY_TEXT } from '../utils/theme';
import { PRIVACY_URL, TERMS_URL } from './LegalAcceptanceModal';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onRestart?: () => void;
  onOpenStory?: () => void;
  onOpenTutorial?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onRestart,
  onOpenStory,
  onOpenTutorial,
}) => {
  const { gameMode, setGameMode } = useGameStore();
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isEnabled());
  const [bgmEnabled, setBgmEnabled] = useState(soundManager.isBgmEnabled());
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // 10/10 on every device: compact spacing for Samsung A03-core class hardware
  // (360dp×640dp usable area is the smallest Android market-share tier we target).
  const isShortScreen = screenHeight < 700;
  const isNarrowWidth = screenWidth < 360;
  const facePadding = isShortScreen && isNarrowWidth ? 18 : isShortScreen || isNarrowWidth ? 20 : 24;
  const sectionGap = Math.round((isShortScreen ? 16 : 22) * (isNarrowWidth ? 0.85 : 1));
  const headerMargin = Math.round((isShortScreen ? 14 : 20) * (isNarrowWidth ? 0.9 : 1));
  const rowGap = isShortScreen ? 12 : 16;
  const _tap = () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

  // ---- Bug #3 OFF/OFF sync: React's useState reads soundManager.isEnabled() runs the
  // moment this component first mounts (before storage-reads AudioPrefs loaded. Singleton
  // was at true/true. But App.js has yet loaded prefs loaded from store, so React local
  // state is stale. Listeners below once init+init() finishes & fires once all storage
  // has the REAL persisted sfxEnabled/bgmEnabled. Re-read at this fresh.
  useEffect(() => {
    const refresh = () => {
      setSoundEnabled(soundManager.isEnabled());
      setBgmEnabled(soundManager.isBgmEnabled());
    };
    refresh();
    const unsub = soundManager.onInitDone(refresh);
    return () => unsub();
  }, []);

  // Sync notification preference and system permission on modal open
  useEffect(() => {
    let alive = true;
    (async () => {
      await storageReady;
      const pref = await getNotificationsEnabled();
      const hasPerm = await checkNotificationPermission();
      if (alive) {
        setNotificationsEnabledState(pref === true && hasPerm);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible]);

  const handleToggleNotifications = async () => {
    _tap();
    const next = !notificationsEnabled;
    const success = await setNotificationsToggle(next);
    if (success) {
      setNotificationsEnabledState(next);
      if (next) soundManager.play('button');
    } else {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications for Jennydoku in your device settings to receive daily puzzle reminders.'
      );
    }
  };

  if (!visible) return null;

  const openLegalLink = async (url: string) => {
    try {
      _tap();
      soundManager.play('button');
      await Linking.openURL(url);
    } catch (err) {
      if (__DEV__) console.error('Failed to open legal link:', err);
    }
  };

  return (
    <View
      style={[
        styles.modalOverlay,
        {
          paddingTop: Math.max(12, insets.top),
          paddingBottom: Math.max(12, insets.bottom),
          paddingLeft: Math.max(20, insets.left),
          paddingRight: Math.max(20, insets.right),
        },
      ]}
    >
      <CandyPanel style={styles.settingsModal} contentStyle={[styles.settingsModalFace, { padding: facePadding }]}>
        <View style={[styles.settingsHeader, { marginBottom: headerMargin }]}>
          <Text style={[styles.settingsTitle, { fontSize: isNarrowWidth ? 20 : 22 }]}>⚙️ Settings</Text>
          <TouchableOpacity
            onPress={() => {
              _tap();
              onClose();
            }}
            style={styles.hintCloseIcon}
            accessibilityLabel="Close settings"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.hintCloseIconText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Everything below the header scrolls when the panel is taller than
            the screen — without this the Legal buttons (and Close) were
            unreachable on short devices. */}
        <ScrollView style={styles.settingsScroll}>
        {/* Mode Selection */}
        <Text style={[styles.settingsSectionTitle, { marginBottom: isShortScreen ? 8 : 10 }]}>Game Mode</Text>
        <View style={[styles.settingsModeGroup, { marginBottom: sectionGap }]}>
          <TouchableOpacity
            style={[
              styles.settingsModeOption,
              styles.settingsModeOptionFirst,
              gameMode === 'normal' && styles.settingsModeOptionActive,
            ]}
            onPress={() => {
              _tap();
              setGameMode('normal');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.settingsModeEmoji, { fontSize: isNarrowWidth ? 22 : 26 }]}>🌱</Text>
            <Text
              style={[
                styles.settingsModeText,
                isNarrowWidth && { fontSize: 13 },
                gameMode === 'normal' && styles.settingsModeTextActive,
              ]}
            >
              Normal
            </Text>
            <Text style={[styles.settingsModeSub, isShortScreen && { fontSize: 10 }]}>First 3 oops free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingsModeOption,
              styles.settingsModeOptionLast,
              gameMode === 'zen' && styles.settingsModeOptionActive,
            ]}
            onPress={() => {
              _tap();
              setGameMode('zen');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.settingsModeEmoji, { fontSize: isNarrowWidth ? 22 : 26 }]}>🧘</Text>
            <Text
              style={[
                styles.settingsModeText,
                isNarrowWidth && { fontSize: 13 },
                gameMode === 'zen' && styles.settingsModeTextActive,
              ]}
            >
              Zen Mode
            </Text>
            <Text style={[styles.settingsModeSub, isShortScreen && { fontSize: 10 }]}>Infinite chances</Text>
          </TouchableOpacity>
        </View>

        {/* Sound Toggle */}
        <View style={[styles.settingsRow, { paddingVertical: isShortScreen ? 10 : 14, marginBottom: rowGap }]}>
          <View style={styles.settingsRowLeft}>
            <Text style={[styles.settingsRowIcon, isNarrowWidth && { fontSize: 18 }]}>🔊</Text>
            <Text style={[styles.settingsRowLabel, isNarrowWidth && { fontSize: 14 }]}>Sound Effects</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleSwitch, soundEnabled && styles.toggleSwitchActive]}
            onPress={() => {
              const next = !soundEnabled;
              _tap();
              soundManager.setEnabled(next);
              setSoundEnabled(next);
              if (next) soundManager.play('button');
            }}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: soundEnabled }}
            accessibilityLabel="Sound effects"
          >
            <Text style={styles.toggleSwitchText}>{soundEnabled ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        {/* Background Music Toggle */}
        <View style={[styles.settingsRow, { paddingVertical: isShortScreen ? 10 : 14, marginBottom: rowGap }]}>
          <View style={styles.settingsRowLeft}>
            <Text style={[styles.settingsRowIcon, isNarrowWidth && { fontSize: 18 }]}>🎵</Text>
            <Text style={[styles.settingsRowLabel, isNarrowWidth && { fontSize: 14 }]}>Acoustic Music</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleSwitch, bgmEnabled && styles.toggleSwitchActive]}
            onPress={() => {
              const next = !bgmEnabled;
              _tap();
              soundManager.setBgmEnabled(next);
              setBgmEnabled(next);
              if (next) soundManager.play('button');
            }}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: bgmEnabled }}
            accessibilityLabel="Acoustic background music"
          >
            <Text style={styles.toggleSwitchText}>{bgmEnabled ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        {/* Daily Puzzle Notifications Toggle */}
        <View style={[styles.settingsRow, { paddingVertical: isShortScreen ? 10 : 14, marginBottom: rowGap }]}>
          <View style={styles.settingsRowLeft}>
            <Text style={[styles.settingsRowIcon, isNarrowWidth && { fontSize: 18 }]}>🧠</Text>
            <Text style={[styles.settingsRowLabel, isNarrowWidth && { fontSize: 14 }]}>Daily Puzzle Notifications</Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleSwitch, notificationsEnabled && styles.toggleSwitchActive]}
            onPress={handleToggleNotifications}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: notificationsEnabled }}
            accessibilityLabel="Daily puzzle notifications"
          >
            <Text style={styles.toggleSwitchText}>{notificationsEnabled ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        {/* Story & Lore Section */}
        {(onOpenStory || onOpenTutorial) && (
          <>
            <Text style={[styles.settingsSectionTitle, { marginBottom: isShortScreen ? 8 : 10 }]}>Story & Learning</Text>
            <View style={[styles.storyButtonsRow, { marginBottom: sectionGap, flexWrap: 'wrap' }]}>
              {onOpenStory && (
                <CandyButton
                  skin="orange"
                  size="sm"
                  label="Story of Jenny"
                  icon={<Text style={styles.settingsStoryIcon}>📖</Text>}
                  style={[styles.settingsStoryButton, styles.settingsStoryButtonFirst]}
                  onPress={() => {
                    _tap();
                    soundManager.play('button');
                    onClose();
                    onOpenStory();
                  }}
                />
              )}

              {onOpenTutorial && (
                <CandyButton
                  skin="blue"
                  size="sm"
                  label="How to Play"
                  icon={<Text style={styles.settingsStoryIcon}>🎓</Text>}
                  style={[styles.settingsStoryButton, styles.settingsStoryButtonLast]}
                  onPress={() => {
                    _tap();
                    soundManager.play('button');
                    onClose();
                    onOpenTutorial();
                  }}
                />
              )}
            </View>
          </>
        )}

        {/* Legal Section */}
        <Text style={[styles.settingsSectionTitle, { marginBottom: isShortScreen ? 8 : 10 }]}>Legal</Text>
        <View style={[styles.storyButtonsRow, { marginBottom: sectionGap, flexWrap: 'wrap' }]}>
          <CandyButton
            skin="neutral"
            size="sm"
            label="Terms ↗"
            icon={<Text style={styles.settingsStoryIcon}>📜</Text>}
            style={[styles.settingsStoryButton, styles.settingsStoryButtonFirst]}
            onPress={() => openLegalLink(TERMS_URL)}
          />
          <CandyButton
            skin="neutral"
            size="sm"
            label="Privacy ↗"
            icon={<Text style={styles.settingsStoryIcon}>🔒</Text>}
            style={[styles.settingsStoryButton, styles.settingsStoryButtonLast]}
            onPress={() => openLegalLink(PRIVACY_URL)}
          />
        </View>

        {/* Action buttons */}
        <View style={[styles.settingsActions, { marginTop: isShortScreen ? 2 : 6 }]}>
          {onRestart && (
            <View style={{ marginBottom: 10 }}>
              <CandyButton
                block
                skin="red"
                label="Restart Level"
                icon={<Text style={styles.settingsStoryIcon}>🔄</Text>}
                onPress={() => {
                  _tap();
                  soundManager.play('button');
                  onRestart();
                }}
              />
            </View>
          )}

          <CandyButton
            block
            skin="neutral"
            label="Close"
            onPress={() => {
              _tap();
              onClose();
            }}
          />
        </View>
        </ScrollView>
      </CandyPanel>
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
    backgroundColor: 'rgba(14, 6, 32, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  settingsModal: {
    width: '100%',
    maxWidth: 380,
    // Fills the inset-padded overlay; its padding provides the margin.
    maxHeight: '100%',
    shadowColor: '#0E0620',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 14,
  },
  settingsModalFace: {
    padding: 24,
    borderColor: CANDY_GOLD.base,
    borderWidth: 2,
    // Compress to the capped wrapper so the ScrollView gets a bounded frame.
    flexShrink: 1,
  },
  settingsScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: CANDY_GOLD.light,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  hintCloseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(20, 10, 44, 0.45)',
    borderWidth: 1.5,
    borderColor: CANDY_SURFACE.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintCloseIconText: {
    fontSize: 18,
    color: CANDY_TEXT.onDarkSoft,
    fontWeight: '900',
  },
  settingsSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: CANDY_GOLD.base,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  settingsModeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  settingsModeOption: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: CANDY_SURFACE.bevel,
    alignItems: 'center',
    backgroundColor: 'rgba(20, 10, 44, 0.4)',
    // Y3: gap:12 replaced with explicit 6 + 6 = 12 between cards
    marginHorizontal: 6,
  },
  settingsModeOptionFirst: {
    marginLeft: 0,
  },
  settingsModeOptionLast: {
    marginRight: 0,
  },
  settingsModeOptionActive: {
    borderColor: CANDY_GOLD.base,
    backgroundColor: '#7C5CBF',
  },
  settingsModeEmoji: {
    fontSize: 26,
    marginBottom: 6,
  },
  settingsModeText: {
    fontSize: 15,
    fontWeight: '800',
    color: CANDY_TEXT.onDarkSoft,
    marginBottom: 2,
  },
  settingsModeTextActive: {
    color: '#FFFFFF',
  },
  settingsModeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: CANDY_TEXT.onDarkMuted,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1.5,
    borderColor: CANDY_SURFACE.border,
    marginBottom: 16,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowIcon: {
    fontSize: 20,
    marginRight: 10, // Y3: replaces settingsRowLeft row gap:10
  },
  settingsRowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: CANDY_TEXT.onDark,
  },
  toggleSwitch: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 10, 44, 0.55)',
    borderWidth: 1.5,
    borderColor: CANDY_SURFACE.bevel,
    minWidth: 64,
    alignItems: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#25B84E',
    borderColor: '#0F6B2B',
  },
  toggleSwitchText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  storyButtonsRow: {
    flexDirection: 'row',
  },
  settingsStoryButton: {
    flex: 1,
    // Y3: replaces storyButtonsRow gap:10 → every child gets marginHorizontal:5
    marginHorizontal: 5,
  },
  settingsStoryButtonFirst: {
    marginLeft: 0,
  },
  settingsStoryButtonLast: {
    marginRight: 0,
  },
  settingsStoryIcon: {
    fontSize: 16,
  },
  settingsActions: {
    // Restart button (if any) wraps a marginBottom:10 View; Close sits flush below.
  },
});
