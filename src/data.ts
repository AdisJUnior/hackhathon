import geojson from './places.json' with { type: 'json' };
import regionalPlaces from './regional-places.json' with { type: 'json' };
import extraPlaces from './places-extra.json' with { type: 'json' };

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
  sourceUrl?: string;
  sourceLabel?: string;
  country?: string;
};
export type Town = { name: string; coordinates: [number, number]; osm: string; source?: string };
export type Measurement = {
  placeId: string;
  mode: Mode;
  value: number;
  date: string;
  observedAt?: string | null; // UTC time of the satellite scene, if the source provides it
  validFraction: number;
  cloudFraction: number;
  source: string;
  provenance: 'precomputed';
  sceneId?: string;
  product: 'S2-L2A-NDVI' | 'CLMS-FSC-20M';
  statistic: 'median' | 'mean';
  radiusMeters: 250;
};

// GeoJSON is the single source of truth for place coordinates (longitude, latitude).
const features = geojson.features as Array<{ id: string; properties: Omit<Place, 'id' | 'coordinates'>; geometry: { type: string; coordinates: number[] } }>;
const originalPlaces: Place[] = features.map((feature) => {
  if (feature.geometry.type !== 'Point' || feature.geometry.coordinates.length !== 2) throw new Error(`Invalid GeoJSON point: ${feature.id}`);
  const [longitude, latitude] = feature.geometry.coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error(`Invalid coordinates: ${feature.id}`);
  return { id: feature.id, ...feature.properties, coordinates: [latitude, longitude] };
});
const importedPlaces: Place[] = [...regionalPlaces, ...extraPlaces].map((place) => {
  if (place.coordinates.length !== 2 || place.coordinates.some((coordinate) => !Number.isFinite(coordinate)))
    throw new Error(`Invalid imported point: ${place.id}`);
  return { ...place, coordinates: [place.coordinates[0], place.coordinates[1]] };
});
// The checked-in lists are the frozen 300-place catalog. Import scripts write candidates elsewhere.
export const places: Place[] = [...originalPlaces, ...importedPlaces];

// Nominatim geocoded representative points within the OSM municipality relations, 2026-11-13.
export const towns: Town[] = [
  { name: 'Plzeň', coordinates: [49.7477415, 13.3775249], osm: 'https://www.openstreetmap.org/relation/438344' },
  { name: 'Klatovy', coordinates: [49.3951183, 13.2935954], osm: 'https://www.openstreetmap.org/relation/438363' },
  { name: 'Domažlice', coordinates: [49.4403546, 12.9297480], osm: 'https://www.openstreetmap.org/relation/438629' },
  { name: 'Železná Ruda', coordinates: [49.1374249, 13.2350287], osm: 'https://www.openstreetmap.org/relation/438302' },
  { name: 'Sušice', coordinates: [49.2313907, 13.5204076], osm: 'https://www.openstreetmap.org/relation/438289' },
];

