import type { Measurement, Mode, Place, Town } from './data';

export const MIN_VALID_FRACTION = 0.7;
export const MAX_CLOUD_FRACTION = 0.3;
export const MAX_DATE_GAP_DAYS = 14;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function validMeasurement(m: Measurement, mode: Mode): boolean {
  return m.mode === mode && m.product === (mode === 'green' ? 'S2-L2A-NDVI' : 'CLMS-FSC-20M') &&
    m.statistic === (mode === 'green' ? 'median' : 'mean') && m.radiusMeters === 250 &&
    (m.provenance === 'demo' || (m.provenance === 'precomputed' && Boolean(m.sceneId?.trim()) && /^https:\/\//.test(m.source))) &&
    Number.isFinite(m.value) && m.value >= (mode === 'green' ? -1 : 0) && m.value <= (mode === 'green' ? 1 : 100) &&
    m.validFraction >= MIN_VALID_FRACTION && m.validFraction <= 1 &&
    m.cloudFraction !== null && m.cloudFraction >= 0 && m.cloudFraction <= MAX_CLOUD_FRACTION &&
    isIsoDate(m.date);
}

export type Result = { place: Place; distance: number; measurement: Measurement };

export function recommend(places: Place[], town: Town, rangeKm: number, mode: Mode, measurements: Measurement[]): Result[] {
  const candidates = places.flatMap((place) => {
    const distance = distanceKm(town.coordinates, place.coordinates);
    if (distance > rangeKm) return [];
    const latest = measurements.filter((m) => m.placeId === place.id && validMeasurement(m, mode)).sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest ? [{ place, distance, measurement: latest }] : [];
  });
  const referenceDate = Math.max(...candidates.map((item) => Date.parse(item.measurement.date)));
  return candidates.filter((item) => referenceDate - Date.parse(item.measurement.date) <= MAX_DATE_GAP_DAYS * 86400000)
    .sort((a, b) => b.measurement.value - a.measurement.value || a.distance - b.distance).slice(0, 3);
}

export function nearby(places: Place[], town: Town, rangeKm: number) {
  return places.map((place) => ({ place, distance: distanceKm(town.coordinates, place.coordinates) })).filter((item) => item.distance <= rangeKm).sort((a, b) => a.distance - b.distance).slice(0, 3);
}
