import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowDownRight, ArrowUpRight, Compass, LocateFixed, MapPin, Satellite, Snowflake, Sprout, ExternalLink, X } from 'lucide-react';
import { HikerLogo } from './HikerLogo';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { places, towns, type Measurement, type Mode, type Place } from './data';
import imported from './measurements.json';
import plzenBoundary from './plzen-boundary.json';
import { distanceKm, explore } from './recommend';

const importedMeasurements = imported as Measurement[];
const regionRing = plzenBoundary.geometry.coordinates[0] as number[][];
const regionOutline = regionRing.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
const regionBounds: L.LatLngBoundsExpression = [
  [Math.min(...regionRing.map((point) => point[1])) - .08, Math.min(...regionRing.map((point) => point[0])) - .08],
  [Math.max(...regionRing.map((point) => point[1])) + .08, Math.max(...regionRing.map((point) => point[0])) + .08],
];
const heroPlaces = ['prasily', 'cerne-jezero', 'cerchov', 'pancir', 'wd-Q15586269']
  .map((id) => places.find((place) => place.id === id)).filter((place): place is Place => Boolean(place));
const heroImageUrl = (place: Place) => place.imageSource.startsWith('https://commons.wikimedia.org/wiki/File:')
  ? `https://commons.wikimedia.org/wiki/Special:FilePath/${place.imageSource.split('/File:')[1]}?width=1400`
  : place.image.replace(/width=400\b/, 'width=1400');
const isOld = (date: string) => Date.now() - Date.parse(`${date}T00:00:00Z`) > 30 * 86400000;
const directionsUrl = (origin: [number, number], destination: [number, number], travelmode: 'walking' | 'driving') =>
  `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', origin: origin.join(','), destination: destination.join(','), travelmode })}`;
const browserUrl = (place: Place, measurement: Measurement) => {
  const params = new URLSearchParams({ zoom: '14', lat: String(place.coordinates[0]), lng: String(place.coordinates[1]),
    fromTime: `${measurement.date}T00:00:00.000Z`, toTime: `${measurement.date}T23:59:59.999Z`, dateMode: 'SINGLE' });
  if (measurement.mode === 'green') {
    params.set('datasetId', 'S2_L2A_CDAS');
    params.set('layerId', '3_NDVI');
  }
  return `https://browser.dataspace.copernicus.eu/?${params}`;
};
function MetricSymbols({ mode, value }: { mode: Mode; value: number }) {
  const count = mode === 'green'
    ? [0.2, 0.4, 0.55, 0.7, 0.8].filter((threshold) => value >= threshold).length
    : Math.min(5, Math.ceil(value / 20));
  const symbol = mode === 'green' ? '🌿' : '❄️';
  const exact = mode === 'green' ? `NDVI ${value.toFixed(2)}` : `Sníh ${Math.round(value)} %`;
  return <strong className="metric-symbols" aria-label={exact}>{Array.from({ length: 5 }, (_, index) =>
    <span key={index} className={index < count ? 'filled' : 'empty'} aria-hidden="true">{symbol}</span>,
  )}</strong>;
}
const pin = (active: boolean, mode: Mode, inRange: boolean, featured: boolean, rank?: number) => L.divIcon({
  className: 'custom-pin-wrap',
  html: `<div class="custom-pin ${active ? 'active' : ''} ${mode} ${featured ? '' : 'background-point'} ${inRange ? '' : 'out-of-range'}">${rank ?? '<span class="pin-dot"></span>'}</div>`,
  iconSize: [38, 44], iconAnchor: [19, 42],
});

function MapFocus({ place, town, range }: { place: Place | null; town: [number, number]; range: number }) {
  const map = useMap();
  useEffect(() => {
    if (place) map.flyTo(place.coordinates, 13, { duration: 1.1 });
    else map.flyTo(town, range >= 100 ? 7.5 : range >= 60 ? 8 : range >= 30 ? 9 : range >= 15 ? 10 : 11, { duration: .9 });
  }, [place, town, range, map]);
  return null;
}

function App() {
  const [mode, setMode] = useState<Mode>('green');
  const [townIndex, setTownIndex] = useState(0);
  const [rangeIndex, setRangeIndex] = useState(4);
  const [tileError, setTileError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroSlideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const town = towns[townIndex];
  const maxRange = useMemo(() => Math.max(5, Math.ceil(Math.max(...places.map((place) => distanceKm(town.coordinates, place.coordinates))))), [town]);
  const distanceOptions = useMemo(() => [...new Set([5, 15, 35, 65, maxRange].filter((distance) => distance <= maxRange))], [maxRange]);
  const currentRangeIndex = Math.min(rangeIndex, distanceOptions.length - 1);
  const range = distanceOptions[currentRangeIndex];
  const { ranked: results, visible: display, outside } = useMemo(() => explore(places, town, range, mode, importedMeasurements), [town, range, mode]);
  const selected = places.find((place) => place.id === selectedId) ?? null;
  const eligibleCount = places.filter((place) => distanceKm(town.coordinates, place.coordinates) <= range).length;
  const themeLabel = mode === 'green' ? 'Vegetace v okolí' : 'Sněhová pokrývka';
  const nextHeroPlace = heroPlaces.length ? heroPlaces[(heroIndex + 1) % heroPlaces.length] : null;

  useEffect(() => { setSelectedId(null); }, [mode, townIndex, range]);
  useEffect(() => {
    if (heroPlaces.length < 2) return;
    const next = () => setHeroIndex((index) => (index + 1) % heroPlaces.length);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const timer = window.setTimeout(next, 5000);
      return () => window.clearTimeout(timer);
    }
    const slide = heroSlideRefs.current[heroIndex];
    if (!slide) return;
    const animation = slide.animate([
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(-1%)', offset: .62 },
      { transform: 'translateX(-5%)', offset: .77 },
      { transform: 'translateX(-105%)', offset: 1 },
    ], { duration: 5000, easing: 'linear', fill: 'forwards' });
    animation.onfinish = next;
    return () => { animation.onfinish = null; animation.cancel(); };
  }, [heroIndex]);
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.js-reveal');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: .08, rootMargin: '0px 0px -24px 0px' });
    elements.forEach((element) => { element.classList.remove('is-visible'); observer.observe(element); });
    return () => observer.disconnect();
  }, [mode, townIndex, range]);

  return <div className={`app ${mode}`}>
    <header className="topbar">
      <a className="brand" href="#uvod" aria-label="Kam ven? Úvod"><span className="brand-symbol"><HikerLogo/></span><span>kam ven<span className="brand-question">?</span><small>PLZEŇSKÝ KRAJ</small></span></a>
      <nav className="topnav" aria-label="Hlavní navigace"><a href="#objevovat">Objevovat</a><a href="#jak-to-funguje">Jak to funguje</a><a href="#zdroje">Data & zdroje</a></nav>
    </header>

    <main id="uvod">
      <section className="hero">
        <div className="hero-content">
          <h1>Zažij krajinu<br/><em>v její nejlepší podobě.</em></h1>
          <p>Kam vyrazit, když toužíš po zeleni nebo sněhu?</p>
          <a href="#objevovat" className="hero-link">Prozkoumat mapu <span><ArrowDownRight size={19}/></span></a>
        </div>
        <div className="hero-image" style={nextHeroPlace ? { backgroundImage: `url("${heroImageUrl(nextHeroPlace)}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>{heroPlaces.map((place, index) => <div ref={(node) => { heroSlideRefs.current[index] = node; }} key={place.id} className={`hero-slide ${index === heroIndex ? 'active' : ''}`} style={{ backgroundImage: `url("${heroImageUrl(place)}")` }} aria-hidden="true"/>)}{heroPlaces[heroIndex] && <a className="hero-photo-source" href={heroPlaces[heroIndex].imageSource} target="_blank" rel="noreferrer">{heroPlaces[heroIndex].name} · foto ↗</a>}</div>
      </section>

      <section className="explore" id="objevovat">
        <div className="section-heading js-reveal"><h2>Kam vyrazíme?</h2></div>
        <div className="explorer-shell">
          <div className="controls-panel">
            <div className="mode-switch" role="group" aria-label="Režim výletu"><button className={mode === 'green' ? 'chosen' : ''} onClick={() => setMode('green')} aria-pressed={mode === 'green'}><Sprout size={20}/><span>Za zelení<small>Nejzelenější okolí</small></span></button><button className={mode === 'snow' ? 'chosen' : ''} onClick={() => setMode('snow')} aria-pressed={mode === 'snow'}><Snowflake size={20}/><span>Za sněhem<small>Nejvíce sněhu</small></span></button></div>
            <label className="field-label" htmlFor="town">ODKUD VYRÁŽÍŠ?</label><div className="select-wrap"><MapPin size={18}/><select id="town" value={townIndex} onChange={(event) => setTownIndex(Number(event.target.value))}>{towns.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select><span>⌄</span></div>
            <div className="range-head"><label className="field-label" htmlFor="range">JAK DALEKO CHCEŠ JET?</label><strong>{range} km</strong></div><input id="range" className="range-input" type="range" min="0" max={distanceOptions.length - 1} step="1" value={currentRangeIndex} onChange={(event) => setRangeIndex(Number(event.target.value))} style={{'--progress': `${distanceOptions.length === 1 ? 100 : currentRangeIndex / (distanceOptions.length - 1) * 100}%`} as React.CSSProperties}/><div className="range-labels">{distanceOptions.map((distance) => <span key={distance}>{distance}</span>)}</div>
          </div>
          <div className="map-panel"><MapContainer center={[49.52, 13.12]} zoom={7.5} minZoom={7.5} zoomSnap={0.5} maxBounds={regionBounds} maxBoundsViscosity={1} scrollWheelZoom={true} className="map" zoomControl={false}>
            <ZoomControl position="topright"/>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{tileerror: () => setTileError(true), load: () => setTileError(false)}}/>
            <Circle center={town.coordinates} radius={range * 1000} pathOptions={{ color: mode === 'green' ? '#315d42' : '#38768c', weight: 2, opacity: .55, fillColor: mode === 'green' ? '#87b587' : '#8ec1d1', fillOpacity: .13 }} interactive={false}/>
            <Polyline positions={regionOutline} pathOptions={{ color: mode === 'green' ? '#315d42' : '#38768c', weight: 2, opacity: .8, fill: false }} interactive={false}/>
            <MapFocus place={selected} town={town.coordinates} range={range}/>
            <Marker position={town.coordinates} icon={L.divIcon({className:'origin-icon',html:'<div class="origin-marker"><span></span></div>',iconSize:[24,24],iconAnchor:[12,12]})}><Popup>Výchozí obec: {town.name}</Popup></Marker>
            {[...display.map((item) => item.place), ...outside.map((item) => item.place)].map((place) => { const rank = results.findIndex((result) => result.place.id === place.id); const inRange = distanceKm(town.coordinates, place.coordinates) <= range; return <Marker key={place.id} position={place.coordinates} icon={pin(selectedId === place.id, mode, inRange, inRange, rank >= 0 ? rank + 1 : undefined)} eventHandlers={{click: () => setSelectedId(place.id)}}/>; })}
            {selected && <Circle center={selected.coordinates} radius={250} pathOptions={{color: mode === 'green' ? '#4f7351' : '#4d8ba3', fillColor: mode === 'green' ? '#84ae81' : '#a8d4e5', fillOpacity: .26, weight: 2}}/>}
          </MapContainer><div className="map-overlay"><LocateFixed size={15}/> {town.name} <span>·</span> {eligibleCount} {eligibleCount === 1 ? 'místo' : 'míst'} v dosahu</div>{tileError && <div className="map-error" role="status">Mapový podklad se nenačetl. Body výletů zůstávají dostupné v kartách.</div>}
          {selected ? <div className="selected-note" role="region" aria-label={`Trasy k místu ${selected.name}`}>
            <div className="selected-note-head"><Compass size={18}/><span><strong>{selected.name}</strong><small>Okolí 250 m · <a href={selected.accessSource} target="_blank" rel="noreferrer">Ověřit přístup ↗</a></small></span><button className="selection-close" type="button" onClick={() => setSelectedId(null)} aria-label="Zavřít vybrané místo"><X size={17}/></button></div>
            <div className="route-actions"><a href={directionsUrl(town.coordinates, selected.coordinates, 'walking')} target="_blank" rel="noreferrer">Trasa pěšky <ArrowUpRight size={14}/></a><a href={directionsUrl(town.coordinates, selected.coordinates, 'driving')} target="_blank" rel="noreferrer">Trasa autem <ArrowUpRight size={14}/></a></div>
          </div> : <div className="map-key"><span className="key-origin"/> start <span className="key-place"/> v dosahu <span className="key-out"/> mimo dosah</div>}</div>
        </div>
        <div className="results-header"><h2>{results.length ? 'Tvoje tipy na výlet' : 'Místa, která můžeš objevit'}</h2>{eligibleCount === 0 && <p>V tomto dosahu zatím nemáme výletní cíl.</p>}</div>
        <div className="cards">{display.map((item) => <article className={`place-card js-reveal ${selectedId === item.place.id ? 'selected' : ''}`} key={item.place.id}>
          <button className="card-select" onClick={() => { setSelectedId(item.place.id); document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }} aria-label={`Zobrazit ${item.place.name} na mapě`}>
            <div className={`card-image ${item.place.image ? '' : 'image-placeholder'}`} style={item.place.image ? { backgroundImage: `url("${item.place.image}")` } : undefined}><span className="card-number">{item.measured ? `TOP ${item.rank}` : 'TIP'}</span>{!item.place.image && <span className="image-missing">Fotografie není dostupná</span>}<span className="card-arrow"><ArrowUpRight size={20}/></span></div>
            <div className="card-body"><span className="card-category">{item.place.category} <span>·</span> {item.distance.toFixed(1).replace('.', ',')} km vzdušně</span><h3>{item.place.name}</h3><p>{item.place.description}</p>
              <div className="card-metric"><span>{item.measurement ? themeLabel : 'SATELITNÍ DATA'}</span>{item.measurement ? <MetricSymbols mode={mode} value={item.measurement.value}/> : <strong>Nedostupná</strong>}</div>
              <div className="card-date">{item.measurement ? <>Snímek {new Date(item.measurement.date).toLocaleDateString('cs-CZ')} {isOld(item.measurement.date) && (mode === 'snow' ? ' · ARCHIVNÍ' : ' · STARŠÍ SNÍMEK')}{!item.measured && ' · MIMO SROVNÁVACÍ OBDOBÍ'}</> : 'Bez ověřeného satelitního měření'}</div>
            </div>
          </button>
          <details className="card-details"><summary>Podrobnosti a zdroje</summary>
            {item.measurement && <p>{mode === 'green' ? `NDVI ${item.measurement.value.toFixed(2).replace('.', ',')}` : `Sníh ${Math.round(item.measurement.value)} %`} · platná plocha {Math.round(item.measurement.validFraction * 100)} % · oblačnost {Math.round(item.measurement.cloudFraction * 100)} %{mode === 'snow' && isOld(item.measurement.date) && ' · Historický snímek nevypovídá o dnešním sněhu.'}</p>}
            {item.measurement && <><a href={browserUrl(item.place, item.measurement)} target="_blank" rel="noreferrer">{mode === 'green' ? 'Prohlédnout oblast a datum v Copernicus Browser' : 'Otevřít Copernicus Browser · vybrat FSC'} <ExternalLink size={12}/></a><p title={item.measurement.source}>ID produktu: {item.measurement.sceneId}</p></>}
            {item.place.imageSource && <a href={item.place.imageSource} target="_blank" rel="noreferrer">Foto: {item.place.imageCredit} <ExternalLink size={12}/></a>}
            {item.place.sourceUrl && <a href={item.place.sourceUrl} target="_blank" rel="noreferrer">Údaje: {item.place.sourceLabel ?? 'zdroj'} <ExternalLink size={12}/></a>}
            <a href={item.place.osm} target="_blank" rel="noreferrer">Poloha v OpenStreetMap <ExternalLink size={12}/></a>
          </details>
        </article>)}</div>
      </section>

      <section className="method" id="jak-to-funguje"><div className="method-intro js-reveal"><h2>Jak to funguje</h2><p>Satelitní snímky vyhodnocujeme v okolí 250 m od každého místa.</p></div><div className="method-items"><div className="js-reveal"><span className="method-icon green-icon"><Sprout/></span><h3>Za zelení</h3><p>Medián NDVI ze Sentinel‑2 ukazuje míru vegetace.</p></div><div className="js-reveal"><span className="method-icon blue-icon"><Snowflake/></span><h3>Za sněhem</h3><p>Průměrný podíl sněhu pochází z Copernicus FSC.</p></div><div className="js-reveal"><span className="method-icon cream-icon"><Satellite/></span><h3>Kvalita dat</h3><p>Do TOP patří jen snímky s alespoň 70 % platné plochy a nejvýše 30 % oblačnosti.</p></div></div></section>
    </main>
    <footer id="zdroje"><div className="footer-top"><div className="brand footer-brand"><span className="brand-symbol"><HikerLogo/></span><span>kam ven<span className="brand-question">?</span><small>PLZEŇSKÝ KRAJ</small></span></div><p>Výlety s otevřenýma očima.<br/>A s otevřenými daty.</p></div><div className="footer-bottom"><span>© 2026 KAM VEN? · PROTOTYP S OVĚŘENÝMI BODY</span><div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a><a href="https://dataspace.copernicus.eu/" target="_blank" rel="noreferrer">Copernicus</a><a href="https://land.copernicus.eu/en/products/snow/fractional-snow-cover" target="_blank" rel="noreferrer">FSC</a><a href="https://www.plzenskykraj-kct.cz/" target="_blank" rel="noreferrer">KČT</a></div></div></footer>
  </div>;
}

createRoot(document.getElementById('app')!).render(<App/>);
