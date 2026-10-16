/**
 * Twin Puppies (quota-2) boards: levels 601-1000.
 *
 * These boards are search-heavy rather than deduction-driven, so they get
 * three guarantees the classic boards don't need:
 *  1. a solution cap (no degenerate "hundreds of answers" boards),
 *  2. a precomputed seed-trial table so on-device generation is instant,
 *  3. a hint fallback that hands over a real placement instead of blaming
 *     the player when pure deduction stalls on an empty board.
 */
jest.mock('../src/utils/storage', () => ({
  loadProgress: jest.fn(async () => null),
  saveProgress: jest.fn(async () => {}),
}));

import {
  getPuzzle,
  getLevelConfig,
  getLevelMechanics,
  generateDeterministicPuzzle,
  countValidSolutions,
  MAX_TWIN_SOLUTIONS,
} from '../src/data/proceduralPuzzles';
import { TWIN_TRIAL_START } from '../src/data/twinTrialStart';
import { PuzzleSolver } from '../src/game/solver';
import { GameEngine } from '../src/game/engine';
import { useGameStore } from '../src/store/gameStore';

const twinLevels = Array.from({ length: 600 }, (_, i) => 601 + i);
const sample = [601, 640, 700, 760, 801, 850, 901, 946, 975, 1000,
                1001, 1021, 1041, 1061, 1081, 1101, 1121, 1141, 1161, 1181, 1200];

const catForbidden = (p: ReturnType<typeof getPuzzle>) => {
  const n = p.gridSize;
  const forbidden = new Uint8Array(n * n);
  for (const cat of p.cats ?? []) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = cat.row + dr, nc = cat.col + dc;
        if (nr >= 0 && nr < n && nc >= 0 && nc < n) forbidden[nr * n + nc] = 1;
      }
    }
  }
  return forbidden;
};

describe('Twin trial table', () => {
  it('covers every twin level and nothing else', () => {
    const keys = Object.keys(TWIN_TRIAL_START).map(Number).sort((a, b) => a - b);
    expect(keys).toEqual(twinLevels);
    for (const level of keys) expect(getLevelMechanics(level).puppiesPerUnit).toBe(2);
  });

  it.each(sample)('level %i generates from its recorded trial without falling back', level => {
    const p = getPuzzle(level);
    expect(p.seedTrial).toBe(TWIN_TRIAL_START[level]);
    expect(p.gridSize).toBe(getLevelConfig(level).gridSize);
    expect(p.puppiesPerUnit).toBe(2);
    expect(p.cats?.length).toBe(getLevelMechanics(level).catCount);
    // Hungry donors can split into extra linked beds, so only non-hungry
    // specs promise an exact linked count.
    const deltas = getLevelMechanics(level).hungryDeltas ?? [];
    const linkedCount = p.regions.filter(r => r.linked).length;
    if (deltas.length > 0) {
      expect(linkedCount).toBeGreaterThanOrEqual(getLevelMechanics(level).linkedCount);
    } else {
      expect(linkedCount).toBe(getLevelMechanics(level).linkedCount);
    }
    const hungryDeltaCount = deltas.length;
    expect(p.regions.filter(r => r.requiredPups !== undefined).length).toBe(hungryDeltaCount);
  });

  it('the recorded trial is the FIRST passing trial (table is canonical)', () => {
    // Cheap spot check on an 8x8: scanning from 0 must land on the same trial.
    const fresh = generateDeterministicPuzzle(601, 0);
    expect(fresh.seedTrial).toBe(TWIN_TRIAL_START[601]);
  });
});

describe('Twin solution cap', () => {
  it.each(sample)('level %i has between 1 and MAX_TWIN_SOLUTIONS arrangements', level => {
    const p = getPuzzle(level);
    const count = countValidSolutions(p.gridSize, p.regions, 2, catForbidden(p), MAX_TWIN_SOLUTIONS + 2);
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(MAX_TWIN_SOLUTIONS);
  });

  it.each(sample)('level %i: the stored solution is valid by construction', level => {
    const p = getPuzzle(level);
    expect(new GameEngine(p).validateSolution(p.solution)).toBe(true);
  });
});

describe('Hungry beds', () => {
  const hungryLevels = [1021, 1061, 1101, 1141, 1161, 1181];

  it.each(hungryLevels)('level %i: labels sum to the board total and match the spec', level => {
    const p = getPuzzle(level);
    const mech = getLevelMechanics(level);
    const quota = mech.puppiesPerUnit;
    const labelled = p.regions.filter(r => r.requiredPups !== undefined);
    // Every spec delta materialises exactly once.
    const deltas = [...(mech.hungryDeltas ?? [])].sort((a, b) => a - b);
    const actual = labelled.map(r => (r.requiredPups ?? quota) - quota).sort((a, b) => a - b);
    expect(actual).toEqual(deltas);
    // Region requirements still sum to n * quota → total pups unchanged.
    const total = p.regions.reduce((s, r) => s + (r.requiredPups ?? quota), 0);
    expect(total).toBe(p.gridSize * quota);
  });

  it.each(hungryLevels)('level %i: feast and pond regions really hold their counts', level => {
    const p = getPuzzle(level);
    for (const region of p.regions) {
      const inSolution = p.solution.filter(s =>
        region.cells.some(c => c.row === s.row && c.col === s.col)).length;
      expect(inSolution).toBe(region.requiredPups ?? p.puppiesPerUnit);
    }
    expect(new GameEngine(p).validateSolution(p.solution)).toBe(true);
  });

  it('a 0-pup pond region rejects every placement inside it', () => {
    const pond = [1061, 1141, 1181].map(getPuzzle).find(p =>
      p.regions.some(r => r.requiredPups === 0));
    expect(pond).toBeDefined();
    const engine = new GameEngine(pond!);
    const cell = pond!.regions.find(r => r.requiredPups === 0)!.cells[0];
    expect(engine.placePuppy(cell.row, cell.col)).toBe(false);
  });
});

describe('Twin hint fallback', () => {
  it.each(sample)('level %i: findAnySolution completes an empty board', level => {
    const p = getPuzzle(level);
    const engine = new GameEngine(p);
    const solver = new PuzzleSolver(engine.getState().board, { puppiesPerUnit: 2 });
    const placements = solver.findAnySolution();
    expect(placements).not.toBeNull();
    expect(placements!.length).toBe(p.gridSize * 2);
    expect(engine.validateSolution(placements!)).toBe(true);
  });

  it('findAnySolution respects existing pups and Paw Marks', () => {
    const p = getPuzzle(601);
    const engine = new GameEngine(p);
    const [first, second] = p.solution;
    engine.placePuppy(first.row, first.col);
    // Mark a cell that is NOT in the stored solution
    const board = engine.getState().board;
    let marked: { row: number; col: number } | null = null;
    outer: for (let r = 0; r < p.gridSize; r++) {
      for (let c = 0; c < p.gridSize; c++) {
        const inSolution = p.solution.some(s => s.row === r && s.col === c);
        const touchesFirst = Math.abs(r - first.row) <= 1 && Math.abs(c - first.col) <= 1;
        if (!inSolution && !touchesFirst) { marked = { row: r, col: c }; break outer; }
      }
    }
    engine.markCell(marked!.row, marked!.col);
    const solver = new PuzzleSolver(engine.getState().board, { puppiesPerUnit: 2 });
    const placements = solver.findAnySolution()!;
    expect(placements).not.toBeNull();
    expect(placements.some(c => c.row === marked!.row && c.col === marked!.col)).toBe(false);
    expect(placements.some(c => c.row === first.row && c.col === first.col)).toBe(false);
    expect(placements.length).toBe(p.gridSize * 2 - 1);
    void second;
    void board;
  });

  it('returns null on a board that can no longer be completed', () => {
    const p = getPuzzle(601);
    const engine = new GameEngine(p);
    for (let c = 0; c < p.gridSize; c++) engine.markCell(0, c);
    const solver = new PuzzleSolver(engine.getState().board, { puppiesPerUnit: 2 });
    expect(solver.findAnySolution()).toBeNull();
  });

  it('tiered hints can finish a twin board without ever blaming the player', () => {
    const store = useGameStore.getState();
    store.startLevel(601);
    for (let i = 0; i < 400 && !useGameStore.getState().isComplete; i++) {
      const ok = useGameStore.getState().requestHint();
      expect(ok).toBe(true);
      expect(useGameStore.getState().hintMessage).toBeNull();
    }
    expect(useGameStore.getState().isComplete).toBe(true);
    expect(useGameStore.getState().mistakes).toBe(0);
  });

  it('still offers recovery copy when the board is genuinely stuck', () => {
    const store = useGameStore.getState();
    store.startLevel(601);
    for (let c = 0; c < 8; c++) useGameStore.getState().markCell(0, c);
    expect(useGameStore.getState().requestHint()).toBe(false);
    expect(useGameStore.getState().hintMessage).toMatch(/undo/i);
  });
});
