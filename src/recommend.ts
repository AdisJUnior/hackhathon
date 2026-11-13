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
    m.provenance === 'precomputed' && Boolean(m.sceneId?.trim()) && /^https:\/\//.test(m.source) &&
    Number.isFinite(m.value) && m.value >= (mode === 'green' ? -1 : 0) && m.value <= (mode === 'green' ? 1 : 100) &&
    m.validFraction >= MIN_VALID_FRACTION && m.validFraction <= 1 &&
    m.cloudFraction !== null && m.cloudFraction >= 0 && m.cloudFraction <= MAX_CLOUD_FRACTION &&
    isIsoDate(m.date);
}

export type Result = { place: Place; distance: number; measurement: Measurement };

function latestValidMeasurement(placeId: string, mode: Mode, measurements: Measurement[]): Measurement | null {
  return measurements.filter((m) => m.placeId === placeId && validMeasurement(m, mode))
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function recommend(places: Place[], town: Town, rangeKm: number, mode: Mode, measurements: Measurement[]): Result[] {
  const candidates = places.flatMap((place) => {
    const distance = distanceKm(town.coordinates, place.coordinates);
    if (distance > rangeKm) return [];
    const latest = latestValidMeasurement(place.id, mode, measurements);
    return latest ? [{ place, distance, measurement: latest }] : [];
  });
  const referenceDate = Math.max(...candidates.map((item) => Date.parse(item.measurement.date)));
  return candidates.filter((item) => referenceDate - Date.parse(item.measurement.date) <= MAX_DATE_GAP_DAYS * 86400000)
    .sort((a, b) => b.measurement.value - a.measurement.value || a.distance - b.distance).slice(0, 7);
}

export function nearby(places: Place[], town: Town, rangeKm: number) {
  return places.map((place) => ({ place, distance: distanceKm(town.coordinates, place.coordinates) })).filter((item) => item.distance <= rangeKm).sort((a, b) => a.distance - b.distance);
}

const greenPriority: Record<string, number> = {
  'Ledovcové jezero': 6, 'Zahrada a park': 6, 'Vodopád': 6, 'Vyhlídka': 5,
  'Horský vrchol': 5, 'Rozhledna': 5, 'Skalní útvar': 5, 'Jeskyně': 4,
  'Hrad a vyhlídka': 4, 'Hrad': 3, 'Zřícenina': 3, 'Zámek': 2,
  'Zoo a akvárium': 2, 'Klášter': 1, 'Turistická atrakce': 1,
};
const snowPriority: Record<string, number> = {
  'Horský vrchol': 6, 'Rozhledna': 6, 'Vyhlídka': 6, 'Hrad a vyhlídka': 5,
  'Ledovcové jezero': 5, 'Skalní útvar': 4, 'Vodopád': 4, 'Zřícenina': 3,
  'Hrad': 3, 'Zahrada a park': 2, 'Jeskyně': 2, 'Zámek': 2,
  'Zoo a akvárium': 1, 'Klášter': 1, 'Turistická atrakce': 1,
};
export function visibleLimit(rangeKm: number) {
  return rangeKm <= 5 ? 5 : 7;
}

export function explore(places: Place[], town: Town, rangeKm: number, mode: Mode, measurements: Measurement[]) {
  const ranked = recommend(places, town, rangeKm, mode, measurements).slice(0, visibleLimit(rangeKm));
  const rankedIds = new Set(ranked.map(({ place }) => place.id));
  const candidates = nearby(places, town, rangeKm).filter(({ place }) => !rankedIds.has(place.id))
    .map((item) => ({ ...item, measurement: latestValidMeasurement(item.place.id, mode, measurements) }));
  const priorities = mode === 'green' ? greenPriority : snowPriority;
  const bands = [0, 1, 2].map((band) => candidates.filter(({ distance }) => Math.min(2, Math.floor(distance / rangeKm * 3)) === band)
    .sort((a, b) => Number(Boolean(b.measurement)) - Number(Boolean(a.measurement)) ||
      (priorities[b.place.category] ?? 0) - (priorities[a.place.category] ?? 0) || a.distance - b.distance));
  const unranked: typeof candidates = [];
  const limit = visibleLimit(rangeKm) - ranked.length;
  while (unranked.length < limit && bands.some((band) => band.length)) {
    for (const band of bands) {
      if (unranked.length >= limit) break;
      const candidate = band.shift();
      if (candidate) unranked.push(candidate);
    }
  }
  const visible = [
    ...ranked.map((item, index) => ({ ...item, measured: true as const, rank: index + 1 })),
    ...unranked.map((item) => ({ ...item, measured: false as const, rank: null })),
  ];
  const outside = places.map((place) => ({ place, distance: distanceKm(town.coordinates, place.coordinates) }))
    .filter(({ distance }) => distance > rangeKm).sort((a, b) => a.distance - b.distance).slice(0, 3);
  return { ranked, visible, outside };
}
