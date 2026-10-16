// Namespace storage import for Jest CJS TDZ safety — see note in gameStore.ts.
import * as storage from './storage';
import { loadStats, GameStats } from './statistics';
import {
  PlayerIdentity,
  formatPlayerName,
  normalizeIdentity,
  randomIdentity,
} from '../data/profileOptions';
import { MAX_LEVEL } from '../game/types';

/**
 * Global leaderboard client (Supabase). Backend: supabase/migrations/0001_leaderboard.sql.
 *
 * Configure at build time with EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (eas.json / .env.local). Never use the
 * secret key here — it would ship inside the APK. Without them every call is a no-op and the
 * UI shows "coming soon", so builds without a backend stay fully offline.
 *
 * Nothing is uploaded until the player taps "Join" (profile.joined).
 */

// Must be literal `process.env.EXPO_PUBLIC_*` reads so Expo inlines them.
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const REQUEST_TIMEOUT_MS = 10000;

export const isLeaderboardConfigured = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

// --- Points (keep in sync with lb_sync / lb_streak_bonus in the SQL) ---------

export const DAILY_POINTS = 500;
export const STREAK_POINT_MILESTONES: { days: number; points: number }[] = [
  { days: 3, points: 300 },
  { days: 7, points: 700 },
  { days: 14, points: 1500 },
  { days: 30, points: 3000 },
];

/** Mirrors lb_max_level_score: server clamps any level score above this. */
export function maxLevelScore(level: number): number {
  if (level >= 1 && level <= 100) return 1500;
  if (level >= 101 && level <= 600) return 1200;
  if (level >= 601 && level <= MAX_LEVEL) return 3000;
  return 0;
}

export function streakBonusPoints(bestStreak: number): number {
  return STREAK_POINT_MILESTONES.reduce((sum, m) => (bestStreak >= m.days ? sum + m.points : sum), 0);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayNumber = (d: string): number => {
  const [y, m, day] = d.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / 86400000);
};

/** Longest run of consecutive calendar days in a list of YYYY-MM-DD strings. */
export function bestStreakFromDates(dates: string[]): number {
  const days = [...new Set(dates.filter(d => DATE_RE.test(d)).map(dayNumber))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export interface SyncPayload {
  levels: Record<string, number>;
  days: string[];
}

/** Full local snapshot sent on every sync — the server keeps the max of each. */
export function buildSyncPayload(stats: GameStats, completedDates: string[]): SyncPayload {
  const levels: Record<string, number> = {};
  for (const [key, ls] of Object.entries(stats.levelStats)) {
    const level = Number(key);
    const cap = maxLevelScore(level);
    const score = Math.round(ls?.bestScore ?? 0);
    if (cap > 0 && score > 0) levels[String(level)] = Math.min(score, cap);
  }
  const days = [...new Set(completedDates.filter(d => DATE_RE.test(d)))].sort().slice(-366);
  return { levels, days };
}

/** Same total the server computes (before its backfill-window rules). */
export function computeLocalPoints(payload: SyncPayload): number {
  const levelPoints = Object.values(payload.levels).reduce((a, b) => a + b, 0);
  return levelPoints + payload.days.length * DAILY_POINTS + streakBonusPoints(bestStreakFromDates(payload.days));
}

// --- Profile ----------------------------------------------------------------

export type LeaderboardProfile = storage.PlayerProfile;

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Loads the profile, creating a random (not yet joined) one on first use. */
export async function getOrCreateProfile(): Promise<LeaderboardProfile> {
  const existing = await storage.loadPlayerProfile();
  if (existing) return { ...existing, ...normalizeIdentity(existing) };
  const profile: LeaderboardProfile = { secret: generateSecret(), ...randomIdentity(), joined: false };
  await storage.savePlayerProfile(profile);
  return profile;
}

export async function updateProfileIdentity(identity: PlayerIdentity): Promise<LeaderboardProfile> {
  const profile = { ...(await getOrCreateProfile()), ...normalizeIdentity(identity) };
  await storage.savePlayerProfile(profile);
  if (profile.joined) syncLeaderboard({ force: true }).catch(() => {});
  return profile;
}

// --- Network ----------------------------------------------------------------

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
    if (!res.ok) throw new Error(`Leaderboard ${fn} failed (${res.status})`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface SyncResult {
  totalPoints: number;
  rank: number;
}

let inFlight: Promise<SyncResult | null> | null = null;
let lastSyncAt = 0;
const MIN_SYNC_INTERVAL_MS = 4000;

/**
 * Uploads the local snapshot. Safe to call after every completion — no-ops
 * when not configured / not joined, coalesces concurrent calls, and simply
 * retries on the next call if the device is offline.
 */
export function syncLeaderboard(opts: { force?: boolean } = {}): Promise<SyncResult | null> {
  if (!isLeaderboardConfigured()) return Promise.resolve(null);
  if (inFlight) return inFlight;
  if (!opts.force && Date.now() - lastSyncAt < MIN_SYNC_INTERVAL_MS) return Promise.resolve(null);
  inFlight = (async () => {
    const profile = await storage.loadPlayerProfile();
    if (!profile?.joined) return null;
    const id = normalizeIdentity(profile);
    const [stats, daily] = await Promise.all([loadStats(), storage.loadDailyChallengeData()]);
    const payload = buildSyncPayload(stats, daily?.completedDates ?? []);
    const rows = await rpc<{ total_points: number; rank: number }[]>('lb_sync', {
      p_secret: profile.secret,
      p_name_adj: id.nameAdj,
      p_name_noun: id.nameNoun,
      p_name_num: id.nameNum,
      p_avatar: id.avatar,
      p_levels: payload.levels,
      p_days: payload.days,
    });
    lastSyncAt = Date.now();
    const row = rows?.[0];
    return row ? { totalPoints: Number(row.total_points), rank: Number(row.rank) } : null;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export type LeaderboardPeriod = 'all' | 'week';

export interface LeaderboardEntry extends PlayerIdentity {
  rank: number;
  name: string;
  points: number;
  isMe: boolean;
}

export async function fetchLeaderboard(period: LeaderboardPeriod): Promise<LeaderboardEntry[]> {
  if (!isLeaderboardConfigured()) return [];
  const profile = await storage.loadPlayerProfile();
  const rows = await rpc<{
    rank: number; name_adj: number; name_noun: number; name_num: number;
    avatar: number; points: number; is_me: boolean;
  }[]>('lb_leaderboard', {
    p_period: period,
    p_secret: profile?.joined ? profile.secret : null,
  });
  return (rows ?? []).map(r => {
    const id = normalizeIdentity({ nameAdj: r.name_adj, nameNoun: r.name_noun, nameNum: r.name_num, avatar: r.avatar });
    return { ...id, rank: Number(r.rank), name: formatPlayerName(id), points: Number(r.points), isMe: !!r.is_me };
  });
}

/** Opt in and upload immediately (throws if offline so the UI can say so). */
export async function joinLeaderboard(): Promise<SyncResult | null> {
  const profile = await getOrCreateProfile();
  await storage.savePlayerProfile({ ...profile, joined: true });
  return syncLeaderboard({ force: true });
}

/** Deletes the player's server data and rotates the secret for a clean re-join. */
export async function leaveLeaderboard(): Promise<void> {
  const profile = await getOrCreateProfile();
  if (profile.joined && isLeaderboardConfigured()) {
    await rpc('lb_delete', { p_secret: profile.secret });
  }
  await storage.savePlayerProfile({ ...profile, secret: generateSecret(), joined: false });
}
