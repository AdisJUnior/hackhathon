import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSyncFeatures } from './copernicus-sync.mjs';
import { validate } from './import-measurements.mjs';

const root = resolve(import.meta.dirname, '..');
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const number = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Neplatná číselná hodnota v historii měření.');
  return String(value);
};
const optional = (value) => value == null ? 'NULL' : quote(value);
const insert = (table, columns, rows, render, conflict) => rows.length
  ? `INSERT INTO public.${table} (${columns.join(', ')}) VALUES\n  ${rows.map(render).join(',\n  ')}\n${conflict};\n`
  : '';

export function neonSyncSql({ measurements, checks, attempts, placeIds }) {
  const accepted = measurements.filter((row) => placeIds.has(row.place_id));
  const checked = checks.filter((row) => placeIds.has(row.place_id));
  const attempted = attempts.filter((row) => placeIds.has(row.place_id));
  if (accepted.length !== measurements.length) throw new Error('Měření odkazuje na místo mimo pevný katalog.');
  for (const row of accepted) validate({
    placeId: row.place_id, mode: row.mode, value: row.value, date: row.date,
    observedAt: row.observed_at, validFraction: row.valid_fraction, cloudFraction: row.cloud_fraction,
    source: row.source, provenance: 'precomputed', sceneId: row.scene_id,
    product: row.product, statistic: row.statistic, radiusMeters: row.radius_meters,
  }, 0);
  const measurementRows = insert('satellite_measurements',
    ['place_id', 'mode', 'scene_id', 'scene_date', 'value', 'valid_fraction', 'cloud_fraction',
      'source_url', 'product', 'statistic', 'radius_meters', 'acquired_at', 'observed_at'], accepted,
    (row) => `(${[row.place_id, row.mode, row.scene_id, row.date].map(quote).join(', ')}, ${[row.value, row.valid_fraction, row.cloud_fraction].map(number).join(', ')}, ${[row.source, row.product, row.statistic].map(quote).join(', ')}, ${number(row.radius_meters)}, ${quote(row.acquired_at)}, ${optional(row.observed_at)})`,
    'ON CONFLICT (place_id, mode, scene_id) DO UPDATE SET observed_at = COALESCE(public.satellite_measurements.observed_at, EXCLUDED.observed_at)');
  const checkRows = insert('satellite_scene_checks', ['place_id', 'mode', 'scene_id', 'checked_at'], checked,
    (row) => `(${[row.place_id, row.mode, row.scene_id, row.checked_at].map(quote).join(', ')})`,
    'ON CONFLICT (place_id, mode, scene_id) DO NOTHING');
  const attemptRows = insert('satellite_sync_attempts', ['place_id', 'mode', 'attempted_at'], attempted,
    (row) => `(${[row.place_id, row.mode, row.attempted_at].map(quote).join(', ')})`,
    'ON CONFLICT (place_id, mode) DO UPDATE SET attempted_at = GREATEST(public.satellite_sync_attempts.attempted_at, EXCLUDED.attempted_at)');
  return `-- Průběžný idempotentní přenos ověřené místní historie do Neonu.\n-- Bez přihlašovacích údajů. Vyžaduje migrace 001–003.\nBEGIN;\n${measurementRows}${checkRows}${attemptRows}COMMIT;\nSELECT (SELECT count(*) FROM public.destinations) AS places, (SELECT count(*) FROM public.satellite_measurements) AS measurements, (SELECT count(*) FROM public.satellite_scene_checks) AS checked_scenes, (SELECT count(*) FROM public.satellite_sync_attempts) AS attempted_pairs;\n`;
}

export function exportNeonSync(destination = resolve(root, 'data/neon-sync.sql')) {
  const db = new DatabaseSync(resolve(root, 'data/measurements.sqlite'), { readOnly: true });
  try {
    const placeIds = new Set(loadSyncFeatures().map(({ id }) => id));
    if (placeIds.size !== 300) throw new Error('Pevný katalog nemá 300 míst.');
    const sql = neonSyncSql({
      measurements: db.prepare('SELECT * FROM measurements ORDER BY place_id, mode, scene_id').all(),
      checks: db.prepare('SELECT * FROM scene_checks ORDER BY place_id, mode, scene_id').all(),
      attempts: db.prepare('SELECT * FROM sync_attempts ORDER BY place_id, mode').all(),
      placeIds,
    });
    writeFileSync(destination, sql, 'utf8');
    return destination;
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(`Připraven přenos: ${exportNeonSync()}`);
