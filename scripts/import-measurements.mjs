import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const geojson = JSON.parse(readFileSync(resolve(root, 'src/places.json'), 'utf8'));
const regional = JSON.parse(readFileSync(resolve(root, 'src/regional-places.json'), 'utf8'));
const extra = JSON.parse(readFileSync(resolve(root, 'src/places-extra.json'), 'utf8'));
const placeIds = new Set([...geojson.features.map((feature) => feature.id), ...regional.map((place) => place.id), ...extra.map((place) => place.id)]);
const required = ['placeId', 'mode', 'value', 'date', 'validFraction', 'cloudFraction', 'source', 'provenance', 'sceneId', 'product', 'statistic', 'radiusMeters'];

export function validate(item, index) {
  const fail = (message) => { throw new Error(`Záznam ${index}: ${message}`); };
  if (!item || typeof item !== 'object' || required.some((key) => !(key in item))) fail('chybí požadovaná pole');
  if (!placeIds.has(item.placeId) || !['green', 'snow'].includes(item.mode)) fail('neznámé místo nebo režim');
  if (item.provenance !== 'precomputed') fail('import přijímá jen předpočítaná měření');
  if (item.product !== (item.mode === 'green' ? 'S2-L2A-NDVI' : 'CLMS-FSC-20M')) fail('nesprávný produkt pro režim');
  if (item.statistic !== (item.mode === 'green' ? 'median' : 'mean')) fail('nesprávná statistika pro režim');
  if (item.radiusMeters !== 250) fail('vyhodnocovací poloměr musí být 250 m');
  if (typeof item.value !== 'number' || !Number.isFinite(item.value)) fail('neplatná hodnota');
  if (item.value < (item.mode === 'green' ? -1 : 0) || item.value > (item.mode === 'green' ? 1 : 100)) fail('hodnota mimo rozsah');
  if (typeof item.validFraction !== 'number' || !Number.isFinite(item.validFraction) || item.validFraction < .7 || item.validFraction > 1) fail('nedostatečná platná plocha');
  if (typeof item.cloudFraction !== 'number' || !Number.isFinite(item.cloudFraction) || item.cloudFraction < 0 || item.cloudFraction > .3) fail('neplatná nebo vysoká oblačnost');
  const parsedDate = typeof item.date === 'string' ? new Date(`${item.date}T00:00:00.000Z`) : new Date(NaN);
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== item.date) fail('neplatné datum');
  if (typeof item.sceneId !== 'string' || !item.sceneId.trim()) fail('chybí identifikátor scény');
  if (typeof item.source !== 'string' || !/^https:\/\//.test(item.source)) fail('source musí být HTTPS URL produktu');
}

export function saveMeasurements(data) {
  if (!Array.isArray(data)) throw new Error('Vstup musí být pole záznamů');
  data.forEach(validate);
  const output = resolve(root, 'src/measurements.json');
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Importováno ${data.length} měření do ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const input = process.argv.slice(2).find((arg) => arg !== '--');
  if (!input) throw new Error('Použití: pnpm import:measurements -- cesta/k/vysledkum.json');
  saveMeasurements(JSON.parse(readFileSync(resolve(input), 'utf8')));
}
