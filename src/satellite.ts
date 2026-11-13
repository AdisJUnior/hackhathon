import type { Measurement, Mode, Place } from './data.ts';
import { distanceKm, MAX_CLOUD_FRACTION, MIN_VALID_FRACTION } from './recommend.ts';

export type PixelPosition = { latitude: number; longitude: number };
export type NdviPixel = PixelPosition & { B04: number | null; B08: number | null; SCL: number | null };
export type SnowPixel = PixelPosition & { FSCOG: number | null; FSCOG_QA: number | null };
export type SceneInput = {
  placeId: string;
  mode: Mode;
  date: string;
  sceneId: string;
  source: string;
  // Complete grid of pixel centres, including missing/cloudy pixels. Values outside 250 m are ignored.
  pixels: NdviPixel[] | SnowPixel[];
};

const CLOUD_SCL = new Set([3, 7, 8, 9, 10]); // shadows, unclassified, clouds, cirrus
const INVALID_SCL = new Set([0, 1, ...CLOUD_SCL]);

export function ndvi(red: number, nir: number): number | null {
  if (!Number.isFinite(red) || !Number.isFinite(nir) || red < 0 || nir < 0 || red + nir <= 0) return null;
  return (nir - red) / (nir + red);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeScene(scene: SceneInput, place: Place): Measurement | null {
  if (scene.placeId !== place.id || !scene.pixels.length) return null;
  const pixels = scene.pixels.filter((pixel) =>
    Number.isFinite(pixel.latitude) && Number.isFinite(pixel.longitude) &&
    distanceKm(place.coordinates, [pixel.latitude, pixel.longitude]) <= .25,
  );
  if (!pixels.length) return null;
  const values: number[] = [];
  let cloudy = 0;

  for (const pixel of pixels) {
    if (scene.mode === 'green') {
      const p = pixel as NdviPixel;
      if (p.SCL !== null && CLOUD_SCL.has(p.SCL)) cloudy++;
      if (p.SCL === null || INVALID_SCL.has(p.SCL) || p.B04 === null || p.B08 === null) continue;
      const value = ndvi(p.B04, p.B08);
      if (value !== null) values.push(value);
    } else {
      const p = pixel as SnowPixel;
      if (p.FSCOG === 205) cloudy++;
      // FSCOG codes 205 (cloud/shadow), 210 (water), 255 (no data) are not snow percentages.
      // QA 0/1 are high/medium confidence; 2/3 are deliberately excluded.
      if (p.FSCOG !== null && Number.isInteger(p.FSCOG) && p.FSCOG >= 0 && p.FSCOG <= 100 &&
          p.FSCOG_QA !== null && [0, 1].includes(p.FSCOG_QA)) values.push(p.FSCOG);
    }
  }
  const validFraction = values.length / pixels.length;
  const cloudFraction = cloudy / pixels.length;
  if (!values.length || validFraction < MIN_VALID_FRACTION || cloudFraction > MAX_CLOUD_FRACTION) return null;
  return {
    placeId: scene.placeId,
    mode: scene.mode,
    value: scene.mode === 'green' ? median(values) : values.reduce((sum, value) => sum + value, 0) / values.length,
    date: scene.date,
    validFraction,
    cloudFraction,
    source: scene.source,
    sceneId: scene.sceneId,
    provenance: 'precomputed',
    product: scene.mode === 'green' ? 'S2-L2A-NDVI' : 'CLMS-FSC-20M',
    statistic: scene.mode === 'green' ? 'median' : 'mean',
    radiusMeters: 250,
  };
}
