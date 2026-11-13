import assert from 'node:assert/strict';
import test from 'node:test';
import { demoMeasurements, places, towns, type Measurement } from './data.ts';
import { distanceKm, recommend, validMeasurement } from './recommend.ts';

test('distance uses real coordinates and respects range', () => {
  assert.equal(distanceKm(towns[0].coordinates, towns[0].coordinates), 0);
  assert.ok(distanceKm(towns[0].coordinates, places[4].coordinates) < 10);
  assert.deepEqual(recommend(places, towns[0], 5, 'green', demoMeasurements), []);
});

test('green and snow rank by their own metric and cap at three', () => {
  const green = recommend(places, towns[1], 100, 'green', demoMeasurements);
  const snow = recommend(places, towns[1], 100, 'snow', demoMeasurements);
  assert.equal(green.length, 3);
  assert.equal(snow.length, 3);
  assert.equal(green[0].place.id, 'prasily');
  assert.equal(snow[0].place.id, 'prasily');
  assert.ok(green.every((row, i) => i === 0 || green[i - 1].measurement.value >= row.measurement.value));
  const changedSnow = demoMeasurements.map((m) => m.mode === 'snow' && m.placeId === 'cerchov' ? { ...m, value: 99 } : m);
  assert.equal(recommend(places, towns[1], 100, 'snow', changedSnow)[0].place.id, 'cerchov');
  assert.equal(recommend(places, towns[1], 100, 'green', changedSnow)[0].place.id, 'prasily');
});

test('zero snow is valid; missing and low quality readings are excluded', () => {
  const base = demoMeasurements.find((m) => m.mode === 'snow')!;
  assert.equal(validMeasurement({ ...base, value: 0 }, 'snow'), true);
  assert.equal(validMeasurement({ ...base, value: NaN }, 'snow'), false);
  assert.equal(validMeasurement({ ...base, validFraction: .69 }, 'snow'), false);
  assert.equal(validMeasurement({ ...base, cloudFraction: .31 }, 'snow'), false);
  assert.equal(validMeasurement({ ...base, cloudFraction: null }, 'snow'), false);
  assert.deepEqual(recommend(places, towns[0], 100, 'snow', []), []);
});

test('ranking compares scenes within fourteen days', () => {
  const recent: Measurement = { ...demoMeasurements[0], date: '2026-07-15' };
  const old: Measurement = { ...demoMeasurements[2], date: '2026-06-01' };
  assert.deepEqual(recommend([places[0], places[1]], towns[1], 100, 'green', [recent, old]).map((r) => r.place.id), ['cerchov']);
});

test('latest valid result wins per place', () => {
  const measurements: Measurement[] = [
    { ...demoMeasurements[0], value: .4, date: '2025-06-01' },
    { ...demoMeasurements[0], value: .5, date: '2026-06-01' },
  ];
  assert.equal(recommend([places[0]], towns[2], 100, 'green', measurements)[0].measurement.value, .5);
});
