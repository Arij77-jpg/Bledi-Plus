/**
 * Multi-Tenant Municipal Region Mapper (`src/utils/regionMapper.ts`)
 *
 * Provides standardized Délégation / Mo3tamdiya definitions, textual reverse-geocode
 * parsing, and GPS centroid proximity fallback to guarantee 100% deterministic
 * municipal region routing for incoming civic reports.
 */

import { calculateDistance } from './geoDistance';

export interface MunicipalRegion {
  id: string;
  name: string;
  arabicName: string;
  governorate: string;
  center: { latitude: number; longitude: number };
  keywords: string[];
}

export const SUPER_ADMIN_REGION = 'ALL';
export const DEFAULT_REGION = 'Sousse Médina';

/**
 * Standardized Tunisian Municipal Délégations (Mo3tamdiyas)
 * Focuses on Sousse Governorate metropolitan area + Zarzis/Médenine to maintain
 * backwards compatibility with existing demo incidents.
 */
export const SUPPORTED_REGIONS: MunicipalRegion[] = [
  {
    id: 'sousse_medina',
    name: 'Sousse Médina',
    arabicName: 'سوسة المدينة',
    governorate: 'Sousse',
    center: { latitude: 35.8256, longitude: 10.6369 },
    keywords: ['médina', 'medina', 'boujaafar', 'port sousse', 'sousse ville', 'centre ville'],
  },
  {
    id: 'hammam_sousse',
    name: 'Hammam Sousse',
    arabicName: 'حمام سوسة',
    governorate: 'Sousse',
    center: { latitude: 35.8592, longitude: 10.5986 },
    keywords: ['hammam sousse', 'kantaoui', 'el kantaoui', 'menchia', 'bahrana'],
  },
  {
    id: 'sousse_jawhara',
    name: 'Sousse Jawhara',
    arabicName: 'سوسة جوهرة',
    governorate: 'Sousse',
    center: { latitude: 35.8288, longitude: 10.6083 },
    keywords: ['jawhara', 'sahloul', 'hopital sahloul', 'khezama', 'khzema'],
  },
  {
    id: 'sousse_riadh',
    name: 'Sousse Riadh',
    arabicName: 'سوسة الرياض',
    governorate: 'Sousse',
    center: { latitude: 35.8012, longitude: 10.6042 },
    keywords: ['riadh', 'cite riadh', 'cité riadh', 'bourguiba riadh', 'ezzouhour'],
  },
  {
    id: 'sousse_sidi_abdelhamid',
    name: 'Sousse Sidi Abdelhamid',
    arabicName: 'سوسة سيدي عبد الحميد',
    governorate: 'Sousse',
    center: { latitude: 35.7925, longitude: 10.6358 },
    keywords: ['sidi abdelhamid', 'abdelhamid', 'zone industrielle sousse', 'ksibat sousse'],
  },
  {
    id: 'msaken',
    name: 'Msaken',
    arabicName: 'مساكن',
    governorate: 'Sousse',
    center: { latitude: 35.7333, longitude: 10.5833 },
    keywords: ['msaken', 'messadine', 'borjine', 'beni rbia'],
  },
  {
    id: 'kalaa_kebira',
    name: 'Kalâa Kebira',
    arabicName: 'القلعة الكبرى',
    governorate: 'Sousse',
    center: { latitude: 35.8667, longitude: 10.5333 },
    keywords: ['kalaa kebira', 'kalâa kebira', 'kebira'],
  },
  {
    id: 'kalaa_seghira',
    name: 'Kalâa Seghira',
    arabicName: 'القلعة الصغرى',
    governorate: 'Sousse',
    center: { latitude: 35.8222, longitude: 10.5583 },
    keywords: ['kalaa seghira', 'kalâa seghira', 'seghira', 'oued laya'],
  },
  {
    id: 'akouda',
    name: 'Akouda',
    arabicName: 'أكودة',
    governorate: 'Sousse',
    center: { latitude: 35.8711, longitude: 10.5694 },
    keywords: ['akouda', 'chott mariem', 'chott meriem'],
  },
  {
    id: 'sidi_bou_ali',
    name: 'Sidi Bou Ali',
    arabicName: 'سيدي بوعلي',
    governorate: 'Sousse',
    center: { latitude: 35.9575, longitude: 10.4722 },
    keywords: ['sidi bou ali', 'bou ali'],
  },
  {
    id: 'enfidha',
    name: 'Enfidha',
    arabicName: 'النفيضة',
    governorate: 'Sousse',
    center: { latitude: 36.135, longitude: 10.38 },
    keywords: ['enfidha', 'aeroport enfidha', 'aéroport enfidha', 'ain garci'],
  },
  {
    id: 'zarzis',
    name: 'Zarzis',
    arabicName: 'جرجيس',
    governorate: 'Médenine',
    center: { latitude: 33.5042, longitude: 11.1125 },
    keywords: ['zarzis', 'jarjis', 'souihel', 'hassi djerbi', 'route touristique zarzis'],
  },
  {
    id: 'medenine_nord',
    name: 'Médenine Nord',
    arabicName: 'مدنين الشمالية',
    governorate: 'Médenine',
    center: { latitude: 33.3547, longitude: 10.4925 },
    keywords: ['medenine', 'médenine'],
  },
  {
    id: 'tunis_centre_ville',
    name: 'Tunis Centre-Ville',
    arabicName: 'تونس المدينة',
    governorate: 'Tunis',
    center: { latitude: 36.8000, longitude: 10.1800 },
    keywords: ['tunis', 'centre ville', 'habib bourguiba tunis', 'bab bhar', 'porte de france'],
  },
  {
    id: 'la_marsa',
    name: 'La Marsa',
    arabicName: 'المرسى',
    governorate: 'Tunis',
    center: { latitude: 36.8782, longitude: 10.3247 },
    keywords: ['la marsa', 'marsa', 'saf-saf', 'saf saf', 'gammarth', 'corniche marsa'],
  },
  {
    id: 'sfax_ville',
    name: 'Sfax Ville',
    arabicName: 'صفاقس المدينة',
    governorate: 'Sfax',
    center: { latitude: 34.7400, longitude: 10.7600 },
    keywords: ['sfax', 'bab diwan', 'medina sfax', 'hedi chaker'],
  },
];

/**
 * Normalizes an arbitrary reverse-geocode result and coordinates into a recognized Délégation.
 *
 * Step 1: Textual search across reverse-geocode fields (`district`, `subregion`, `city`, `street`, `name`).
 * Step 2: Fallback to Haversine nearest centroid distance calculation against all region centers.
 */
export function detectRegionFromLocation(
  coords?: { latitude: number; longitude: number } | null,
  place?: {
    district?: string | null;
    subregion?: string | null;
    city?: string | null;
    street?: string | null;
    region?: string | null;
    name?: string | null;
  } | null
): string {
  // 1. Textual search in reverse-geocoded tokens
  if (place) {
    const rawTokens = [
      place.district,
      place.subregion,
      place.city,
      place.street,
      place.region,
      place.name,
    ]
      .filter((t): t is string => Boolean(t && typeof t === 'string'))
      .map((t) => t.toLowerCase().trim());

    for (const region of SUPPORTED_REGIONS) {
      const regNameLower = region.name.toLowerCase();
      // Direct name match
      if (rawTokens.some((token) => token.includes(regNameLower) || regNameLower.includes(token))) {
        return region.name;
      }
      // Keyword match
      if (
        region.keywords.some((kw) =>
          rawTokens.some((token) => token.includes(kw) || kw.includes(token))
        )
      ) {
        return region.name;
      }
    }
  }

  // 2. Geospatial Haversine fallback to nearest municipal center
  if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
    let closestRegion = SUPPORTED_REGIONS[0];
    let minDistance = Number.POSITIVE_INFINITY;

    for (const region of SUPPORTED_REGIONS) {
      const dist = calculateDistance(
        coords.latitude,
        coords.longitude,
        region.center.latitude,
        region.center.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        closestRegion = region;
      }
    }

    return closestRegion.name;
  }

  return DEFAULT_REGION;
}

/**
 * Returns true if the region is a recognized Délégation or the Super-Admin wildcard.
 */
export function isValidRegion(regionName: string): boolean {
  if (regionName === SUPER_ADMIN_REGION) return true;
  return SUPPORTED_REGIONS.some((r) => r.name.toLowerCase() === regionName.toLowerCase());
}

/**
 * Checks whether an admin with `assignedRegion` has authority over an incident in `targetRegion`.
 */
export function hasRegionalAuthority(adminRegion?: string | null, targetRegion?: string | null): boolean {
  if (!adminRegion) return false;
  if (adminRegion === SUPER_ADMIN_REGION || adminRegion.toUpperCase() === 'ALL') return true;
  if (!targetRegion) return false;
  return adminRegion.toLowerCase().trim() === targetRegion.toLowerCase().trim();
}
