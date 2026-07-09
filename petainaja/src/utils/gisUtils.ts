/**
 * GIS Math Utilities for calculations on WGS84 sphere
 */

/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 */
export function calculateHaversineDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // distance in km
}

/**
 * Generates a GeoJSON Polygon representing a circular buffer around a center point
 * with a specified radius (in kilometers).
 */
export function generateCircularBufferGeoJSON(
  center: [number, number],
  radiusKm: number,
  pointsCount: number = 64
): any {
  const [longitude, latitude] = center;
  const coordinates: [number, number][] = [];

  const earthRadiusKm = 6371;
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  const radialDist = radiusKm / earthRadiusKm; // Angular distance

  for (let i = 0; i <= pointsCount; i++) {
    const bearing = (i * 2 * Math.PI) / pointsCount;

    const radialLat = Math.asin(
      Math.sin(latRad) * Math.cos(radialDist) +
        Math.cos(latRad) * Math.sin(radialDist) * Math.cos(bearing)
    );

    const radialLon =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(radialDist) * Math.cos(latRad),
        Math.cos(radialDist) - Math.sin(latRad) * Math.sin(radialLat)
      );

    const latDeg = (radialLat * 180) / Math.PI;
    const lonDeg = (radialLon * 180) / Math.PI;

    coordinates.push([lonDeg, latDeg]);
  }

  return {
    type: "Feature",
    properties: {
      type: "buffer",
      radius_km: radiusKm,
      center: center
    },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates]
    }
  };
}
