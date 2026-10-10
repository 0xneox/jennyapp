/**
 * Level-aware "How to Play": builds the rule list for the board the player is
 * on, so twin levels say 2 pups, linked beds say how many they share, and
 * hungry-bed levels explain exactly the numbers on this board.
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
      title: `${pups(q)} in every row and column`,
      body: `Each row and each column needs exactly ${pups(q)}. Each coloured patch needs ${pups(q)} too${
        hasHungry ? ' — unless it shows a number badge' : ''
      }.`,
    },
    {
      emoji: '🚫',
      title: 'Puppies never touch',
      body: 'No two puppies can be next to each other — not even diagonally.',
    },
  ];

  if (m.catCount > 0) {
    rules.push({
      emoji: '😾',
      title: m.catCount === 1 ? 'Grumpy cat' : `${m.catCount} grumpy cats`,
      body: 'No puppy on a cat, or on any of the 8 tiles around it. Paw-mark those tiles first.',
    });
  }

  if (m.linkedCount > 0) {
    rules.push({
      emoji: '🔗',
      title: 'Linked beds',
      body:
        q > 1
          ? `Tiles with 🔗 are ONE bed split into two parts. Together they need ${pups(q)} — 1 + 1 or 2 + 0. Tap a part to see its partner glow.`
          : 'Tiles with 🔗 are ONE bed split into two parts. They share a single puppy — it can sit in either part. Tap a part to see its partner glow.',
    });
  }

  if (hasHungry) {
    const needs = new Set(hungryNeeds);
    const lines = [`A number badge means that patch needs exactly that many puppies instead of ${q}.`];
    if (needs.has(0)) lines.push('• 0 = pond: no puppies at all. Paw-mark every tile in it first.');
    if (needs.has(q + 2)) {
      lines.push(`• ${q + 2} = feast: it needs ${pups(q + 2)} that still can't touch each other. Find where they can all fit — a great place to start.`);
    }
    const light = [...needs].filter(n => n !== 0 && n !== q + 2).sort((a, b) => a - b);
    if (light.length) {
      lines.push(`• ${light.join(' and ')}: lighter and hungrier beds come in pairs — one gives a puppy to the other.`);
    }
    lines.push(`Rows and columns still need exactly ${q} each, so the numbers always balance.`);
    rules.push({ emoji: '🍽️', title: 'Number beds', body: lines.join('\n') });
  }

  rules.push({
    emoji: '💡',
    title: 'Stuck?',
    body: 'Use Paw Mark to rule tiles out, and tap Hint — Jenny shows a tile and explains which rule makes it certain.',
  });
  return rules;
}
