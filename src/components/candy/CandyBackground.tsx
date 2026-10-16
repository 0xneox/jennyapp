import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CANDY_BACKDROP, getBackdropPreset } from '../../utils/theme';

interface CandyBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Level number — when supplied, swaps between 7 unique backdrop gradients
   * (Deep Grape / Sunset Shore / Aurora Forest / Midnight Neon / Dawn Meadow
   *  / Ocean Abyss / Candy Citrus) plus their matching center glow so even
   * the whole-screen background doesn't stay identical across 1000 levels.
   *
   * When omitted, keeps the original Deep Grape arcade backdrop (safe
   * default for non-level screens like Home / World Map initial renders).
   */
  level?: number;
}

/**
 * Arcade backdrop: 3-stop vertical gradient + soft centered glow.
 * When `level` is passed, one of 7 unique themed sky palettes is picked from
 * a deterministic seed so level 12 ≠ level 57 visually.
 */
export const CandyBackground: React.FC<CandyBackgroundProps> = ({ children, style, level }) => {
  const preset = level !== undefined ? getBackdropPreset(level) : CANDY_BACKDROP;
  return (
    <LinearGradient
      colors={[preset.top, preset.mid, preset.bottom]}
      locations={[0, 0.55, 1]}
      style={[styles.fill, style]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          { backgroundColor: preset.glowCenter },
        ]}
      />
      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: '18%',
    width: 520,
    height: 520,
    borderRadius: 260,
    opacity: 0.5,
  },
});
