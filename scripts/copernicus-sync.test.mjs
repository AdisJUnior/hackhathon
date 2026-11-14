import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { catalogWindows, circle, exportLatest, importExisting, loadSyncFeatures, markAttempted, markChecked, measurementFromStats, openDatabase, retryAfterMs, saveMeasurement, sceneObservedAt, statisticsRequest, syncQueue } from './copernicus-sync.mjs';

const meta = { placeId: 'cerchov', mode: 'green', date: '2026-08-30', sceneId: 'REAL_SCENE_ID', source: 'https://example.org/item' };
function response({ median = .62, mean = 42, count = 100, valid = 80, cloud = .1 } = {}) {
  return { data: [{ outputs: {
    metric: { bands: { B0: { stats: { sampleCount: count, noDataCount: count - valid, mean, percentiles: { '50.0': median } } } } },
    coverage: { bands: { B0: { stats: { sampleCount: count, noDataCount: 0 } } } },
    cloud: { bands: { B0: { stats: { mean: cloud } } } },
  } }] };
}

test('250m polygon is closed and centered on the place', () => {
  const polygon = circle([49.3833361, 12.7837268]);
  assert.equal(polygon.coordinates[0].length, 65);
  assert.deepEqual(polygon.coordinates[0][0], polygon.coordinates[0].at(-1));
  assert.ok(polygon.coordinates[0].every(([lon, lat]) => lat > 49.38 && lat < 49.39 && lon > 12.77 && lon < 12.80));
  assert.equal(statisticsRequest('green', polygon, '2026-11-05').aggregation.width, 50);
  assert.equal(statisticsRequest('snow', polygon, '2026-11-05').aggregation.height, 25);
});

test('snow without a stored result searches the previous winter', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  const historical = catalogWindows(now, 'snow');
  assert.ok(historical.length > 1);
  assert.ok(historical.some(({ from, to }) => from <= '2026-02-15' && to >= '2026-02-15'));
  assert.ok(historical.every(({ from, to }) => /-(12|01|02)-/.test(from.slice(0, 10)) && /-(12|01|02)-/.test(to.slice(0, 10))));
  assert.ok(catalogWindows(now, 'snow', true).length < historical.length);
  const currentWinter = catalogWindows(new Date('2027-01-15T12:00:00Z'), 'snow', true);
  assert.ok(currentWinter.every(({ from, to }) => from >= '2026-12-01' && to <= '2027-01-15T12:00:00Z'));
  assert.equal(catalogWindows(now, 'green').length, 6);
  assert.equal(catalogWindows(now, 'green', true).length, 1);
  assert.ok(catalogWindows(now, 'green').some(({ from, to }) => from <= '2026-09-15' && to >= '2026-09-15'));
});

test('snow export excludes non-winter measurements without deleting history', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kam-ven-winter-'));
  try {
    const db = openDatabase(join(dir, 'measurements.sqlite'));
    const winter = measurementFromStats(response({ mean: 45 }), { ...meta, mode: 'snow', date: '2026-02-15', sceneId: 'WINTER' });
    const autumn = measurementFromStats(response({ mean: 0 }), { ...meta, mode: 'snow', date: '2026-10-29', sceneId: 'AUTUMN' });
    saveMeasurement(db, winter);
    saveMeasurement(db, autumn);
    const latest = exportLatest(db, join(dir, 'current.json'));
    assert.equal(latest.length, 1);
    assert.equal(latest[0].sceneId, 'WINTER');
    assert.equal(db.prepare('SELECT count(*) AS n FROM measurements').get().n, 2);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('all regional places enter a rotating sync queue', () => {
  const features = loadSyncFeatures();
  assert.equal(features.length, 300);
  const dir = mkdtempSync(join(tmpdir(), 'kam-ven-queue-'));
  try {
    const db = openDatabase(join(dir, 'measurements.sqlite'));
    const first = syncQueue(db, features, ['green', 'snow']);
    assert.equal(first.length, features.length * 2);
    markAttempted(db, first[0].feature.id, first[0].mode, new Date('2026-11-13'));
    const next = syncQueue(db, features, ['green', 'snow']);
    assert.deepEqual(next.at(-1), first[0]);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('cloud gate rejects poor scenes and keeps true zero snow', () => {
  assert.equal(measurementFromStats(response({ cloud: .31 }), meta), null);
  assert.equal(measurementFromStats(response({ valid: 69 }), meta), null);
  assert.equal(measurementFromStats(response({ valid: 19, count: 20 }), meta), null);
  assert.equal(measurementFromStats(response(), meta)?.value, .62);
  assert.equal(measurementFromStats(response(), meta)?.validFraction, .8);
  assert.equal(measurementFromStats(response({ mean: 0 }), { ...meta, mode: 'snow' })?.value, 0);
});

test('capture time comes from catalog metadata or a matching Sentinel-2 product name', () => {
  const sceneId = 'S2A_MSIL2A_20261105T101121_N0513_R022_T33UUQ_20261105T164000';
  assert.equal(sceneObservedAt({ mode: 'green', date: '2026-11-05', sceneId }), '2026-11-05T10:11:21.000Z');
  assert.equal(sceneObservedAt({ mode: 'green', date: '2026-11-06', sceneId }), null);
  assert.equal(sceneObservedAt({ mode: 'snow', date: '2026-11-05', sceneId: 'UNKNOWN' }), null);
  assert.equal(sceneObservedAt({ mode: 'snow', date: '2026-11-05', sceneId: 'UNKNOWN', observedAt: '2026-11-05T10:12:00Z' }), '2026-11-05T10:12:00.000Z');
});

test('Copernicus rate-limit header is milliseconds and fallback backs off', () => {
  assert.equal(retryAfterMs('3398', 0), 3698);
  assert.equal(retryAfterMs(null, 0), 15000);
  assert.equal(retryAfterMs(null, 2), 60000);
});

test('SQLite keeps latest accepted reading when next scene is cloudy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kam-ven-sync-'));
  try {
    const db = openDatabase(join(dir, 'measurements.sqlite'));
    const first = measurementFromStats(response(), meta);
    importExisting(db, [first]);
    const cloudy = measurementFromStats(response({ cloud: .5 }), { ...meta, date: '2026-09-01', sceneId: 'CLOUDY' });
    assert.equal(cloudy, null);
    markChecked(db, meta.placeId, meta.mode, 'CLOUDY');
    assert.equal(db.prepare('SELECT count(*) AS n FROM scene_checks').get().n, 1);
    let latest = exportLatest(db, join(dir, 'current.json'));
    assert.equal(latest.length, 1);
    assert.equal(latest[0].sceneId, 'REAL_SCENE_ID');
    saveMeasurement(db, measurementFromStats(response({ median: .7 }), { ...meta, date: '2026-09-02', sceneId: 'CLEAR' }));
    latest = exportLatest(db, join(dir, 'current.json'));
    assert.equal(latest[0].sceneId, 'CLEAR');
    assert.equal(latest[0].value, .7);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
