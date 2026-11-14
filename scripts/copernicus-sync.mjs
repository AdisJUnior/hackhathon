import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { validate } from './import-measurements.mjs';

const root = resolve(import.meta.dirname, '..');
const localEnv = resolve(root, '.env.local');
function loadLocalEnv() {
  if (!existsSync(localEnv)) return;
  const config = parseEnv(readFileSync(localEnv, 'utf8'));
  for (const key of ['CDSE_CLIENT_ID', 'CDSE_CLIENT_SECRET']) {
    if (config[key]) process.env[key] = config[key];
  }
}
const COLLECTIONS = {
  green: 'sentinel-2-l2a',
  snow: 'byoc-2bb9974a-0eb8-484d-adf1-20cc307021b6',
};
const CATALOG_URL = 'https://sh.dataspace.copernicus.eu/catalog/v1/search';
const STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/statistics/v1';
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const MIN_VALID = .7;
const MAX_CLOUD = .3;
const DEFAULT_MAX_STATISTICS = 40;
const DEFAULT_MAX_TASKS = 60;

export function catalogWindows(now, mode, hasStoredMeasurement = false) {
  if (mode === 'snow') {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const firstWinterYear = month === 11 ? year : year - 1;
    const windows = [];
    for (let winterYear = firstWinterYear; winterYear >= firstWinterYear - (hasStoredMeasurement ? 0 : 1); winterYear--) {
      const start = new Date(Date.UTC(winterYear, 11, 1));
      const lastFebruaryDay = new Date(Date.UTC(winterYear + 1, 2, 0, 23, 59, 59));
      let to = new Date(Math.min(now.getTime(), lastFebruaryDay.getTime()));
      while (to > start) {
        const from = new Date(Math.max(start.getTime(), to.getTime() - 30 * 86400000));
        windows.push({ from: from.toISOString(), to: to.toISOString() });
        to = from;
      }
    }
    return windows;
  }
  const lookbackDays = !hasStoredMeasurement ? 180 : 30;
  const stepDays = 30;
  const windows = [];
  for (let daysBack = 0; daysBack < lookbackDays; daysBack += stepDays) {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - Math.min(daysBack + stepDays, lookbackDays));
    const to = new Date(now);
    to.setUTCDate(to.getUTCDate() - daysBack);
    windows.push({ from: from.toISOString(), to: to.toISOString() });
  }
  return windows;
}

export function circle([latitude, longitude], radiusMeters = 250, vertices = 64) {
  const earthRadius = 6371008.8;
  const latitudeRad = latitude * Math.PI / 180;
  const longitudeRad = longitude * Math.PI / 180;
  const angular = radiusMeters / earthRadius;
  const coordinates = [];
  for (let i = 0; i < vertices; i++) {
    const bearing = 2 * Math.PI * i / vertices;
    const lat = Math.asin(Math.sin(latitudeRad) * Math.cos(angular) + Math.cos(latitudeRad) * Math.sin(angular) * Math.cos(bearing));
    const lon = longitudeRad + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latitudeRad), Math.cos(angular) - Math.sin(latitudeRad) * Math.sin(lat));
    coordinates.push([lon * 180 / Math.PI, lat * 180 / Math.PI]);
  }
  coordinates.push(coordinates[0]);
  return { type: 'Polygon', coordinates: [coordinates] };
}

function bbox(geometry) {
  const xs = geometry.coordinates[0].map((point) => point[0]);
  const ys = geometry.coordinates[0].map((point) => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export const EVALSCRIPTS = {
  green: `//VERSION=3
function setup() { return { input: [{bands: ['B04','B08','SCL','dataMask']}], output: [
  {id:'metric',bands:1,sampleType:'FLOAT32'}, {id:'coverage',bands:1,sampleType:'FLOAT32'},
  {id:'cloud',bands:1,sampleType:'FLOAT32'}, {id:'dataMask',bands:['metric','coverage','cloud']}
]}; }
function evaluatePixel(s) {
  const cloud = [3,7,8,9,10].includes(s.SCL) ? 1 : 0;
  const valid = s.dataMask && ![0,1,3,7,8,9,10].includes(s.SCL) && s.B04+s.B08>0 ? 1 : 0;
  return {metric:[valid ? (s.B08-s.B04)/(s.B08+s.B04) : 0], coverage:[1], cloud:[cloud],
    dataMask:[valid,s.dataMask,s.dataMask]};
}`,
  snow: `//VERSION=3
function setup() { return { input: [{bands: ['FSCOG','FSCOG_QA','dataMask']}], output: [
  {id:'metric',bands:1,sampleType:'FLOAT32'}, {id:'coverage',bands:1,sampleType:'FLOAT32'},
  {id:'cloud',bands:1,sampleType:'FLOAT32'}, {id:'dataMask',bands:['metric','coverage','cloud']}
]}; }
function evaluatePixel(s) {
  const cloud = s.FSCOG===205 ? 1 : 0;
  const valid = s.dataMask && s.FSCOG>=0 && s.FSCOG<=100 && [0,1].includes(s.FSCOG_QA) ? 1 : 0;
  return {metric:[valid ? s.FSCOG : 0], coverage:[1], cloud:[cloud],
    dataMask:[valid,s.dataMask,s.dataMask]};
}`,
};

export function sceneObservedAt({ mode, date, sceneId, observedAt }) {
  if (typeof observedAt === 'string') {
    const parsed = new Date(observedAt);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) return parsed.toISOString();
  }
  if (mode !== 'green') return null;
  const stamp = /^S2[ABCD]_MSIL2A_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})_/.exec(sceneId);
  if (!stamp) return null;
  const parsed = new Date(`${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:${stamp[6]}Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? parsed.toISOString() : null;
}

export function measurementFromStats(response, { placeId, mode, date, sceneId, source, observedAt }) {
  const outputs = response?.data?.[0]?.outputs;
  const metric = outputs?.metric?.bands?.B0?.stats;
  const coverage = outputs?.coverage?.bands?.B0?.stats;
  const cloud = outputs?.cloud?.bands?.B0?.stats;
  const count = coverage ? coverage.sampleCount - coverage.noDataCount : NaN;
  const validCount = metric ? metric.sampleCount - metric.noDataCount : NaN;
  const validFraction = count > 0 ? validCount / count : NaN;
  const cloudFraction = cloud?.mean;
  const value = mode === 'green' ? metric?.percentiles?.['50.0'] : metric?.mean;
  if (!Number.isFinite(value) || !Number.isFinite(validFraction) || !Number.isFinite(cloudFraction) ||
      validFraction < MIN_VALID || validFraction > 1 || cloudFraction < 0 || cloudFraction > MAX_CLOUD ||
      validCount < 20) return null;
  const measurement = { placeId, mode, value, date, observedAt: sceneObservedAt({ mode, date, sceneId, observedAt }), validFraction, cloudFraction, source,
    sceneId, provenance: 'precomputed', product: mode === 'green' ? 'S2-L2A-NDVI' : 'CLMS-FSC-20M',
    statistic: mode === 'green' ? 'median' : 'mean', radiusMeters: 250 };
  validate(measurement, 0);
  return measurement;
}

function qualitySummary(response) {
  const outputs = response?.data?.[0]?.outputs;
  const metric = outputs?.metric?.bands?.B0?.stats;
  const coverage = outputs?.coverage?.bands?.B0?.stats;
  const valid = metric ? metric.sampleCount - metric.noDataCount : undefined;
  const total = coverage ? coverage.sampleCount - coverage.noDataCount : undefined;
  const cloud = outputs?.cloud?.bands?.B0?.stats?.mean;
  return `platné=${valid ?? '?'} / ${total ?? '?'}, oblačnost=${Number.isFinite(cloud) ? Math.round(cloud * 100) + '%' : '?'}`;
}

export function retryAfterMs(header, attempt) {
  const reported = header == null ? NaN : Number(header);
  return Number.isFinite(reported) && reported >= 0
    ? Math.max(1000, reported + 300)
    : Math.min(60000, 15000 * 2 ** attempt);
}

async function api(url, body, token) {
  const accept = url === CATALOG_URL ? 'application/geo+json' : 'application/json';
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: accept }, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    if (response.ok) return response.json();
    const retryAfter = response.headers.get('retry-after');
    if (response.status === 429 && attempt < 4) {
      const delay = retryAfterMs(retryAfter, attempt);
      if (delay <= 60000) {
        console.info(`Copernicus omezil rychlost dotazů; čekám ${Math.ceil(delay / 1000)} s a opakuji.`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
    const error = new Error(`${new URL(url).pathname}: HTTP ${response.status} ${String(await response.text()).slice(0, 400)}`);
    error.status = response.status;
    error.retryAfter = retryAfter;
    throw error;
  }
}

async function accessToken() {
  loadLocalEnv();
  const clientId = process.env.CDSE_CLIENT_ID;
  const clientSecret = process.env.CDSE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Chybí CDSE_CLIENT_ID / CDSE_CLIENT_SECRET; vytvořte OAuth klienta v Copernicus Data Space.');
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }), signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`OAuth: HTTP ${response.status}`);
  const body = await response.json();
  if (typeof body.access_token !== 'string') throw new Error('OAuth nevrátil access_token');
  return body.access_token;
}

export function statisticsRequest(mode, geometry, date) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    input: { bounds: { bbox: bbox(geometry), geometry, properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } },
      data: [{ type: COLLECTIONS[mode], dataFilter: { mosaickingOrder: 'mostRecent' } }] },
    aggregation: { timeRange: { from: `${date}T00:00:00Z`, to: next.toISOString().replace('.000Z', 'Z') },
      aggregationInterval: { of: 'P1D' }, evalscript: EVALSCRIPTS[mode], width: mode === 'green' ? 50 : 25, height: mode === 'green' ? 50 : 25 },
    ...(mode === 'green' ? { calculations: { metric: { statistics: { default: { percentiles: { k: [50] } } } } } } : {}),
  };
}

export function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000');
  db.exec(`CREATE TABLE IF NOT EXISTS measurements (
    place_id TEXT NOT NULL, mode TEXT NOT NULL, scene_id TEXT NOT NULL, date TEXT NOT NULL,
    value REAL NOT NULL, valid_fraction REAL NOT NULL, cloud_fraction REAL NOT NULL,
    source TEXT NOT NULL, product TEXT NOT NULL, statistic TEXT NOT NULL, radius_meters INTEGER NOT NULL,
    acquired_at TEXT NOT NULL, observed_at TEXT, PRIMARY KEY (place_id, mode, scene_id)
  )`);
  if (!db.prepare('PRAGMA table_info(measurements)').all().some((column) => column.name === 'observed_at'))
    db.exec('ALTER TABLE measurements ADD COLUMN observed_at TEXT');
  for (const row of db.prepare('SELECT place_id, mode, scene_id, date FROM measurements WHERE observed_at IS NULL').all()) {
    const observedAt = sceneObservedAt({ mode: row.mode, date: row.date, sceneId: row.scene_id });
    if (observedAt) db.prepare('UPDATE measurements SET observed_at=? WHERE place_id=? AND mode=? AND scene_id=?')
      .run(observedAt, row.place_id, row.mode, row.scene_id);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS scene_checks (
    place_id TEXT NOT NULL, mode TEXT NOT NULL, scene_id TEXT NOT NULL, checked_at TEXT NOT NULL,
    PRIMARY KEY (place_id, mode, scene_id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS sync_attempts (
    place_id TEXT NOT NULL, mode TEXT NOT NULL, attempted_at TEXT NOT NULL,
    PRIMARY KEY (place_id, mode)
  )`);
  return db;
}

export function loadSyncFeatures() {
  const originals = JSON.parse(readFileSync(resolve(root, 'src/places.json'), 'utf8')).features;
  const outdoorPriority = new Map(['Vodopád', 'Zahrada a park', 'Rozhledna', 'Skalní útvar', 'Jeskyně', 'Zřícenina', 'Hrad', 'Muzeum a galerie', 'Zámek', 'Klášter']
    .map((category, index) => [category, index]));
  const additions = ['regional-places.json', 'places-extra.json'].flatMap((file) =>
    JSON.parse(readFileSync(resolve(root, 'src', file), 'utf8')).map((place) => ({
      id: place.id, geometry: { type: 'Point', coordinates: [place.coordinates[1], place.coordinates[0]] },
      properties: { category: place.category },
    }))).sort((a, b) => (outdoorPriority.get(a.properties.category) ?? 10) - (outdoorPriority.get(b.properties.category) ?? 10));
  const features = [...originals, ...additions];
  if (new Set(features.map(({ id }) => id)).size !== features.length ||
      features.some((feature) => feature.geometry?.type !== 'Point' ||
        feature.geometry.coordinates.length !== 2 || feature.geometry.coordinates.some((n) => !Number.isFinite(n))))
    throw new Error('Katalog míst obsahuje neplatný nebo duplicitní bod.');
  return features;
}

export function syncQueue(db, features, modes) {
  const lastAttempts = new Map(db.prepare('SELECT place_id, mode, attempted_at FROM sync_attempts').all()
    .map((row) => [`${row.place_id}\u0000${row.mode}`, row.attempted_at]));
  const tasks = features.flatMap((feature) => modes.map((mode) => ({ feature, mode })));
  return tasks.sort((a, b) => {
    const left = lastAttempts.get(`${a.feature.id}\u0000${a.mode}`) ?? '';
    const right = lastAttempts.get(`${b.feature.id}\u0000${b.mode}`) ?? '';
    return left.localeCompare(right);
  });
}

export function markAttempted(db, placeId, mode, when = new Date()) {
  db.prepare('INSERT INTO sync_attempts VALUES (?,?,?) ON CONFLICT(place_id,mode) DO UPDATE SET attempted_at=excluded.attempted_at')
    .run(placeId, mode, when.toISOString());
}

export function markChecked(db, placeId, mode, sceneId) {
  db.prepare('INSERT OR IGNORE INTO scene_checks VALUES (?,?,?,?)').run(placeId, mode, sceneId, new Date().toISOString());
}

export function saveMeasurement(db, m) {
  validate(m, 0);
  db.prepare(`INSERT OR IGNORE INTO measurements
    (place_id, mode, scene_id, date, value, valid_fraction, cloud_fraction, source, product, statistic, radius_meters, acquired_at, observed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    m.placeId, m.mode, m.sceneId, m.date, m.value, m.validFraction, m.cloudFraction,
    m.source, m.product, m.statistic, m.radiusMeters, new Date().toISOString(), m.observedAt ?? sceneObservedAt(m));
}

export function importExisting(db, measurements) {
  for (const measurement of measurements) {
    if (measurement.provenance === 'precomputed') saveMeasurement(db, measurement);
  }
}

export function exportLatest(db, destination) {
  const rows = db.prepare(`SELECT place_id AS placeId, mode, value, date, valid_fraction AS validFraction,
    observed_at AS observedAt, cloud_fraction AS cloudFraction, source, scene_id AS sceneId, product, statistic,
    radius_meters AS radiusMeters FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY place_id, mode ORDER BY date DESC, acquired_at DESC) AS rn FROM measurements
      WHERE mode != 'snow' OR strftime('%m', date) IN ('12', '01', '02')
    ) WHERE rn = 1 ORDER BY placeId, mode`).all();
  const data = rows.map((row) => ({ ...row, provenance: 'precomputed' }));
  data.forEach(validate);
  const temporary = `${destination}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  renameSync(temporary, destination);
  return data;
}

export async function sync({ now = new Date(), log = console, modes = ['green', 'snow'],
  maxTasks = DEFAULT_MAX_TASKS, maxStatistics = DEFAULT_MAX_STATISTICS, maxScenesPerPlaceMode = 2,
  placeIds = null } = {}) {
  if (!Number.isSafeInteger(maxTasks) || maxTasks < 1 || maxTasks > 600 ||
      !Number.isSafeInteger(maxStatistics) || maxStatistics < 1 || maxStatistics > 120 ||
      !Number.isSafeInteger(maxScenesPerPlaceMode) || maxScenesPerPlaceMode < 1 || maxScenesPerPlaceMode > 5)
    throw new Error('Neplatný limit synchronizační dávky.');
  const token = await accessToken();
  const allFeatures = loadSyncFeatures();
  const features = placeIds ? allFeatures.filter((feature) => placeIds.includes(feature.id)) : allFeatures;
  if (!features.length || placeIds?.some((id) => !features.some((feature) => feature.id === id)))
    throw new Error('Zadané místo nebylo nalezeno v pevném katalogu.');
  const databasePath = resolve(root, 'data/measurements.sqlite');
  mkdirSync(resolve(root, 'data'), { recursive: true });
  const db = openDatabase(databasePath);
  let added = 0;
  let errors = 0;
  let requests = 0;
  let attempted = 0;
  let rateLimited = false;
  try {
    importExisting(db, JSON.parse(readFileSync(resolve(root, 'src/measurements.json'), 'utf8')));
    outer: for (const { feature, mode } of syncQueue(db, features, modes)) {
        if (attempted >= maxTasks) break;
        const geometry = circle([feature.geometry.coordinates[1], feature.geometry.coordinates[0]]);
        try {
          const hasStoredMeasurement = Boolean(db.prepare("SELECT 1 FROM measurements WHERE place_id=? AND mode=? AND (mode != 'snow' OR strftime('%m', date) IN ('12', '01', '02')) LIMIT 1").get(feature.id, mode));
          let finished = false;
          let placeRequests = 0;
          for (const window of catalogWindows(now, mode, hasStoredMeasurement)) {
            const catalog = await api(CATALOG_URL, { collections: [COLLECTIONS[mode]], bbox: bbox(geometry),
              datetime: `${window.from}/${window.to}`, limit: 100 }, token);
            if (catalog.context?.next !== undefined || catalog.context?.returned === 100) throw new Error('Katalog vrátil plnou stránku; rozšiřte stránkování před zpracováním, aby novější snímek nezůstal vynechán.');
            const byDate = new Map();
            for (const item of catalog.features ?? []) {
              const date = item.properties?.datetime?.slice(0, 10);
              if (date) byDate.set(date, [...(byDate.get(date) ?? []), item]);
            }
            const cloudRank = (items) => {
              const rawCloud = items[0]?.properties?.['eo:cloud_cover'];
              const cloud = rawCloud == null ? NaN : Number(rawCloud);
              return Number.isFinite(cloud) ? cloud <= 30 ? 0 : 2 : 1;
            };
            for (const [date, items] of [...byDate].sort(([a, ai], [b, bi]) => cloudRank(ai) - cloudRank(bi) || b.localeCompare(a))) {
              // A single catalog item prevents attributing a daily mosaic to an arbitrary scene.
              if (items.length !== 1) continue;
              const item = items[0];
              const exists = db.prepare('SELECT 1 FROM measurements WHERE place_id=? AND mode=? AND scene_id=?').get(feature.id, mode, item.id);
              if (exists) { finished = true; break; }
              const checked = db.prepare('SELECT 1 FROM scene_checks WHERE place_id=? AND mode=? AND scene_id=?').get(feature.id, mode, item.id);
              if (checked) continue;
              if (requests >= maxStatistics) { log.info('Dosažen limit dotazů pro tento běh; další scény počkají na další spuštění.'); break outer; }
              requests++;
              placeRequests++;
              const stats = await api(STATISTICS_URL, statisticsRequest(mode, geometry, date), token);
              const source = item.links?.find((link) => link.rel === 'self' && link.href?.startsWith('https://'))?.href ??
                `https://sh.dataspace.copernicus.eu/catalog/v1/collections/${COLLECTIONS[mode]}/items/${encodeURIComponent(item.id)}`;
              const measurement = measurementFromStats(stats, { placeId: feature.id, mode, date, sceneId: item.id, source, observedAt: item.properties?.datetime });
              if (!measurement) {
                markChecked(db, feature.id, mode, item.id);
                log.info(`${feature.id}/${mode}/${date}: vyřazeno (${qualitySummary(stats)})`);
              } else {
                saveMeasurement(db, measurement);
                added++;
                log.info(`${feature.id}/${mode}/${date}: přijato ${measurement.value.toFixed(3)}`);
                finished = true;
              }
              if (finished || placeRequests >= maxScenesPerPlaceMode) break;
            }
            if (finished || placeRequests >= maxScenesPerPlaceMode) break;
          }
        } catch (error) {
          errors++;
          log.error(`${feature.id}/${mode}: ${error.message}`);
          if (error.status === 429) { rateLimited = true; break outer; }
        }
        markAttempted(db, feature.id, mode, now);
        attempted++;
    }
    const current = exportLatest(db, resolve(root, 'src/measurements.json'));
    log.info(`Dokončeno: ${attempted} míst/režimů z ${features.length * modes.length}, ${requests} statistických dotazů, ${added} nových měření, ${current.length} posledních výsledků v exportu.`);
    if (rateLimited) throw new Error('Copernicus omezil počet požadavků (HTTP 429); další běh zkuste později.');
    if (attempted > 0 && errors === attempted) throw new Error('Všechny dotazy na Copernicus selhaly; data nebyla obnovena.');
    return { added, current: current.length };
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const asOf = args.indexOf('--as-of');
  const placesArg = args.find((arg) => arg.startsWith('--places='));
  const scenesArg = args.find((arg) => arg.startsWith('--scenes='));
  const placeIds = placesArg ? placesArg.slice('--places='.length).split(',').filter(Boolean) : null;
  const maxScenes = scenesArg ? Number(scenesArg.slice('--scenes='.length)) : args.includes('--backfill') ? 3 : 2;
  const now = asOf >= 0 ? new Date(`${args[asOf + 1]}T23:59:59Z`) : new Date();
  if (Number.isNaN(now.getTime())) {
    console.error('Neplatné datum za --as-of; použijte YYYY-MM-DD.');
    process.exitCode = 1;
  } else {
    sync({ now, modes: args.includes('--snow-only') ? ['snow'] : args.includes('--green-only') ? ['green'] : ['green', 'snow'],
      maxTasks: args.includes('--backfill') ? 120 : DEFAULT_MAX_TASKS,
      maxStatistics: args.includes('--backfill') ? 80 : DEFAULT_MAX_STATISTICS,
      maxScenesPerPlaceMode: maxScenes, placeIds })
      .catch((error) => { console.error(error.message); process.exitCode = 1; });
  }
}
