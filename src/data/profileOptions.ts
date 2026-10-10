/**
 * Child-safe player identity. Names are built only from these words plus a
 * number, and the server stores the *indexes*, never text — so nothing a
 * player types can ever appear on the global leaderboard.
 *
 * APPEND-ONLY: existing players reference words by index. Never reorder or
 * remove entries; only add to the end (server allows indexes 0..199).
 */
export const NAME_ADJECTIVES = [
  'Sunny', 'Happy', 'Brave', 'Clever', 'Cozy', 'Fluffy', 'Gentle', 'Jolly',
  'Lucky', 'Merry', 'Peppy', 'Quick', 'Sleepy', 'Sparkly', 'Speedy', 'Sweet',
  'Swift', 'Tiny', 'Wise', 'Zippy', 'Bouncy', 'Cheery', 'Daring', 'Mighty',
] as const;

export const NAME_NOUNS = [
  'Beagle', 'Corgi', 'Poodle', 'Pug', 'Husky', 'Shiba', 'Collie', 'Terrier',
  'Puppy', 'Kitten', 'Bunny', 'Panda', 'Otter', 'Fox', 'Koala', 'Penguin',
  'Hedgehog', 'Duckling', 'Owl', 'Squirrel', 'Daisy', 'Tulip', 'Acorn', 'Pebble',
] as const;

export const NAME_NUMBER_MAX = 99;

export interface AvatarDef {
  emoji: string;
  label: string;
  /** Gradient stops, light → dark. */
  colors: [string, string];
}

/** Seven mixed avatars. Index is stored server-side (0..6) — append-only. */
export const AVATARS: AvatarDef[] = [
  { emoji: '🐶', label: 'Pup', colors: ['#FFD48A', '#F39C12'] },
  { emoji: '🐱', label: 'Kitty', colors: ['#FFB3C7', '#E8507A'] },
  { emoji: '🦊', label: 'Fox', colors: ['#FFC08A', '#E0621A'] },
  { emoji: '🐰', label: 'Bunny', colors: ['#D9C8FF', '#8E6BE0'] },
  { emoji: '🐼', label: 'Panda', colors: ['#C9F2D6', '#3FAE6A'] },
  { emoji: '🦉', label: 'Owl', colors: ['#B8E4FF', '#2C93E8'] },
  { emoji: '🐸', label: 'Frog', colors: ['#D8F7A0', '#6DB82E'] },
];

export interface PlayerIdentity {
  nameAdj: number;
  nameNoun: number;
  nameNum: number;
  avatar: number;
}

const clampIndex = (i: number, len: number) =>
  Number.isInteger(i) && i >= 0 && i < len ? i : 0;

/** Sanitizes indexes so a corrupt/old payload can never crash rendering. */
export function normalizeIdentity(p: Partial<PlayerIdentity>): PlayerIdentity {
  return {
    nameAdj: clampIndex(p.nameAdj ?? 0, NAME_ADJECTIVES.length),
    nameNoun: clampIndex(p.nameNoun ?? 0, NAME_NOUNS.length),
    nameNum: clampIndex(p.nameNum ?? 0, NAME_NUMBER_MAX + 1),
    avatar: clampIndex(p.avatar ?? 0, AVATARS.length),
  };
}

export function formatPlayerName(p: Pick<PlayerIdentity, 'nameAdj' | 'nameNoun' | 'nameNum'>): string {
  const n = normalizeIdentity(p);
  return `${NAME_ADJECTIVES[n.nameAdj]} ${NAME_NOUNS[n.nameNoun]} ${n.nameNum}`;
}

export function randomIdentity(rand: () => number = Math.random): PlayerIdentity {
  const pick = (len: number) => Math.floor(rand() * len) % len;
  return {
    nameAdj: pick(NAME_ADJECTIVES.length),
    nameNoun: pick(NAME_NOUNS.length),
    nameNum: pick(NAME_NUMBER_MAX + 1),
    avatar: pick(AVATARS.length),
  };
}
