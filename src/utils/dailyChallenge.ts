// Namespace storage import for Jest CJS TDZ safety — see parallel note in gameStore.ts.
import * as storage from './storage';
export type DailyChallengeData = storage.DailyChallengeData;
export const STREAK_MAX_BONUS_HINTS = storage.STREAK_MAX_BONUS_HINTS;

export interface DailyChallengeState {
  currentStreak: number;
  bestStreak: number;
  isCompletedToday: boolean;
  lastPlayedDate: string;
  completedDates: string[];
  rewardsClaimed: number[];
  nextReward: { days: number; title: string } | null;
  /** Tangible daily-streak bonus hints per level granted to the player so far. */
  streakBonusHintsPerLevel: number;
  /** True if the player missed yesterday and their streak reset to 0. Home uses
   *  this to surface the "🛠️ Repair via Rewarded Ad" card in the streak shop. */
  streakMissedYesterday: boolean;
  /** --- Y2 proactive streak-guarding fields --- */
  /** ISO Date string: the EXACT moment (Date.now()) the streak resets if no
   *  daily is completed. During the grace window this is still in the future.
   *  WorldMap/Homescreen use this to render "🔥 Streak safe for 8h 42m". */
  nextPlayDueDate: string;
  /** True when the player MISSED yesterday's 24h boundary but we are still
   *  inside the forgivable 6–12h GRACE WINDOW before the streak actually
   *  snaps to 0. The UI can show a big red CTA: "Keep my streak" — watch a
   *  rewarded ad RIGHT NOW and we pretend yesterday was never missed. */
  streakInGraceWindow: boolean;
  /** How many full hours remain before the grace window closes and the
   *  streak breaks (0 = the grace window is its final hour, use minutes). */
  graceHoursLeft: number;
  /** Minutes component within the current hour of the grace countdown. */
  graceMinutesLeft: number;
}

// Keep ~1 year of completion history — enough for any streak, prevents the
// persisted array from growing unboundedly over the app's lifetime.
const MAX_COMPLETED_DATES = 366;

export interface StreakRewardDef {
  /** Milestone day on which this reward unlocks (exact match, not cumulative). */
  days: number;
  /** Short reward name for: toast popups, `recordDailyCompletion().reward` return, test assertions. */
  shortTitle: string;
  /** Long marketing-form with the bonus description, shown in modals/banners (e.g. "— +1 free hint on every level!"). */
  title: string;
  /** Extra free bonus hints per level (granted forever) unlocked at this streak. */
  bonusHintsPerLevel: number;
}

export const STREAK_REWARDS: StreakRewardDef[] = [
  {
    days: 3,
    shortTitle: 'Sparkle Paw Charm ✨',
    title: 'Sparkle Paw Charm ✨ — +1 free hint on every level!',
    bonusHintsPerLevel: 1,
  },
  {
    days: 7,
    shortTitle: 'Meadow Scout Badge 🏅',
    title: 'Meadow Scout Badge 🏅 — +2 free hints on every level!',
    bonusHintsPerLevel: 2,
  },
  {
    days: 14,
    shortTitle: 'Puppy Whisperer Badge 🐾',
    title: 'Puppy Whisperer Badge 🐾 — MAX hints unlocked (+3/level)!',
    bonusHintsPerLevel: 3,
  },
  {
    days: 30,
    shortTitle: 'Master Sitter Golden Trophy 🏆',
    title: 'Master Sitter Golden Trophy 🏆 — You are Jenny’s favorite person! 💛',
    bonusHintsPerLevel: 3, // cap reached; keeps hint cap at 3; cosmetic trophy only
  },
];

/**
 * How many extra bonus hints per level should the player have unlocked, given
 * their best all-time daily streak?
 */
export function getStreakHintsForBestStreak(bestStreak: number): number {
  let bonus = 0;
  for (const r of STREAK_REWARDS) {
    if (bestStreak >= r.days) bonus = Math.max(bonus, r.bonusHintsPerLevel);
  }
  const cap =
    typeof STREAK_MAX_BONUS_HINTS === 'number' ? STREAK_MAX_BONUS_HINTS :
    typeof storage.STREAK_MAX_BONUS_HINTS === 'number' ? storage.STREAK_MAX_BONUS_HINTS : 3;
  return Math.min(bonus, cap);
}

/**
 * Read the currently-persisted streak bonus hints per level.
 *
 * This is the single source of truth callers (store, screens) should use so
 * nobody re-imports the raw storage key directly. Safe default of 0 on any
 * storage error so the hint-limit formula never NaNs.
 */
export async function getStreakBonusHintsPerLevel(): Promise<number> {
  if (typeof storage.loadStreakBonusHintsPerLevel !== 'function') return 0;
  return storage.loadStreakBonusHintsPerLevel().catch(() => 0);
}

export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(d: Date = new Date()): string {
  const yesterday = new Date(d);
  yesterday.setDate(yesterday.getDate() - 1);
  return getTodayDateString(yesterday);
}

export function getTodayDateSeed(d: Date = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function getFormattedTodayDisplay(d: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', weekday: 'short' };
  return d.toLocaleDateString(undefined, options);
}

export function getTimeUntilNextPuzzle(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const diffMs = Math.max(0, midnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

  return { hours, minutes, seconds, formatted };
}

// Y2: Grace window configuration.
// - MIN_GRACE_HOURS: how many hours past midnight the player gets "for free"
//   before we consider the streak broken. 6 hours is the default minimum.
// - MAX_GRACE_HOURS: best-streak bonus — each 10 days of best streak adds
//   1h of grace up to this ceiling. Protects 30-day streaks the most.
const MIN_GRACE_HOURS = 6;
const MAX_GRACE_HOURS = 12;

export function getGraceHoursForBestStreak(best: number): number {
  const bonus = Math.floor(Math.max(0, best) / 10); // 1 extra hour per 10 days
  return Math.min(MAX_GRACE_HOURS, MIN_GRACE_HOURS + bonus);
}

export async function getDailyChallengeState(): Promise<DailyChallengeState> {
  const data = typeof storage.loadDailyChallengeData === 'function'
    ? await storage.loadDailyChallengeData()
    : null;
  const now = new Date();
  const today = getTodayDateString(now);
  const yesterday = getYesterdayDateString(now);

  // Load current streak-derived bonus hints.
  const savedBonus = typeof storage.loadStreakBonusHintsPerLevel === 'function'
    ? await storage.loadStreakBonusHintsPerLevel().catch(() => 0)
    : 0;

  if (!data) {
    // Fresh player: due tomorrow at grace-window-closing time (= midnight + MIN hours).
    const due = new Date(now);
    due.setHours(24 + MIN_GRACE_HOURS, 0, 0, 0);
    return {
      currentStreak: 0,
      bestStreak: 0,
      isCompletedToday: false,
      lastPlayedDate: '',
      completedDates: [],
      rewardsClaimed: [],
      nextReward: STREAK_REWARDS[0],
      streakBonusHintsPerLevel: savedBonus,
      streakMissedYesterday: false,
      nextPlayDueDate: due.toISOString(),
      streakInGraceWindow: false,
      graceHoursLeft: 0,
      graceMinutesLeft: 0,
    };
  }

  const isCompletedToday = new Set(data.completedDates).has(today);
  const bestStreak = data.bestStreak || 0;
  const graceHours = getGraceHoursForBestStreak(bestStreak);

  // --- Compute the exact streak-break deadline ---
  // Last completed day (fallback: today so the math doesn't NaN).
  const lastCompletedOrPlayed = data.lastPlayedDate || today;
  const dayAfterLast = new Date(`${lastCompletedOrPlayed}T00:00:00`);
  dayAfterLast.setDate(dayAfterLast.getDate() + 1);
  // Grace window closes at: midnight_after_last_complete + graceHours
  const streakBreakDeadline = new Date(dayAfterLast);
  streakBreakDeadline.setHours(graceHours, 0, 0, 0);

  // If they already completed today, the NEXT deadline is midnight+grace tomorrow.
  const effectiveDue = isCompletedToday
    ? (() => {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(graceHours, 0, 0, 0);
        return d;
      })()
    : streakBreakDeadline;

  const msUntilDue = effectiveDue.getTime() - now.getTime();
  const totalMinutesLeft = Math.max(0, Math.floor(msUntilDue / 60000));
  const hoursLeft = Math.floor(totalMinutesLeft / 60);
  const minutesLeft = totalMinutesLeft % 60;

  // --- Missed-day + grace-window logic ---
  // Did they miss yesterday's deadline? i.e. not completed yesterday AND not
  // completed today AND the grace window after yesterday's deadline has been
  // entered (past midnight into today) but not yet closed.
  const yesterdayCompleted = new Set(data.completedDates).has(yesterday);
  const graceWindowOpened = !yesterdayCompleted && !isCompletedToday;
  const graceWindowStillOpen = now.getTime() < streakBreakDeadline.getTime();
  // We only count as "in grace" if there was actually a streak worth protecting AND
  // today is not yet complete AND yesterday was missed (we past midnight already).
  const streakInGraceWindow =
    graceWindowOpened && graceWindowStillOpen && (data.currentStreak || 0) >= 1;

  let effectiveStreak = data.currentStreak;
  let streakMissedYesterday = false;

  if (streakInGraceWindow) {
    // Inside grace: the player still has their streak. DO NOT snap it to 0.
    // They can either complete today's daily normally OR watch an ad to
    // "credit" yesterday's completion and move the deadline forward by a day.
    // (The latter is handled by redeemStreakShopItem kind='repair' + proactive CTA.)
    // We also snapshot now so repair can restore it later (redundant but safe).
    if (typeof storage.saveLastStreakBeforeReset === 'function') {
      void storage.saveLastStreakBeforeReset(effectiveStreak).catch(() => {});
    }
  } else if (!isCompletedToday && data && data.lastPlayedDate !== yesterday && data.currentStreak !== 0) {
    // Grace window has CLOSED. Streak snaps to 0. This is the legacy behaviour.
    if (typeof storage.saveLastStreakBeforeReset === 'function') {
      void storage.saveLastStreakBeforeReset(data.currentStreak).catch(() => {});
    }
    effectiveStreak = 0;
    streakMissedYesterday = true;
    if (typeof storage.saveDailyChallengeData === 'function') {
      void storage.saveDailyChallengeData({ ...data, currentStreak: 0 }).catch(() => {});
    }
  }

  const nextReward =
    STREAK_REWARDS.find(r => r.days > effectiveStreak && !data.rewardsClaimed.includes(r.days)) ||
    null;

  return {
    currentStreak: effectiveStreak,
    bestStreak,
    isCompletedToday,
    lastPlayedDate: data.lastPlayedDate,
    completedDates: data.completedDates,
    rewardsClaimed: data.rewardsClaimed || [],
    nextReward,
    streakBonusHintsPerLevel: savedBonus,
    streakMissedYesterday,
    nextPlayDueDate: effectiveDue.toISOString(),
    streakInGraceWindow,
    graceHoursLeft: hoursLeft,
    graceMinutesLeft: minutesLeft,
  };
}

export async function recordDailyCompletion(stats?: {
  moves?: number;
  time?: number;
}): Promise<{
  streak: number;
  isNewRecord: boolean;
  reward: string | null;
  newBonusHintsPerLevel: number;
  isStreakMilestone: boolean;
  alreadyCompleted: boolean;
}> {
  const existing = (typeof storage.loadDailyChallengeData === 'function'
    ? await storage.loadDailyChallengeData()
    : null) || {
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedDate: '',
    completedDates: [],
    rewardsClaimed: [],
  };

  const today = getTodayDateString();
  const yesterday = getYesterdayDateString();

  // Already completed today
  if (new Set(existing.completedDates).has(today)) {
    const savedBonus = typeof storage.loadStreakBonusHintsPerLevel === 'function'
      ? await storage.loadStreakBonusHintsPerLevel().catch(() => 0)
      : 0;
    return {
      streak: existing.currentStreak,
      isNewRecord: false,
      reward: null,
      newBonusHintsPerLevel: savedBonus,
      isStreakMilestone: false,
      alreadyCompleted: true,
    };
  }

  // Compute new streak
  let newStreak = 1;
  if (existing.lastPlayedDate === yesterday) {
    newStreak = existing.currentStreak + 1;
  }

  const isNewRecord = newStreak > existing.bestStreak;
  const bestStreak = Math.max(existing.bestStreak, newStreak);

  // --- Tangible daily-streak rewards ---
  // Award milestone (3/7/14/30 days): bump stored streak hints per level.
  let rewardTitle: string | null = null;
  const rewardsClaimed = [...(existing.rewardsClaimed || [])];
  let bonusChanged = false;
  let newBonusHintsPerLevel = typeof storage.loadStreakBonusHintsPerLevel === 'function'
    ? await storage.loadStreakBonusHintsPerLevel().catch(() => 0)
    : 0;

  for (const milestone of STREAK_REWARDS) {
    if (newStreak === milestone.days && !rewardsClaimed.includes(milestone.days)) {
      rewardsClaimed.push(milestone.days);
      rewardTitle = milestone.shortTitle;
      const expected = getStreakHintsForBestStreak(bestStreak);
      if (expected !== newBonusHintsPerLevel) {
        newBonusHintsPerLevel = expected;
        bonusChanged = true;
      }
    }
  }
  // Paranoia: if player's BEST streak already qualifies for higher tier than
  // what storage holds (e.g. restored backup or upgrade scenario), top-up now.
  const expectedFromBest = getStreakHintsForBestStreak(bestStreak);
  if (expectedFromBest > newBonusHintsPerLevel) {
    newBonusHintsPerLevel = expectedFromBest;
    bonusChanged = true;
  }
  if (bonusChanged && typeof storage.saveStreakBonusHintsPerLevel === 'function') {
    await storage.saveStreakBonusHintsPerLevel(newBonusHintsPerLevel);
  }

  const isStreakMilestone = !!rewardTitle;

  const updated: DailyChallengeData = {
    currentStreak: newStreak,
    bestStreak,
    lastPlayedDate: today,
    completedDates: [...existing.completedDates.slice(-(MAX_COMPLETED_DATES - 1)), today],
    rewardsClaimed,
  };

  if (typeof storage.saveDailyChallengeData === 'function') await storage.saveDailyChallengeData(updated);

  return {
    streak: newStreak,
    isNewRecord,
    reward: rewardTitle,
    newBonusHintsPerLevel,
    isStreakMilestone,
    alreadyCompleted: false,
  };
}

/**
 * Spend N days of the current streak (shop purchase). Clamps against zero.
 * Fails (resolves false) when current streak < tierCost or there's no
 * persisted daily data to mutate. Streak can't go below 0. Does NOT touch the
 * permanent bestStreak counter — bestStreak is the player's all-time trophy.
 */
export async function deductStreakTier(tierCost: 1 | 3 | 5): Promise<boolean> {
  if (typeof storage.loadDailyChallengeData !== 'function' || typeof storage.saveDailyChallengeData !== 'function') return false;
  const existing = await storage.loadDailyChallengeData();
  if (!existing) return false;
  if (existing.currentStreak < tierCost) return false;
  const newStreak = Math.max(0, existing.currentStreak - tierCost);
  await storage.saveDailyChallengeData({ ...existing, currentStreak: newStreak });
  return true;
}

/**
 * Called after the player watches a rewarded ad to repair a just-broken streak.
 * Restores currentStreak back to the snapshot captured BEFORE the miss-day
 * reset (see getDailyChallengeState). Also re-bumps bestStreak if the restored
 * streak beats the recorded best (covers edge case where reset zeroed it).
 *
 * Resolves false if there is nothing to repair.
 */
export async function repairBrokenStreak(): Promise<boolean> {
  if (typeof storage.loadLastStreakBeforeReset !== 'function' || typeof storage.loadDailyChallengeData !== 'function') return false;
  const snapshot = await storage.loadLastStreakBeforeReset();
  const existing = await storage.loadDailyChallengeData();
  if (!snapshot || snapshot <= 0) return false;
  const base: DailyChallengeData = existing || {
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedDate: '',
    completedDates: [],
    rewardsClaimed: [],
  };
  // Repair snapshot becomes the new current streak. Best-ever can only rise.
  const restoredCurrent = Math.max(base.currentStreak, snapshot);
  const restoredBest = Math.max(base.bestStreak, restoredCurrent);
  // Also re-top-up the permanent streak bonus hints in case the earlier
  // milestone claim got lost during the reset.
  const expectedBonus = getStreakHintsForBestStreak(restoredBest);
  const currentBonus = typeof storage.loadStreakBonusHintsPerLevel === 'function'
    ? await storage.loadStreakBonusHintsPerLevel().catch(() => 0)
    : 0;
  if (expectedBonus > currentBonus && typeof storage.saveStreakBonusHintsPerLevel === 'function') {
    await storage.saveStreakBonusHintsPerLevel(expectedBonus);
  }
  if (typeof storage.saveDailyChallengeData === 'function') {
    await storage.saveDailyChallengeData({
      ...base,
      currentStreak: restoredCurrent,
      bestStreak: restoredBest,
      // Don't mutate completedDates / rewardsClaimed — those are facts, not opinion.
    });
  }
  // Clear the snapshot so the Repair button disappears after one use.
  if (typeof storage.saveLastStreakBeforeReset === 'function') await storage.saveLastStreakBeforeReset(0);
  return true;
}

