import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { soundManager } from '../utils/soundManager';
import { CandyButton } from './candy/CandyButton';
import { PlayerAvatar } from './PlayerAvatar';
import { CANDY_GOLD } from '../utils/theme';
import {
  AVATARS,
  NAME_ADJECTIVES,
  NAME_NOUNS,
  NAME_NUMBER_MAX,
  PlayerIdentity,
  formatPlayerName,
  randomIdentity,
} from '../data/profileOptions';
import { LeaderboardProfile, getOrCreateProfile, updateProfileIdentity } from '../utils/leaderboard';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (profile: LeaderboardProfile) => void;
  /** Shown under the Save button when the player has joined (opens confirm). */
  onLeave?: () => void;
}

const tap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  try { soundManager.play('button'); } catch {}
};

const ChipRow: React.FC<{ words: readonly string[]; selected: number; onSelect: (i: number) => void }> = ({
  words,
  selected,
  onSelect,
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
    {words.map((w, i) => (
      <TouchableOpacity
        key={w}
        onPress={() => { tap(); onSelect(i); }}
        style={[styles.chip, i === selected && styles.chipSelected]}
        accessibilityState={{ selected: i === selected }}
      >
        <Text style={[styles.chipText, i === selected && styles.chipTextSelected]}>{w}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

export const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, onSaved, onLeave }) => {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);
  const [joined, setJoined] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    getOrCreateProfile().then(p => {
      if (!alive) return;
      setIdentity({ nameAdj: p.nameAdj, nameNoun: p.nameNoun, nameNum: p.nameNum, avatar: p.avatar });
      setJoined(p.joined);
    }).catch(() => {});
    return () => { alive = false; };
  }, [visible]);

  if (!visible || !identity) return null;

  const set = (patch: Partial<PlayerIdentity>) => setIdentity({ ...identity, ...patch });

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    tap();
    const saved = await updateProfileIdentity(identity).catch(() => null);
    setSaving(false);
    if (saved) onSaved?.(saved);
    onClose();
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Profile</Text>
          <TouchableOpacity hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => { tap(); onClose(); }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          <View style={styles.preview}>
            <PlayerAvatar avatar={identity.avatar} size={64} selected />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.previewName} numberOfLines={1}>{formatPlayerName(identity)}</Text>
              <TouchableOpacity onPress={() => { tap(); set({ ...randomIdentity(), avatar: identity.avatar }); }}>
                <Text style={styles.shuffle}>🎲 Surprise me</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Pick your buddy</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((a, i) => (
              <TouchableOpacity key={a.label} onPress={() => { tap(); set({ avatar: i }); }} style={styles.avatarCell}>
                <PlayerAvatar avatar={i} size={40} selected={i === identity.avatar} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>First word</Text>
          <ChipRow words={NAME_ADJECTIVES} selected={identity.nameAdj} onSelect={i => set({ nameAdj: i })} />
          <Text style={styles.label}>Second word</Text>
          <ChipRow words={NAME_NOUNS} selected={identity.nameNoun} onSelect={i => set({ nameNoun: i })} />

          <Text style={styles.label}>Lucky number</Text>
          <View style={styles.numberRow}>
            <CandyButton size="sm" skin="neutral" label="−" onPress={() => { tap(); set({ nameNum: (identity.nameNum + NAME_NUMBER_MAX) % (NAME_NUMBER_MAX + 1) }); }} />
            <Text style={styles.numberText}>{identity.nameNum}</Text>
            <CandyButton size="sm" skin="neutral" label="+" onPress={() => { tap(); set({ nameNum: (identity.nameNum + 1) % (NAME_NUMBER_MAX + 1) }); }} />
          </View>

          <Text style={styles.safety}>
            🐾 Names are made from friendly words so everyone stays safe. No email, no sign-up.
          </Text>
        </ScrollView>

        <CandyButton block size="lg" skin="green" label={saving ? 'Saving…' : 'Save'} disabled={saving} onPress={handleSave} style={{ marginTop: 10 }} />
        {joined && onLeave && (
          <TouchableOpacity onPress={() => { tap(); onLeave(); }} style={{ marginTop: 12, alignSelf: 'center' }}>
            <Text style={styles.leave}>Leave leaderboard & delete my scores</Text>
          </TouchableOpacity>
        )}
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
    maxHeight: '90%',
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '900', color: '#3A2465' },
  close: { fontSize: 18, color: '#6F5E8E', fontWeight: '800', paddingHorizontal: 6 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3ECFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 6,
  },
  previewName: { fontSize: 18, fontWeight: '900', color: '#3A2465' },
  shuffle: { marginTop: 6, fontSize: 14, fontWeight: '800', color: '#7C3FD6' },
  label: { fontSize: 13, fontWeight: '900', color: '#6F5E8E', marginTop: 12, marginBottom: 6 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  avatarCell: { width: '24%', alignItems: 'center' },
  chipRow: { columnGap: 8, paddingRight: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#EFE8FA',
    borderWidth: 1.5,
    borderColor: '#D9CCF2',
  },
  chipSelected: { backgroundColor: '#7C3FD6', borderColor: '#52259C' },
  chipText: { fontSize: 14, fontWeight: '800', color: '#3A2465' },
  chipTextSelected: { color: '#FFFFFF' },
  numberRow: { flexDirection: 'row', alignItems: 'center', columnGap: 14 },
  numberText: { fontSize: 22, fontWeight: '900', color: '#3A2465', minWidth: 36, textAlign: 'center' },
  safety: { fontSize: 12, color: '#7A66A8', marginTop: 14, lineHeight: 17 },
  leave: { fontSize: 13, fontWeight: '700', color: '#C0392B', textDecorationLine: 'underline' },
});
