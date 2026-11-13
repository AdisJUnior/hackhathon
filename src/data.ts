import geojson from './places.json' with { type: 'json' };

export type Mode = 'green' | 'snow';
export type Place = {
  id: string;
  name: string;
  category: string;
  coordinates: [number, number]; // Leaflet: latitude, longitude
  osm: string;
  description: string;
  access: string;
  accessSource: string;
  image: string;
  imageSource: string;
  imageCredit: string;
};
export type Town = { name: string; coordinates: [number, number]; osm: string };
export type Measurement = {
  placeId: string;
  mode: Mode;
  value: number;
  date: string;
  validFraction: number;
  cloudFraction: number;
  source: string;
  provenance: 'precomputed' | 'demo';
  sceneId?: string;
  product: 'S2-L2A-NDVI' | 'CLMS-FSC-20M';
  statistic: 'median' | 'mean';
  radiusMeters: 250;
};

// GeoJSON is the single source of truth for place coordinates (longitude, latitude).
const features = geojson.features as Array<{ id: string; properties: Omit<Place, 'id' | 'coordinates'>; geometry: { type: string; coordinates: number[] } }>;
export const places: Place[] = features.map((feature) => {
  if (feature.geometry.type !== 'Point' || feature.geometry.coordinates.length !== 2) throw new Error(`Invalid GeoJSON point: ${feature.id}`);
  const [longitude, latitude] = feature.geometry.coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error(`Invalid coordinates: ${feature.id}`);
  return { id: feature.id, ...feature.properties, coordinates: [latitude, longitude] };
});

// Nominatim geocoded representative points within the OSM municipality relations, 2026-11-13.
export const towns: Town[] = [
  { name: 'Plzeň', coordinates: [49.7477415, 13.3775249], osm: 'https://www.openstreetmap.org/relation/438344' },
  { name: 'Klatovy', coordinates: [49.3951183, 13.2935954], osm: 'https://www.openstreetmap.org/relation/438363' },
  { name: 'Domažlice', coordinates: [49.4403546, 12.9297480], osm: 'https://www.openstreetmap.org/relation/438629' },
  { name: 'Železná Ruda', coordinates: [49.1374249, 13.2350287], osm: 'https://www.openstreetmap.org/relation/438302' },
  { name: 'Sušice', coordinates: [49.2313907, 13.5204076], osm: 'https://www.openstreetmap.org/relation/438289' },
];

// Explicitly invented values, isolated from real observations and disabled by default.
export const demoMeasurements: Measurement[] = [
  ...[['cerchov', .79, 28], ['cerne-jezero', .68, 46], ['prasily', .83, 58], ['pancir', .72, 52], ['radyne', .64, 12]].flatMap(([placeId, ndvi, snow]) => [
    { placeId: String(placeId), mode: 'green' as const, value: Number(ndvi), date: '2026-07-15', validFraction: .95, cloudFraction: .03, source: 'Demonstrační hodnoty', provenance: 'demo' as const, product: 'S2-L2A-NDVI' as const, statistic: 'median' as const, radiusMeters: 250 as const },
    { placeId: String(placeId), mode: 'snow' as const, value: Number(snow), date: '2026-02-15', validFraction: .91, cloudFraction: .06, source: 'Demonstrační hodnoty', provenance: 'demo' as const, product: 'CLMS-FSC-20M' as const, statistic: 'mean' as const, radiusMeters: 250 as const },
  ]),
];
