import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { soundManager } from '../utils/soundManager';
import { CandyButton } from './candy/CandyButton';
import { CANDY_GOLD } from '../utils/theme';
import { RuleMechanics, getLevelRules } from '../data/levelRules';

interface LevelRulesModalProps {
  visible: boolean;
  onClose: () => void;
  /** e.g. "Level 1161" or "Daily Walk". */
  title: string;
  mechanics: RuleMechanics;
  hungryNeeds: number[];
  /** The current level number (used for beginner-specific rules). */
  level: number;
}

const tap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  try { soundManager.play('button'); } catch {}
};

export const LevelRulesModal: React.FC<LevelRulesModalProps> = ({
  visible,
  onClose,
  title,
  mechanics,
  hungryNeeds,
  level,
}) => {
  const rules = useMemo(() => getLevelRules(mechanics, hungryNeeds, level), [mechanics, hungryNeeds, level]);
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>How to Play</Text>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
          </View>
        </View>

        {/* flexShrink lets the list shrink to the card's maxHeight and scroll */}
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 4 }}>
          {rules.map(rule => (
            <View key={rule.title} style={styles.rule}>
              <Text style={styles.ruleEmoji}>{rule.emoji}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Text style={styles.ruleBody}>{rule.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <CandyButton block size="md" skin="green" label="Got it!" onPress={() => { tap(); onClose(); }} style={{ marginTop: 10 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14, 6, 32, 0.88)',
    justifyContent: 'center',
    paddingHorizontal: 14,
    zIndex: 9000,
  },
  card: {
    backgroundColor: '#FFFDF7',
    borderRadius: 26,
    borderWidth: 3,
    borderColor: CANDY_GOLD.base,
    padding: 16,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '88%',
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  kicker: { fontSize: 12, fontWeight: '900', color: '#7C3FD6', textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 20, fontWeight: '900', color: '#3A2465' },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3ECFF',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  ruleEmoji: { fontSize: 20, marginRight: 10 },
  ruleTitle: { fontSize: 14, fontWeight: '900', color: '#3A2465' },
  ruleBody: { fontSize: 12, color: '#5B4A7E', marginTop: 2, lineHeight: 17 },
});
