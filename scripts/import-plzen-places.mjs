import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const boundary = JSON.parse(readFileSync(resolve(root, 'src/plzen-boundary.json'), 'utf8'));
const source = JSON.parse(readFileSync(resolve(root, 'data/wikidata-tourism.geojson'), 'utf8'));
const originals = JSON.parse(readFileSync(resolve(root, 'src/places.json'), 'utf8')).features;
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function inRegion(point) {
  return inRing(point, boundary.geometry.coordinates[0]) &&
    !boundary.geometry.coordinates.slice(1).some((hole) => inRing(point, hole));
}
const nearOriginal = ([lon, lat]) => originals.some((feature) => {
  const [otherLon, otherLat] = feature.geometry.coordinates;
  return Math.abs(lat - otherLat) < .001 && Math.abs(lon - otherLon) < .0015;
});
const places = source.features.filter((feature) => feature.geometry?.type === 'Point' &&
  feature.geometry.coordinates?.length === 2 && feature.geometry.coordinates.every(Number.isFinite) &&
  inRegion(feature.geometry.coordinates) && !nearOriginal(feature.geometry.coordinates) &&
  feature.properties?.nazev && feature.properties?.druh &&
  feature.properties?.obrazek?.startsWith('https://commons.wikimedia.org/'))
  .map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const p = feature.properties;
    const sourceUrl = p.__dm_url ?? `https://www.wikidata.org/wiki/${feature.id}`;
    const imageFile = new URL(p.obrazek).pathname.split('/').at(-1);
    return {
      id: `wd-${feature.id}`, name: p.nazev, category: p.druh, coordinates: [lat, lon],
      osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`,
      description: p.popis || `${p.druh}${p.obec ? ` v obci ${p.obec}` : ''}.`,
      access: 'Přístupnost není ověřena.', accessSource: p.web || p.wikipedie || sourceUrl,
      image: p.obrazek, imageSource: `https://commons.wikimedia.org/wiki/File:${imageFile}`,
      imageCredit: 'Wikimedia Commons · autor a licence u souboru', sourceUrl, sourceLabel: 'Wikidata', country: 'CZ',
    };
  });
writeFileSync(resolve(root, 'data/places-candidates.json'), `${JSON.stringify(places, null, 2)}\n`);
console.log(`Uloženo ${places.length} kandidátů do data/places-candidates.json. Pevný katalog 300 cílů se nemění.`);
