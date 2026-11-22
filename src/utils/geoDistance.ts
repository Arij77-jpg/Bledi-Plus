/**
 * Geospatial Distance & Smart Duplicate Detection Utilities (`src/utils/geoDistance.ts`)
 *
 * Implements the spherical Haversine Distance Formula in meters and filters active
 * civic issues (`status !== 'resolved'`) within a configurable proximity threshold.
 */

import type { CivicReport } from '../types/report';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface NearbyDuplicateMatch<T extends CivicReport = CivicReport> {
  report: T;
  /** Exact Haversine ground distance in meters */
  distanceMeters: number;
  /** Rounded integer meters suitable for UI display (e.g. 14) */
  roundedMeters: number;
}

export const DUPLICATE_DETECTION_RADIUS_METERS = 30;
const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates great-circle distance between two WGS-84 coordinates using the Haversine formula.
 *
 * @returns Distance in meters (returns `0` for identical coordinates, `Infinity` on invalid inputs)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const sinHalfLat = Math.sin(deltaPhi / 2);
  const sinHalfLon = Math.sin(deltaLambda / 2);

  const a =
    sinHalfLat * sinHalfLat +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfLon * sinHalfLon;

  // Clamp floating-point rounding drift strictly into [0, 1]
  const clampedA = Math.min(1, Math.max(0, a));
  const angularDistance = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * angularDistance;
}

/**
 * Filters active (non-resolved) civic reports within `maxRadiusMeters` (default: 30m)
 * and sorts results from closest to farthest.
 */
export function findNearbyActiveDuplicates<T extends CivicReport>(
  origin: GeoCoordinates,
  reports: T[],
  maxRadiusMeters: number = DUPLICATE_DETECTION_RADIUS_METERS
): NearbyDuplicateMatch<T>[] {
  if (!origin || !Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)) {
    return [];
  }

  const matches: NearbyDuplicateMatch<T>[] = [];

  for (const report of reports) {
    if (!report || report.status === 'resolved' || report.status === 'completed') {
      continue;
    }

    const targetLat = report.location?.latitude;
    const targetLon = report.location?.longitude;
    if (typeof targetLat !== 'number' || typeof targetLon !== 'number') {
      continue;
    }

    const distanceMeters = calculateDistance(
      origin.latitude,
      origin.longitude,
      targetLat,
      targetLon
    );

    if (distanceMeters <= maxRadiusMeters) {
      matches.push({
        report,
        distanceMeters,
        roundedMeters: Math.round(distanceMeters),
      });
    }
  }

  matches.sort((a, b) => {
    const distDiff = a.distanceMeters - b.distanceMeters;
    if (Math.abs(distDiff) > 0.5) return distDiff;
    return (b.report.upvotesCount || 0) - (a.report.upvotesCount || 0);
  });

  return matches;
}
