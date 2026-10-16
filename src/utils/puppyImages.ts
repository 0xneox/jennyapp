import { ImageSourcePropType } from 'react-native';

const GOLDEN_IMG: ImageSourcePropType = require('../../assets/puppies/pup_20_golden.jpg');
const CORGI_IMG: ImageSourcePropType = require('../../assets/puppies/pup_100_corgi.jpg');
const SHIBA_IMG: ImageSourcePropType = require('../../assets/puppies/pup_200_shiba.jpg');
const TERRIER_IMG: ImageSourcePropType = require('../../assets/puppies/pup_400_terrier.jpg');
const HOUND_IMG: ImageSourcePropType = require('../../assets/puppies/pup_600_hound.jpg');
const TWIN_IMG: ImageSourcePropType = require('../../assets/puppies/pup_800_twin.jpg');
const JENNY_IMG: ImageSourcePropType = require('../../assets/puppies/pup_1000_jenny.png');

export const PUPPY_MILESTONE_IMAGES: Record<number, ImageSourcePropType> = {
  10: GOLDEN_IMG,
  20: GOLDEN_IMG,
  50: CORGI_IMG,
  100: CORGI_IMG,
  200: SHIBA_IMG,
  400: TERRIER_IMG,
  500: TERRIER_IMG,
  600: HOUND_IMG,
  800: TWIN_IMG,
  1000: JENNY_IMG,
};

export interface PuppyMilestoneLike {
  level?: number;
  breedName?: string;
  icon?: string;
  chapter?: number;
}

/**
 * Returns the customized 3D puppy breed image for a given milestone level or object.
 * Checks by level, breed name, and icon. Always falls back to a 3D puppy photo (never null).
 */
export function getPuppyMilestoneImage(
  item: number | PuppyMilestoneLike | null | undefined
): ImageSourcePropType {
  if (item == null) return GOLDEN_IMG;

  const level = typeof item === 'number' ? item : item.level;
  if (level !== undefined && PUPPY_MILESTONE_IMAGES[level]) {
    return PUPPY_MILESTONE_IMAGES[level];
  }

  if (typeof item === 'object') {
    const name = (item.breedName || '').toLowerCase();
    const icon = item.icon || '';

    if (name.includes('golden') || name.includes('sunny') || icon === '🦮') return GOLDEN_IMG;
    if (name.includes('corgi') || name.includes('daisy') || icon === '🐕') return CORGI_IMG;
    if (name.includes('shiba') || name.includes('zen') || icon === '🦊') return SHIBA_IMG;
    if (name.includes('terrier') || name.includes('highland') || icon === '🐶') return TERRIER_IMG;
    if (name.includes('hound') || name.includes('guardian') || icon === '🐺') return HOUND_IMG;
    if (name.includes('twin') || name.includes('dalmatian') || icon === '🐾') return TWIN_IMG;
    if (name.includes('jenny') || name.includes('legend') || icon === '👑') return JENNY_IMG;
  }

  return GOLDEN_IMG;
}
