export type LatLng = { lat: number; lng: number };

// Golden angle in radians, used to spread points on a spiral deterministically
const GOLDEN_ANGLE = 2.399963229728653; // ~137.5°

// Convert meters to degrees latitude (approx)
function metersToDegreesLat(meters: number): number {
  return meters / 111_320;
}

// Convert meters to degrees longitude (approx, depends on latitude)
function metersToDegreesLng(meters: number, atLatitudeDeg: number): number {
  const latRad = (atLatitudeDeg * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  // Avoid division by ~0 near poles; not expected for FR, but keep it safe
  const denom = 111_320 * Math.max(0.2, cosLat);
  return meters / denom;
}

/**
 * Returns a deterministic, small offset around a (lat,lng) center.
 * - index: 0..total-1 (0 yields no offset)
 * - total: size of the group sharing the same coordinate
 */
export function getJitteredLatLng({
  lat,
  lng,
  index,
  total
}: {
  lat: number;
  lng: number;
  index: number;
  total: number;
}): LatLng {
  if (total <= 1 || index <= 0) return { lat, lng };

  // Spiral radius in meters grows with index but stays visually subtle.
  // Using sqrt helps avoid too aggressive spread for larger groups.
  const baseMeters = 12;
  const stepMeters = 10;
  const radiusMeters = baseMeters + stepMeters * Math.sqrt(index);

  const angle = index * GOLDEN_ANGLE;
  const dxMeters = Math.cos(angle) * radiusMeters;
  const dyMeters = Math.sin(angle) * radiusMeters;

  const dLat = metersToDegreesLat(dyMeters);
  const dLng = metersToDegreesLng(dxMeters, lat);

  return {
    lat: lat + dLat,
    lng: lng + dLng
  };
}
