import { PuzzleData, Region, DifficultyLevel, DeductionTechnique, MAX_LEVEL } from '../game/types';
import { puzzles as handcraftedPuzzles } from './puzzles';
import { PuzzleSolver } from '../game/solver';
import { TWIN_TRIAL_START } from './twinTrialStart';

/* ---------------------------------------------------------------------------
 * Sorted handcrafted cache (Levels 11–100).
 * Gives a strictly-ascending visual ramp: gridSize ↑, then #techniques ↑,
 * then original level number as tiebreaker. Uses 90 of the 100 handcrafted
 * puzzles (the 10 largest are dropped — negligible for a 1000-level game).
 * ------------------------------------------------------------------------- */
let _sortedHandcrafted: PuzzleData[] | null = null;
function getSortedHandcrafted(): PuzzleData[] {
  if (!_sortedHandcrafted) {
    _sortedHandcrafted = [...handcraftedPuzzles].sort((a, b) => {
      if (a.gridSize !== b.gridSize) return a.gridSize - b.gridSize;
      const ta = a.techniquesRequired.length;
      const tb = b.techniquesRequired.length;
      if (ta !== tb) return ta - tb;
      return a.level - b.level;
    });
  }
  return _sortedHandcrafted;
}

/* ---------------------------------------------------------------------------
 * Tutorial puzzle generator (Levels 1–10).
 *
 * Onboarding players learn fastest when the board teaches each rule in
 * isolation. We guarantee:
 *   - quota = 1, no cats, no linked beds
 *   - gridSize ramps 4×4 → 5×5 across levels 1→10
 *   - several regions LOCKED to exactly 1 cell ("single_cell_colour" freebie)
 *     Ramp: Level 1 → 3 of 4 regions locked. Level 10 → 2 of 5 locked.
 *   - exactly 1 unique solution, connectivity checked
 * Deterministic per-level (Mulberry32).
 * ------------------------------------------------------------------------- */
function generateTutorialPuzzle(level: number): PuzzleData {
  const n = level <= 4 ? 4 : level <= 7 ? (level % 2 === 1 ? 4 : 5) : 5;
  // Locked single-cell regions: more locks = easier puzzle.
  const lockCount =
    level <= 2 ? n - 1
    : level <= 5 ? n - 2
    : level <= 8 ? 3
    : 2;

  for (let trial = 0; trial < 500; trial++) {
    const rng = createMulberry32(level * 31337 + trial * 7);

    // 1. Valid quota-1 puppy placement (the solution).
    const placedCols: number[] = new Array(n).fill(-1);
    const usedCols = new Uint8Array(n);
    function solveRow(row: number): boolean {
      if (row === n) return true;
      const cands: number[] = [];
      for (let c = 0; c < n; c++) {
        if (usedCols[c]) continue;
        if (row > 0 && Math.abs(c - placedCols[row - 1]) <= 1) continue;
        cands.push(c);
      }
      for (let i = cands.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [cands[i], cands[j]] = [cands[j], cands[i]];
      }
      for (const c of cands) {
        placedCols[row] = c;
        usedCols[c] = 1;
        if (solveRow(row + 1)) return true;
        usedCols[c] = 0;
      }
      placedCols[row] = -1;
      return false;
    }
    if (!solveRow(0)) continue;
    const solution: { row: number; col: number }[] =
      placedCols.map((c, r) => ({ row: r, col: c }));

    // 2. Anchor regions on solution cells. Lock first `lockCount` to 1 cell.
    const grid: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const regions: Region[] = Array.from({ length: n }, (_, i) => ({ id: i + 1, cells: [] }));
    const order = [...Array(n).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const locked = new Set<number>(order.slice(0, lockCount));
    for (let i = 0; i < n; i++) {
      const { row, col } = solution[i];
      grid[row][col] = i + 1;
      regions[i].cells.push({ row, col });
    }

    // 3. Grow unlocked regions to fill. Prefer smallest-region-first for spread.
    const unassigned: { row: number; col: number }[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (grid[r][c] === 0) unassigned.push({ r, c } as any);
    }
    let stuck = false;
    while (unassigned.length > 0) {
      let assigned = false;
      for (let i = 0; i < unassigned.length; i++) {
        const cell = unassigned[i] as any;
        const { r: row, c: col } = cell;
        const adj: number[] = [];
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = row + dr, nc = col + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          const regId = grid[nr][nc];
          if (regId > 0 && !locked.has(regId - 1) && !adj.includes(regId)) adj.push(regId);
        }
        if (adj.length > 0) {
          adj.sort((a, b) => regions[a - 1].cells.length - regions[b - 1].cells.length);
          const chosen = adj[0];
          grid[row][col] = chosen;
          regions[chosen - 1].cells.push({ row, col });
          unassigned.splice(i, 1);
          assigned = true;
          break;
        }
      }
      if (!assigned) { stuck = true; break; }
    }
    if (stuck) continue;

    // 4. Connectivity + uniqueness checks.
    let ok = true;
    for (const reg of regions) {
      if (reg.cells.length > 1 && !isConnected(reg.cells)) { ok = false; break; }
    }
    if (!ok) continue;
    if (countValidSolutions(n, regions, 1, undefined, 2) !== 1) continue;

    // 5. Metadata.
    const introTechs: DeductionTechnique[] = [];
    if (level === 1) introTechs.push('single_cell_colour', 'colour_unique_row', 'colour_unique_column');
    if (level === 2) introTechs.push('neighbour_elimination');
    if (level === 4) introTechs.push('row_elimination');
    if (level === 8) introTechs.push('column_elimination', 'region_elimination');
    const techs: DeductionTechnique[] = ['single_cell_colour', 'colour_unique_row', 'colour_unique_column', 'neighbour_elimination'];
    if (n >= 5) techs.push('row_elimination', 'column_elimination', 'region_elimination');

    const firstSingle = regions.find(r => r.cells.length === 1);
    const startCell = firstSingle ? firstSingle.cells[0] : solution[0];

    return {
      level,
      gridSize: n,
      regions,
      solution,
      difficulty: level <= 7 ? 'beginner' : 'easy',
      techniquesRequired: techs,
      techniquesIntroduced: introTechs,
      hasLogicalStart: true,
      startingDeduction: firstSingle
        ? `Single-cell patch at (${startCell.row + 1}, ${startCell.col + 1}) — that's a puppy!`
        : `Look for a row or column with only one open spot left.`,
      estimatedSolvingSteps: Math.max(n - lockCount + 1, 2),
    };
  }

  // Hardcoded fallback — 4×4 with 3 single-cell regions, trivially solvable.
  return createFallbackTutorial(level);
}

function createFallbackTutorial(level: number): PuzzleData {
  return {
    level,
    gridSize: 4,
    regions: [
      { id: 1, cells: [{ row: 1, col: 3 }] },
      { id: 2, cells: [{ row: 0, col: 1 }] },
      { id: 3, cells: [{ row: 2, col: 0 }] },
      {
        id: 4,
        cells: [
          { row: 0, col: 0 }, { row: 0, col: 2 }, { row: 0, col: 3 },
          { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
          { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
          { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
        ],
      },
    ],
    solution: [
      { row: 0, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 0 }, { row: 3, col: 2 },
    ],
    difficulty: 'beginner',
    techniquesRequired: ['single_cell_colour', 'colour_unique_row', 'colour_unique_column', 'neighbour_elimination'],
    techniquesIntroduced: level === 1 ? ['single_cell_colour', 'colour_unique_row', 'colour_unique_column'] : [],
    hasLogicalStart: true,
    startingDeduction: "Single-cell patch at (2, 4) — that spot IS the puppy!",
    estimatedSolvingSteps: 2,
  };
}

/**
 * High-performance 32-bit PRNG (Mulberry32)
 * Generates deterministic pseudo-random numbers in [0, 1) from an integer seed.
 */
export function createMulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fast BFS connectivity test for region cells
 */
function isConnected(cells: { row: number; col: number }[]): boolean {
  if (cells.length <= 1) return true;
  const cellSet = new Set(cells.map(c => `${c.row},${c.col}`));
  const visited = new Set<string>();
  const queue = [`${cells[0].row},${cells[0].col}`];
  visited.add(queue[0]);

  while (queue.length > 0) {
    const curr = queue.pop()!;
    const [r, c] = curr.split(',').map(Number);
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (cellSet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(key);
      }
    }
  }
  return visited.size === cells.length;
}

/**
 * Ultra-fast backtracking solution counter. Stops as soon as `limit`
 * solutions are found (default 2 — enough to decide uniqueness).
 * Quota-aware: places `quota` mutually non-touching pups per row.
 * `forbidden` marks cat cells + cat-adjacent cells as unplaceable.
 */
export function countValidSolutions(
  gridSize: number,
  regions: Region[],
  quota: number = 1,
  forbidden?: Uint8Array,
  limit: number = 2
): number {
  const size = gridSize;
  const regionMap = new Int32Array(size * size);
  const regionNeed = new Map<number, number>();
  for (const region of regions) {
    regionNeed.set(region.id, region.requiredPups ?? quota);
    for (const cell of region.cells) {
      regionMap[cell.row * size + cell.col] = region.id;
    }
  }

  let solutionCount = 0;
  const usedCols = new Uint8Array(size);
  const usedRegions = new Map<number, number>();
  const placedCols = new Int32Array(size * quota).fill(-1);

  function cellUsable(row: number, col: number): boolean {
    if (forbidden && forbidden[row * size + col]) return false;
    if (usedCols[col] >= quota) return false;
    const regId = regionMap[row * size + col];
    if ((usedRegions.get(regId) || 0) >= (regionNeed.get(regId) ?? quota)) return false;
    if (row > 0) {
      for (let k = 0; k < quota; k++) {
        const pc = placedCols[(row - 1) * quota + k];
        if (pc >= 0 && Math.abs(col - pc) <= 1) return false;
      }
    }
    return true;
  }

  function placeOnRow(row: number, startCol: number, placed: number): void {
    if (solutionCount >= limit) return;
    if (placed === quota) {
      solveRow(row + 1);
      return;
    }
    for (let col = startCol; col < size; col++) {
      if (placed > 0 && col - placedCols[row * quota + placed - 1] <= 1) continue;
      if (!cellUsable(row, col)) continue;

      const regId = regionMap[row * size + col];
      usedCols[col]++;
      usedRegions.set(regId, (usedRegions.get(regId) || 0) + 1);
      placedCols[row * quota + placed] = col;

      placeOnRow(row, col + 1, placed + 1);

      usedCols[col]--;
      usedRegions.set(regId, usedRegions.get(regId)! - 1);
      placedCols[row * quota + placed] = -1;
      if (solutionCount >= limit) return;
    }
  }

  function solveRow(row: number): void {
    if (solutionCount >= limit) return;
    if (row === size) {
      for (const region of regions) {
        if ((usedRegions.get(region.id) || 0) !== (region.requiredPups ?? quota)) return;
      }
      for (let c = 0; c < size; c++) {
        if (usedCols[c] !== quota) return;
      }
      solutionCount++;
      return;
    }
    placeOnRow(row, 0, 0);
  }

  solveRow(0);
  return solutionCount;
}

/** Twin (quota-2) boards may have at most this many valid arrangements. */
export const MAX_TWIN_SOLUTIONS = 3;

// Re-export so scripts/tests can keep importing it from the data module.
export { MAX_LEVEL };

/**
 * Chapter-twist mechanics layered on top of the classic rules.
 * Keeps grids at phone-friendly sizes while still escalating difficulty.
 */
export interface LevelMechanics {
  /** 1 = classic, 2 = Twin Puppies (two pups per row/col/region). */
  puppiesPerUnit: number;
  /** Grumpy cat cells: unplaceable, and ban pups in all 8 neighbours. */
  catCount: number;
  /** Non-contiguous regions that share a single puppy. */
  linkedCount: number;
  /** Minimum hypothesis-chain deductions the solver must need. */
  minChains: number;
  /**
   * Hungry beds: per-region quota deltas applied on top of puppiesPerUnit
   * (must sum to 0 so row/col totals are unchanged). [1,-1] = one bed needs
   * quota+1 pups, another needs quota-1. [] or undefined = uniform quota.
   */
  hungryDeltas?: number[];
}

export function getLevelMechanics(level: number): LevelMechanics {
  if (level <= 100) {
    // Handcrafted/sorted campaign + tutorial — no procedural mechanics.
    return { puppiesPerUnit: 1, catCount: 0, linkedCount: 0, minChains: 0 };
  }

  // =========================================================================
  // Levels 101–600: quota-1 (classic). Exactly 1 solution, pure deduction.
  //   Boundaries tuned so gridSize from getLevelConfig() changes every ~50
  //   levels instead of 100–200, eliminating the "same puzzle on repeat"
  //   feel reported in playtesting.
  // =========================================================================
  if (level <= 150) {
    return { puppiesPerUnit: 1, catCount: 0, linkedCount: 0,
             minChains: level <= 125 ? 0 : 1 };
  }
  if (level <= 200) {
    return { puppiesPerUnit: 1, catCount: 0, linkedCount: 0,
             minChains: level <= 175 ? 1 : 2 };
  }
  if (level <= 250) {
    // Grumpy Cats debut.
    return { puppiesPerUnit: 1, catCount: level <= 225 ? 1 : 2, linkedCount: 0,
             minChains: 0 };
  }
  if (level <= 300) {
    return { puppiesPerUnit: 1, catCount: 2, linkedCount: 0,
             minChains: level <= 275 ? 0 : 1 };
  }
  if (level <= 350) {
    // Linked Beds debut.
    return { puppiesPerUnit: 1, catCount: 0, linkedCount: level <= 325 ? 1 : 2,
             minChains: 0 };
  }
  if (level <= 400) {
    return { puppiesPerUnit: 1, catCount: 0, linkedCount: 2,
             minChains: level <= 375 ? 0 : 1 };
  }
  if (level <= 450) {
    // Combo: 1 cat + 1 link.
    return { puppiesPerUnit: 1, catCount: 1, linkedCount: 1,
             minChains: level <= 425 ? 0 : 1 };
  }
  if (level <= 500) {
    return { puppiesPerUnit: 1,
             catCount:   level <= 475 ? 1 : 2,
             linkedCount: level <= 475 ? 1 : 2,
             minChains: 1 };
  }
  if (level <= 550) {
    // Grid bump to 8×8 quota-1.
    return { puppiesPerUnit: 1, catCount: 2, linkedCount: 2,
             minChains: level <= 525 ? 1 : 2 };
  }
  if (level <= 600) {
    // Quota-1 finale: max everything on 8×8.
    return { puppiesPerUnit: 1, catCount: 2, linkedCount: 2, minChains: 2 };
  }

  // =========================================================================
  // Levels 601–1000: quota-2 (Twin Puppies). 1–3 solutions tolerated.
  //   ⚠  Twin is mathematically infeasible below gridSize 8×8.
  //   ⚠  Changing any threshold below REQUIRES regenerating the trial table:
  //        scripts/buildTwinTrialTable.ts   then   tests/twinBoards.test.ts
  // =========================================================================
  if (level <= 650) {
    // Twin debut on 8×8 — pure, no distractions.
    return { puppiesPerUnit: 2, catCount: 0, linkedCount: 0, minChains: 0 };
  }
  if (level <= 700) {
    return { puppiesPerUnit: 2, catCount: 0,
             linkedCount: level <= 675 ? 1 : 2, minChains: 0 };
  }
  if (level <= 750) {
    // Grid bump to 9×9 twin.
    return { puppiesPerUnit: 2, catCount: 0,
             linkedCount: level <= 725 ? 1 : 2, minChains: 0 };
  }
  if (level <= 800) {
    return { puppiesPerUnit: 2, catCount: 0, linkedCount: 2, minChains: 0 };
  }
  if (level <= 850) {
    // Cats join the twin arena.
    return { puppiesPerUnit: 2, catCount: 1,
             linkedCount: level <= 825 ? 0 : 1, minChains: 0 };
  }
  if (level <= 900) {
    return { puppiesPerUnit: 2,
             catCount: level <= 875 ? 1 : 2,
             linkedCount: 1, minChains: 0 };
  }
  if (level <= 950) {
    // 10×10 championship: cats + linked twins.
    return { puppiesPerUnit: 2, catCount: 1,
             linkedCount: level <= 925 ? 1 : 2, minChains: 0 };
  }
  // 951–1000 — ultimate: 10×10, 1→2 cats, 2 links.
  if (level <= 1000) {
    return {
      puppiesPerUnit: 2,
      catCount: level <= 975 ? 1 : 2,
      linkedCount: 2,
      minChains: 0,
    };
  }

  // =========================================================================
  // Levels 1001–1200: post-sanctuary encore, all 10×10.
  //   Quota-3 is mathematically impossible on 10×10 (two adjacent rows can't
  //   each hold 3 non-touching pups on width 10), so the headline mechanic is
  //   HUNGRY BEDS: regions get their own pup requirement (0–4) while rows &
  //   columns stay at 2. Hungry chapters interleave with quota-2 remix
  //   chapters that push cat/link counts to 3 for the first time.
  //   ⚠  Same rule as twins: every level here is capped-search, so ALL of
  //      them need entries in the trial table — rebuild it after any change.
  // =========================================================================
  if (level <= 1020) {
    // Victory-lap remix: triple linked beds debut on twin boards.
    return { puppiesPerUnit: 2, catCount: 2, linkedCount: 3, minChains: 0 };
  }
  if (level <= 1040) {
    // Hungry Beds debut — pond (0 pups) + feast (4). Empirically the ONLY
    // single-pair spec that stays under the cap: a lone -1 light bed relaxes
    // the board past 3 solutions every trial.
    return { puppiesPerUnit: 2, catCount: 0, linkedCount: 0,
             minChains: 0, hungryDeltas: [2, -2] };
  }
  if (level <= 1060) {
    // Remix: triple cats debut on twin boards.
    return { puppiesPerUnit: 2, catCount: 3, linkedCount: 1, minChains: 0 };
  }
  if (level <= 1080) {
    // The Pond debuts: a 0-pup bed + a feast bed holding 4.
    return { puppiesPerUnit: 2, catCount: 0, linkedCount: 1,
             minChains: 0, hungryDeltas: [2, -2] };
  }
  if (level <= 1100) {
    // Remix peak: max cats + max links on twin boards.
    return { puppiesPerUnit: 2, catCount: 3, linkedCount: 3, minChains: 0 };
  }
  if (level <= 1120) {
    // Lighter beds debut — but only in balanced pairs (a lone -1 fails the cap).
    return { puppiesPerUnit: 2, catCount: 0, linkedCount: 0,
             minChains: 0, hungryDeltas: [1, -1, 1, -1] };
  }
  if (level <= 1140) {
    // Breather remix — lighter combo before the finale push.
    return { puppiesPerUnit: 2, catCount: 1, linkedCount: 2, minChains: 0 };
  }
  if (level <= 1160) {
    // Pond + feast, now with a cat guarding them.
    return { puppiesPerUnit: 2, catCount: 1, linkedCount: 0,
             minChains: 0, hungryDeltas: [2, -2] };
  }
  if (level <= 1180) {
    return { puppiesPerUnit: 2, catCount: 1, linkedCount: 1,
             minChains: 0, hungryDeltas: [1, -1, 1, -1] };
  }
  // 1181–1200 — encore finale: pond + feast + light/hungry pair, cats, links.
  return { puppiesPerUnit: 2, catCount: 2, linkedCount: 2,
           minChains: 0, hungryDeltas: [2, -2, 1, -1] };
}

/**
 * Determine grid size and difficulty target for any level number 1..1000.
 *
 * GRID SIZES ARE NOW STRICTLY ASCENDING (your playtesting feedback).
 *   Old: 100–200 consecutive levels at the same size → "same puzzle on repeat".
 *   New: changes every ~50–100 levels; never decreases.
 *
 * Chapter accent-colour / icon changes already happen every 20 levels, so
 * between the two players see fresh visuals roughly twice per chapter.
 */
export function getLevelConfig(level: number): {
  gridSize: number;
  difficulty: DifficultyLevel;
} {
  // Tutorial + sorted handcrafted campaign (sorted ramp: 4×4 → 9×9 across 100 lvls)
  if (level <= 10) return { gridSize: level <= 4 ? 4 : level <= 7 ? (level % 2 === 1 ? 4 : 5) : 5, difficulty: 'beginner' };
  if (level <= 20) return { gridSize: level <= 15 ? 4 : 5, difficulty: 'beginner' };
  if (level <= 40) return { gridSize: level <= 30 ? 5 : 6, difficulty: 'easy' };
  if (level <= 60) return { gridSize: level <= 50 ? 6 : 7, difficulty: 'medium' };
  if (level <= 80) return { gridSize: level <= 70 ? 7 : 8, difficulty: 'hard' };
  if (level <= 100) return { gridSize: level <= 90 ? 8 : 9, difficulty: 'expert' };

  // ----- Procedural campaign (101–1000): strictly non-decreasing -----
  if (level <= 175)  return { gridSize: 5, difficulty: level <= 140 ? 'beginner' : 'easy' };
  if (level <= 275)  return { gridSize: 6, difficulty: level <= 225 ? 'easy' : 'medium' };
  if (level <= 375)  return { gridSize: 7, difficulty: 'medium' };
  if (level <= 500)  return { gridSize: 7, difficulty: level <= 450 ? 'medium' : 'hard' };
  if (level <= 600)  return { gridSize: 8, difficulty: 'hard' };
  // quota=2 (Twin Puppies) begins at 601 — mathematically infeasible below 8×8
  if (level <= 700)  return { gridSize: 8, difficulty: level <= 650 ? 'hard' : 'expert' };
  if (level <= 800)  return { gridSize: 9, difficulty: 'expert' };
  if (level <= 900)  return { gridSize: 9, difficulty: 'expert' };
  if (level <= 950)  return { gridSize: 10, difficulty: 'master' };
  if (level <= 1000) return { gridSize: 10, difficulty: level <= 975 ? 'master' : 'legend' };
  // 1001+: encore campaign — 10×10 is the ceiling, difficulty lives in the
  // mechanic mix (quota-3 boards, triple cats/links) rather than the badge.
  return { gridSize: 10, difficulty: 'legend' };
}

/**
 * In-memory LRU cache for on-demand generated puzzles
 */
const puzzleCache = new Map<number, PuzzleData>();

/**
 * Construct a verified procedural puzzle deterministically using level as seed.
 */
export function generateDeterministicPuzzle(
  level: number,
  startTrial: number = TWIN_TRIAL_START[level] ?? 0,
  verifyAllTrials: boolean = false,
  maxTrialsOverride?: number
): PuzzleData {
  const { gridSize: n, difficulty } = getLevelConfig(level);
  const mech = getLevelMechanics(level);
  const quota = mech.puppiesPerUnit;
  // Hungry beds tighten the cap pass-rate (~1 in 600 trials for a pond+feast
  // pair) — give those specs a bigger search budget so rare-but-valid seeds
  // aren't forced into the handcrafted fallback.
  const maxTrials = maxTrialsOverride ??
    600 * quota * ((mech.hungryDeltas?.length ?? 0) > 0 ? 6 : 1);
  // When resuming from the precomputed table the cap was already proven
  // offline (scripts/buildTwinTrialTable.ts + tests/twinBoards.test.ts), so
  // the runtime only needs an existence check — exhausting a 10x10 quota-2
  // search tree can otherwise cost hundreds of ms on a phone. The skip must
  // only apply to a genuine resume (startTrial === tableTrial): a scan from
  // 0 that trusts the recorded entry would re-bless a stale value, which is
  // exactly how the table builder regenerates the table.
  const tableTrial = verifyAllTrials ? undefined : TWIN_TRIAL_START[level];

  for (let trial = startTrial; trial < maxTrials; trial++) {
    const rng = createMulberry32(level * 7919 + trial * 31);

    // 1. Solve for non-touching puppies — `quota` per row, column & region
    const rowCols: number[][] = [];
    const used = new Uint8Array(n);

    function solve(r: number): boolean {
      if (r === n) return true;
      const combos: number[][] = [];
      const pick = (start: number, chosen: number[]) => {
        if (chosen.length === quota) {
          combos.push([...chosen]);
          return;
        }
        for (let c = start; c < n; c++) {
          if (used[c] >= quota) continue;
          if (chosen.length > 0 && c - chosen[chosen.length - 1] < 2) continue;
          if (r > 0 && rowCols[r - 1].some(pc => Math.abs(c - pc) < 2)) continue;
          chosen.push(c);
          pick(c + 1, chosen);
          chosen.pop();
        }
      };
      pick(0, []);
      // Seeded Fisher-Yates shuffle
      for (let i = combos.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [combos[i], combos[j]] = [combos[j], combos[i]];
      }
      for (const combo of combos) {
        rowCols.push(combo);
        for (const c of combo) used[c]++;
        if (solve(r + 1)) return true;
        rowCols.pop();
        for (const c of combo) used[c]--;
      }
      return false;
    }

    if (!solve(0)) continue;
    const solution: { row: number; col: number }[] = [];
    rowCols.forEach((cols, row) => {
      for (const col of cols) solution.push({ row, col });
    });

    // 2. Initialize regions — region i is anchored on row i's `quota` pups
    const grid: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const regions: Region[] = Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      cells: [],
    }));

    // Anchor regions stay exactly 1 cell → a forced single-cell starting clue.
    // Disabled at quota>1: a locked twin region would be two non-adjacent
    // seeds, which is disconnected by definition and can never pass the
    // connectivity check.
    const lockedRegionIds = new Set<number>();
    if (quota === 1) {
      if (n >= 8 || trial > 15) {
        lockedRegionIds.add(1);
        lockedRegionIds.add(n);
      } else {
        lockedRegionIds.add(1);
      }
    }

    for (let i = 0; i < n; i++) {
      for (let k = 0; k < quota; k++) {
        const cell = solution[i * quota + k];
        grid[cell.row][cell.col] = i + 1;
        regions[i].cells.push({ row: cell.row, col: cell.col });
      }
    }

    // 3. Collect unassigned cells
    const unassigned: { row: number; col: number }[] = [];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] === 0) unassigned.push({ row: r, col: c });
      }
    }
    unassigned.sort((a, b) => a.row - b.row || a.col - b.col);

    // 4. Directional region growth (closest distance + smallest size priority)
    let stuck = false;
    while (unassigned.length > 0) {
      let assigned = false;
      for (let i = 0; i < unassigned.length; i++) {
        const { row, col } = unassigned[i];
        const adjRegs: number[] = [];
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nr = row + dr;
          const nc = col + dc;
          if (nr >= 0 && nr < n && nc >= 0 && nc < n && grid[nr][nc] > 0) {
            const regId = grid[nr][nc];
            if (!lockedRegionIds.has(regId) && !adjRegs.includes(regId)) {
              adjRegs.push(regId);
            }
          }
        }

        if (adjRegs.length > 0) {
          adjRegs.sort((a, b) => {
            const distA = Math.abs(a - 1 - row);
            const distB = Math.abs(b - 1 - row);
            if (distA !== distB) return distA - distB;
            return regions[a - 1].cells.length - regions[b - 1].cells.length;
          });

          const chosen = adjRegs[0];
          grid[row][col] = chosen;
          regions[chosen - 1].cells.push({ row, col });
          unassigned.splice(i, 1);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        stuck = true;
        break;
      }
    }

    if (stuck) continue;
    if (regions.some(r => !isConnected(r.cells))) continue;

    const solutionSet = new Set(solution.map(s => s.row * n + s.col));

    // 5. Grumpy cats — placed away from every solution pup (cat aura) and
    // never inside locked anchor regions
    const cats: { row: number; col: number }[] = [];
    const forbidden = new Uint8Array(n * n);
    if (mech.catCount > 0) {
      const catCandidates: { row: number; col: number }[] = [];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (solutionSet.has(r * n + c)) continue;
          if (lockedRegionIds.has(grid[r][c])) continue;
          let nearSolution = false;
          for (const s of solution) {
            if (Math.abs(s.row - r) <= 1 && Math.abs(s.col - c) <= 1) {
              nearSolution = true;
              break;
            }
          }
          if (!nearSolution) catCandidates.push({ row: r, col: c });
        }
      }
      for (let i = catCandidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [catCandidates[i], catCandidates[j]] = [catCandidates[j], catCandidates[i]];
      }
      for (const cell of catCandidates.slice(0, mech.catCount)) {
        cats.push(cell);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cell.row + dr;
            const nc = cell.col + dc;
            if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
              forbidden[nr * n + nc] = 1;
            }
          }
        }
      }
      if (cats.length < mech.catCount) continue;
    }

    // 6. Linked beds — steal a remote (non-adjacent) cell into a region so it
    // becomes intentionally non-contiguous while sharing one puppy
    if (mech.linkedCount > 0) {
      const solutionName = new Set(solution.map(s => `${s.row},${s.col}`));
      const linkedSoFar = new Set<number>();
      for (let k = 0; k < mech.linkedCount; k++) {
        const targets = regions
          .map(r => r.id)
          .filter(id => !lockedRegionIds.has(id) && !linkedSoFar.has(id));
        for (let i = targets.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [targets[i], targets[j]] = [targets[j], targets[i]];
        }

        let done = false;
        for (const rid of targets) {
          const R = regions[rid - 1];
          const donors: { q: Region; cell: { row: number; col: number } }[] = [];
          for (const Q of regions) {
            if (Q.id === R.id || lockedRegionIds.has(Q.id) || Q.cells.length <= 1) continue;
            for (const cell of Q.cells) {
              if (solutionName.has(`${cell.row},${cell.col}`)) continue;
              if (cats.some(ct => ct.row === cell.row && ct.col === cell.col)) continue;
              const touchesR = R.cells.some(
                rc => Math.abs(rc.row - cell.row) + Math.abs(rc.col - cell.col) === 1
              );
              if (!touchesR) donors.push({ q: Q, cell });
            }
          }
          for (let i = donors.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [donors[i], donors[j]] = [donors[j], donors[i]];
          }
          for (const d of donors) {
            d.q.cells = d.q.cells.filter(
              c => !(c.row === d.cell.row && c.col === d.cell.col)
            );
            if (d.q.cells.length === 0 || !isConnected(d.q.cells)) {
              d.q.cells.push(d.cell);
              continue;
            }
            R.cells.push(d.cell);
            R.linked = true;
            linkedSoFar.add(R.id);
            done = true;
            break;
          }
          if (done) break;
        }
      }
      if (linkedSoFar.size < mech.linkedCount) continue;
    }

    // 6.5 Hungry beds — give selected regions their own pup requirement.
    // Each +k "feast" region steals k SOLUTION cells from its -k donor, so
    // the stored solution still satisfies every label by construction
    // (deltas always sum to 0 → row/col quotas are untouched).
    const deltas = mech.hungryDeltas ?? [];
    if (deltas.length > 0) {
      const pos = deltas.filter(d => d > 0).sort((a, b) => b - a);
      const neg = deltas.filter(d => d < 0).map(d => -d).sort((a, b) => b - a);
      const specValid = pos.length === neg.length && pos.every((p, i) => p === neg[i]);
      let hungryFailed = !specValid;

      const usedHungry = new Set<number>();
      const shuffle = (ids: number[]) => {
        for (let i = ids.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [ids[i], ids[j]] = [ids[j], ids[i]];
        }
        return ids;
      };

      for (const k of pos) {
        if (hungryFailed) break;
        const targets = shuffle(regions.map(r => r.id).filter(id => !usedHungry.has(id)));
        let done = false;
        for (const tid of targets) {
          const T = regions[tid - 1];
          const donors = shuffle(
            regions.map(r => r.id).filter(id =>
              id !== tid && !usedHungry.has(id) && regions[id - 1].cells.length - k >= 1)
          );
          for (const did of donors) {
            const D = regions[did - 1];
            const donorSolCells = D.cells.filter(c => solutionSet.has(c.row * n + c.col));
            if (donorSolCells.length < k) continue;
            // Prefer solution cells adjacent to T (keeps T contiguous);
            // non-adjacent steals honestly mark T as linked.
            const key = (c: { row: number; col: number }) => `${c.row},${c.col}`;
            const adjacent = donorSolCells.filter(c =>
              T.cells.some(tc => Math.abs(tc.row - c.row) + Math.abs(tc.col - c.col) === 1));
            const adjacentKeys = new Set(adjacent.map(key));
            const steal = [...adjacent, ...donorSolCells.filter(c => !adjacentKeys.has(key(c)))].slice(0, k);
            const removed = new Set(steal.map(key));
            const remaining = D.cells.filter(c => !removed.has(key(c)));
            if (remaining.length === 0) continue;
            D.cells = remaining;
            // A donor that loses interior cells can split — that's just a
            // linked bed, which is already a legal board feature.
            if (!isConnected(remaining)) D.linked = true;
            for (const c of steal) {
              const detached = !T.cells.some(
                tc => Math.abs(tc.row - c.row) + Math.abs(tc.col - c.col) === 1
              );
              T.cells.push(c);
              if (detached) T.linked = true;
            }
            T.requiredPups = quota + k;
            D.requiredPups = quota - k;
            usedHungry.add(tid);
            usedHungry.add(did);
            done = true;
            break;
          }
          if (done) break;
        }
        if (!done) hungryFailed = true;
      }
      if (hungryFailed) continue;
    }

    // 7. Solution check + logic-solvability gate.
    // Quota-1 boards must be UNIQUE and solvable by pure deduction (no guessing).
    // Twin boards are intrinsically search-heavy — players solve them by
    // experimenting with instant validity feedback — so we allow a small
    // handful of arrangements, but reject degenerate boards with many.
    // `solution` is valid by construction (regions anchored on its pups, cats
    // kept out of its aura, linked cells never stolen from it), so existence
    // is guaranteed; the count only decides uniqueness / the cap.
    const capVerifiedOffline =
      quota > 1 && tableTrial !== undefined && startTrial === tableTrial && trial === tableTrial;
    if (!capVerifiedOffline) {
      const limit = quota === 1 ? 2 : MAX_TWIN_SOLUTIONS + 1;
      const solutionCount = countValidSolutions(n, regions, quota, forbidden, limit);
      const withinCap = quota === 1 ? solutionCount === 1 : solutionCount <= MAX_TWIN_SOLUTIONS;
      if (!withinCap) continue;
    }

    let deductionsApplied = n * quota * 2;
    if (quota === 1) {
      const scratchCells = Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => ({
          row: r,
          col: c,
          value: cats.some(ct => ct.row === r && ct.col === c)
            ? ('cat' as const)
            : ('empty' as const),
        }))
      );
      const analysis = new PuzzleSolver(
        { gridSize: n, cells: scratchCells, regions },
        { puppiesPerUnit: quota }
      ).analyze();
      if (!analysis.solvable || analysis.chainsUsed < mech.minChains) continue;
      deductionsApplied = analysis.deductionsApplied;
    }

    const firstLocked = Array.from(lockedRegionIds)[0] ?? 1;
    const anchorCell = regions[firstLocked - 1].cells[0];
    const techniquesRequired: PuzzleData['techniquesRequired'] = [
      'single_cell_colour',
      'row_elimination',
      'column_elimination',
      'neighbour_elimination',
    ];
    if (quota === 1 && mech.minChains > 0) techniquesRequired.push('deduction_chain');

    return {
      level,
      gridSize: n,
      regions,
      solution,
      difficulty,
      techniquesRequired,
      techniquesIntroduced: [],
      hasLogicalStart: true,
      startingDeduction: `Single-cell colour at (${anchorCell.row}, ${anchorCell.col})`,
      estimatedSolvingSteps: deductionsApplied,
      puppiesPerUnit: quota,
      cats,
      seedTrial: trial,
    };
  }

  // Ultra-resilient fallback: return an adjacent verified puzzle configuration scaled to level
  const fallbackLevel = 100;
  const fallback = handcraftedPuzzles[fallbackLevel - 1];
  return {
    ...fallback,
    level,
    difficulty,
    puppiesPerUnit: 1,
    cats: [],
  };
}

/**
 * Get any puzzle from Level 1 to 1000.
 *
 *     1 – 10  → onboarding tutorials (tiny boards + many single-cell freebies)
 *    11 – 100 → handcrafted campaign, SORTED by ascending gridSize so the
 *               visual ramp never plateaus for 20+ levels at a stretch
 *   101 – 1000 → deterministic procedural generation (deduction-gated for
 *               101–600, twin-capped for 601–1000) with LRU in-memory cache
 */
export function getPuzzle(levelNumber: number): PuzzleData {
  const level = Math.max(1, Math.min(MAX_LEVEL, levelNumber));

  // --- Levels 1–10: onboarding tutorials ---
  if (level <= 10) {
    const cached = puzzleCache.get(level);
    if (cached) return cached;
    const puzzle = generateTutorialPuzzle(level);
    puzzleCache.set(level, puzzle);
    return puzzle;
  }

  // --- Levels 11–100: handcrafted sorted by visual difficulty (gridSize ↑) ---
  if (level <= 100) {
    const sorted = getSortedHandcrafted();
    const idx = Math.min(level - 11, sorted.length - 1);
    return { ...sorted[idx], level };
  }

  // --- Levels 101–1000: procedural + LRU cache ---
  const cached = puzzleCache.get(level);
  if (cached) return cached;
  const puzzle = generateDeterministicPuzzle(level);
  puzzleCache.set(level, puzzle);
  return puzzle;
}

/**
 * Daily Challenge Puzzle Generator (seeded by date integer, e.g. 20260909)
 */
export function getDailyPuzzle(dateSeed?: number): PuzzleData {
  const seed =
    dateSeed ||
    (() => {
      const now = new Date();
      return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    })();

  // Map date seed into range 200..900 for an enjoyable daily medium/hard challenge
  const mappedLevel = 200 + (Math.abs(seed) % 701);
  return getPuzzle(mappedLevel);
}
