import { getLevelRules, getRuleChips } from '../src/data/levelRules';
import { getDifficultyLabel, getLevelDifficulty } from '../src/utils/levelHelpers';
import { getLevelMechanics, getPuzzle } from '../src/data/proceduralPuzzles';
import { explainHint } from '../src/store/gameStore';
import { Deduction, Region } from '../src/game/types';

const mech = (puppiesPerUnit: number, catCount = 0, linkedCount = 0, hungryCount = 0) =>
  ({ puppiesPerUnit, catCount, linkedCount, hungryCount });

describe('Level-aware How to Play', () => {
  it('classic levels teach 1 puppy and nothing extra', () => {
    const rules = getLevelRules(mech(1));
    expect(rules[0].title).toBe('1 puppy in every row & column');
    expect(rules.map(r => r.emoji)).toEqual(['🐶', '🚫', '💡']);
  });

  it('twin linked beds say they share 2, classic linked beds say 1', () => {
    const twin = getLevelRules(mech(2, 0, 2)).find(r => r.title === 'Linked beds')!;
    expect(twin.body).toContain('2 puppies in total');
    const classic = getLevelRules(mech(1, 0, 1)).find(r => r.title === 'Linked beds')!;
    expect(classic.body).toContain('1 puppy in either part');
  });

  it('explains only the number badges present on the board', () => {
    const pondFeast = getLevelRules(mech(2, 0, 0, 2), [0, 4]).find(r => r.title === 'Number beds')!.body;
    expect(pondFeast).toContain('0 = pond');
    expect(pondFeast).toContain('4 = feast');
    expect(pondFeast).not.toContain('come in pairs');

    const lighter = getLevelRules(mech(2, 1, 1, 4), [3, 1, 3, 1]).find(r => r.title === 'Number beds')!.body;
    expect(lighter).toContain('1 & 3');
    expect(lighter).not.toContain('pond');
  });

  it('real encore levels get a rule for every mechanic they use', () => {
    for (const level of [1001, 1021, 1101, 1161, 1200]) {
      const m = getLevelMechanics(level);
      const puzzle = getPuzzle(level);
      const needs = puzzle.regions.flatMap(r => (r.requiredPups === undefined ? [] : [r.requiredPups]));
      const rules = getLevelRules(
        { puppiesPerUnit: m.puppiesPerUnit, catCount: m.catCount, linkedCount: m.linkedCount, hungryCount: needs.length },
        needs,
      );
      const titles = rules.map(r => r.title).join('|');
      expect(titles).toContain('2 puppies in every row');
      if (m.catCount) expect(titles).toMatch(/cat/);
      if (m.linkedCount) expect(titles).toContain('Linked beds');
      if (needs.length) expect(titles).toContain('Number beds');
    }
  });

  it('keeps every rule short enough to read at a glance', () => {
    const rules = getLevelRules(mech(2, 3, 3, 4), [0, 4, 3, 1]);
    rules.forEach(r => {
      expect(r.title.length).toBeLessThanOrEqual(32);
      r.body.split('\n').forEach(line => expect(line.length).toBeLessThanOrEqual(60));
    });
  });

  it('header chips stay short so they wrap cleanly on small phones', () => {
    const chips = getRuleChips(mech(2, 3, 3, 4));
    expect(chips.map(c => c.label)).toEqual(['2 per row', '3 cats', '3 links', 'number beds']);
    chips.forEach(c => expect(c.label.length).toBeLessThanOrEqual(12));
    expect(getRuleChips(mech(1))).toEqual([]);
  });
});

describe('Difficulty badge', () => {
  it('uses a word instead of a row of stars', () => {
    expect(getDifficultyLabel(getLevelDifficulty(1161))).toBe('Legend');
    expect(getDifficultyLabel(getLevelDifficulty(1))).toBe('Beginner');
    expect(getDifficultyLabel(getLevelDifficulty(1161))).not.toContain('★');
  });
});

describe('Hint wording on number beds', () => {
  const regions: Region[] = [
    { id: 1, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }], requiredPups: 0 },
    { id: 2, cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }], requiredPups: 4 },
    { id: 3, cells: [{ row: 2, col: 0 }] },
  ];
  const elim = (row: number, col: number): Deduction => ({
    technique: 'region_elimination',
    affectedCell: { row, col },
    explanation: '',
    eliminatedCells: [{ row, col }],
    difficultyValue: 1,
  });

  it('names the pond, uses the badge count, and falls back to the board quota', () => {
    expect(explainHint(elim(0, 1), 2, regions)).toContain('pond (0)');
    expect(explainHint(elim(1, 0), 2, regions)).toContain('all 4 puppies');
    expect(explainHint(elim(2, 0), 2, regions)).toContain('all 2 puppies');
    expect(explainHint(elim(2, 0), 1, regions)).toContain('its puppy');
  });
});
