/**
 * Candy Theme Tokens
 *
 * A single source of truth for the glossy candy-arcade look. Tiles keep the
 * saturated RAINBOW_CANDY_PALETTE from colors.ts, and everything around them
 * (backdrop, panels, buttons) sits on a deep grape backdrop so those bright
 * hues read as juicy rather than jarring.
 */

import { getRegionTheme, getLevelThemeSeed, LevelThemeSeed, BACKDROP_PRESETS, BackdropPreset } from './colors';

/** Product name — single source of truth for UI copy and share text. */
export const APP_NAME = 'JennyDoko';
export const APP_TAGLINE = 'A Cozy Logic Adventure';

/** Deep grape backdrop — dark and low-chroma so all 10 tile hues stay legible. */
export const CANDY_BACKDROP = {
  top: '#4A2E8C',
  mid: '#382066',
  bottom: '#1F1240',
  glowCenter: 'rgba(167, 118, 255, 0.28)',
  glowEdge: 'rgba(31, 18, 64, 0)',
  vignette: 'rgba(16, 8, 34, 0.55)',
};

/** Raised HUD / card surfaces: gradient top→bottom plus a hard bevel underneath. */
export const CANDY_SURFACE = {
  top: '#6B4BB8',
  bottom: '#4A2E8C',
  border: '#A17FE8',
  bevel: '#2A1857',
  gloss: 'rgba(255, 255, 255, 0.22)',
  inset: 'rgba(255, 255, 255, 0.30)',
  /** Lighter recessed well, e.g. behind stat rows or the tile tray. */
  wellTop: '#331E5E',
  wellBottom: '#3E2570',
};

/** Gold trim used for titles, stars and streak accents. */
export const CANDY_GOLD = {
  light: '#FFEDA6',
  base: '#FFC93C',
  dark: '#D18F00',
  shadow: 'rgba(89, 51, 0, 0.55)',
};

export const CANDY_TEXT = {
  /** On dark backdrop / panels. */
  onDark: '#FFFFFF',
  onDarkSoft: '#E4D6FF',
  onDarkMuted: '#AE99E0',
  /** On light candy surfaces (modals with pale interiors). */
  onLight: '#3A2465',
  onLightMuted: '#7A66A8',
  /** Hard drop shadow that gives arcade text its punch. */
  shadow: 'rgba(28, 12, 61, 0.6)',
};

export interface CandySkin {
  /** Gradient stops, light → dark. */
  gradient: [string, string];
  /** Solid darker shade drawn as a hard offset bevel below the button. */
  bevel: string;
  /** Outline colour. */
  border: string;
  /** Label colour. */
  text: string;
}

/**
 * Chunky candy button skins. The bevel is deliberately a *solid* colour with a
 * hard offset (not a blurred shadow) — that's what makes arcade buttons look
 * physically pressable.
 */
export const CANDY_SKINS: Record<
  'green' | 'grape' | 'orange' | 'red' | 'blue' | 'gold' | 'neutral',
  CandySkin
> = {
  green: {
    gradient: ['#6BEE8C', '#25B84E'],
    bevel: '#138033',
    border: '#0F6B2B',
    text: '#FFFFFF',
  },
  grape: {
    gradient: ['#B98BFF', '#7C3FD6'],
    bevel: '#52259C',
    border: '#421C82',
    text: '#FFFFFF',
  },
  orange: {
    gradient: ['#FFCB6B', '#F17C00'],
    bevel: '#B25400',
    border: '#8F4300',
    text: '#FFFFFF',
  },
  red: {
    gradient: ['#FF8A8A', '#E03131'],
    bevel: '#A31C1C',
    border: '#851515',
    text: '#FFFFFF',
  },
  blue: {
    gradient: ['#7FD4FF', '#2C93E8'],
    bevel: '#1A6BAD',
    border: '#12558C',
    text: '#FFFFFF',
  },
  gold: {
    gradient: ['#FFE9A3', '#F5B324'],
    bevel: '#B47A00',
    border: '#8F6000',
    text: '#4A3000',
  },
  neutral: {
    gradient: ['#8E74C9', '#6144A3'],
    bevel: '#3D2670',
    border: '#33205C',
    text: '#FFFFFF',
  },
};

export type CandySkinName = keyof typeof CANDY_SKINS;

/** Radii, gaps and bevel depths kept consistent across every candy surface. */
export const CANDY_METRICS = {
  radiusPanel: 22,
  radiusCard: 18,
  radiusButton: 18,
  radiusPill: 24,
  radiusChip: 12,
  /** Hard bevel depth under buttons. */
  bevelDepth: 4,
  /** Deeper bevel for primary CTAs. */
  bevelDepthLarge: 6,
};

export interface GradientResult {
  colors: [string, string, ...string[]];
  start:  { x: number; y: number };
  end:    { x: number; y: number };
}

/**
 * Build a tile's gradient stops AND direction from the hue's unique
 * treatment recipe + optional per-level visual seed.
 *
 * v1: every tile used the same recipe → `[accent, pastel, border]` top→bottom.
 * v2: 6 different treatments × 16 palettes × ~50 level-variant seeds =
 *     ~4800 *visually distinct* gradient combinations in the game.
 */
export function getTileGradient(
  regionId?: number,
  level: number = 1,
): GradientResult {
  const seed = getLevelThemeSeed(level);
  const theme = getRegionTheme(regionId, seed);

  const start = theme.gradStart;
  const end = theme.gradEnd;

  switch (theme.treatment) {
    case 'diagonal': {
      // Warm→cool diagonal sweep. 4 stops for depth.
      return {
        colors: [theme.accent, theme.pastel, theme.shimmer, theme.border],
        start, end,
      };
    }
    case 'reversed': {
      // Lime / lemon: brightest band sits at the BOTTOM so the highlight
      // reads as "reflecting off the tray's bezel" instead of the usual
      // top-light. Stops run shade → mid → highlight.
      return {
        colors: [theme.border, theme.pastel, theme.accent],
        start, end,
      };
    }
    case 'pearlescent': {
      // Pink / blue / lavender: pearlescent uses 4 stops so the hue shimmers
      // through 2 distinct midbands. Accent → shimmer1 → pastel → border.
      return {
        colors: [theme.accent, theme.shimmer, theme.pastel, theme.border],
        start, end,
      };
    }
    case 'citrus': {
      // Red / orange: punchy 3-stop with a deep burnt border.
      return {
        colors: [theme.accent, theme.shimmer, theme.border],
        start, end,
      };
    }
    case 'sunset': {
      // Coral / teal / magenta: 5-stop diagonal sunset sweep.
      return {
        colors: [theme.accent, theme.shimmer, theme.pastel, theme.shimmer, theme.border],
        start, end,
      };
    }
    case 'vertical':
    default: {
      // Standard glossy highlight → mid → shade (kept for greens/purples
      // where the simple recipe already reads well).
      return {
        colors: [theme.accent, theme.pastel, theme.border],
        start, end,
      };
    }
  }
}

/** Resolve which of the 7 backdrop gradients a specific level should render. */
export function getBackdropPreset(level: number = 1): BackdropPreset {
  const seed = getLevelThemeSeed(level);
  return BACKDROP_PRESETS[seed.backdrop] ?? BACKDROP_PRESETS[0];
}

/** Legacy 3-stop array accessor — kept for callers that don't need direction. */
export function getTileGradientStops(
  regionId?: number,
  level: number = 1,
): string[] {
  return getTileGradient(regionId, level).colors;
}
