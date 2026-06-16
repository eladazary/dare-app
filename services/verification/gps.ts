export interface GPSResult {
  valid: boolean;
  distance_m: number;
  message: string;
}

export function validateGPS(
  submissionLat: number,
  submissionLng: number,
  challengeLat: number,
  challengeLng: number,
  radiusM: number
): GPSResult {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(submissionLat - challengeLat);
  const dLng = toRad(submissionLng - challengeLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(challengeLat)) *
      Math.cos(toRad(submissionLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance_m = R * c;

  const tolerance = 50;
  const allowed = radiusM + tolerance;
  const valid = distance_m <= allowed;

  return {
    valid,
    distance_m: Math.round(distance_m),
    message: valid
      ? `Within radius (${Math.round(distance_m)}m of ${radiusM}m limit)`
      : `Too far from challenge location (${Math.round(distance_m)}m, limit ${radiusM}m + 50m tolerance)`,
  };
}
