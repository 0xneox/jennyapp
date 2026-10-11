import { getTotalStars, GameStats } from '../src/utils/statistics';
import {
  getAllStarMilestones,
  getNextStarMilestone,
  checkAndClaimStarMilestones,
} from '../src/utils/starRewards';
import {
  loadConsumableHints,
  saveConsumableHints,
  loadClaimedStarMilestones,
  saveClaimedStarMilestones,
} from '../src/utils/storage';

describe('Star Rewards & Total Stars Calculation', () => {
  beforeEach(async () => {
    await saveConsumableHints(0);
    await saveClaimedStarMilestones([]);
  });

  describe('getTotalStars', () => {
    it('returns 0 when levelStats is empty', () => {
      const stats: GameStats = {
        totalPuzzlesSolved: 0,
        totalPlayTime: 0,
        levelStats: {},
      };
      expect(getTotalStars(stats)).toBe(0);
    });

    it('sums stars correctly across completed levels', () => {
      const stats: GameStats = {
        totalPuzzlesSolved: 3,
        totalPlayTime: 120,
        levelStats: {
          1: { bestMoves: 5, bestTime: 10, completions: 1, hintsUsed: 0, stars: 3 },
          2: { bestMoves: 8, bestTime: 20, completions: 1, hintsUsed: 1, stars: 2.5 },
          3: { bestMoves: 12, bestTime: 35, completions: 2, hintsUsed: 2, stars: 2 },
        },
      };
      // 3 + 2.5 + 2 = 7.5 -> Math.floor = 7
      expect(getTotalStars(stats)).toBe(7);
    });

    it('backfills pre-score completed levels to 3 stars', () => {
      const stats: GameStats = {
        totalPuzzlesSolved: 2,
        totalPlayTime: 50,
        levelStats: {
          1: { bestMoves: 5, bestTime: 10, completions: 1, hintsUsed: 0 }, // no stars field
          2: { bestMoves: 6, bestTime: 12, completions: 1, hintsUsed: 0, stars: 3 },
        },
      };
      expect(getTotalStars(stats)).toBe(6);
    });
  });

  describe('Star Milestones Configuration', () => {
    it('has monotonically increasing star thresholds', () => {
      const milestones = getAllStarMilestones();
      expect(milestones.length).toBeGreaterThan(10);
      for (let i = 1; i < milestones.length; i++) {
        expect(milestones[i].starsRequired).toBeGreaterThan(milestones[i - 1].starsRequired);
        expect(milestones[i].hints).toBeGreaterThan(0);
      }
    });

    it('determines the next milestone correctly', () => {
      expect(getNextStarMilestone(0)?.starsRequired).toBe(15);
      expect(getNextStarMilestone(14)?.starsRequired).toBe(15);
      expect(getNextStarMilestone(15)?.starsRequired).toBe(30);
      expect(getNextStarMilestone(40)?.starsRequired).toBe(50);
    });
  });

  describe('checkAndClaimStarMilestones', () => {
    it('returns empty when current stars are 0', async () => {
      const res = await checkAndClaimStarMilestones(0);
      expect(res.newlyClaimed).toHaveLength(0);
      expect(res.totalNewHints).toBe(0);
    });

    it('claims a milestone and awards consumable hints', async () => {
      const initialHints = await loadConsumableHints();
      const res = await checkAndClaimStarMilestones(15);

      expect(res.newlyClaimed).toHaveLength(1);
      expect(res.newlyClaimed[0].starsRequired).toBe(15);
      expect(res.totalNewHints).toBe(3);

      const updatedHints = await loadConsumableHints();
      expect(updatedHints).toBe(initialHints + 3);

      const claimed = await loadClaimedStarMilestones();
      expect(claimed).toContain(15);
    });

    it('does not re-claim already claimed milestones', async () => {
      await checkAndClaimStarMilestones(15);
      const secondCall = await checkAndClaimStarMilestones(15);
      expect(secondCall.newlyClaimed).toHaveLength(0);
      expect(secondCall.totalNewHints).toBe(0);
    });

    it('claims multiple milestones at once if player jumps ahead', async () => {
      // Jump straight to 50 stars (should claim 15, 30, and 50)
      const res = await checkAndClaimStarMilestones(50);
      expect(res.newlyClaimed).toHaveLength(3);
      expect(res.newlyClaimed.map(m => m.starsRequired)).toEqual([15, 30, 50]);
      // 3 + 3 + 4 = 10 hints
      expect(res.totalNewHints).toBe(10);
      expect(res.totalNewUndos).toBe(1);

      const currentHints = await loadConsumableHints();
      expect(currentHints).toBe(10);
    });
  });
});
