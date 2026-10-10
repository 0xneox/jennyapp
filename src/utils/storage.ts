const STORAGE_KEY = '@jenny_game_progress';
const TUTORIAL_KEY = '@jenny_tutorial_seen';
const LAST_INTERSTITIAL_KEY = '@jenny_last_interstitial_at';

export interface GameProgress {
  unlockedLevels: number;
  currentLevel: number;
}

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
let asyncStorageAvailable: boolean = false;
let memoryStorage: Record<string, string> = {};

// Web localStorage can throw (private mode, quota exceeded). Once a web op
// fails we permanently fall back to in-memory storage for the session so
// reads stay consistent with earlier writes instead of silently losing them.
let webStorageBroken = false;

const webGet = (key: string): string | null => {
  if (webStorageBroken) return memoryStorage[key] ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    webStorageBroken = true;
    return memoryStorage[key] ?? null;
  }
};

const webSet = (key: string, value: string): void => {
  if (webStorageBroken) {
    memoryStorage[key] = value;
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    webStorageBroken = true;
    memoryStorage[key] = value;
  }
};

const webRemove = (key: string): void => {
  if (webStorageBroken) {
    delete memoryStorage[key];
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    webStorageBroken = true;
    delete memoryStorage[key];
  }
};

// --- Persisted payload validation -------------------------------------------
// JSON.parse only checks syntax — a corrupt payload (e.g. a string in a numeric
// field) would otherwise pass and crash downstream math. Each loader validates
// shape before trusting the data; invalid payloads are discarded to defaults.

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const parseGameProgress = (raw: string | null): GameProgress | null => {
  if (raw == null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    isFiniteNumber((parsed as GameProgress).unlockedLevels) &&
    isFiniteNumber((parsed as GameProgress).currentLevel)
  ) {
    return parsed as GameProgress;
  }
  console.warn('Discarding corrupt game progress payload');
  return null;
};

const parseDailyChallengeData = (raw: string | null): DailyChallengeData | null => {
  if (raw == null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const d = parsed as Record<string, unknown>;
  if (!isFiniteNumber(d.currentStreak) || !isFiniteNumber(d.bestStreak)) {
    console.warn('Discarding corrupt daily challenge payload');
    return null;
  }
  // Numeric fields are load-bearing; optional/list fields are sanitized so a
  // partially-corrupt payload degrades gracefully instead of being dropped.
  return {
    currentStreak: d.currentStreak,
    bestStreak: d.bestStreak,
    lastPlayedDate: typeof d.lastPlayedDate === 'string' ? d.lastPlayedDate : '',
    completedDates: Array.isArray(d.completedDates)
      ? d.completedDates.filter((x): x is string => typeof x === 'string')
      : [],
    rewardsClaimed: Array.isArray(d.rewardsClaimed)
      ? d.rewardsClaimed.filter(isFiniteNumber)
      : [],
  };
};

const parseNumberArray = (raw: string | null): number[] => {
  if (raw == null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed) && parsed.every(isFiniteNumber)) {
    return parsed;
  }
  console.warn('Discarding corrupt number-array payload');
  return [];
};

// --- Backend selection ------------------------------------------------------
// AsyncStorage availability is probed asynchronously. Every read/write awaits
// the probe so a boot-time load (e.g. the game store restoring progress) can
// never race ahead of it and silently read the empty in-memory fallback.

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let asyncStorage: AsyncStorageLike | null = null;

const checkAsyncStorage = async (): Promise<void> => {
  if (isWeb) {
    asyncStorageAvailable = false;
    return;
  }
  try {
    const AsyncStorageModule = await import('@react-native-async-storage/async-storage');
    const AsyncStorage = (AsyncStorageModule.default || AsyncStorageModule) as AsyncStorageLike;
    await AsyncStorage.setItem('__test__', 'test');
    await AsyncStorage.removeItem('__test__');
    asyncStorage = AsyncStorage;
    asyncStorageAvailable = true;
  } catch (error) {
    if (__DEV__) console.log('AsyncStorage not available, using in-memory storage');
    asyncStorageAvailable = false;
  }
};

/** Resolves once the storage backend has been chosen. Exported for tests. */
export const storageReady: Promise<void> = checkAsyncStorage();

const getItem = async (key: string): Promise<string | null> => {
  await storageReady;
  if (isWeb) return webGet(key);
  if (asyncStorageAvailable && asyncStorage) return asyncStorage.getItem(key);
  return memoryStorage[key] ?? null;
};

const setItem = async (key: string, value: string): Promise<void> => {
  await storageReady;
  if (isWeb) return webSet(key, value);
  if (asyncStorageAvailable && asyncStorage) return asyncStorage.setItem(key, value);
  memoryStorage[key] = value;
};

const removeItem = async (key: string): Promise<void> => {
  await storageReady;
  if (isWeb) return webRemove(key);
  if (asyncStorageAvailable && asyncStorage) return asyncStorage.removeItem(key);
  delete memoryStorage[key];
};

export const saveProgress = async (progress: GameProgress): Promise<void> => {
  try {
    await setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
};

export const loadProgress = async (): Promise<GameProgress | null> => {
  try {
    return parseGameProgress(await getItem(STORAGE_KEY));
  } catch (error) {
    console.error('Error loading progress:', error);
    return null;
  }
};

export const clearProgress = async (): Promise<void> => {
  try {
    await removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing progress:', error);
  }
};

export const setTutorialSeen = async (seen: boolean): Promise<void> => {
  try {
    await setItem(TUTORIAL_KEY, seen ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting tutorial seen:', error);
  }
};

export const getTutorialSeen = async (): Promise<boolean> => {
  try {
    return (await getItem(TUTORIAL_KEY)) === 'true';
  } catch (error) {
    console.error('Error getting tutorial seen:', error);
    return false;
  }
};

const STORY_KEY = '@jenny_story_seen';
const LEGAL_ACCEPTED_KEY = '@jenny_legal_accepted_v1';

export const setStorySeen = async (seen: boolean): Promise<void> => {
  try {
    await setItem(STORY_KEY, seen ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting story seen:', error);
  }
};

export const getStorySeen = async (): Promise<boolean> => {
  try {
    return (await getItem(STORY_KEY)) === 'true';
  } catch (error) {
    console.error('Error getting story seen:', error);
    return false;
  }
};

const CHAPTER_STORY_KEY = '@jenny_chapter_stories_seen';

export const setChapterStorySeen = async (chapter: number): Promise<void> => {
  try {
    const existing = await getChapterStoriesSeen();
    if (existing.includes(chapter)) return;
    await setItem(CHAPTER_STORY_KEY, JSON.stringify([...existing, chapter]));
  } catch (error) {
    console.error('Error setting chapter story seen:', error);
  }
};

export const getChapterStoriesSeen = async (): Promise<number[]> => {
  try {
    const value = await getItem(CHAPTER_STORY_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v: unknown) => typeof v === 'number') : [];
  } catch (error) {
    console.error('Error getting chapter stories seen:', error);
    return [];
  }
};

export const hasChapterStoryBeenSeen = async (chapter: number): Promise<boolean> => {
  const seen = await getChapterStoriesSeen();
  return seen.includes(chapter);
};

/**
 * Whether the user has already accepted the Terms of Service + Privacy Policy.
 *
 * Required by Play Console for any app handling personal data: acceptance must
 * be collected once, persistently stored, and never silently revoked on update.
 * Versioned key (_v1) so we can re-prompt if the legal text materially changes.
 */
export const setLegalAccepted = async (accepted: boolean): Promise<void> => {
  try {
    await setItem(LEGAL_ACCEPTED_KEY, accepted ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting legal acceptance:', error);
  }
};

export const getLegalAccepted = async (): Promise<boolean> => {
  try {
    return (await getItem(LEGAL_ACCEPTED_KEY)) === 'true';
  } catch (error) {
    console.error('Error getting legal acceptance:', error);
    return false;
  }
};

const NOTIFICATIONS_ENABLED_KEY = '@jenny_notifications_enabled';
const NOTIFICATION_PROMPT_SHOWN_KEY = '@jenny_notification_prompt_shown';

export const setNotificationsEnabled = async (enabled: boolean): Promise<void> => {
  try {
    await setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting notifications enabled:', error);
  }
};

export const getNotificationsEnabled = async (): Promise<boolean | null> => {
  try {
    const value = await getItem(NOTIFICATIONS_ENABLED_KEY);
    if (value === null) return null;
    return value === 'true';
  } catch (error) {
    console.error('Error getting notifications enabled:', error);
    return null;
  }
};

export const setNotificationPromptShown = async (shown: boolean): Promise<void> => {
  try {
    await setItem(NOTIFICATION_PROMPT_SHOWN_KEY, shown ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting notification prompt shown:', error);
  }
};

export const getNotificationPromptShown = async (): Promise<boolean> => {
  try {
    return (await getItem(NOTIFICATION_PROMPT_SHOWN_KEY)) === 'true';
  } catch (error) {
    console.error('Error getting notification prompt shown:', error);
    return false;
  }
};

const CHAPTER_STAMPS_KEY = '@jenny_claimed_chapter_stamps';

export const getClaimedChapterStamps = async (): Promise<number[]> => {
  try {
    const value = await getItem(CHAPTER_STAMPS_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v: unknown) => typeof v === 'number') : [];
  } catch (error) {
    console.error('Error getting claimed chapter stamps:', error);
    return [];
  }
};

export const saveClaimedChapterStamp = async (chapterId: number): Promise<void> => {
  try {
    const existing = await getClaimedChapterStamps();
    if (existing.includes(chapterId)) return;
    await setItem(CHAPTER_STAMPS_KEY, JSON.stringify([...existing, chapterId]));
  } catch (error) {
    console.error('Error saving claimed chapter stamp:', error);
  }
};

const DAILY_CHALLENGE_KEY = '@jenny_daily_challenge';

const MECHANIC_INTRO_KEY = '@jenny_mechanic_intros_seen';

export type MechanicIntroKey = 'cats' | 'linked' | 'twin' | 'hungry';

export const setMechanicIntroSeen = async (key: MechanicIntroKey): Promise<void> => {
  try {
    const existing = await getMechanicIntrosSeen();
    if (existing.includes(key)) return;
    await setItem(MECHANIC_INTRO_KEY, JSON.stringify([...existing, key]));
  } catch (error) {
    console.error('Error setting mechanic intro seen:', error);
  }
};

export const getMechanicIntrosSeen = async (): Promise<MechanicIntroKey[]> => {
  try {
    const value = await getItem(MECHANIC_INTRO_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const validKeys: MechanicIntroKey[] = ['cats', 'linked', 'twin', 'hungry'];
    return parsed.filter((v: unknown): v is MechanicIntroKey =>
      typeof v === 'string' && validKeys.includes(v as MechanicIntroKey)
    );
  } catch (error) {
    console.error('Error getting mechanic intros seen:', error);
    return [];
  }
};

export const hasMechanicIntroBeenSeen = async (key: MechanicIntroKey): Promise<boolean> => {
  const seen = await getMechanicIntrosSeen();
  return seen.includes(key);
};

export interface DailyChallengeData {
  currentStreak: number;
  bestStreak: number;
  lastPlayedDate: string;
  completedDates: string[];
  rewardsClaimed: number[];
}

export const saveDailyChallengeData = async (data: DailyChallengeData): Promise<void> => {
  try {
    await setItem(DAILY_CHALLENGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving daily challenge data:', error);
  }
};

export const loadDailyChallengeData = async (): Promise<DailyChallengeData | null> => {
  try {
    return parseDailyChallengeData(await getItem(DAILY_CHALLENGE_KEY));
  } catch (error) {
    console.error('Error loading daily challenge data:', error);
    return null;
  }
};

const AUDIO_PREFS_KEY = '@jenny_audio_prefs';

export interface AudioPrefs {
  sfxEnabled: boolean;
  bgmEnabled: boolean;
}

export const saveAudioPrefs = async (prefs: AudioPrefs): Promise<void> => {
  try {
    await setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Error saving audio prefs:', error);
  }
};

export const loadAudioPrefs = async (): Promise<AudioPrefs | null> => {
  try {
    const jsonValue = await getItem(AUDIO_PREFS_KEY);
    if (jsonValue == null) return null;
    const parsed: unknown = JSON.parse(jsonValue);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as AudioPrefs).sfxEnabled === 'boolean' &&
      typeof (parsed as AudioPrefs).bgmEnabled === 'boolean'
    ) {
      return parsed as AudioPrefs;
    }
    return null;
  } catch (error) {
    console.error('Error loading audio prefs:', error);
    return null;
  }
};

const ADOPTIONS_KEY = '@jenny_claimed_adoptions';

export interface PuppyMilestone {
  chapter: number;
  level: number;
  breedName: string;
  badgeTitle: string;
  icon: string;
  quote: string;
  color: string;
  /** Optional "New Power Unlocked!" ceremony text for milestone levels. */
  powerUnlocked?: string;
}

export const PUPPY_MILESTONES: PuppyMilestone[] = [
  {
    chapter: 1,
    level: 20,
    breedName: 'Sunny Golden Pup',
    badgeTitle: 'Certified Meadow Scout 🏅',
    icon: '🦮',
    quote: 'Always eager, warm, and ready to sniff out the sunniest spots in the meadow!',
    color: '#F39C12',
  },
  {
    chapter: 5,
    level: 100,
    breedName: 'Daisy Corgi Cadet',
    badgeTitle: 'Master Garden Sitter 🎖️',
    icon: '🐕',
    quote: 'Small paws, big heart. Can herd any wandering pup back to safety with a happy wiggle!',
    color: '#E67E22',
  },
  {
    chapter: 10,
    level: 200,
    breedName: 'Zen Shiba Explorer',
    badgeTitle: 'Woodland Guardian 🌲',
    icon: '🦊',
    quote: 'Calm, patient, and wise. Sees the entire garden in harmony before taking a single step.',
    color: '#D35400',
    powerUnlocked: 'Grumpy Cats! 😾 A new mechanic awaits in Chapter 11!',
  },
  {
    chapter: 20,
    level: 400,
    breedName: 'Highland Terrier Scout',
    badgeTitle: 'Linked Bed Pioneer 🔗',
    icon: '🐶',
    quote: 'Fearless and spirited! Mastered the magic of linked beds across distant gardens!',
    color: '#8E44AD',
    powerUnlocked: 'Linked Beds! 🔗 Two flower beds can share one puppy!',
  },
  {
    chapter: 30,
    level: 600,
    breedName: 'Combo Guardian Hound',
    badgeTitle: 'Combo Master 🧩',
    icon: '🐺',
    quote: 'Wise and watchful! Handles cats AND linked beds together like a true expert!',
    color: '#1565C0',
    powerUnlocked: 'Combo Gardens! 😾🔗 Cats and linked beds together!',
  },
  {
    chapter: 40,
    level: 800,
    breedName: 'Twin Pup Champion',
    badgeTitle: 'Twin Puppy Master 👯',
    icon: '🐾',
    quote: 'Double the pups, double the fun! Mastered the art of twin puppy placement!',
    color: '#3949AB',
    powerUnlocked: 'Twin Puppies! 👯 TWO pups per row, column, and patch!',
  },
  {
    chapter: 50,
    level: 1000,
    breedName: 'Grand Legend Jenny',
    badgeTitle: 'Grand Master Sitter 🏆',
    icon: '👑',
    quote: 'The ultimate garden protector. All 1000 meadows are now peaceful and safe under her watch!',
    color: '#27AE60',
    powerUnlocked: 'Grand Championship! 🏆 Every mechanic at once — you\'re a legend!',
  },
];

export const saveClaimedAdoptions = async (claimedLevels: number[]): Promise<void> => {
  try {
    await setItem(ADOPTIONS_KEY, JSON.stringify(claimedLevels));
  } catch (error) {
    console.error('Error saving claimed adoptions:', error);
  }
};

export const loadClaimedAdoptions = async (): Promise<number[]> => {
  try {
    return parseNumberArray(await getItem(ADOPTIONS_KEY));
  } catch (error) {
    console.error('Error loading claimed adoptions:', error);
    return [];
  }
};

/** Last time an interstitial ad was shown (ms epoch) — backs the frequency cap. */
export const getLastInterstitialAt = async (): Promise<number> => {
  try {
    const raw = await getItem(LAST_INTERSTITIAL_KEY);
    const ts = raw ? Number(raw) : 0;
    return Number.isFinite(ts) ? ts : 0;
  } catch (error) {
    console.error('Error loading interstitial timestamp:', error);
    return 0;
  }
};

export const setLastInterstitialAt = async (ts: number): Promise<void> => {
  try {
    await setItem(LAST_INTERSTITIAL_KEY, String(ts));
  } catch (error) {
    console.error('Error saving interstitial timestamp:', error);
  }
};

/**
 * Persistent daily-streak bonus hints.
 *
 * Daily streaks now produce TANGIBLE rewards in addition to the cosmetic
 * badge titles (see STREAK_REWARDS in dailyChallenge.ts).
 *
 *   3 days  → +1 free hint on every level forever
 *   7 days  → +2 free hints on every level forever
 *  14 days  → +3 free hints on every level (cap)
 *  30 days  → +3 capped; badge only (hints are already at the ceiling)
 *
 * We store the *current bonus hints per level* as a single integer so the
 * store & GameScreen hint limit (FREE_HINTS_PER_LEVEL + streak + adFree)
 * formula reads it O(1) without importing daily state.
 */
const STREAK_HINTS_KEY = '@jenny_streak_hints';
const MAX_STREAK_BONUS_HINTS = 3;

// --- Streak Shop consumables (non-resetting; purchased via streak tier spend)
// Hints + undos are global pool. Skips are consumed once per level (keyed by the
// level the player skipped so we never allow double-skip the same level).
const CONSUMABLE_HINTS_KEY = '@jenny_consumable_hints_v1';
const CONSUMABLE_UNDOS_KEY = '@jenny_consumable_undos_v1';
const LEVELS_SKIPPED_KEY = '@jenny_levels_skipped_v1';
// Snapshot of streak counter RIGHT BEFORE it was reset by a missed day — used
// by "🛠️ Repair Streak via Rewarded Ad" so a 12-day streak broken on day 13
// can be fully restored, not just bumped to 1.
const LAST_STREAK_BEFORE_RESET_KEY = '@jenny_last_streak_snapshot_v1';

const readIntSafe = async (key: string): Promise<number> => {
  try {
    const raw = await getItem(key);
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
};

const writeIntSafe = async (key: string, n: number): Promise<void> => {
  try {
    const safe = Math.max(0, Math.floor(n));
    await setItem(key, String(safe));
  } catch {
    // noop — storage backend flake doesn't hard-block gameplay
  }
};

export async function loadConsumableHints(): Promise<number> {
  return readIntSafe(CONSUMABLE_HINTS_KEY);
}
export async function saveConsumableHints(n: number): Promise<void> {
  return writeIntSafe(CONSUMABLE_HINTS_KEY, n);
}
export async function loadConsumableUndos(): Promise<number> {
  return readIntSafe(CONSUMABLE_UNDOS_KEY);
}
export async function saveConsumableUndos(n: number): Promise<void> {
  return writeIntSafe(CONSUMABLE_UNDOS_KEY, n);
}

export const loadLevelsSkipped = async (): Promise<number[]> => {
  try {
    const raw = await getItem(LEVELS_SKIPPED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Upper bound mirrors MAX_LEVEL in proceduralPuzzles (kept literal here —
    // storage is a leaf module and must not pull in the puzzle graph).
    return Array.isArray(parsed) ? parsed.filter((v: unknown): v is number => typeof v === 'number' && v >= 1 && v <= 1200) : [];
  } catch {
    return [];
  }
};

export const saveLevelSkipped = async (level: number): Promise<void> => {
  try {
    const current = new Set(await loadLevelsSkipped());
    if (current.has(level)) return;
    current.add(level);
    await setItem(LEVELS_SKIPPED_KEY, JSON.stringify([...current].sort((a, b) => a - b)));
  } catch {
    // noop
  }
};

export async function loadLastStreakBeforeReset(): Promise<number> {
  return readIntSafe(LAST_STREAK_BEFORE_RESET_KEY);
}
export async function saveLastStreakBeforeReset(n: number): Promise<void> {
  return writeIntSafe(LAST_STREAK_BEFORE_RESET_KEY, n);
}

export const loadStreakBonusHintsPerLevel = async (): Promise<number> => {
  try {
    const raw = await getItem(STREAK_HINTS_KEY);
    if (raw == null) return 0;
    const n = Math.max(0, Math.min(MAX_STREAK_BONUS_HINTS, parseInt(raw, 10)));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

export const saveStreakBonusHintsPerLevel = async (hints: number): Promise<void> => {
  const clamped = Math.max(0, Math.min(MAX_STREAK_BONUS_HINTS, Math.trunc(hints)));
  try {
    await setItem(STREAK_HINTS_KEY, String(clamped));
  } catch (error) {
    console.error('Error saving streak bonus hints:', error);
  }
};

export const STREAK_MAX_BONUS_HINTS = MAX_STREAK_BONUS_HINTS;

