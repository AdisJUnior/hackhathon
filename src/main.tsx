import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Circle, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Compass, LocateFixed, MapPin, Mountain, Satellite, Snowflake, Sprout, Info, ExternalLink } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { demoMeasurements, places, towns, type Measurement, type Mode, type Place } from './data';
import imported from './measurements.json';
import { distanceKm, nearby, recommend, validMeasurement } from './recommend';

const importedMeasurements = imported as Measurement[];
const pin = (active: boolean, mode: Mode, rank?: number) => L.divIcon({
  className: 'custom-pin-wrap',
  html: `<div class="custom-pin ${active ? 'active' : ''} ${mode}">${rank ?? '<span class="pin-dot"></span>'}</div>`,
  iconSize: [38, 44], iconAnchor: [19, 42],
});

function MapFocus({ place, town }: { place: Place | null; town: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (place) map.flyTo(place.coordinates, 13, { duration: 1.1 });
    else map.flyTo(town, 9, { duration: .9 });
  }, [place, town, map]);
  return null;
}

function App() {
  const [mode, setMode] = useState<Mode>('green');
  const [townIndex, setTownIndex] = useState(0);
  const [range, setRange] = useState(100);
  const [demo, setDemo] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const town = towns[townIndex];
  const measurements = demo ? demoMeasurements : importedMeasurements;
  const results = useMemo(() => recommend(places, town, range, mode, measurements), [town, range, mode, measurements]);
  const nearbyPlaces = useMemo(() => nearby(places, town, range), [town, range]);
  const selected = places.find((place) => place.id === selectedId) ?? null;
  const display = results.length ? results.map((item) => ({ ...item, measured: true })) : nearbyPlaces.map((item) => ({ ...item, measurement: null, measured: false }));
  const eligibleCount = places.filter((place) => distanceKm(town.coordinates, place.coordinates) <= range).length;
  const themeLabel = mode === 'green' ? 'Vegetace v okolí' : 'Sněhová pokrývka';

  useEffect(() => { setSelectedId(null); }, [mode, townIndex, range, demo]);

  return <div className={`app ${mode}`}>
    <header className="topbar">
      <a className="brand" href="#uvod" aria-label="Kam ven? Úvod"><span className="brand-symbol"><Mountain size={20} strokeWidth={2.2}/></span><span>kam ven<span className="brand-question">?</span><small>PLZEŇSKÝ KRAJ</small></span></a>
      <nav className="topnav" aria-label="Hlavní navigace"><a href="#objevovat">Objevovat</a><a href="#jak-to-funguje">Jak to funguje</a><a href="#zdroje">Data & zdroje</a></nav>
      <a className="top-action" href="#objevovat">Vybrat výlet <ArrowUpRight size={16}/></a>
    </header>

    <main id="uvod">
      <section className="hero">
        <div className="hero-content"><div className="eyebrow"><span className="eyebrow-line"/> OBJEVUJ SVŮJ KRAJ JINAK <span>01 / 03</span></div>
          <h1>Zažij krajinu<br/><em>v její nejlepší podobě.</em></h1>
          <p>Kam vyrazit, když toužíš po zeleni nebo sněhu? Vyber výchozí místo a objev výlety, které dávají smysl podle dat o krajině.</p>
          <a href="#objevovat" className="hero-link">Prozkoumat mapu <span><ArrowDownRight size={19}/></span></a>
        </div>
        <div className="hero-image" role="img" aria-label="Ilustrační fotografie lesní krajiny"><div className="hero-image-label"><span>ILUSTRAČNÍ FOTOGRAFIE</span><strong>OBJEVUJ PLZEŇSKÝ KRAJ</strong></div></div>
        <div className="hero-bottom"><span>✳ &nbsp;PŘÍRODA JE BLÍŽ, NEŽ SI MYSLÍŠ</span><span>SCROLLUJ DÁL &nbsp; ↓</span></div>
      </section>

      <section className="explore" id="objevovat">
        <div className="section-heading"><div><span className="section-kicker">TVŮJ DALŠÍ VÝLET ZAČÍNÁ TADY</span><h2>Kam vyrazíme?</h2></div><p>Výletní cíle v Plzeňském kraji na jedné mapě. Zvol, co tě dnes láká.</p></div>
        <div className="explorer-shell">
          <div className="controls-panel">
            <div className="control-heading"><span>01 / NASTAVENÍ VÝLETU</span><Info size={17}/></div>
            <div className="mode-switch" role="group" aria-label="Režim výletu"><button className={mode === 'green' ? 'chosen' : ''} onClick={() => setMode('green')} aria-pressed={mode === 'green'}><Sprout size={20}/><span>Za zelení<small>Nejzelenější okolí</small></span></button><button className={mode === 'snow' ? 'chosen' : ''} onClick={() => setMode('snow')} aria-pressed={mode === 'snow'}><Snowflake size={20}/><span>Za sněhem<small>Nejvíce sněhu</small></span></button></div>
            <label className="field-label" htmlFor="town">ODKUD VYRÁŽÍŠ?</label><div className="select-wrap"><MapPin size={18}/><select id="town" value={townIndex} onChange={(event) => setTownIndex(Number(event.target.value))}>{towns.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select><span>⌄</span></div>
            <div className="range-head"><label className="field-label" htmlFor="range">JAK DALEKO CHCEŠ JET?</label><strong>{range} km</strong></div><input id="range" className="range-input" type="range" min="5" max="100" step="5" value={range} onChange={(event) => setRange(Number(event.target.value))} style={{'--progress': `${(range - 5) / 95 * 100}%`} as React.CSSProperties}/><div className="range-labels"><span>5 km</span><span>100 km</span></div>
            <div className="data-toggle"><label><input type="checkbox" checked={demo} onChange={(event) => setDemo(event.target.checked)}/><span className="toggle-track"/><span>Ukázat demonstrační žebříček</span></label><p>Umožňuje vyzkoušet řazení. Hodnoty jsou smyšlené, nikoli satelitní měření.</p></div>
            <div className="control-foot"><Satellite size={18}/><span>{demo ? 'DEMONSTRAČNÍ DATA' : importedMeasurements.length ? 'IMPORTOVANÁ MĚŘENÍ' : 'ČEKÁME NA SATELITNÍ MĚŘENÍ'}</span></div>
          </div>
          <div className="map-panel"><MapContainer center={[49.43, 13.24]} zoom={9} scrollWheelZoom={true} className="map" zoomControl={false}>
            <ZoomControl position="topright"/>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{tileerror: () => setTileError(true), load: () => setTileError(false)}}/>
            <MapFocus place={selected} town={town.coordinates}/>
            <Marker position={town.coordinates} icon={L.divIcon({className:'origin-icon',html:'<div class="origin-marker"><span></span></div>',iconSize:[24,24],iconAnchor:[12,12]})}><Popup>Výchozí obec: {town.name}</Popup></Marker>
            {places.map((place) => { const rank = results.findIndex((result) => result.place.id === place.id); return <Marker key={place.id} position={place.coordinates} icon={pin(selectedId === place.id, mode, rank >= 0 ? rank + 1 : undefined)} eventHandlers={{click: () => setSelectedId(place.id)}}><Popup><strong>{place.name}</strong><br/>{place.category}<br/><a href={place.osm} target="_blank" rel="noreferrer">Zobrazit v OSM</a></Popup></Marker>; })}
            {selected && <Circle center={selected.coordinates} radius={250} pathOptions={{color: mode === 'green' ? '#4f7351' : '#4d8ba3', fillColor: mode === 'green' ? '#84ae81' : '#a8d4e5', fillOpacity: .26, weight: 2}}/>}
          </MapContainer><div className="map-overlay"><LocateFixed size={15}/> {town.name} <span>·</span> {eligibleCount} {eligibleCount === 1 ? 'místo' : 'míst'} v dosahu</div>{tileError && <div className="map-error" role="status">Mapový podklad se nenačetl. Body výletů zůstávají dostupné v kartách.</div>}<div className="map-key"><span className="key-origin"/> výchozí obec <span className="key-place"/> výletní cíl</div></div>
        </div>
        <div className="results-header"><div><span className="section-kicker">02 / VÝSLEDKY V TVÉM DOSAHU</span><h2>{results.length ? 'Tvoje tipy na výlet' : 'Místa, která můžeš objevit'}</h2><p>{results.length ? `Seřazeno podle ${mode === 'green' ? 'mediánu NDVI' : 'průměrného podílu sněhu'} v okolí 250 m.` : eligibleCount ? 'Zatím chybí ověřená satelitní měření. Ukazujeme nejbližší místa, nikoli datový žebříček.' : 'V tomto dosahu zatím nemáme žádný z pěti výletních cílů.'}</p></div><span className="result-count">{display.length.toString().padStart(2,'0')} / 03 TIPY</span></div>
        {demo && <div className="demo-warning"><Info size={18}/><span>DEMONSTRAČNÍ REŽIM — všechny zobrazené hodnoty NDVI a sněhu jsou smyšlené testovací údaje. Neslouží k plánování podle skutečných podmínek.</span></div>}
        <div className="cards">{display.map((item, index) => <article className={`place-card ${selectedId === item.place.id ? 'selected' : ''}`} key={item.place.id}>
          <button className="card-select" onClick={() => {setSelectedId(item.place.id); document.querySelector('.map-panel')?.scrollIntoView({behavior:'smooth',block:'center'});}} aria-label={`Zobrazit ${item.place.name} na mapě`}><div className="card-image" style={{backgroundImage: `url("${item.place.image}")`}}><span className="card-number">{String(index + 1).padStart(2,'0')}</span><span className="card-arrow"><ArrowUpRight size={20}/></span></div><div className="card-body"><span className="card-category">{item.place.category} <span>·</span> {item.distance.toFixed(1).replace('.', ',')} km vzdušně</span><h3>{item.place.name}</h3><p>{item.place.description}</p><div className="card-metric"><span>{item.measured ? themeLabel : 'SATELITNÍ DATA'}</span><strong>{item.measured && item.measurement ? mode === 'green' ? item.measurement.value.toFixed(2).replace('.', ',') : `${Math.round(item.measurement.value)} %` : 'Nedostupná'}</strong></div><div className="card-date">{item.measured && item.measurement ? <>{item.measurement.provenance === 'demo' ? 'Ukázková hodnota' : 'Předpočítané měření'} · snímek {new Date(item.measurement.date).toLocaleDateString('cs-CZ')} · platná plocha {Math.round(item.measurement.validFraction * 100)} % · oblačnost {Math.round(item.measurement.cloudFraction * 100)} %</> : 'Žádný ověřený snímek pro toto místo'}</div></div></button><a className="photo-credit" href={item.place.imageSource} target="_blank" rel="noreferrer">Foto: {item.place.imageCredit} <ExternalLink size={11}/></a>{item.measurement?.provenance !== 'demo' && item.measurement?.source && <a className="card-source" href={item.measurement.source} target="_blank" rel="noreferrer" title={item.measurement.sceneId}>Satelitní produkt · {item.measurement.sceneId} <ExternalLink size={13}/></a>}<a className="card-source" href={item.place.osm} target="_blank" rel="noreferrer">Poloha v OpenStreetMap <ExternalLink size={13}/></a></article>)}</div>
        {selected && <div className="selected-note"><Compass size={18}/><span><strong>{selected.name}</strong> — vyhodnocovací kruh má poloměr 250 m. {selected.access} <a href={selected.accessSource} target="_blank" rel="noreferrer">Podklad k přístupu ↗</a> Aktuální stav trasy ověřte před cestou.</span></div>}
      </section>

      <section className="method" id="jak-to-funguje"><div className="method-intro"><span className="section-kicker">CO JE ZA DOPORUČENÍM</span><h2>Data, která dávají<br/><em>výletům směr.</em></h2><p>Každý bod je skutečné místo z OpenStreetMap. Satelitní výsledek se vztahuje k okolí o poloměru 250 metrů, nikoliv jen k jednomu pixelu.</p><a href="#zdroje">Prohlédnout zdroje <ArrowRight size={16}/></a></div><div className="method-items"><div><span className="method-icon green-icon"><Sprout/></span><span>01 / ZA ZELENÍ</span><h3>Jak zelená je krajina?</h3><p>NDVI porovnává červené a blízké infračervené světlo ze Sentinel‑2. Medián platných pixelů v kruhu pomáhá omezit vliv extrémů.</p></div><div><span className="method-icon blue-icon"><Snowflake/></span><span>02 / ZA SNĚHEM</span><h3>Kolik plochy kryje sníh?</h3><p>Copernicus Fractional Snow Cover udává podíl sněhu v jednotlivých pixelech. Pro místo se počítá průměr ze všech platných pixelů kruhu.</p></div><div><span className="method-icon cream-icon"><Satellite/></span><span>03 / KVALITA MĚŘENÍ</span><h3>Jen když data stačí.</h3><p>Do žebříčku přijímáme měření s alespoň 70 % vyhodnotitelné plochy a nejvýše 30 % oblačnosti. Nula je hodnota; chybějící data zůstávají chybějící.</p></div></div></section>
    </main>
    <footer id="zdroje"><div className="footer-top"><div className="brand footer-brand"><span className="brand-symbol"><Mountain size={20}/></span><span>kam ven<span className="brand-question">?</span><small>PLZEŇSKÝ KRAJ</small></span></div><p>Výlety s otevřenýma očima.<br/>A s otevřenými daty.</p></div><div className="footer-bottom"><span>© 2026 KAM VEN? · PROTOTYP S OVĚŘENÝMI BODY</span><div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a><a href="https://dataspace.copernicus.eu/" target="_blank" rel="noreferrer">Copernicus</a><a href="https://land.copernicus.eu/en/products/snow/fractional-snow-cover" target="_blank" rel="noreferrer">FSC</a><a href="https://www.plzenskykraj-kct.cz/" target="_blank" rel="noreferrer">KČT</a></div></div></footer>
  </div>;
}

createRoot(document.getElementById('app')!).render(<App/>);
