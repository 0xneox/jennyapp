/**
 * Level-aware "How to Play": builds the rule list for the board the player is
 * on, so twin levels say 2 pups, linked beds say how many they share, and
 * hungry-bed levels explain exactly the numbers on this board.
 * Keep bodies to one short line each — the sheet must read at a glance.
 */
export interface RuleMechanics {
  puppiesPerUnit: number;
  catCount: number;
  linkedCount: number;
  hungryCount: number;
}

export interface LevelRule {
  emoji: string;
  title: string;
  body: string;
}

/** Compact header chips — short enough to wrap cleanly on a 320dp phone. */
export interface RuleChip {
  emoji: string;
  label: string;
}

const pups = (n: number) => `${n} ${n === 1 ? 'puppy' : 'puppies'}`;

export function getRuleChips(m: RuleMechanics): RuleChip[] {
  const chips: RuleChip[] = [];
  if (m.puppiesPerUnit > 1) chips.push({ emoji: '🐾', label: `${m.puppiesPerUnit} per row` });
  if (m.catCount > 0) chips.push({ emoji: '😾', label: m.catCount === 1 ? '1 cat' : `${m.catCount} cats` });
  if (m.linkedCount > 0) chips.push({ emoji: '🔗', label: m.linkedCount === 1 ? '1 link' : `${m.linkedCount} links` });
  if (m.hungryCount > 0) chips.push({ emoji: '🍽️', label: 'number beds' });
  return chips;
}

/**
 * @param hungryNeeds the requiredPups values present on this board (any order,
 *   duplicates fine) — lets the sheet explain only the badges the player sees.
 */
export function getLevelRules(m: RuleMechanics, hungryNeeds: number[] = []): LevelRule[] {
  const q = Math.max(1, m.puppiesPerUnit);
  const hasHungry = m.hungryCount > 0;
  const rules: LevelRule[] = [
    {
      emoji: q > 1 ? '👯' : '🐶',
      title: `${pups(q)} in every row & column`,
      body: `Each colour patch needs ${q} too${hasHungry ? ' (unless it has a number)' : ''}.`,
    },
    { emoji: '🚫', title: 'Puppies never touch', body: 'Not even diagonally.' },
  ];

  if (m.catCount > 0) {
    rules.push({
      emoji: '😾',
      title: m.catCount === 1 ? '1 grumpy cat' : `${m.catCount} grumpy cats`,
      body: 'No puppy on a cat or on the 8 tiles around it.',
    });
  }

  if (m.linkedCount > 0) {
    rules.push({
      emoji: '🔗',
      title: 'Linked beds',
      body: q > 1
        ? `Two parts, one bed: ${pups(q)} in total.`
        : 'Two parts, one bed: 1 puppy in either part.',
    });
  }

  if (hasHungry) {
    const needs = new Set(hungryNeeds);
    const lines = ['The badge = how many puppies that patch needs.'];
    if (needs.has(0)) lines.push('0 = pond: no puppies.');
    if (needs.has(q + 2)) lines.push(`${q + 2} = feast: ${pups(q + 2)}.`);
    const light = [...needs].filter(n => n !== 0 && n !== q + 2).sort((a, b) => a - b);
    if (light.length) lines.push(`${light.join(' & ')} beds come in pairs.`);
    rules.push({ emoji: '🍽️', title: 'Number beds', body: lines.join('\n') });
  }

  rules.push({ emoji: '💡', title: 'Stuck?', body: 'Paw Mark to rule tiles out, or tap Hint.' });
  return rules;
}
