/**
 * Rainbow Candy Palette System
 * Glossy, vibrant, candy-crush-style colors flowing from warm (top-left)
 * to cool (bottom-right). Each color includes a darker border shade and a
 * lighter accent for glossy 3D tile effects.
 */

/**
 * Rainbow Candy Palette System — v2 (variety pass).
 *
 * Glossy, vibrant, candy-crush-style colors flowing from warm (top-left)
 * to cool (bottom-right). Each color includes a darker border shade and a
 * lighter accent for glossy 3D tile effects.
 *
 * PALETTE EXPANSION (10 → 16 hues):
 *   Original had only the "standard" rainbow slots — Red/Pink/Orange/Yellow/
 *   Green/Cyan/Blue/Indigo/Violet/Magenta. That left hue gaps where two
 *   randomly-assigned neighbours would read as "both warm" or "both purple".
 *   The 6 new slots (Coral, Lime, Teal, Lavender, Peach, Burgundy) sit in
 *   those exact gaps. Every adjacent pair on the hue wheel now pops.
 *
 * PER-HUE GRADIENT TREATMENTS:
 *   v1 used one recipe for every tile: accent → pastel → border, same
 *   direction, same mid-stop. v2 gives each of the 16 hues its own unique
 *   gradient stops + direction flag: some are diagonal sunset blends, some
 *   pearlescent duo-tone, some metallic tri-tone, some citrus-rainbow.
 *   End result: 16 region types, 16 *visually distinct* tiles — no more
 *   "same gradient with a different tint".
 */

export interface RegionTheme {
  id: number;
  name: string;
  pastel: string;
  border: string;
  darkContrast: string;
  accent: string;
  /** Extra mid-stop for pearlescent / metallic / citrus gradients. */
  shimmer: string;
  /** Which treatment this palette uses. */
  treatment:
    | 'vertical'     // top→bottom  gloss → base → shade
    | 'diagonal'     // top-left→bottom-right warm→cool
    | 'reversed'     // darker→lighter (for already-bright palettes like lime)
    | 'pearlescent'  // 4 stops: accent → shimmer → pastel → border
    | 'citrus'       // vivid accent → pastel → deep border (no muted edge)
    | 'sunset';      // 3 stops warm→mid→cool, diagonal
  /** Gradient direction — { x:0, y:0 } = top-left, { x:1, y:1 } = bottom-right */
  gradStart: { x: number; y: number };
  gradEnd:   { x: number; y: number };
}

export const RAINBOW_CANDY_PALETTE: RegionTheme[] = [
  {
    id: 1, name: 'Cherry Red',
    pastel: '#e63946', border: '#b71c2c', darkContrast: '#6f1018',
    accent: '#ff7a86', shimmer: '#ff3d50',
    treatment: 'citrus',
    gradStart: { x: 0.2, y: 0 }, gradEnd: { x: 0.8, y: 1 },
  },
  {
    id: 2, name: 'Hot Pink',
    pastel: '#ec4899', border: '#be185d', darkContrast: '#831843',
    accent: '#f9a8d4', shimmer: '#ff65a5',
    treatment: 'pearlescent',
    gradStart: { x: 0, y: 0 }, gradEnd: { x: 1, y: 1 },
  },
  {
    id: 3, name: 'Coral',
    pastel: '#fb7185', border: '#e11d48', darkContrast: '#881337',
    accent: '#fecdd3', shimmer: '#ffa4b2',
    treatment: 'sunset',
    gradStart: { x: 0, y: 0.1 }, gradEnd: { x: 1, y: 0.9 },
  },
  {
    id: 4, name: 'Sunset Peach',
    pastel: '#fb923c', border: '#c2410c', darkContrast: '#7c2d12',
    accent: '#fed7aa', shimmer: '#fdba74',
    treatment: 'diagonal',
    gradStart: { x: 0, y: 0 }, gradEnd: { x: 1, y: 1 },
  },
  {
    id: 5, name: 'Pumpkin Orange',
    pastel: '#f59e0b', border: '#b45309', darkContrast: '#78350f',
    accent: '#fde68a', shimmer: '#fbbf24',
    treatment: 'citrus',
    gradStart: { x: 0.1, y: 0 }, gradEnd: { x: 0.9, y: 1 },
  },
  {
    id: 6, name: 'Lemon Gold',
    pastel: '#facc15', border: '#a16207', darkContrast: '#713f12',
    accent: '#fef9c3', shimmer: '#fde047',
    treatment: 'reversed',
    gradStart: { x: 0.5, y: 0 }, gradEnd: { x: 0.5, y: 1 },
  },
  {
    id: 7, name: 'Lime Punch',
    pastel: '#a3e635', border: '#65a30d', darkContrast: '#3f6212',
    accent: '#ecfccb', shimmer: '#bef264',
    treatment: 'reversed',
    gradStart: { x: 0, y: 0.2 }, gradEnd: { x: 1, y: 0.8 },
  },
  {
    id: 8, name: 'Leaf Green',
    pastel: '#22c55e', border: '#15803d', darkContrast: '#14532d',
    accent: '#bbf7d0', shimmer: '#4ade80',
    treatment: 'vertical',
    gradStart: { x: 0.4, y: 0 }, gradEnd: { x: 0.6, y: 1 },
  },
  {
    id: 9, name: 'Tropical Teal',
    pastel: '#14b8a6', border: '#0f766e', darkContrast: '#134e4a',
    accent: '#99f6e4', shimmer: '#2dd4bf',
    treatment: 'sunset',
    gradStart: { x: 0, y: 0 }, gradEnd: { x: 1, y: 1 },
  },
  {
    id: 10, name: 'Sky Cyan',
    pastel: '#38bdf8', border: '#0284c7', darkContrast: '#075985',
    accent: '#bae6fd', shimmer: '#7dd3fc',
    treatment: 'vertical',
    gradStart: { x: 0.5, y: 0 }, gradEnd: { x: 0.5, y: 1 },
  },
  {
    id: 11, name: 'Ocean Blue',
    pastel: '#3b82f6', border: '#1d4ed8', darkContrast: '#1e3a8a',
    accent: '#bfdbfe', shimmer: '#60a5fa',
    treatment: 'pearlescent',
    gradStart: { x: 0, y: 0 }, gradEnd: { x: 1, y: 0.9 },
  },
  {
    id: 12, name: 'Royal Indigo',
    pastel: '#6366f1', border: '#4338ca', darkContrast: '#312e81',
    accent: '#c7d2fe', shimmer: '#818cf8',
    treatment: 'diagonal',
    gradStart: { x: 0, y: 0.1 }, gradEnd: { x: 0.9, y: 1 },
  },
  {
    id: 13, name: 'Lilac Lavender',
    pastel: '#a78bfa', border: '#7c3aed', darkContrast: '#4c1d95',
    accent: '#ddd6fe', shimmer: '#c4b5fd',
    treatment: 'pearlescent',
    gradStart: { x: 0.2, y: 0 }, gradEnd: { x: 0.8, y: 1 },
  },
  {
    id: 14, name: 'Grape Violet',
    pastel: '#c084fc', border: '#9333ea', darkContrast: '#581c87',
    accent: '#e9d5ff', shimmer: '#d8b4fe',
    treatment: 'vertical',
    gradStart: { x: 0.5, y: 0 }, gradEnd: { x: 0.5, y: 1 },
  },
  {
    id: 15, name: 'Plum Magenta',
    pastel: '#d946ef', border: '#a21caf', darkContrast: '#701a75',
    accent: '#f5d0fe', shimmer: '#e879f9',
    treatment: 'sunset',
    gradStart: { x: 0.1, y: 0 }, gradEnd: { x: 0.9, y: 1 },
  },
  {
    id: 16, name: 'Burgundy',
    pastel: '#be123c', border: '#881337', darkContrast: '#4c0519',
    accent: '#fda4af', shimmer: '#f43f5e',
    treatment: 'diagonal',
    gradStart: { x: 0, y: 0 }, gradEnd: { x: 1, y: 1 },
  },
];

/**
 * Region id → palette index lookup. A board with n regions uses the first n
 * entries. The order maximises hue separation on TWO axes:
 *
 *   1. Set spread — every prefix is a max-min-spaced subset, so the smallest
 *      hue gap on any board is: 4 regions: 70°  5: 40°  6: 40°  7: 30°
 *      8: 28°  9: 28°  10: 18° (vs 8–12° in the old order).
 *   2. Consecutive-id distance — the generator lays regions in rough row
 *      bands, so neighbouring ids are usually adjacent cells. Every
 *      consecutive pair below is ≥58° apart; the remaining close pairs
 *      (Leaf/Teal 32°, Plum/Lilac 30°) sit 3+ ids apart and rarely touch.
 *
 * The redundant warm hues (Peach ~25°, Lemon ~50°, Burgundy ~350°,
 * Coral ~351°) sit in slots 11–16: no board exceeds 10 regions (max
 * gridSize = 10), so a second near-identical red can never share a board
 * with Cherry Red — the "two reds" confusion seen on levels 342 & 522
 * (Cherry vs Burgundy sat 8° apart in the old order). The per-level
 * hueShift rotates every hue by the same amount, so these gaps hold on all
 * 1200 levels.
 */
const REGION_HUE_ORDER = [
  0,  // Cherry Red     (358°)
  10, // Ocean Blue     (218°)
  6,  // Lime Punch     (84°)
  14, // Plum Magenta   (288°)
  4,  // Pumpkin Orange (38°)
  8,  // Tropical Teal  (174°)
  12, // Lilac Lavender (258°)
  1,  // Hot Pink       (330°)
  7,  // Leaf Green     (142°)
  9,  // Sky Cyan       (200°)
  // --- Slots 10–15: unreachable today (no board has >10 regions); kept so
  //     regionId wraps cyclically if oversized boards ever arrive. ---
  11, // Royal Indigo   (236°)
  3,  // Sunset Peach   (25°)
  13, // Grape Violet   (270°)
  5,  // Lemon Gold     (50°)
  15, // Burgundy       (350°)
  2,  // Coral          (351°)
];

export interface LevelThemeSeed {
  /** -30..+30 shift degrees applied to every region hue on this level. */
  hueShift: number;
  /** 0.9..1.15 — per-level global saturation tweak. */
  satBoost: number;
  /** Backdrop gradient key (0..BACKDROP_PRESETS.length-1). */
  backdrop: number;
}

/** Deterministic 32-bit hash of two ints (Mulberry32-lite). Range [0, 1). */
function hash2(a: number, b: number): number {
  let t = Math.imul(a ^ 0x6d2b79f5, 2654435761) ^ b;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Produce a deterministic visual seed from a level number so every level
 * paints the same palette IDs differently. Level 4 and level 104 will both
 * show region #1 as Cherry Red… but shifted by +12° on one and -8° on the
 * other, plus saturation nudged — they read as *related but distinct*
 * colour combinations, eliminating the "identical gradient" repetition.
 */
export function getLevelThemeSeed(level: number): LevelThemeSeed {
  return {
    hueShift: Math.round((hash2(level, 7) - 0.5) * 60),   // -30..+30
    satBoost: 0.9 + hash2(level, 13) * 0.25,             // 0.9..1.15
    backdrop: Math.floor(hash2(level, 23) * BACKDROP_PRESETS.length),
  };
}

/**
 * Shift a hex #RRGGBB color by ±h degrees (hue) and multiply saturation.
 * Pure JS (no color lib needed), good enough for ±30° tweaks on known
 * bright hex palettes (all of RAINBOW_CANDY_PALETTE are saturated).
 */
export function shiftHexColor(hex: string, hueShiftDeg: number, satMul: number = 1): string {
  // Parse hex
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  // RGB → HSL
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
  H = ((H + hueShiftDeg) % 360 + 360) % 360;
  S = Math.max(0, Math.min(1, S * satMul));

  // HSL → RGB
  const C = (1 - Math.abs(2 * L - 1)) * S;
  const hh = H / 60;
  const X = C * (1 - Math.abs((hh % 2) - 1));
  let R2 = 0, G2 = 0, B2 = 0;
  if (hh < 1)      { R2 = C; G2 = X; }
  else if (hh < 2) { R2 = X; G2 = C; }
  else if (hh < 3) { G2 = C; B2 = X; }
  else if (hh < 4) { G2 = X; B2 = C; }
  else if (hh < 5) { R2 = X; B2 = C; }
  else             { R2 = C; B2 = X; }
  const m = L - C / 2;
  const toHex = (v: number) => {
    const n = Math.round(Math.max(0, Math.min(1, v + m)) * 255);
    return n.toString(16).padStart(2, '0');
  };
  return `#${toHex(R2)}${toHex(G2)}${toHex(B2)}`;
}

/**
 * Backdrop gradients — 7 unique arcade skies per level.
 * Old: 1 deep grape gradient for every screen in the whole game.
 * New: level's seed picks one, so the screen's entire background changes
 * every couple of levels instead of always being purple-on-purple.
 */
export interface BackdropPreset {
  name: string;
  top: string;
  mid: string;
  bottom: string;
  glowCenter: string;
  glowEdge: string;
}
export const BACKDROP_PRESETS: BackdropPreset[] = [
  { name: 'Deep Grape',      // original — kept as the default vibe
    top: '#4A2E8C', mid: '#382066', bottom: '#1F1240',
    glowCenter: 'rgba(167, 118, 255, 0.28)', glowEdge: 'rgba(31, 18, 64, 0)' },
  { name: 'Sunset Shore',
    top: '#FF7A59', mid: '#D63384', bottom: '#5B2C8C',
    glowCenter: 'rgba(255, 180, 130, 0.30)', glowEdge: 'rgba(91, 44, 140, 0)' },
  { name: 'Aurora Forest',
    top: '#0A4D68', mid: '#088395', bottom: '#05BFDB',
    glowCenter: 'rgba(120, 255, 210, 0.28)', glowEdge: 'rgba(10, 77, 104, 0)' },
  { name: 'Midnight Neon',
    top: '#171132', mid: '#2C1A5C', bottom: '#4B0082',
    glowCenter: 'rgba(255, 90, 210, 0.26)', glowEdge: 'rgba(23, 17, 50, 0)' },
  { name: 'Dawn Meadow',
    top: '#FFB88C', mid: '#DE8CBA', bottom: '#6A48A0',
    glowCenter: 'rgba(255, 220, 170, 0.28)', glowEdge: 'rgba(106, 72, 160, 0)' },
  { name: 'Ocean Abyss',
    top: '#0F3460', mid: '#16213E', bottom: '#1A1A2E',
    glowCenter: 'rgba(80, 180, 255, 0.30)', glowEdge: 'rgba(15, 52, 96, 0)' },
  { name: 'Candy Citrus',
    top: '#FFD66B', mid: '#FF7B54', bottom: '#944E63',
    glowCenter: 'rgba(255, 220, 130, 0.30)', glowEdge: 'rgba(148, 78, 99, 0)' },
];

export const getRegionTheme = (regionId?: number, seed?: LevelThemeSeed): RegionTheme => {
  if (!regionId || regionId <= 0) {
    return {
      id: 0,
      name: 'Parchment',
      pastel: '#F7F4EB',
      border: '#DFD8C8',
      darkContrast: '#4A463B',
      accent: '#EDE8DA',
      shimmer: '#FDF9F0',
      treatment: 'vertical',
      gradStart: { x: 0.5, y: 0 }, gradEnd: { x: 0.5, y: 1 },
    };
  }
  const index = REGION_HUE_ORDER[(regionId - 1) % REGION_HUE_ORDER.length];
  const base = RAINBOW_CANDY_PALETTE[index];
  if (!seed || (seed.hueShift === 0 && seed.satBoost === 1)) return base;

  return {
    ...base,
    pastel:       shiftHexColor(base.pastel,       seed.hueShift, seed.satBoost),
    border:       shiftHexColor(base.border,       seed.hueShift, seed.satBoost),
    darkContrast: shiftHexColor(base.darkContrast, seed.hueShift, seed.satBoost * 0.9),
    accent:       shiftHexColor(base.accent,       seed.hueShift, seed.satBoost * 1.05),
    shimmer:      shiftHexColor(base.shimmer,      seed.hueShift, seed.satBoost),
  };
};

export const getRegionColor = (regionId?: number): string => {
  return getRegionTheme(regionId).pastel;
};

export const getRegionBorderColor = (regionId?: number): string => {
  return getRegionTheme(regionId).border;
};

export const COZY_COLORS = {
  canvasBackground: '#F8F6F0',
  boardBackground: '#FFFDF9',
  boardFrame: '#EADFCF',
  boardShadow: 'rgba(74, 58, 41, 0.12)',
  linenTextureLine: 'rgba(120, 100, 80, 0.05)',
  regionOuterStroke: 'rgba(44, 38, 30, 0.28)',
  regionInnerSeam: 'rgba(255, 255, 255, 0.35)',
  chalkMark: '#FFFDF8',
  chalkShadow: 'rgba(60, 48, 36, 0.3)',
  woodDark: '#4A3B2C',
  goldHighlight: '#F5B041',
  softError: '#D9534F',
};
