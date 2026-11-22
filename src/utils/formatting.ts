/**
 * Formatting helpers for human-readable timestamps and geospatial distances.
 */

export function formatRelativeTime(createdAt: any): string {
  if (!createdAt) return 'Just now';

  let timestampMs: number;
  if (typeof createdAt === 'number') {
    timestampMs = createdAt;
  } else if (typeof createdAt === 'string') {
    timestampMs = new Date(createdAt).getTime();
  } else if (typeof createdAt?.toMillis === 'function') {
    timestampMs = createdAt.toMillis();
  } else if (typeof createdAt?.seconds === 'number') {
    timestampMs = createdAt.seconds * 1000;
  } else {
    return 'Recently';
  }

  if (Number.isNaN(timestampMs)) return 'Recently';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSeconds < 60) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Haversine distance formatted into meters or kilometers (e.g., "340m", "1.4km").
 */
export function formatDistanceLabel(
  from?: Coordinates | null,
  to?: Coordinates | null
): string | null {
  if (!from || !to || !to.latitude || !to.longitude) return null;

  const R = 6371e3; // Earth radius in meters
  const phi1 = (from.latitude * Math.PI) / 180;
  const phi2 = (to.latitude * Math.PI) / 180;
  const deltaPhi = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLambda = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = R * c;

  if (meters < 1000) {
    return `${Math.max(10, Math.round(meters / 10) * 10)}m away`;
  }
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)}km away`;
}
