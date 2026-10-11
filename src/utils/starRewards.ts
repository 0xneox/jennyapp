import {
  loadClaimedStarMilestones,
  saveClaimedStarMilestones,
  loadConsumableHints,
  saveConsumableHints,
  loadConsumableUndos,
  saveConsumableUndos,
} from './storage';

export interface StarMilestone {
  starsRequired: number;
  hints: number;
  undos: number;
  title: string;
  badgeEmoji: string;
}

export const BASE_STAR_MILESTONES: StarMilestone[] = [
  { starsRequired: 15, hints: 3, undos: 0, title: 'Star Seeker', badgeEmoji: '🌟' },
  { starsRequired: 30, hints: 3, undos: 0, title: 'Meadow Scout', badgeEmoji: '✨' },
  { starsRequired: 50, hints: 4, undos: 1, title: 'Garden Star', badgeEmoji: '🎯' },
  { starsRequired: 75, hints: 4, undos: 1, title: 'Starlight Tracker', badgeEmoji: '💫' },
  { starsRequired: 100, hints: 5, undos: 1, title: 'Centurion of Stars', badgeEmoji: '🎖️' },
  { starsRequired: 150, hints: 5, undos: 1, title: 'Constellation Master', badgeEmoji: '🌌' },
  { starsRequired: 200, hints: 5, undos: 2, title: 'Galaxy Wanderer', badgeEmoji: '🪐' },
  { starsRequired: 250, hints: 5, undos: 2, title: 'Star Champion', badgeEmoji: '🏆' },
  { starsRequired: 300, hints: 6, undos: 2, title: 'Astral Puppy Friend', badgeEmoji: '🐾' },
  { starsRequired: 400, hints: 6, undos: 2, title: 'Cosmic Caretaker', badgeEmoji: '🔮' },
  { starsRequired: 500, hints: 8, undos: 3, title: 'Grand Stellar Legend', badgeEmoji: '👑' },
];

/**
  * Full list of star milestones up to maximum campaign capacity (3000 stars).
  */
export function getAllStarMilestones(): StarMilestone[] {
  const milestones = [...BASE_STAR_MILESTONES];
  for (let s = 600; s <= 3000; s += 100) {
    milestones.push({
      starsRequired: s,
      hints: 5,
      undos: 2,
      title: `Star Master Tier ${s / 100}`,
      badgeEmoji: '⭐',
    });
  }
  return milestones;
}

export function getNextStarMilestone(currentStars: number): StarMilestone | null {
  const all = getAllStarMilestones();
  return all.find(m => m.starsRequired > currentStars) || null;
}

export interface ClaimResult {
  newlyClaimed: StarMilestone[];
  totalNewHints: number;
  totalNewUndos: number;
}

/**
 * Checks for any newly unlocked star milestones based on the current star total.
 * Automatically claims them, persists the claimed list, and credits hints & undos.
 */
export async function checkAndClaimStarMilestones(currentStars: number): Promise<ClaimResult> {
  if (currentStars <= 0) {
    return { newlyClaimed: [], totalNewHints: 0, totalNewUndos: 0 };
  }

  const claimedArr = await loadClaimedStarMilestones();
  const claimed = new Set(claimedArr);
  const all = getAllStarMilestones();
  const newlyClaimed = all.filter(m => currentStars >= m.starsRequired && !claimed.has(m.starsRequired));

  if (newlyClaimed.length === 0) {
    return { newlyClaimed: [], totalNewHints: 0, totalNewUndos: 0 };
  }

  let totalNewHints = 0;
  let totalNewUndos = 0;
  for (const m of newlyClaimed) {
    claimed.add(m.starsRequired);
    totalNewHints += m.hints;
    totalNewUndos += m.undos;
  }

  await saveClaimedStarMilestones([...claimed].sort((a, b) => a - b));

  if (totalNewHints > 0) {
    const curHints = await loadConsumableHints();
    await saveConsumableHints(curHints + totalNewHints);
  }
  if (totalNewUndos > 0) {
    const curUndos = await loadConsumableUndos();
    await saveConsumableUndos(curUndos + totalNewUndos);
  }

  return { newlyClaimed, totalNewHints, totalNewUndos };
}
