import assert from 'node:assert/strict';
import test from 'node:test';
import { ndvi, summarizeScene } from './satellite.ts';
import { places } from './data.ts';
import { validMeasurement } from './recommend.ts';
import { validate } from '../scripts/import-measurements.mjs';

const place = places[0];
const position = { latitude: place.coordinates[0], longitude: place.coordinates[1] };
const metadata = { placeId: place.id, date: '2026-07-15', sceneId: 'TEST_SCENE', source: 'https://example.org/real-product' };

test('NDVI uses B08 NIR and B04 red, with zero denominator handled', () => {
  assert.ok(Math.abs(ndvi(.2, .6)! - .5) < 1e-12);
  assert.equal(ndvi(0, 0), null);
  assert.equal(ndvi(-.1, .5), null);
});

test('NDVI takes median inside 250 m and masks cloud shadow and no-data', () => {
  const pixels = [
    { ...position, B04: .2, B08: .6, SCL: 4 },  // .5
    { ...position, B04: .3, B08: .7, SCL: 4 },  // .4
    { ...position, B04: .1, B08: .9, SCL: 4 },  // .8; median .5, mean .5667
    { ...position, B04: .1, B08: .9, SCL: 3 },  // shadow, excluded
    { latitude: position.latitude + .01, longitude: position.longitude, B04: 0, B08: 1, SCL: 4 }, // outside
  ];
  const result = summarizeScene({ ...metadata, mode: 'green', pixels }, place);
  assert.ok(Math.abs(result!.value - .5) < 1e-12);
  assert.equal(result?.validFraction, .75);
  assert.equal(result?.cloudFraction, .25);
  assert.equal(result?.statistic, 'median');
  assert.equal(validMeasurement(result!, 'green'), true);
});

test('FSC uses FSCOG mean, zero is valid, mask codes and poor QA are excluded', () => {
  const pixels = [
    { ...position, FSCOG: 0, FSCOG_QA: 0 },
    { ...position, FSCOG: 50, FSCOG_QA: 1 },
    { ...position, FSCOG: 100, FSCOG_QA: 0 },
    { ...position, FSCOG: 205, FSCOG_QA: 205 },
  ];
  const result = summarizeScene({ ...metadata, mode: 'snow', pixels }, place);
  assert.equal(result?.value, 50);
  assert.equal(result?.validFraction, .75);
  assert.equal(result?.cloudFraction, .25);
  assert.equal(result?.product, 'CLMS-FSC-20M');
  assert.equal(summarizeScene({ ...metadata, mode: 'snow', pixels: pixels.map((p) => ({ ...p, FSCOG: 0, FSCOG_QA: 0 })) }, place)?.value, 0);
  assert.equal(summarizeScene({ ...metadata, mode: 'snow', pixels: [{ ...position, FSCOG: 210, FSCOG_QA: 210 }] }, place), null);
  assert.equal(summarizeScene({ ...metadata, mode: 'snow', pixels: [{ ...position, FSCOG: 50, FSCOG_QA: 3 }] }, place), null);
});

test('import rejects product swaps, wrong radius, and invalid dates', () => {
  const item = summarizeScene({ ...metadata, mode: 'green', pixels: [{ ...position, B04: .2, B08: .6, SCL: 4 }] }, place)!;
  assert.doesNotThrow(() => validate(item, 0));
  assert.doesNotThrow(() => validate({ ...item, placeId: 'wd-Q123190997' }, 0));
  assert.throws(() => validate({ ...item, product: 'CLMS-FSC-20M' }, 0));
  assert.throws(() => validate({ ...item, statistic: 'mean' }, 0));
  assert.throws(() => validate({ ...item, radiusMeters: 500 }, 0));
  assert.throws(() => validate({ ...item, date: '2026-02-31' }, 0));
});
