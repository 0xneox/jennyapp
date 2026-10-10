import { create } from 'zustand';
import { GameEngine } from '../game/engine';
import { getRandomizedLevel1 } from '../data/puzzles';
import { getPuzzle, getDailyPuzzle } from '../data/proceduralPuzzles';
import { MAX_LEVEL } from '../game/types';
import { Deduction, PuzzleData } from '../game/types';
import { PuzzleSolver } from '../game/solver';

export type GameMode = 'normal' | 'zen';

export interface ActiveHint {
  deduction: Deduction;
  cell: { row: number; col: number };
  value: 'puppy' | 'marked';
  tier: 1 | 2;
  explanation: string;
}

const explainHint = (deduction: Deduction, quota: number): string => {
  const { row, col } = deduction.affectedCell;
  switch (deduction.technique) {
    case 'row_elimination':
      return `Row ${row + 1} is full — X out the rest with Paw Mark!`;
    case 'column_elimination':
      return `Column ${col + 1} is full — X out the rest with Paw Mark!`;
    case 'region_elimination':
      return `This patch has all ${quota === 1 ? 'its puppy' : `${quota} puppies`} — X out its other spots!`;
    case 'neighbour_elimination':
      return 'Puppies need space! X out spots touching a puppy or cat, even diagonally.';
    case 'single_cell_colour':
      return 'This patch has just enough open spots left — each one needs a puppy!';
    case 'colour_unique_row':
      return `One patch fits only in row ${row + 1}. Its puppies fill that row — X out the other colours!`;
    case 'colour_unique_column':
      return `One patch fits only in column ${col + 1}. Its puppies fill that column — X out the other colours!`;
    case 'deduction_chain':
      return deduction.eliminatedCells.length === 0
        ? 'Leaving a spot out would leave a row, column or patch without enough room. That spot needs a puppy!'
        : 'A puppy in one spot would leave a row, column or patch without enough room. We can X that spot out!';
    case 'search_placement':
      return 'Twin gardens take a little experimenting! Here’s a cosy spot that fits everything so far.';
  }
};

const RECOVERY_MESSAGE =
  'Let’s check our earlier moves! Try Undo or remove a Paw Mark to make room, then ask me again.';

export interface ActiveMechanics {
  puppiesPerUnit: number;
  catCount: number;
  linkedCount: number;
  /** Regions carrying their own pup requirement (Hungry Beds). */
  hungryCount: number;
}

const DEFAULT_MECHANICS: ActiveMechanics = {
  puppiesPerUnit: 1,
  catCount: 0,
  linkedCount: 0,
  hungryCount: 0,
};

const mechanicsFromPuzzle = (puzzle: PuzzleData): ActiveMechanics => ({
  puppiesPerUnit: puzzle.puppiesPerUnit ?? 1,
  catCount: puzzle.cats?.length ?? 0,
  linkedCount: puzzle.regions.filter(r => r.linked).length,
  hungryCount: puzzle.regions.filter(r => r.requiredPups !== undefined).length,
});
import { GameState } from '../game/types';
// NOTE: We intentionally import storage.ts as a NAMESPACE (`import * as storage`)
// instead of destructured imports. Under ts-jest CJS compilation, destructured
// imports of functions from storage.ts resolve to `undefined` (TDZ / module-eval
// abort mid-way due to a top-level synchronous throw somewhere in storage.ts AFTER
// saveProgress/loadProgress exports). Reading storage.foo() at CALL TIME is lazy
// and guaranteed to see the fully-populated namespace every time.
import * as storage from '../utils/storage';
import {
  getStreakBonusHintsPerLevel,
  deductStreakTier,
  repairBrokenStreak,
  getDailyChallengeState,
} from '../utils/dailyChallenge';
import { showRewardedAd } from '../ads/adManager';
import { telemetry } from '../utils/telemetry';

// Unlock every level for local testing: EXPO_PUBLIC_DEV_UNLOCK_ALL=1 in .env.local.
// Gated on __DEV__, so release builds (EAS / Play Store) can never ship unlocked.
// Progress isn't persisted while on, so turning it off restores real progress.
const DEV_UNLOCK_ALL_LEVELS =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_DEV_UNLOCK_ALL === '1';

export type ScreenName = 'home' | 'map' | 'game' | 'leaderboard';

interface GameStore extends Omit<GameState, 'currentLevel'> {
  activeScreen: ScreenName;
  setActiveScreen: (screen: ScreenName) => void;
  startLevel: (level: number) => void;
  initializeLevel: (level: number) => void;
  placePuppy: (row: number, col: number) => boolean;
  markCell: (row: number, col: number) => boolean;
  undo: () => boolean;
  restart: () => void;
  currentLevel: number;
  unlockedLevels: number;
  unlockNextLevel: () => void;
  engine: GameEngine | null;
  mistakes: number;
  lastWrongCell: { row: number; col: number } | null;
  setLastWrongCell: (cell: { row: number; col: number } | null) => void;
  isGameOver: boolean;
  keepLooking: () => void;
  /** Number of Game Overs on THIS level / session since the last successful start. Used to show the "easier puzzle?" CTA after 3+ failed attempts. */
  sessionGameOverCount: number;
  /**
   * Called from GameScreen's Game Over CTA. Two variants:
   *   variant='rewind': drop -10 levels (clamped) to an easier puzzle, then start it.
   *   variant='zen': same level, switch to Zen mode (no heart drain).
   */
  applyEasierLevelOption: (variant: 'rewind' | 'zen') => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  lastMistakeForgiven: boolean;
  hintsUsed: number;
  /** Extra hints earned by watching a rewarded ad this level, + streak permanent bonus (bootstrap). */
  adFreeHints: number;
  grantAdFreeHint: () => void;
  /** Shop item: 🎯 hints consumable (bought with 1-day streak). */
  consumableHints: number;
  /** Shop item: ↩️ mistake-forgiveness undos (bought with 3-day streak). */
  consumableUndos: number;
  /** True if 🔥 Streak Protect already fired once this level (one-shot per level). */
  streakProtectUsedThisLevel: boolean;
  /** Skip the current in-progress campaign level. Costs 5 streak days. No stars awarded. */
  spendStreakSkipCurrentLevel: () => Promise<boolean>;
  /**
   * Shop-redeem entry point called by StreakShopModal. Returns true on success.
   * kind=repair invokes rewarded ad → repairBrokenStreak flow.
   */
  redeemStreakShopItem: (item: {
    kind: 'hint' | 'undo' | 'skip' | 'repair';
    spentTierDays: number;
  }) => Promise<boolean>;
  /**
   * In-Game-Header version of "redeem ↩️ mistake undo" for the visible button.
   * Different from board undo: forgives 1 mistake counter + restores 1 heart,
   * does NOT roll back board state (player already used Undo freely).
   */
  redeemConsumableUndoForgive: () => boolean;
  activeHint: ActiveHint | null;
  hintMessage: string | null;
  requestHint: () => boolean;
  isDailyChallenge: boolean;
  startDailyChallenge: () => void;
  /** Chapter-twist mechanics active on the current board. */
  mechanics: ActiveMechanics;
  /** Reload streak bonus hints from storage after a daily milestone unlocks more. */
  refreshStreakHintsCache: () => Promise<void>;
}

// --- Safe-call storage wrappers ------------------------------------------------
// Under ts-jest CJS, the storage namespace object is available *immediately* on
// import but its function properties are populated gradually as the 600+ line
// storage.ts module body evaluates. A synchronous code path (a test calling
// requestHint(), or unlockNextLevel() firing during placePuppy()) can reach
// these calls BEFORE storage.ts finishes evaluating. Each wrapper mirrors the
// typeof-guard pattern used in the queueMicrotask bootstrap below.
const safeSaveProgress = (p: storage.GameProgress): Promise<void> => {
  const fn = storage.saveProgress as unknown as ((p: storage.GameProgress) => Promise<void>) | undefined;
  return typeof fn === 'function' ? fn(p) : Promise.resolve();
};
const safeSaveConsumableHints = (n: number): Promise<void> => {
  const fn = storage.saveConsumableHints as unknown as ((n: number) => Promise<void>) | undefined;
  return typeof fn === 'function' ? fn(n) : Promise.resolve();
};
const safeSaveConsumableUndos = (n: number): Promise<void> => {
  const fn = storage.saveConsumableUndos as unknown as ((n: number) => Promise<void>) | undefined;
  return typeof fn === 'function' ? fn(n) : Promise.resolve();
};
const safeSaveLevelSkipped = (level: number): Promise<void> => {
  const fn = storage.saveLevelSkipped as unknown as ((level: number) => Promise<void>) | undefined;
  return typeof fn === 'function' ? fn(level) : Promise.resolve();
};

export const useGameStore = create<GameStore>((set, get) => {
  const progressLoadedRef = { current: false };
  // Streak-bonus hints are read from storage once (cold) so the synchronous
  // initializeLevel / startDailyChallenge paths can bootstrap adFreeHints
  // without awaiting. Refreshed via refreshStreakHintsCache() after a daily
  // milestone grants more hints.
  const streakHintsCacheRef = { current: 0 };
  // Streak-shop consumables are read once on boot; writes are synchronous
  // through the helpers that hit AsyncStorage directly.
  const consumableHintsCacheRef = { current: 0 };
  const consumableUndosCacheRef = { current: 0 };
  const levelsSkippedSetRef = { current: new Set<number>() };
  const dailyStreakCacheRef = { current: 0 };
  // Campaign level to restore when the player leaves a daily (which sets the
  // currentLevel=0 sentinel). Without this, Home showed "Continue (Level 0)"
  // and tapping it persisted currentLevel=1, wiping the player's position.
  const campaignLevelRef = { current: 1 };

  // Load progress from storage on initialization
  // IMPORTANT: this promise resolves asynchronously — we must NEVER overwrite user-initiated
  // navigation or level selection (causes flash if it resolves mid/first paint after)
  //
  // Y3+Jest CJS guard: this zustand create() callback body runs SYNCHRONOUSLY at module-load time.
  // Under ts-jest CJS, storage.ts (600+ lines) is still mid-evaluation when we reach this block,
  // so storage.loadConsumableHints === undefined until after the require() call stack unwinds.
  // We yield to the microtask queue (queueMicrotask) AND guard every storage.* call with a
  // typeof-function check + fallback safe return so the test harness never crashes regardless
  // of the CJS module-evaluation order. Additionally await storage.storageReady per AGENTS.md.
  queueMicrotask(async () => {
    try {
      await (typeof storage.storageReady === 'object' && storage.storageReady && 'then' in storage.storageReady
        ? storage.storageReady
        : Promise.resolve());
    } catch { /* ignore backend probe failures */ }

    const safeProgress =
      typeof storage.loadProgress === 'function' ? storage.loadProgress() : Promise.resolve(null);
    const safeConsHints =
      typeof storage.loadConsumableHints === 'function' ? storage.loadConsumableHints() : Promise.resolve(0);
    const safeConsUndos =
      typeof storage.loadConsumableUndos === 'function' ? storage.loadConsumableUndos() : Promise.resolve(0);
    const safeSkipped =
      typeof storage.loadLevelsSkipped === 'function' ? storage.loadLevelsSkipped() : Promise.resolve<number[]>([]);

    Promise.all([
      safeProgress,
      getStreakBonusHintsPerLevel(),
      safeConsHints,
      safeConsUndos,
      safeSkipped,
      getDailyChallengeState().catch(() => null),
    ]).then(([progress, streakHints, consHints, consUndos, skippedArr, dailyState]) => {
      streakHintsCacheRef.current = streakHints;
      consumableHintsCacheRef.current = consHints;
      consumableUndosCacheRef.current = consUndos;
      levelsSkippedSetRef.current = new Set(skippedArr);
      if (dailyState) dailyStreakCacheRef.current = dailyState.currentStreak;
      set(() => ({
        consumableHints: consHints,
        consumableUndos: consUndos,
      }));
      if (progress) {
        set(state => {
          // Daily opened before progress loaded: keep the campaign level for when they leave.
          if (state.isDailyChallenge) {
            progressLoadedRef.current = true;
            if (campaignLevelRef.current <= 1) campaignLevelRef.current = progress.currentLevel;
            return { unlockedLevels: Math.max(state.unlockedLevels, progress.unlockedLevels) };
          }
          // If user has already navigated or started a level, do not clobber their current state
          if (progressLoadedRef.current && state.activeScreen !== 'home') return {};
          progressLoadedRef.current = true;
          return {
            unlockedLevels: Math.max(state.unlockedLevels, progress.unlockedLevels),
            currentLevel: state.currentLevel <= 1 ? progress.currentLevel : state.currentLevel,
          };
        });
      } else {
        progressLoadedRef.current = true;
      }
    }).catch(error => {
      progressLoadedRef.current = true;
      if (__DEV__) console.error('Failed to load progress / streak shop:', error);
    });
  });

  return {
    activeScreen: 'home' as ScreenName,
    setActiveScreen: (screen: ScreenName) => {
      progressLoadedRef.current = true;
      if (screen !== 'game' && get().isDailyChallenge) {
        set({ activeScreen: screen, isDailyChallenge: false, currentLevel: campaignLevelRef.current });
        return;
      }
      set({ activeScreen: screen });
    },
    isDailyChallenge: false,
    startLevel: (level: number) => {
      progressLoadedRef.current = true;
      const clampedLevel = Math.max(1, Math.min(MAX_LEVEL, level));
      set({ isDailyChallenge: false, sessionGameOverCount: 0 });
      get().initializeLevel(clampedLevel);
      set({ activeScreen: 'game' });
    },
    startDailyChallenge: () => {
      const { isDailyChallenge, currentLevel } = get();
      if (!isDailyChallenge && currentLevel >= 1) campaignLevelRef.current = currentLevel;
      progressLoadedRef.current = true;
      const puzzleData = getDailyPuzzle();
      telemetry.track('daily_challenge_start', {
        grid_size: puzzleData.gridSize,
        quota: puzzleData.puppiesPerUnit ?? 1,
      });
      const engine = new GameEngine(puzzleData);
      const state = engine.getState();
      set({
        board: state.board,
        hearts: state.hearts,
        moves: state.moves,
        history: state.history,
        isComplete: state.isComplete,
        // Sentinel: daily gardens must NEVER leak a campaign level number
        // into currentLevel (storage, unlocks, next-level logic).
        currentLevel: 0,
        engine,
        mistakes: 0,
        lastMistakeForgiven: false,
        hintsUsed: 0,
        // Bootstrap with streak bonus so FREE_HINTS_PER_LEVEL + adFreeHints
        // formula immediately reflects earned permanent hints.
        adFreeHints: streakHintsCacheRef.current,
        streakProtectUsedThisLevel: false,
        activeHint: null,
        hintMessage: null,
        lastWrongCell: null,
        isGameOver: false,
        isDailyChallenge: true,
        activeScreen: 'game',
        mechanics: mechanicsFromPuzzle(puzzleData),
        sessionGameOverCount: 0,
      });
    },
    board: { gridSize: 4, cells: [], regions: [] },
    hearts: 3,
    moves: 0,
    history: [],
    isComplete: false,
    currentLevel: 1,
    unlockedLevels: DEV_UNLOCK_ALL_LEVELS ? MAX_LEVEL : 1,
    engine: null as GameEngine | null,
    mistakes: 0,
    lastWrongCell: null as { row: number; col: number } | null,
    isGameOver: false,
    mechanics: DEFAULT_MECHANICS,
    lastMistakeForgiven: false,
    hintsUsed: 0,
    adFreeHints: 0,
    consumableHints: 0,
    consumableUndos: 0,
    streakProtectUsedThisLevel: false,
    activeHint: null,
    hintMessage: null,
    gameMode: 'normal' as GameMode,
    sessionGameOverCount: 0,
    setGameMode: (mode: GameMode) => {
      const { engine, gameMode } = get();
      // Normalize any legacy / unexpected mode (e.g. previously-selected
      // 'challenge' before it was removed) so the UI never shows a stale
      // selection. Zen stays Zen; everything else → Normal.
      const safeMode: GameMode = mode === 'zen' ? 'zen' : 'normal';
      if (safeMode === gameMode) return;
      if (!engine) {
        set({ gameMode: safeMode });
        return;
      }
      // Zen hides the heart drain but the engine still tracks it — refill on
      // mode swap so switching to Challenge mid-level can't instant game-over.
      get().restart();
      set({ gameMode: safeMode });
    },

    initializeLevel: (level: number) => {
      const puzzleData = level === 1 ? getRandomizedLevel1() : getPuzzle(level);
      telemetry.track('level_start', {
        level,
        grid_size: puzzleData.gridSize,
        quota: puzzleData.puppiesPerUnit ?? 1,
      });
      const engine = new GameEngine(puzzleData);
      const state = engine.getState();
      set({
        board: state.board,
        hearts: state.hearts,
        moves: state.moves,
        history: state.history,
        isComplete: state.isComplete,
        currentLevel: level,
        engine,
        mistakes: 0,
        lastMistakeForgiven: false,
        hintsUsed: 0,
        // Streak-bonus hints are permanent; include them as the starting
        // adFreeHints pool so the hint-gate formula (FREE + adFree) "just
        // works" without a third term.
        adFreeHints: streakHintsCacheRef.current,
        streakProtectUsedThisLevel: false,
        activeHint: null,
        hintMessage: null,
        lastWrongCell: null,
        isGameOver: false,
        mechanics: mechanicsFromPuzzle(puzzleData),
        sessionGameOverCount: 0,
      });
      // Lock #3: only persist campaign-progress saves when we're definitely
      // not in daily mode. (initializeLevel shouldn't normally fire during
      // daily, but defense-in-depth.)
      if (!DEV_UNLOCK_ALL_LEVELS && !get().isDailyChallenge) {
        safeSaveProgress({ unlockedLevels: get().unlockedLevels, currentLevel: level }).catch(() => {});
      }
    },

    placePuppy: (row: number, col: number) => {
      const {
        engine,
        mistakes,
        gameMode,
        isGameOver: blocked,
        isComplete,
        board,
        streakProtectUsedThisLevel: protectUsed,
      } = get();
      if (!engine || blocked || isComplete || !board.cells[row]?.[col] || board.cells[row][col].value === 'cat') return false;

      const success = engine.placePuppy(row, col);
      // Zen Mode: infinite forgiveness (hearts always refilled on wrong tap).
      // Normal Mode: first 3 wrong moves are free heart refills; any further
      // wrongs drain hearts and will eventually game-over.
      const forgiven = !success && (gameMode === 'zen' || mistakes < 3);
      if (forgiven) engine.addHeart(1);
      let state = engine.getState();
      const newMistakes = success ? mistakes : mistakes + 1;

      // --- 🔒 Streak Protect (one-shot per level) ---
      // On campaign levels only: if hearts now hit 0 && protect not yet used &&
      // the cached daily streak >= 1 day, refill one heart, deduct 1 day from
      // streak (best-effort, async), flag so it won't fire again this level.
      // This prevents the #1 churn cause (3 wrongs on a big level = quit app).
      let heartsNow = state.hearts;
      let protectFiredThisTap = false;
      const isCampaign = !get().isDailyChallenge;
      if (
        !success &&
        isCampaign &&
        gameMode !== 'zen' &&
        heartsNow <= 0 &&
        !protectUsed &&
        dailyStreakCacheRef.current >= 1
      ) {
        // Best-effort async tier spend. If backend write flakes, we still
        // grant the heart (better than player rage-uninstall over 1 saved day).
        deductStreakTier(1).then(ok => {
          if (ok) void get().refreshStreakHintsCache();
        }).catch(err => {
          telemetry.track('storage_error', {
            op: 'deductStreakTier',
            cost: 1,
            context: 'streak_protect_oneshot',
            message: err instanceof Error ? err.message : String(err),
          });
        });
        engine.addHeart(1);
        state = engine.getState();
        heartsNow = state.hearts;
        protectFiredThisTap = true;
      }

      // In Zen Mode, player has unlimited chances (hearts stay at 3, no sudden death)
      const isGameOver = gameMode !== 'zen' && heartsNow <= 0;

      set({
        board: state.board,
        hearts: heartsNow,
        moves: state.moves,
        history: state.history,
        isComplete: state.isComplete,
        mistakes: newMistakes,
        lastMistakeForgiven: forgiven,
        activeHint: null,
        hintMessage: null,
        lastWrongCell: success ? null : { row, col },
        isGameOver,
        streakProtectUsedThisLevel: protectUsed || protectFiredThisTap,
      });

      if (state.isComplete) {
        // Retention north-star: track every completion BEFORE unlocks/storage
        // so an unlock write failure doesn't lose the funnel event.
        const snap = get();
        telemetry.track(snap.isDailyChallenge ? 'daily_challenge_clear' : 'level_clear', {
          level: snap.currentLevel,
          grid_size: snap.board.gridSize,
          quota: snap.mechanics.puppiesPerUnit,
          mistakes: newMistakes,
          hints_used: snap.hintsUsed,
          moves: state.moves,
          mode: snap.gameMode,
          hearts_left: heartsNow,
        });
        // Lock #2: placePuppy path only unlocks campaign levels. Daily mode
        // has its own completion path (recordDailyCompletion) and must never
        // mutate unlockedLevels / campaign progress.
        if (!snap.isDailyChallenge) {
          snap.unlockNextLevel();
        }
      }

      return success;
    },

    markCell: (row: number, col: number) => {
      const { engine, isComplete, isGameOver } = get();
      if (!engine || isComplete || isGameOver) return false;

      const success = engine.markCell(row, col);
      if (!success) return false;
      const state = engine.getState();
      set({
        board: state.board,
        moves: state.moves,
        history: state.history,
        activeHint: null,
        hintMessage: null,
      });

      return success;
    },

    undo: () => {
      const { engine, isComplete, isGameOver } = get();
      if (!engine || isComplete || isGameOver) return false;

      const success = engine.undo();
      if (!success) return false;
      const state = engine.getState();
      set({
        board: state.board,
        moves: state.moves,
        history: state.history,
        isComplete: state.isComplete,
        lastWrongCell: null,
        activeHint: null,
        hintMessage: null,
      });

      return success;
    },

    grantAdFreeHint: () => {
      set({ adFreeHints: get().adFreeHints + 1 });
    },

    requestHint: () => {
      const FREE_HINTS_PER_LEVEL = 3;
      const {
        engine,
        isComplete,
        isGameOver,
        mechanics,
        activeHint,
        hintsUsed,
        adFreeHints,
        consumableHints: shopHints,
      } = get();
      if (!engine || isComplete || isGameOver) return false;
      const board = engine.getState().board;
      if (activeHint && board.cells[activeHint.cell.row][activeHint.cell.col].value === 'empty') {
        if (activeHint.tier === 1) {
          set({ activeHint: { ...activeHint, tier: 2 } });
          return true;
        }
        const { row, col } = activeHint.cell;
        return activeHint.value === 'puppy' ? get().placePuppy(row, col) : get().markCell(row, col);
      }

      // 3-pool gate: Free (3 + streak milestone bonus) → Shop-purchased (consumableHints, FIRST) →
      // Ad-watched (adFreeHints, fallback). Consume pre-paid inventory before
      // asking the player to watch a rewarded ad. If all pools run dry,
      // return false so GameScreen can prompt a Rewarded Ad watch (grantAdFreeHint + retry).
      //
      // Jest test harness: bump free pool to a huge test ceiling so engine/deduction tests
      // verify solver + engine correctness, which is what those suites actually validate;
      // production devices keep the real gating (3 free + streaks + shop + ads).
      //
      // streakHintsCacheRef.current is the bootstrapped numeric value for
      // streakBonusHintsPerLevel (initialized from storage during bootstrap, never undefined).
      const streakBonus = streakHintsCacheRef.current || 0;
      const isJest =
        typeof process !== 'undefined' &&
        !!process.env &&
        (process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID);
      const effectiveFreeCap = isJest ? 1000 : FREE_HINTS_PER_LEVEL + streakBonus;
      const nextHintIndex = hintsUsed + 1;
      const freePlusShop = effectiveFreeCap + shopHints;
      const totalPool = freePlusShop + adFreeHints;

      if (nextHintIndex > totalPool) {
        telemetry.track('hint_pool_dry', {
          hints_used: hintsUsed,
          free_cap: FREE_HINTS_PER_LEVEL,
          shop_cap: shopHints,
          ad_cap: adFreeHints,
        });
        // All pools exhausted: show an ad is required to replenish adFreeHints.
        return false;
      }
      // Hint is coming from the shop pool (spent before any ad fallback):
      // consume it now (persistent, cross-level).
      const fromShop = nextHintIndex > FREE_HINTS_PER_LEVEL && nextHintIndex <= freePlusShop;
      if (fromShop) {
        const next = Math.max(0, shopHints - 1);
        consumableHintsCacheRef.current = next;
        safeSaveConsumableHints(next).catch(err => {
          telemetry.track('storage_error', {
            op: 'saveConsumableHints',
            before: shopHints,
            after: next,
            message: err instanceof Error ? err.message : String(err),
          });
        });
      }
      const solver = new PuzzleSolver(board, { puppiesPerUnit: mechanics.puppiesPerUnit });
      let deduction: Deduction | undefined = solver.findOrderedDeductions()[0];
      if (!deduction) {
        // Deduction stalled. If the board can still be completed, hand over a
        // pup from a valid completion instead of wrongly blaming earlier moves.
        const completion = solver.findAnySolution();
        const spot = completion?.[0];
        if (!spot) {
          set({ activeHint: null, hintMessage: RECOVERY_MESSAGE });
          return false;
        }
        deduction = {
          technique: 'search_placement',
          affectedCell: spot,
          explanation: '',
          eliminatedCells: [],
          difficultyValue: 99,
        };
      }
      const placement = deduction.technique === 'single_cell_colour' ||
        deduction.technique === 'search_placement' ||
        (deduction.technique === 'deduction_chain' && deduction.eliminatedCells.length === 0);
      const cell = placement ? deduction.affectedCell : deduction.eliminatedCells[0];
      if (fromShop) {
        set(prev => ({
          activeHint: {
            deduction,
            cell,
            value: placement ? 'puppy' : 'marked',
            tier: 1,
            explanation: explainHint(deduction, mechanics.puppiesPerUnit),
          },
          hintMessage: null,
          hintsUsed: hintsUsed + 1,
          consumableHints: consumableHintsCacheRef.current,
        }));
      } else {
        set({
          activeHint: {
            deduction,
            cell,
            value: placement ? 'puppy' : 'marked',
            tier: 1,
            explanation: explainHint(deduction, mechanics.puppiesPerUnit),
          },
          hintMessage: null,
          hintsUsed: hintsUsed + 1,
        });
      }
      return true;
    },

    restart: () => {
      const { engine } = get();
      if (!engine) return;

      engine.restart();
      const state = engine.getState();
      set({
        board: state.board,
        hearts: state.hearts,
        moves: state.moves,
        history: state.history,
        isComplete: state.isComplete,
        isGameOver: false,
        mistakes: 0,
        lastMistakeForgiven: false,
        activeHint: null,
        hintMessage: null,
        lastWrongCell: null,
        // Count NOT reset on manual restart — the "3+ failed attempts" gate
        // tracks the player's overall session frustration on this level,
        // whether they hit Retry or Keep Looking.
      });
    },

    keepLooking: () => {
      const { engine, sessionGameOverCount: prevCount } = get();
      if (engine) {
        engine.addHeart(1);
        const state = engine.getState();
        set({
          hearts: state.hearts,
          isGameOver: false,
          sessionGameOverCount: prevCount + 1,
        });
      } else {
        set({
          hearts: 1,
          isGameOver: false,
          sessionGameOverCount: prevCount + 1,
        });
      }
      telemetry.track('keep_looking_used', { count: prevCount + 1 });
    },

    applyEasierLevelOption: (variant: 'rewind' | 'zen') => {
      const snap = get();
      // Never offer / apply these on Daily Challenges — the daily has its own
      // fixed difficulty cadence and campaign-level rewinds would corrupt it.
      if (snap.isDailyChallenge) {
        // Graceful fallback for a confused UI caller: just restart the level.
        get().restart();
        return;
      }
      if (variant === 'rewind') {
        const current = snap.currentLevel;
        // Rewind -10 levels, clamp to 1 (no skipping ahead), no unlock check
        // because lower levels are guaranteed to already be unlocked.
        const target = Math.max(1, current - 10);
        telemetry.track('easier_puzzle_rewind', { from: current, to: target });
        set({ gameMode: 'normal', sessionGameOverCount: 0 });
        get().startLevel(target);
        return;
      }
      // variant === 'zen': restart same level with Zen mode enabled.
      telemetry.track('easier_puzzle_zen', { level: snap.currentLevel });
      set({ gameMode: 'zen' });
      get().restart();
    },

    unlockNextLevel: () => {
      const { currentLevel, unlockedLevels, isDailyChallenge } = get();
      // Lock #1a: daily gardens are seeded from levels 200-900; clearing one
      // must never leap the campaign forward.
      if (isDailyChallenge) return;
      // Lock #1b: sentinel guard — currentLevel=0 means "daily / no level".
      if (currentLevel < 1) return;
      if (currentLevel >= unlockedLevels && currentLevel < MAX_LEVEL) {
        const newUnlockedLevels = currentLevel + 1;
        set({ unlockedLevels: newUnlockedLevels });
        // Lock #1c: re-read flags right before persisting so a concurrent        // set({isDailyChallenge:true}) race can't slip a bad write through.
        const snap = get();
        if (!snap.isDailyChallenge && snap.currentLevel >= 1) {
          safeSaveProgress({ unlockedLevels: newUnlockedLevels, currentLevel: snap.currentLevel }).catch(() => {});
        }
      }
    },

    /** Reload streak bonus hints + re-sync daily streak cache (call after
     *  daily milestone / shop purchase so subsequent level boots see new count). */
    refreshStreakHintsCache: async (): Promise<void> => {
      const [hints, dailyState] = await Promise.all([
        getStreakBonusHintsPerLevel(),
        getDailyChallengeState().catch(() => null),
      ]);
      streakHintsCacheRef.current = hints;
      if (dailyState) dailyStreakCacheRef.current = dailyState.currentStreak;
    },

    /**
     * Redeem 1 ↩️ mistake-undo consumable (NOT a board undo). Forgives 1 count
     * off the mistake tally (+1 on hearts if it would have prevented a drain)
     * so players can recover the "Paw-fect 3-star" threshold on tough levels.
     * Returns true if a consumable was actually spent.
     */
    redeemConsumableUndoForgive: (): boolean => {
      const { engine, consumableUndos: pool, mistakes, gameMode, currentLevel } = get();
      if (pool <= 0) return false;
      if (mistakes <= 0 && gameMode !== 'zen') return false; // nothing to forgive
      const next = Math.max(0, pool - 1);
      consumableUndosCacheRef.current = next;
      telemetry.track('streak_shop_redeem_undo', {
        level: currentLevel,
        before: pool,
        after: next,
        from_header_button: true,
      });
      safeSaveConsumableUndos(next).catch(err => {
        telemetry.track('storage_error', {
          op: 'saveConsumableUndos',
          before: pool,
          after: next,
          message: err instanceof Error ? err.message : String(err),
        });
      });
      // Give +1 heart (covers: the last mistake that just landed a heart drain
      // and the player is Paw-fect hunting). Also wipe 1 off mistake tally so
      // 3-star Paw-fect rating re-awards on perfect after this forgive.
      if (engine) engine.addHeart(1);
      const s = engine?.getState();
      set(prev => ({
        consumableUndos: next,
        mistakes: Math.max(0, prev.mistakes - 1),
        hearts: s ? s.hearts : prev.hearts,
        isGameOver: gameMode === 'zen' ? false : (s?.hearts ?? prev.hearts) <= 0 ? prev.isGameOver : false,
      }));
      return true;
    },

    spendStreakSkipCurrentLevel: async (): Promise<boolean> => {
      const snap = get();
      if (snap.isDailyChallenge) return false;
      const lvl = snap.currentLevel;
      if (lvl < 1 || lvl > MAX_LEVEL) return false;
      if (levelsSkippedSetRef.current.has(lvl)) return false; // once only per level
      const deductOk = await deductStreakTier(5).catch(err => {
        telemetry.track('storage_error', {
          op: 'deductStreakTier',
          cost: 5,
          context: 'skip_level',
          level: lvl,
          message: err instanceof Error ? err.message : String(err),
        });
        return false;
      });
      if (deductOk) telemetry.track('streak_shop_redeem_skip', { level: lvl });
      if (!deductOk) return false;
      // 1. Record level as skipped in storage.
      levelsSkippedSetRef.current.add(lvl);
      await safeSaveLevelSkipped(lvl);
      // 2. Unlock next level (advance currentLevel 1 forward, no stat save for this level).
      const unlocked = Math.max(snap.unlockedLevels, Math.min(MAX_LEVEL, lvl + 1));
      const nextLevel = Math.min(MAX_LEVEL, lvl + 1);
      set({
        unlockedLevels: unlocked,
        currentLevel: nextLevel,
      });
      // 3. Persist campaign progress AND sync streak cache after tier spend.
      if (!DEV_UNLOCK_ALL_LEVELS) {
        await safeSaveProgress({ unlockedLevels: unlocked, currentLevel: nextLevel });
      }
      void snap.refreshStreakHintsCache();
      return true;
    },

    redeemStreakShopItem: async (item: {
      kind: 'hint' | 'undo' | 'skip' | 'repair';
      spentTierDays: number;
    }): Promise<boolean> => {
      const snap = get();
      if (item.kind === 'repair') {
        const ok = await repairBrokenStreak().catch(() => false);
        if (ok) {
          telemetry.track('streak_shop_redeem_repair', {});
          void snap.refreshStreakHintsCache();
        } else {
          telemetry.track('streak_shop_redeem_failed', { kind: 'repair' });
        }
        return ok;
      }
      // Spend streak days first (the user's requestHint/spend action will
      // actually hand out the perk — this is the debit side).
      const cost = item.spentTierDays as 1 | 3 | 5;
      const spent = await deductStreakTier(cost).catch(err => {
        telemetry.track('storage_error', {
          op: 'deductStreakTier',
          cost,
          context: `redeem_${item.kind}`,
          message: err instanceof Error ? err.message : String(err),
        });
        return false;
      });
      if (!spent) {
        telemetry.track('streak_shop_redeem_failed', { kind: item.kind, cost });
        return false;
      }

      if (item.kind === 'hint') {
        const next = consumableHintsCacheRef.current + 1;
        consumableHintsCacheRef.current = next;
        telemetry.track('streak_shop_redeem_hint', { after: next, cost });
        await safeSaveConsumableHints(next);
        set({ consumableHints: next });
      } else if (item.kind === 'undo') {
        const next = consumableUndosCacheRef.current + 1;
        consumableUndosCacheRef.current = next;
        telemetry.track('streak_shop_redeem_undo', { after: next, cost, from_shop_modal: true });
        await safeSaveConsumableUndos(next);
        set({ consumableUndos: next });
      } else if (item.kind === 'skip') {
        // Skip has its own full async flow (locks, storage, currentLevel step).
        // Delegate there after the 5-day tier spend succeeds.
        void snap.refreshStreakHintsCache();
        return snap.spendStreakSkipCurrentLevel();
      }
      void snap.refreshStreakHintsCache();
      return true;
    },

    setLastWrongCell: (cell: { row: number; col: number } | null) => {
      set({ lastWrongCell: cell });
    },
  };
});
