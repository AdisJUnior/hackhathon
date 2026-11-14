import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlNumber = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Non-finite satellite value');
  return String(value);
};

const catalog = [
  ...JSON.parse(read('src/places.json')).features.map((feature) => feature.id),
  ...JSON.parse(read('src/regional-places.json')).map((place) => place.id),
  ...JSON.parse(read('src/places-extra.json')).map((place) => place.id),
];
const placeIds = new Set(catalog);
if (catalog.length !== 300 || placeIds.size !== 300) throw new Error('Destination catalog must contain 300 unique IDs');

const destinationsSql = read('db/001_frozen_destinations.sql')
  .replace(/^BEGIN;\s*/mu, '')
  .replace(/\s*COMMIT;\s*$/u, '');
if (destinationsSql.includes('BEGIN;') || destinationsSql.includes('COMMIT;')) {
  throw new Error('Unexpected transaction statement in destination migration');
}

const db = new DatabaseSync(resolve(root, 'data/measurements.sqlite'), { readOnly: true });
const measurements = db.prepare('SELECT * FROM measurements ORDER BY place_id, mode, scene_id').all();
const allChecks = db.prepare('SELECT * FROM scene_checks ORDER BY place_id, mode, scene_id').all();
const allAttempts = db.prepare('SELECT * FROM sync_attempts ORDER BY place_id, mode').all();
db.close();
const checks = allChecks.filter((row) => placeIds.has(row.place_id));
const attempts = allAttempts.filter((row) => placeIds.has(row.place_id));
const excluded = allChecks.length - checks.length + allAttempts.length - attempts.length;
if (excluded) console.warn(`Skipped ${excluded} checks/attempts for destinations removed from the fixed catalog.`);

for (const row of [...measurements, ...checks, ...attempts]) {
  if (!placeIds.has(row.place_id) || !['green', 'snow'].includes(row.mode)) {
    throw new Error(`Invalid satellite history reference: ${row.place_id} / ${row.mode}`);
  }
}
for (const row of measurements) {
  if (!Number.isFinite(row.value) || row.valid_fraction < .7 || row.valid_fraction > 1 ||
      row.cloud_fraction < 0 || row.cloud_fraction > .3 || row.radius_meters !== 250 ||
      !row.source.startsWith('https://') ||
      !(row.mode === 'green' && row.product === 'S2-L2A-NDVI' && row.statistic === 'median' && row.value >= -1 && row.value <= 1 ||
        row.mode === 'snow' && row.product === 'CLMS-FSC-20M' && row.statistic === 'mean' && row.value >= 0 && row.value <= 100)) {
    throw new Error(`Invalid accepted measurement: ${row.place_id} / ${row.scene_id}`);
  }
}

const insertRows = (table, columns, rows, render) => rows.length ?
  `INSERT INTO public.${table} (${columns.join(', ')}) VALUES\n  ${rows.map(render).join(',\n  ')};\n` : '';

const measurementSql = insertRows('satellite_measurements',
  ['place_id', 'mode', 'scene_id', 'scene_date', 'value', 'valid_fraction', 'cloud_fraction', 'source_url', 'product', 'statistic', 'radius_meters', 'acquired_at'],
  measurements,
  (row) => `(${[row.place_id, row.mode, row.scene_id, row.date].map(sqlString).join(', ')}, ${[row.value, row.valid_fraction, row.cloud_fraction].map(sqlNumber).join(', ')}, ${[row.source, row.product, row.statistic].map(sqlString).join(', ')}, ${sqlNumber(row.radius_meters)}, ${sqlString(row.acquired_at)})`);
const checksSql = insertRows('satellite_scene_checks', ['place_id', 'mode', 'scene_id', 'checked_at'], checks,
  (row) => `(${[row.place_id, row.mode, row.scene_id, row.checked_at].map(sqlString).join(', ')})`);
const attemptsSql = insertRows('satellite_sync_attempts', ['place_id', 'mode', 'attempted_at'], attempts,
  (row) => `(${[row.place_id, row.mode, row.attempted_at].map(sqlString).join(', ')})`);
const timestampMigration = read('db/003_measurement_timestamps.sql')
  .replace(/^BEGIN;\s*/mu, '')
  .replace(/\s*COMMIT;[\s\S]*$/mu, '');
const observedAtSql = measurements.filter((row) => row.observed_at).map((row) =>
  `UPDATE public.satellite_measurements SET observed_at = ${sqlString(row.observed_at)} WHERE place_id = ${sqlString(row.place_id)} AND mode = ${sqlString(row.mode)} AND scene_id = ${sqlString(row.scene_id)};`).join('\n');

const sql = `-- Jednorázové založení nové prázdné databáze/větve Neon pro Kam ven?.
-- Vygenerováno z migrací db/001 až 004
-- a místní databáze data/measurements.sqlite. Neobsahuje přístupové údaje.
-- Počty při vytvoření: 300 destinací, ${measurements.length} přijatých měření,
-- ${checks.length} prověřených scén, ${attempts.length} pokusů synchronizace.
-- Nespouštějte podruhé ani na větvi s existujícím katalogem destinací.
BEGIN;
${destinationsSql}

${read('db/002_satellite_measurements.sql').trim()}

${measurementSql}${checksSql}${attemptsSql}
${timestampMigration}
${observedAtSql}
${read('db/004_winter_snow_season.sql').trim()}
DO $$ BEGIN
  IF (SELECT count(*) FROM public.destinations) <> 300 OR
     (SELECT count(*) FROM public.satellite_measurements) <> ${measurements.length} OR
     (SELECT count(*) FROM public.satellite_scene_checks) <> ${checks.length} OR
     (SELECT count(*) FROM public.satellite_sync_attempts) <> ${attempts.length} THEN
    RAISE EXCEPTION 'Neon bootstrap row counts do not match the local snapshot';
  END IF;
END $$;
COMMIT;

SELECT (SELECT count(*) FROM public.destinations) AS destinations,
       (SELECT count(*) FROM public.satellite_measurements) AS measurements,
       (SELECT count(*) FROM public.satellite_scene_checks) AS scene_checks,
       (SELECT count(*) FROM public.satellite_sync_attempts) AS sync_attempts;
`;

const output = resolve(root, 'db/neon-bootstrap.sql');
writeFileSync(output, sql, 'utf8');
console.log(`Created ${output}: 300 destinations, ${measurements.length} measurements, ${checks.length} scene checks, ${attempts.length} sync attempts.`);
