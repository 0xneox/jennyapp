import {
  maxLevelScore,
  streakBonusPoints,
  bestStreakFromDates,
  buildSyncPayload,
  computeLocalPoints,
  isLeaderboardConfigured,
  syncLeaderboard,
} from '../src/utils/leaderboard';
import {
  AVATARS,
  NAME_ADJECTIVES,
  NAME_NOUNS,
  formatPlayerName,
  normalizeIdentity,
  randomIdentity,
} from '../src/data/profileOptions';
import { calculateLevelScore, GameStats } from '../src/utils/statistics';
import { getLevelConfig, getLevelMechanics, getPuzzle } from '../src/data/proceduralPuzzles';
import { MAX_LEVEL } from '../src/game/types';

const statsWith = (scores: Record<number, number>): GameStats => ({
  totalPuzzlesSolved: 0,
  totalPlayTime: 0,
  levelStats: Object.fromEntries(
    Object.entries(scores).map(([l, s]) => [l, { bestMoves: 1, bestTime: 1, completions: 1, hintsUsed: 0, stars: 3, bestScore: s }]),
  ),
});

describe('Leaderboard points', () => {
  it('server score cap is never below the best score a level can award', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const gridSize = level <= 100 ? getPuzzle(level).gridSize : getLevelConfig(level).gridSize;
      const puppiesPerUnit = level <= 100 ? 1 : getLevelMechanics(level).puppiesPerUnit;
      const best = calculateLevelScore(3, 0, { gridSize, puppiesPerUnit });
      if (maxLevelScore(level) < best) throw new Error(`level ${level}: cap ${maxLevelScore(level)} < ${best}`);
    }
    expect(maxLevelScore(0)).toBe(0);
    expect(maxLevelScore(MAX_LEVEL + 1)).toBe(0);
  });

  it('streak bonus accumulates at 3/7/14/30 days', () => {
    expect(streakBonusPoints(2)).toBe(0);
    expect(streakBonusPoints(3)).toBe(300);
    expect(streakBonusPoints(7)).toBe(1000);
    expect(streakBonusPoints(14)).toBe(2500);
    expect(streakBonusPoints(365)).toBe(5500);
  });

  it('finds the longest consecutive-day run across month boundaries, ignoring junk', () => {
    expect(bestStreakFromDates([])).toBe(0);
    expect(bestStreakFromDates(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-02', 'nope'])).toBe(3);
    expect(bestStreakFromDates(['2026-01-01', '2026-01-03', '2026-02-28', '2026-03-01'])).toBe(2);
  });

  it('builds a clamped, deduped snapshot payload', () => {
    const days = Array.from({ length: 400 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1 + i));
      return d.toISOString().slice(0, 10);
    });
    const p = buildSyncPayload(statsWith({ 5: 800, 650: 99999, 9999: 100, 7: 0 }), [...days, days[0], 'bad']);
    expect(p.levels).toEqual({ '5': 800, '650': 3000 });
    expect(p.days).toHaveLength(366);
    expect(p.days[p.days.length - 1]).toBe(days[days.length - 1]);
  });

  it('local total matches the server formula (same scenario as the SQL test)', () => {
    const payload = buildSyncPayload(statsWith({ 5: 800, 650: 3000 }), ['2026-10-08', '2026-10-09', '2026-10-10', '2026-03-01']);
    // 800 + 3000 + 4 * 500 + 300 (3-day streak) = 6100
    expect(computeLocalPoints(payload)).toBe(6100);
  });
});

describe('Child-safe profile options', () => {
  it('has 7 avatars and unique, short, server-indexable words', () => {
    expect(AVATARS).toHaveLength(7);
    for (const list of [NAME_ADJECTIVES, NAME_NOUNS]) {
      expect(new Set(list).size).toBe(list.length);
      expect(list.length).toBeLessThanOrEqual(200);
      list.forEach(w => expect(w).toMatch(/^[A-Z][a-z]{1,11}$/));
    }
  });

  it('formats names and clamps corrupt indexes', () => {
    expect(formatPlayerName({ nameAdj: 0, nameNoun: 0, nameNum: 42 })).toBe('Sunny Beagle 42');
    expect(normalizeIdentity({ nameAdj: -1, nameNoun: 999, nameNum: 100, avatar: 7 })).toEqual({
      nameAdj: 0, nameNoun: 0, nameNum: 0, avatar: 0,
    });
    for (let i = 0; i < 50; i++) {
      const r = randomIdentity();
      expect(normalizeIdentity(r)).toEqual(r);
    }
    expect(normalizeIdentity(randomIdentity(() => 0.999999))).toEqual(randomIdentity(() => 0.999999));
  });
});

describe('Leaderboard network client', () => {
  it('is a no-op without backend config', async () => {
    expect(isLeaderboardConfigured()).toBe(false);
    await expect(syncLeaderboard({ force: true })).resolves.toBeNull();
  });

  describe('with backend configured', () => {
    const URL_ = 'https://example.supabase.co';
    let lb: typeof import('../src/utils/leaderboard');
    let st: typeof import('../src/utils/storage');
    let stats: typeof import('../src/utils/statistics');
    let fetchMock: jest.Mock;

    beforeEach(() => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = `${URL_}/`;
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      fetchMock = jest.fn(async (url: string) => {
        const body = url.endsWith('lb_sync')
          ? [{ total_points: 6100, rank: 1 }]
          : url.endsWith('lb_leaderboard')
            ? [{ rank: 1, name_adj: 1, name_noun: 2, name_num: 3, avatar: 4, points: 6100, is_me: true }]
            : null;
        return { ok: true, status: 200, text: async () => (body ? JSON.stringify(body) : '') };
      });
      (global as any).fetch = fetchMock;
      jest.isolateModules(() => {
        lb = require('../src/utils/leaderboard');
        st = require('../src/utils/storage');
        stats = require('../src/utils/statistics');
      });
    });

    afterEach(() => {
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      delete (global as any).fetch;
    });

    it('uploads nothing until the player joins', async () => {
      await lb.getOrCreateProfile();
      await expect(lb.syncLeaderboard({ force: true })).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('join uploads the snapshot via the lb_sync RPC', async () => {
      await stats.saveStats(statsWith({ 5: 800 }));
      await st.saveDailyChallengeData({
        currentStreak: 1, bestStreak: 1, lastPlayedDate: '2026-10-10', completedDates: ['2026-10-10'], rewardsClaimed: [],
      });
      const profile = await lb.updateProfileIdentity({ nameAdj: 1, nameNoun: 2, nameNum: 3, avatar: 4 });
      expect(profile.secret).toMatch(/^[0-9a-f]{64}$/);

      await expect(lb.joinLeaderboard()).resolves.toEqual({ totalPoints: 6100, rank: 1 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${URL_}/rest/v1/rpc/lb_sync`);
      expect(init.headers.apikey).toBe('anon-key');
      expect(JSON.parse(init.body)).toEqual({
        p_secret: profile.secret,
        p_name_adj: 1, p_name_noun: 2, p_name_num: 3, p_avatar: 4,
        p_levels: { '5': 800 },
        p_days: ['2026-10-10'],
      });

      const rows = await lb.fetchLeaderboard('week');
      expect(rows).toEqual([{ rank: 1, nameAdj: 1, nameNoun: 2, nameNum: 3, avatar: 4, name: 'Happy Poodle 3', points: 6100, isMe: true }]);
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ p_period: 'week', p_secret: profile.secret });
    });

    it('leave deletes server data and rotates the secret', async () => {
      await lb.joinLeaderboard();
      const before = await lb.getOrCreateProfile();
      await lb.leaveLeaderboard();
      const after = await lb.getOrCreateProfile();
      const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(url).toBe(`${URL_}/rest/v1/rpc/lb_delete`);
      expect(JSON.parse(init.body)).toEqual({ p_secret: before.secret });
      expect(after.joined).toBe(false);
      expect(after.secret).not.toBe(before.secret);
    });

    it('surfaces server errors so the UI can show retry', async () => {
      fetchMock.mockImplementation(async () => ({ ok: false, status: 503, text: async () => '' }));
      await expect(lb.fetchLeaderboard('all')).rejects.toThrow('503');
    });
  });
});
