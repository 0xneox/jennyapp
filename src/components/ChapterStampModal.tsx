import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { soundManager } from '../utils/soundManager';
import { Chapter } from '../data/chapterData';
import { PostageStamp } from './PostageStamp';
import { Confetti } from './Confetti';
import { CandyButton } from './candy/CandyButton';
import { CANDY_GOLD } from '../utils/theme';

interface ChapterStampModalProps {
  visible: boolean;
  chapter: Chapter | null;
  onClose: () => void;
  onNextChapter?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Chapter Completion Stamp Award Ceremony Modal.
 * Triggered whenever the player finishes all 20 levels in a chapter.
 * Shows an authentic rubber stamp impact animation with haptic feedback
 * and confetti.
 */
export const ChapterStampModal: React.FC<ChapterStampModalProps> = ({
  visible,
  chapter,
  onClose,
  onNextChapter,
}) => {
  const cardScale = useRef(new Animated.Value(0.7)).current;
  const stampAnim = useRef(new Animated.Value(2.2)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && chapter) {
      // 1. Play celebratory fanfare
      soundManager.play('complete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 2. Animate card entrance
      cardScale.setValue(0.7);
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();

      // 3. Stamp "slam" effect: drops down with dynamic impact
      stampAnim.setValue(2.0);
      stampOpacity.setValue(0);

      const stampTimer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(stampOpacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(stampAnim, {
            toValue: 1,
            friction: 4,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Hard haptic thud upon stamp imprint
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          soundManager.play('placePuppy');
        });
      }, 450);

      return () => clearTimeout(stampTimer);
    }
  }, [visible, chapter]);

  if (!visible || !chapter) return null;

  return (
    <View style={styles.modalOverlay}>
      <Confetti visible={visible} />

      <Animated.View
        style={[
          styles.postcardContainer,
          { transform: [{ scale: cardScale }] },
        ]}
      >
        {/* Top Postcard Airmail Border */}
        <View style={styles.airmailStripe} />

        {/* Header Tag */}
        <View style={styles.headerRibbon}>
          <Text style={styles.headerTitle}>OFFICIAL PASSPORT STAMP</Text>
          <Text style={styles.headerSub}>Chapter {chapter.id} Complete!</Text>
        </View>

        {/* Center Postage Stamp Hero */}
        <View style={styles.stampHeroArea}>
          <Animated.View
            style={{
              transform: [{ scale: stampAnim }],
              opacity: stampOpacity,
            }}
          >
            <PostageStamp chapter={chapter} size="lg" isStamped={true} />
          </Animated.View>
        </View>

        {/* Garden Lore & Congratulations */}
        <View style={styles.loreCard}>
          <Text style={styles.chapterTitleText}>
            {chapter.icon} {chapter.title}
          </Text>
          <Text style={styles.chapterDescText}>
            {chapter.description}
          </Text>
          <View style={styles.statRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Levels Cleared</Text>
              <Text style={styles.statChipVal}>20 / 20 ⭐</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Garden Grid</Text>
              <Text style={styles.statChipVal}>{chapter.gridSizes}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Difficulty</Text>
              <Text style={[styles.statChipVal, { color: chapter.accentColor }]}>
                {chapter.difficultyBadge}
              </Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.actionButtons}>
          {onNextChapter && chapter.id < 50 && (
            <CandyButton
              block
              size="lg"
              skin="green"
              label="Next Chapter ➡️"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                soundManager.play('button');
                onClose();
                onNextChapter();
              }}
            />
          )}

          <CandyButton
            block
            size="md"
            skin="neutral"
            label="View Passport 🗺️"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              soundManager.play('button');
              onClose();
            }}
          />
        </View>

        {/* Bottom Postcard Airmail Border */}
        <View style={styles.airmailStripe} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 6, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  postcardContainer: {
    width: Math.min(SCREEN_WIDTH - 36, 390),
    backgroundColor: '#FFFDF7',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: CANDY_GOLD.base,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
  },
  airmailStripe: {
    width: '120%',
    height: 6,
    backgroundColor: '#E74C3C',
    marginVertical: -8,
    opacity: 0.8,
  },
  headerRibbon: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#8E44AD',
    letterSpacing: 1.5,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D18F00',
    marginTop: 2,
  },
  stampHeroArea: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loreCard: {
    width: '100%',
    backgroundColor: 'rgba(240, 235, 255, 0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4C6F0',
    padding: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  chapterTitleText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#3A2465',
    marginBottom: 4,
  },
  chapterDescText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5E4B7C',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    // Y3: gap:6 replaced with statChip marginHorizontal:3 below
  },
  statChip: {
    flex: 1,
    marginHorizontal: 3, // Y3: replaces statRow gap:6
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6DEFC',
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8A77AA',
  },
  statChipVal: {
    fontSize: 11,
    fontWeight: '900',
    color: '#3A2465',
    marginTop: 2,
  },
  actionButtons: {
    width: '100%',
    // Y3: gap:8 — button children apply marginBottom:8 via JSX style
    marginTop: 4,
    marginBottom: 8,
  },
});
