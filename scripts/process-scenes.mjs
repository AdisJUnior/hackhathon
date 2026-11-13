import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isIsoDate } from '../src/recommend.ts';
import { summarizeScene } from '../src/satellite.ts';
import { saveMeasurements } from './import-measurements.mjs';

const input = process.argv.slice(2).find((arg) => arg !== '--');
if (!input) throw new Error('Použití: pnpm process:scenes -- cesta/ke/scenam.json');
const root = resolve(import.meta.dirname, '..');
const geojson = JSON.parse(readFileSync(resolve(root, 'src/places.json'), 'utf8'));
const places = [
  ...geojson.features.map((feature) => ({ id: feature.id, coordinates: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]] })),
  ...['regional-places.json', 'places-extra.json'].flatMap((file) => JSON.parse(readFileSync(resolve(root, 'src', file), 'utf8'))
    .map((place) => ({ id: place.id, coordinates: place.coordinates }))),
];
const scenes = JSON.parse(readFileSync(resolve(input), 'utf8'));
if (!Array.isArray(scenes)) throw new Error('Vstup musí být pole scén');

function assertPixel(pixel, mode, sceneId, index) {
  if (!pixel || !Number.isFinite(pixel.latitude) || !Number.isFinite(pixel.longitude)) throw new Error(`${sceneId}: pixel ${index} nemá souřadnice`);
  if (mode === 'green') {
    if (!Number.isInteger(pixel.SCL) || pixel.SCL < 0 || pixel.SCL > 11) throw new Error(`${sceneId}: pixel ${index} má neplatnou SCL třídu`);
    for (const band of ['B04', 'B08']) if (pixel[band] !== null && (!Number.isFinite(pixel[band]) || pixel[band] < 0)) throw new Error(`${sceneId}: pixel ${index} má neplatné ${band}`);
  } else {
    if (pixel.FSCOG !== null && (!Number.isInteger(pixel.FSCOG) || !((pixel.FSCOG >= 0 && pixel.FSCOG <= 100) || [205, 210, 255].includes(pixel.FSCOG)))) throw new Error(`${sceneId}: pixel ${index} má neplatný kód FSCOG`);
    if (pixel.FSCOG_QA !== null && (!Number.isInteger(pixel.FSCOG_QA) || !([0, 1, 2, 3, 205, 210, 255].includes(pixel.FSCOG_QA)))) throw new Error(`${sceneId}: pixel ${index} má neplatný kód FSCOG_QA`);
  }
}

const results = [];
for (const scene of scenes) {
  const place = places.find((item) => item.id === scene.placeId);
  if (!place || !['green', 'snow'].includes(scene.mode) || !isIsoDate(scene.date) ||
      typeof scene.sceneId !== 'string' || !scene.sceneId.trim() ||
      typeof scene.source !== 'string' || !scene.source.startsWith('https://') ||
      !Array.isArray(scene.pixels) || !scene.pixels.length) throw new Error('Scéna má neplatná metadata nebo chybí pixely');
  scene.pixels.forEach((pixel, index) => assertPixel(pixel, scene.mode, scene.sceneId, index));
  const result = summarizeScene(scene, place);
  if (result) results.push(result);
  else console.warn(`${scene.sceneId}: vyřazeno kvůli nedostatečné ploše nebo oblačnosti`);
}
saveMeasurements(results);
