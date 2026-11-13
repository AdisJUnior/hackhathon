import assert from 'node:assert/strict';
import test from 'node:test';
import { places, towns, type Measurement } from './data.ts';
import { distanceKm, explore, recommend, validMeasurement } from './recommend.ts';

// Synthetic fixtures live only in tests; production never imports them.
const testMeasurements: Measurement[] = [
  ...[['cerchov', .79, 28], ['cerne-jezero', .68, 46], ['prasily', .83, 58], ['pancir', .72, 52], ['radyne', .64, 12]].flatMap(([placeId, green, snow]) => [
    { placeId: String(placeId), mode: 'green' as const, value: Number(green), date: '2026-07-15', validFraction: .95, cloudFraction: .03, source: 'https://example.org/scene', provenance: 'precomputed' as const, sceneId: 'TEST_SCENE', product: 'S2-L2A-NDVI' as const, statistic: 'median' as const, radiusMeters: 250 as const },
    { placeId: String(placeId), mode: 'snow' as const, value: Number(snow), date: '2026-02-15', validFraction: .91, cloudFraction: .06, source: 'https://example.org/scene', provenance: 'precomputed' as const, sceneId: 'TEST_SCENE', product: 'CLMS-FSC-20M' as const, statistic: 'mean' as const, radiusMeters: 250 as const },
  ]),
];

test('distance uses real coordinates and respects range', () => {
  assert.equal(distanceKm(towns[0].coordinates, towns[0].coordinates), 0);
  assert.ok(distanceKm(towns[0].coordinates, places[4].coordinates) < 10);
  assert.deepEqual(recommend(places, towns[0], 5, 'green', testMeasurements), []);
});

test('green and snow rank by their own metric', () => {
  const green = recommend(places, towns[1], 100, 'green', testMeasurements);
  const snow = recommend(places, towns[1], 100, 'snow', testMeasurements);
  assert.equal(green.length, 5);
  assert.equal(snow.length, 5);
  assert.equal(green[0].place.id, 'prasily');
  assert.equal(snow[0].place.id, 'prasily');
  assert.ok(green.every((row, i) => i === 0 || green[i - 1].measurement.value >= row.measurement.value));
  const changedSnow = testMeasurements.map((m) => m.mode === 'snow' && m.placeId === 'cerchov' ? { ...m, value: 99 } : m);
  assert.equal(recommend(places, towns[1], 100, 'snow', changedSnow)[0].place.id, 'cerchov');
  assert.equal(recommend(places, towns[1], 100, 'green', changedSnow)[0].place.id, 'prasily');
});

test('zero snow is valid; missing and low quality readings are excluded', () => {
  const base = testMeasurements.find((m) => m.mode === 'snow')!;
  assert.equal(validMeasurement({ ...base, value: 0 }, 'snow'), true);
  assert.equal(validMeasurement({ ...base, value: NaN }, 'snow'), false);
  assert.equal(validMeasurement({ ...base, validFraction: .69 }, 'snow'), false);
  assert.equal(validMeasurement({ ...base, cloudFraction: .31 }, 'snow'), false);
  assert.equal(validMeasurement({ ...base, cloudFraction: null }, 'snow'), false);
  assert.equal(validMeasurement({ ...base, provenance: 'demo' } as Measurement, 'snow'), false);
  assert.deepEqual(recommend(places, towns[0], 100, 'snow', []), []);
});

test('ranking compares scenes within fourteen days', () => {
  const recent: Measurement = { ...testMeasurements[0], date: '2026-07-15' };
  const old: Measurement = { ...testMeasurements[2], date: '2026-06-01' };
  assert.deepEqual(recommend([places[0], places[1]], towns[1], 100, 'green', [recent, old]).map((r) => r.place.id), ['cerchov']);
  const shown = explore([places[0], places[1]], towns[1], 100, 'green', [recent, old]).visible;
  assert.equal(shown.find((item) => item.place.id === 'cerne-jezero')?.measurement?.date, '2026-06-01');
  assert.equal(shown.find((item) => item.place.id === 'cerne-jezero')?.measured, false);
});

test('latest valid result wins per place', () => {
  const measurements: Measurement[] = [
    { ...testMeasurements[0], value: .4, date: '2025-06-01' },
    { ...testMeasurements[0], value: .5, date: '2026-06-01' },
  ];
  assert.equal(recommend([places[0]], towns[2], 100, 'green', measurements)[0].measurement.value, .5);
});

test('shows seven places at 100 km but ranks only the one with valid satellite data', () => {
  const actual = testMeasurements.filter((m) => m.placeId === 'prasily' && m.mode === 'green');
  const { ranked, visible } = explore(places, towns[0], 100, 'green', actual);
  assert.equal(ranked.length, 1);
  assert.equal(visible.length, 7);
  assert.equal(visible[0].place.id, 'prasily');
  assert.equal(visible[0].rank, 1);
  assert.equal(visible.filter((item) => item.measured).length, 1);
  assert.ok(visible.slice(1).every((item) => item.measurement === null && item.rank === null));
  assert.equal(new Set(visible.map((item) => item.place.id)).size, 7);
});

test('every departure town offers exactly five destinations within 5 km', () => {
  for (const town of towns) {
    const { visible, outside } = explore(places, town, 5, 'green', []);
    assert.equal(visible.length, 5, town.name);
    assert.ok(visible.every((item) => item.distance <= 5), town.name);
    assert.equal(outside.length, 3, town.name);
    assert.ok(outside.every((item) => item.distance > 5), town.name);
  }
});
