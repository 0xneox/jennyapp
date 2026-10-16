/**
 * Diagnose region-color collisions on a level.
 * Prints each region's palette name + rendered pastel, the region grid,
 * and flags ADJACENT region pairs whose hues are too close.
 *
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/checkLevelColors.ts 342 522
 */
import { getPuzzle } from '../src/data/proceduralPuzzles';
import { getLevelThemeSeed, getRegionTheme } from '../src/utils/colors';

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let H = 0, S = 0; const L = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    S = L > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: H = (g - b) / d + (g < b ? 6 : 0); break;
      case g: H = (b - r) / d + 2; break;
      case b: H = (r - g) / d + 4; break;
    }
    H *= 60;
  }
  return { h: H, s: S, l: L };
}

function rgbDist(a: string, b: string): number {
  const pa = [0, 2, 4].map(i => parseInt(a.slice(1 + i, 3 + i), 16));
  const pb = [0, 2, 4].map(i => parseInt(b.slice(1 + i, 3 + i), 16));
  return Math.sqrt(
    (pa[0] - pb[0]) ** 2 * 0.3 + (pa[1] - pb[1]) ** 2 * 0.59 + (pa[2] - pb[2]) ** 2 * 0.11
  );
}

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

for (const arg of process.argv.slice(2)) {
  const level = parseInt(arg, 10);
  const puzzle = getPuzzle(level);
  const seed = getLevelThemeSeed(level);
  const n = puzzle.gridSize;

  // cell → regionId grid
  const rid: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const r of puzzle.regions) for (const c of r.cells) rid[c.row][c.col] = r.id;

  const ids = [...new Set(puzzle.regions.map(r => r.id))].sort((a, b) => a - b);
  const themes = new Map(ids.map(id => [id, getRegionTheme(id, seed)]));

  console.log(`\n=== Level ${level} (${n}x${n}, ${ids.length} regions) seed hueShift=${seed.hueShift} satBoost=${seed.satBoost.toFixed(2)} ===`);
  for (const id of ids) {
    const t = themes.get(id)!;
    const hsl = hexToHsl(t.pastel);
    console.log(
      `  region ${String(id).padStart(2)}  ${t.name.padEnd(15)} pastel=${t.pastel} hue=${hsl.h.toFixed(0).padStart(3)}° sat=${(hsl.s * 100).toFixed(0)}% light=${(hsl.l * 100).toFixed(0)}%`
    );
  }

  console.log('  region grid:');
  for (const row of rid) console.log('   ' + row.map(v => String(v).padStart(2)).join(' '));

  // adjacency pairs (4-neighbour)
  const pairs = new Set<string>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (c + 1 < n && rid[r][c] !== rid[r][c + 1])
        pairs.add([Math.min(rid[r][c], rid[r][c + 1]), Math.max(rid[r][c], rid[r][c + 1])].join('-'));
      if (r + 1 < n && rid[r][c] !== rid[r + 1][c])
        pairs.add([Math.min(rid[r][c], rid[r + 1][c]), Math.max(rid[r][c], rid[r + 1][c])].join('-'));
    }

  console.log('  adjacent pairs with hue distance < 35° (confusable):');
  let flagged = 0;
  for (const p of [...pairs].sort()) {
    const [a, b] = p.split('-').map(Number);
    const ta = themes.get(a)!, tb = themes.get(b)!;
    const da = hueDist(hexToHsl(ta.pastel).h, hexToHsl(tb.pastel).h);
    const dr = rgbDist(ta.pastel, tb.pastel);
    if (da < 35) {
      flagged++;
      console.log(
        `    ${a} (${ta.name}) vs ${b} (${tb.name}): hue Δ${da.toFixed(0)}° rgbDist=${dr.toFixed(0)} ${ta.pastel} vs ${tb.pastel}`
      );
    }
  }
  if (!flagged) console.log('    none');
}
