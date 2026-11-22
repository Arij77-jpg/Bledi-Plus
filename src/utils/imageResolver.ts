/**
 * Image Resolver Utility (`src/utils/imageResolver.ts`)
 * ====================================================
 *
 * Resolves image sources seamlessly across:
 * 1. Local bundled seed images in `assets/seed-images/` (via `require(...)`)
 * 2. Remote Firebase Storage or web URLs (`https://...`, `file://...`, `data:...`)
 * 3. Seed asset identifier tags (e.g. `seed:lamp_before.jpg`, `lamp_before.jpg`, or full asset paths)
 */

import { ImageSourcePropType } from 'react-native';

export const LOCAL_SEED_IMAGES: Record<string, any> = {
  'lamp_before.jpg': require('../../assets/seed-images/lamp_before.jpg'),
  'lamp_after.jpg': require('../../assets/seed-images/lamp_after.jpg'),
  'pothole_before.jpg': require('../../assets/seed-images/pothole_before.jpg'),
  'pothole_after.jpg': require('../../assets/seed-images/pothole_after.jpg'),
  'alley_before.jpg': require('../../assets/seed-images/alley_before.jpg'),
  'alley_after.jpg': require('../../assets/seed-images/alley_after.jpg'),
  'grass_trash_before.jpg': require('../../assets/seed-images/grass_trash_before.jpg'),
  'grass_trash_after.jpg': require('../../assets/seed-images/grass_trash_after.jpg'),
  'pending_1.jpg': require('../../assets/seed-images/pending_1.jpg'),
  'pending_2.jpg': require('../../assets/seed-images/pending_2.jpg'),
  'pending_3.jpg': require('../../assets/seed-images/pending_3.jpg'),
  'pending_4.jpg': require('../../assets/seed-images/pending_4.jpg'),
};

/**
 * Resolves any image identifier or URL into a valid React Native `ImageSourcePropType`.
 */
export function resolveImageSource(source?: string | number | null): ImageSourcePropType {
  if (!source) {
    return { uri: '' };
  }

  // Already a bundled required asset number
  if (typeof source === 'number') {
    return source;
  }

  if (typeof source === 'string') {
    const trimmed = source.trim();

    // Check exact match in seed images dictionary
    if (LOCAL_SEED_IMAGES[trimmed]) {
      return LOCAL_SEED_IMAGES[trimmed];
    }

    // Strip common prefixes: "seed:", "assets/seed-images/", "/assets/seed-images/"
    const cleanKey = trimmed
      .replace(/^seed:/i, '')
      .replace(/^(\/)?assets\/seed-images\//i, '')
      .split('?')[0]
      .split('/')
      .pop();

    if (cleanKey && LOCAL_SEED_IMAGES[cleanKey]) {
      return LOCAL_SEED_IMAGES[cleanKey];
    }

    // Standard remote or local URI
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('file://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('ph://')
    ) {
      return { uri: trimmed };
    }

    return { uri: trimmed };
  }

  return source as ImageSourcePropType;
}
