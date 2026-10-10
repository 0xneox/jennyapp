import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { soundManager } from '../utils/soundManager';
import { CandyBackground } from '../components/candy/CandyBackground';
import { CandyButton } from '../components/candy/CandyButton';
import { CandyPanel } from '../components/candy/CandyPanel';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { ProfileModal } from '../components/ProfileModal';
import { CANDY_GOLD, CANDY_TEXT } from '../utils/theme';
import { formatPlayerName } from '../data/profileOptions';
import { loadStats } from '../utils/statistics';
import { loadDailyChallengeData } from '../utils/storage';
import {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardProfile,
  DAILY_POINTS,
  buildSyncPayload,
  computeLocalPoints,
  fetchLeaderboard,
  getOrCreateProfile,
  isLeaderboardConfigured,
  joinLeaderboard,
  leaveLeaderboard,
  syncLeaderboard,
} from '../utils/leaderboard';

const tap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  try { soundManager.play('button'); } catch {}
};

const MEDALS = ['🥇', '🥈', '🥉'];

export const LeaderboardScreen: React.FC = () => {
  const { setActiveScreen } = useGameStore();
  const configured = isLeaderboardConfigured();
  const [profile, setProfile] = useState<LeaderboardProfile | null>(null);
  const [localPoints, setLocalPoints] = useState(0);
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    getOrCreateProfile().then(setProfile).catch(() => {});
    Promise.all([loadStats(), loadDailyChallengeData()])
      .then(([stats, daily]) => setLocalPoints(computeLocalPoints(buildSyncPayload(stats, daily?.completedDates ?? []))))
      .catch(() => {});
  }, []);

  const load = useCallback(async (p: LeaderboardPeriod, sync: boolean) => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      if (sync) await syncLeaderboard({ force: true }).catch(() => null);
      setEntries(await fetchLeaderboard(p));
    } catch {
      setError("Can't reach the leaderboard. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    if (profile?.joined) load(period, false);
  }, [profile?.joined, period, load]);

  const handleJoin = async () => {
    if (busy) return;
    tap();
    setBusy(true);
    try {
      await joinLeaderboard();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      // Stays joined locally; the next completion retries the upload.
    }
    setProfile(await getOrCreateProfile());
    setBusy(false);
    load(period, false);
  };

  const confirmLeave = () => {
    Alert.alert(
      'Leave the leaderboard?',
      'Your name, buddy and points will be deleted from the leaderboard. Your game progress on this device stays safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveLeaderboard();
              setShowProfile(false);
              setEntries([]);
              setProfile(await getOrCreateProfile());
            } catch {
              Alert.alert('Could not leave right now', 'Please check your internet and try again.');
            }
          },
        },
      ],
    );
  };

  const me = entries.find(e => e.isMe);

  const renderRow = ({ item }: { item: LeaderboardEntry }) => (
    <View style={[styles.row, item.isMe && styles.rowMe]}>
      <Text style={styles.rank}>{item.rank <= 3 ? MEDALS[item.rank - 1] : `#${item.rank}`}</Text>
      <PlayerAvatar avatar={item.avatar} size={34} selected={item.isMe} />
      <Text style={styles.rowName} numberOfLines={1}>{item.name}{item.isMe ? ' (you)' : ''}</Text>
      <Text style={styles.rowPoints}>{item.points.toLocaleString()}</Text>
    </View>
  );

  const body = () => {
    if (!configured) {
      return (
        <CandyPanel contentStyle={styles.infoCard}>
          <Text style={styles.infoEmoji}>🏗️</Text>
          <Text style={styles.infoTitle}>Leaderboard coming soon!</Text>
          <Text style={styles.infoText}>Keep collecting points — they'll all count when it opens.</Text>
        </CandyPanel>
      );
    }
    if (!profile) return <ActivityIndicator color="#fff" style={{ marginTop: 40 }} />;
    if (!profile.joined) {
      return (
        <CandyPanel contentStyle={styles.infoCard}>
          <PlayerAvatar avatar={profile.avatar} size={72} selected />
          <Text style={[styles.infoTitle, { marginTop: 12 }]}>{formatPlayerName(profile)}</Text>
          <TouchableOpacity onPress={() => { tap(); setShowProfile(true); }}>
            <Text style={styles.editLink}>✏️ Change name & buddy</Text>
          </TouchableOpacity>
          <Text style={styles.infoText}>
            Earn points from every level, {DAILY_POINTS} for each Daily Garden, and big bonuses for streaks.
            {'\n\n'}Joining shares only your friendly name, buddy and points. No email, no sign-up.
          </Text>
          <CandyButton block size="lg" skin="green" label={busy ? 'Joining…' : '🏆 Join the Leaderboard'} disabled={busy} onPress={handleJoin} style={{ marginTop: 16 }} />
        </CandyPanel>
      );
    }
    return (
      <>
        <View style={styles.tabs}>
          {(['all', 'week'] as LeaderboardPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, period === p && styles.tabActive]}
              onPress={() => { tap(); setPeriod(p); }}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                {p === 'all' ? 'All Time' : 'This Week'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <CandyPanel style={{ marginBottom: 12 }} contentStyle={styles.meCard}>
          <PlayerAvatar avatar={profile.avatar} size={48} selected />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.meName} numberOfLines={1}>{formatPlayerName(profile)}</Text>
            <Text style={styles.meSub}>{me ? `Rank #${me.rank}` : loading ? 'Loading…' : 'Not ranked yet'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.mePoints}>{(me?.points ?? (period === 'all' ? localPoints : 0)).toLocaleString()}</Text>
            <Text style={styles.meSub}>points</Text>
          </View>
        </CandyPanel>

        {error && (
          <TouchableOpacity onPress={() => load(period, true)} style={styles.error}>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={entries}
          keyExtractor={(e, i) => `${e.rank}-${i}`}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(period, true)} tintColor="#fff" />}
          ListEmptyComponent={!loading && !error ? (
            <Text style={styles.empty}>No points yet this {period === 'week' ? 'week' : 'season'} — be the first! 🐾</Text>
          ) : null}
        />
      </>
    );
  };

  return (
    <CandyBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <CandyButton size="sm" skin="grape" label="← Home" onPress={() => { tap(); setActiveScreen('home'); }} />
          <Text style={styles.title}>🏆 Leaderboard</Text>
          {profile?.joined ? (
            <TouchableOpacity onPress={() => { tap(); setShowProfile(true); }} accessibilityLabel="Edit profile">
              <PlayerAvatar avatar={profile.avatar} size={34} />
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>
        <View style={styles.content}>{body()}</View>
      </SafeAreaView>
      <ProfileModal
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        onSaved={p => { setProfile(p); if (p.joined) load(period, true); }}
        onLeave={confirmLeave}
      />
    </CandyBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: CANDY_GOLD.light,
    textShadowColor: CANDY_TEXT.shadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  content: { flex: 1, paddingHorizontal: 16, maxWidth: 520, width: '100%', alignSelf: 'center' },
  infoCard: { alignItems: 'center', padding: 22 },
  infoEmoji: { fontSize: 44, marginBottom: 8 },
  infoTitle: { fontSize: 19, fontWeight: '900', color: CANDY_TEXT.onDark, textAlign: 'center' },
  infoText: { fontSize: 14, color: CANDY_TEXT.onDarkSoft, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  editLink: { fontSize: 14, fontWeight: '800', color: CANDY_GOLD.base, marginTop: 8 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 10, 44, 0.45)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: CANDY_GOLD.base },
  tabText: { fontSize: 14, fontWeight: '900', color: CANDY_TEXT.onDarkSoft },
  tabTextActive: { color: '#4A3000' },
  meCard: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  meName: { fontSize: 16, fontWeight: '900', color: CANDY_TEXT.onDark },
  meSub: { fontSize: 12, fontWeight: '700', color: CANDY_TEXT.onDarkMuted, marginTop: 2 },
  mePoints: { fontSize: 20, fontWeight: '900', color: CANDY_GOLD.light },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 10, 44, 0.35)',
    marginBottom: 6,
  },
  rowMe: { backgroundColor: 'rgba(255, 201, 60, 0.25)', borderWidth: 1.5, borderColor: CANDY_GOLD.base },
  rank: { width: 44, fontSize: 15, fontWeight: '900', color: CANDY_TEXT.onDark, textAlign: 'center' },
  rowName: { flex: 1, fontSize: 15, fontWeight: '800', color: CANDY_TEXT.onDark },
  rowPoints: { fontSize: 15, fontWeight: '900', color: CANDY_GOLD.light },
  error: { backgroundColor: 'rgba(224, 49, 49, 0.25)', borderRadius: 12, padding: 10, marginBottom: 10 },
  errorText: { color: '#FFD6D6', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  empty: { color: CANDY_TEXT.onDarkSoft, textAlign: 'center', marginTop: 24, fontSize: 14 },
});
