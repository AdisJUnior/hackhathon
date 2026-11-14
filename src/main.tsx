import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronDown, Compass, LocateFixed, MapPin, Snowflake, Sprout, ExternalLink, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './style.css';
import { places, towns, type Measurement, type Mode, type Place } from './data';
import imported from './measurements.json';
import plzenBoundary from './plzen-boundary.json';
import { distanceKm, explore, validMeasurement } from './recommend';
import { OrbitMethodVisual } from './OrbitMethodVisual';
import { SurfaceReflectance } from './SurfaceReflectance';

const importedMeasurements = imported as Measurement[];
const regionRing = plzenBoundary.geometry.coordinates[0] as number[][];
const regionOutline = regionRing.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
const regionBounds: L.LatLngBoundsExpression = [
  [Math.min(...regionRing.map((point) => point[1])) - .08, Math.min(...regionRing.map((point) => point[0])) - .08],
  [Math.max(...regionRing.map((point) => point[1])) + .08, Math.max(...regionRing.map((point) => point[0])) + .08],
];
const heroPlaces = ['prasily', 'cerne-jezero', 'cerchov', 'pancir', 'wd-Q15586269']
  .map((id) => places.find((place) => place.id === id)).filter((place): place is Place => Boolean(place));
const HERO_CYCLE_MS = 5000;
const pageSections = ['uvod', 'objevovat', 'vysledky', 'zdroje'];
let cancelGlide: (() => void) | null = null;
const heroImageUrl = (place: Place) => place.imageSource.startsWith('https://commons.wikimedia.org/wiki/File:')
  ? `https://commons.wikimedia.org/wiki/Special:FilePath/${place.imageSource.split('/File:')[1]}?width=1400`
  : place.image.replace(/width=400\b/, 'width=1400');
function glideTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  cancelGlide?.();
  const from = window.scrollY;
  const distance = id === 'uvod' ? -from : target.getBoundingClientRect().top;
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 450 : 950;
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  const started = performance.now();
  let frame = 0;
  const stop = () => {
    window.cancelAnimationFrame(frame);
    root.style.scrollBehavior = previousBehavior;
    window.removeEventListener('wheel', stop);
    window.removeEventListener('touchstart', stop);
    if (cancelGlide === stop) cancelGlide = null;
  };
  const tick = (now: number) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    window.scrollTo(0, from + distance * eased);
    if (progress < 1) frame = window.requestAnimationFrame(tick);
    else stop();
  };
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('touchstart', stop, { passive: true });
  cancelGlide = stop;
  frame = window.requestAnimationFrame(tick);
}
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
  const [sectionIndex, setSectionIndex] = useState(0);
  const [logoPhase, setLogoPhase] = useState<'full' | 'small' | 'hidden'>('full');
  const logoPhaseRef = useRef<'full' | 'small' | 'hidden'>('full');
  const logoHideTimerRef = useRef<number | null>(null);
  const lastPageYRef = useRef(0);
  const [methodActive, setMethodActive] = useState(false);
  const methodRef = useRef<HTMLElement | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);
  const destinationViewportRef = useRef<HTMLDivElement | null>(null);
  const idleDriftFrameRef = useRef<number | null>(null);
  const returnFrameRef = useRef<number | null>(null);
  const idleResumeRef = useRef<() => void>(() => {});
  const destinationInteractedRef = useRef(false);
  const driftFrameRef = useRef<number | null>(null);
  const driftVelocityRef = useRef(0);
  const driftTargetRef = useRef(0);
  const driftLastRef = useRef(0);
  const heroSlideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rangeLabelRef = useRef<HTMLElement | null>(null);
  const previousRangeRef = useRef<number | null>(null);
  const town = towns[townIndex];
  const maxRange = useMemo(() => Math.max(5, Math.ceil(Math.max(...places.map((place) => distanceKm(town.coordinates, place.coordinates))))), [town]);
  const distanceOptions = useMemo(() => [...new Set([5, 15, 35, 65, maxRange].filter((distance) => distance <= maxRange))], [maxRange]);
  const currentRangeIndex = Math.min(rangeIndex, distanceOptions.length - 1);
  const range = distanceOptions[currentRangeIndex];
  const { ranked: results, visible: display, outside } = useMemo(() => explore(places, town, range, mode, importedMeasurements), [town, range, mode]);
  const selected = places.find((place) => place.id === selectedId) ?? null;
  const eligibleCount = places.filter((place) => distanceKm(town.coordinates, place.coordinates) <= range).length;
  const selectedMeasurement = importedMeasurements.filter((measurement) => measurement.placeId === selectedId && validMeasurement(measurement, mode))
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const upcomingHeroIndex = heroPlaces.length ? (heroIndex + 1) % heroPlaces.length : 0;

  useLayoutEffect(() => {
    const timeouts: number[] = [];
    const resetScroll = () => {
      const root = document.documentElement;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      window.requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        window.requestAnimationFrame(() => window.scrollTo(0, 0));
      });
    };
    const stabilizeScroll = () => {
      resetScroll();
      timeouts.push(window.setTimeout(resetScroll, 120), window.setTimeout(resetScroll, 420));
    };
    let previousWidth = window.innerWidth;
    let previousHeight = window.innerHeight;
    const onResize = () => {
      const changed = Math.max(Math.abs(window.innerWidth - previousWidth), Math.abs(window.innerHeight - previousHeight));
      const desktop = Math.max(window.innerWidth, previousWidth) >= 768;
      previousWidth = window.innerWidth;
      previousHeight = window.innerHeight;
      if (desktop && changed >= 100) resetScroll();
    };
    resetScroll();
    window.addEventListener('pageshow', stabilizeScroll);
    window.addEventListener('load', stabilizeScroll, { once: true });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('pageshow', stabilizeScroll); window.removeEventListener('load', stabilizeScroll); window.removeEventListener('resize', onResize); timeouts.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    const changeLogo = (phase: 'full' | 'small' | 'hidden') => {
      if (logoPhaseRef.current === phase) return;
      logoPhaseRef.current = phase;
      setLogoPhase(phase);
    };
    const clearHideTimer = () => {
      if (logoHideTimerRef.current !== null) clearTimeout(logoHideTimerRef.current);
      logoHideTimerRef.current = null;
    };
    const update = () => {
      const y = window.scrollY;
      const movingDown = y > lastPageYRef.current + 2;
      lastPageYRef.current = y;
      if (y <= 24) {
        clearHideTimer();
        changeLogo('full');
      } else if (movingDown && logoPhaseRef.current !== 'hidden' && logoHideTimerRef.current === null) {
        changeLogo('small');
        logoHideTimerRef.current = window.setTimeout(() => { changeLogo('hidden'); logoHideTimerRef.current = null; }, 1800);
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 24) {
        setSectionIndex(pageSections.length - 1);
        return;
      }
      const marker = window.scrollY + window.innerHeight * .35;
      const current = pageSections.reduce((index, id, candidate) => {
        const element = document.getElementById(id);
        return element && element.getBoundingClientRect().top + window.scrollY <= marker ? candidate : index;
      }, 0);
      setSectionIndex(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); clearHideTimer(); };
  }, []);

  const stopDestinationDrift = () => {
    driftTargetRef.current = 0;
  };
  const stopIdleDrift = () => {
    if (idleDriftFrameRef.current !== null) cancelAnimationFrame(idleDriftFrameRef.current);
    idleDriftFrameRef.current = null;
  };
  const stopReturnDrift = () => {
    if (returnFrameRef.current !== null) cancelAnimationFrame(returnFrameRef.current);
    returnFrameRef.current = null;
  };
  const cancelDestinationDrift = () => {
    driftTargetRef.current = 0;
    driftVelocityRef.current = 0;
    driftLastRef.current = 0;
    if (driftFrameRef.current !== null) cancelAnimationFrame(driftFrameRef.current);
    driftFrameRef.current = null;
  };
  const moveDestinationDrift = (clientX: number) => {
    stopReturnDrift();
    const viewport = destinationViewportRef.current;
    if (!viewport || display.length < 3) return;
    const bounds = viewport.getBoundingClientRect();
    const offset = (clientX - bounds.left) / bounds.width * 2 - 1;
    const distance = Math.max(0, Math.abs(offset) - .05);
    driftTargetRef.current = Math.sign(offset) * Math.pow(distance / .95, 1.15) * 155;
    if (driftFrameRef.current !== null || driftTargetRef.current === 0) return;
    const step = (time: number) => {
      const elapsed = driftLastRef.current ? Math.min(64, time - driftLastRef.current) : 0;
      driftLastRef.current = time;
      const node = destinationViewportRef.current;
      if (!node) { cancelDestinationDrift(); return; }
      driftVelocityRef.current += (driftTargetRef.current - driftVelocityRef.current) * Math.min(1, elapsed / 450);
      if (driftTargetRef.current === 0 && Math.abs(driftVelocityRef.current) < .25) { cancelDestinationDrift(); return; }
      const before = node.scrollLeft;
      if ((before <= 0 && driftVelocityRef.current < 0) ||
          (before >= node.scrollWidth - node.clientWidth - 1 && driftVelocityRef.current > 0)) {
        cancelDestinationDrift(); return;
      }
      node.scrollLeft += driftVelocityRef.current * elapsed / 1000;
      driftFrameRef.current = requestAnimationFrame(step);
    };
    driftFrameRef.current = requestAnimationFrame(step);
  };
  const returnDestinationHome = () => {
    cancelDestinationDrift();
    stopReturnDrift();
    const viewport = destinationViewportRef.current;
    if (!viewport || viewport.scrollLeft < 1) { idleResumeRef.current(); return; }
    const from = viewport.scrollLeft;
    const duration = Math.min(1800, Math.max(1250, from * 2));
    const started = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - started) / duration);
      const eased = progress * progress * (3 - 2 * progress);
      viewport.scrollLeft = from * (1 - eased);
      if (progress < 1) returnFrameRef.current = requestAnimationFrame(step);
      else { returnFrameRef.current = null; idleResumeRef.current(); }
    };
    returnFrameRef.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { cancelDestinationDrift(); stopReturnDrift(); }, []);
  useEffect(() => {
    const section = resultsRef.current;
    const viewport = destinationViewportRef.current;
    if (!section || !viewport) return;
    let inView = false;
    const startIdle = () => {
      stopIdleDrift();
      if (!inView || destinationInteractedRef.current || returnFrameRef.current !== null || viewport.scrollWidth <= viewport.clientWidth) return;
      const base = viewport.scrollLeft;
      let start = 0;
      const wave = (time: number) => {
        if (!start) start = time;
        // First hint after one second; later hints wait five seconds after returning.
        const phase = (time - start + 4000) % 9000;
        const ease = (progress: number) => progress * progress * (3 - 2 * progress);
        const offset = phase < 5000 ? 0
          : phase < 6700 ? 18 * ease((phase - 5000) / 1700)
          : phase < 7300 ? 18
          : 18 * (1 - ease((phase - 7300) / 1700));
        viewport.scrollLeft = base + offset;
        idleDriftFrameRef.current = requestAnimationFrame(wave);
      };
      idleDriftFrameRef.current = requestAnimationFrame(wave);
    };
    idleResumeRef.current = startIdle;
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) startIdle(); else stopIdleDrift();
    }, { threshold: .25 });
    observer.observe(section);
    return () => { observer.disconnect(); stopIdleDrift(); idleResumeRef.current = () => {}; };
  }, []);
  useEffect(() => { setSelectedId(null); stopReturnDrift(); if (destinationViewportRef.current) destinationViewportRef.current.scrollLeft = 0; }, [mode, townIndex, range]);
  useEffect(() => {
    if (!selectedId) return;
    const index = display.findIndex((item) => item.place.id === selectedId);
    const viewport = destinationViewportRef.current;
    const card = viewport?.querySelector<HTMLElement>('.place-card');
    if (index >= 0 && viewport && card) {
      cancelDestinationDrift();
      const gap = Number.parseFloat(getComputedStyle(card.parentElement!).columnGap) || 0;
      viewport.scrollTo({ left: index * (card.offsetWidth + gap), behavior: 'smooth' });
    }
  }, [selectedId, display]);
  useEffect(() => {
    if (heroPlaces.length < 2) return;
    const next = () => setHeroIndex((index) => (index + 1) % heroPlaces.length);
    const slide = heroSlideRefs.current[heroIndex];
    const upcoming = heroSlideRefs.current[(heroIndex + 1) % heroPlaces.length];
    if (!slide || !upcoming || !slide.animate || !upcoming.animate) {
      const timer = window.setTimeout(next, HERO_CYCLE_MS);
      return () => window.clearTimeout(timer);
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const options: KeyframeAnimationOptions = { duration: HERO_CYCLE_MS, fill: 'forwards' };
      const currentAnimation = slide.animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: .88 }, { opacity: 0, offset: 1 }], options);
      const upcomingAnimation = upcoming.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: .88 }, { opacity: 1, offset: 1 }], options);
      currentAnimation.onfinish = next;
      return () => { currentAnimation.onfinish = null; currentAnimation.cancel(); upcomingAnimation.cancel(); };
    }
    const smallScreen = window.matchMedia('(max-width: 600px)').matches;
    const travel = smallScreen ? 0 : 1.5;
    const blur = smallScreen ? 6 : 9;
    const currentAnimation = slide.animate([
      { transform: 'translateX(0) scale(1.04)', opacity: 1, filter: 'blur(0)', offset: 0 },
      { transform: smallScreen ? 'translateX(0) scale(1.04)' : `translateX(${travel / 3}%) scale(1.045)`, opacity: 1, filter: 'blur(0)', offset: .6 },
      { transform: `translateX(${travel * .75}%) scale(1.04)`, opacity: .62, filter: `blur(${blur * .8}px)`, offset: .82 },
      { transform: `translateX(${travel}%) scale(1.04)`, opacity: 0, filter: `blur(${blur}px)`, offset: 1 },
    ], { duration: HERO_CYCLE_MS, easing: 'ease-in-out', fill: 'forwards' });
    const upcomingAnimation = upcoming.animate([
      { transform: `translateX(${-travel}%) scale(1.04)`, opacity: 0, filter: `blur(${blur}px)`, offset: 0 },
      { transform: `translateX(${-travel}%) scale(1.04)`, opacity: 0, filter: `blur(${blur}px)`, offset: .6 },
      { transform: `translateX(${-travel * .4}%) scale(1.04)`, opacity: .46, filter: `blur(${blur * .7}px)`, offset: .82 },
      { transform: 'translateX(0) scale(1.04)', opacity: 1, filter: 'blur(0)', offset: 1 },
    ], { duration: HERO_CYCLE_MS, easing: 'ease-in-out', fill: 'forwards' });
    currentAnimation.onfinish = next;
    return () => { currentAnimation.onfinish = null; currentAnimation.cancel(); upcomingAnimation.cancel(); };
  }, [heroIndex]);
  useEffect(() => {
    if (previousRangeRef.current === null) {
      previousRangeRef.current = range;
      return;
    }
    if (previousRangeRef.current === range) return;
    previousRangeRef.current = range;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const label = rangeLabelRef.current;
    if (!label?.animate) return;
    const animation = label.animate([
      { opacity: .82, transform: 'translateY(1px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 700, easing: 'cubic-bezier(.45, 0, .25, 1)' });
    return () => animation?.cancel();
  }, [range]);
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
    elements.forEach((element) => { if (!element.classList.contains('is-visible')) observer.observe(element); });
    return () => observer.disconnect();
  }, [mode, townIndex, range]);
  useEffect(() => {
    const node = methodRef.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) { setMethodActive(true); return; }
    const observer = new IntersectionObserver(([entry]) => setMethodActive(entry.isIntersecting), { threshold: .2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div className={`app ${mode}`}>
    <nav className="section-glider" aria-label="Pohyb mezi částmi stránky">
      <button type="button" aria-label="Předchozí část stránky" title="Nahoru" disabled={sectionIndex === 0} onClick={() => glideTo(pageSections[sectionIndex - 1])}><ArrowUp size={20}/></button>
      <button type="button" aria-label="Další část stránky" title="Dolů" disabled={sectionIndex === pageSections.length - 1} onClick={() => glideTo(pageSections[sectionIndex + 1])}><ArrowDown size={20}/></button>
    </nav>
    <header className="topbar">
      <a className={`brand brand-with-logo is-${logoPhase}`} href="#uvod" aria-label="Kam ven? Úvod" tabIndex={logoPhase === 'hidden' ? -1 : undefined}><img className="header-logo" src="/kam-ven-logo-transparent.png" alt="Kam ven"/><small>PLZEŇSKÝ KRAJ</small></a>
    </header>

    <main id="uvod">
      <section className="hero">
        <div className="hero-content">
          <h1>Ven za<br/><em>přírodou.</em></h1>
          <p>V létě do lesa, v zimě na hory.</p>
        </div>
        <div className="hero-image">{heroPlaces.map((place, index) => <div ref={(node) => { heroSlideRefs.current[index] = node; }} key={place.id} className={`hero-slide ${index === heroIndex ? 'active' : ''} ${index === upcomingHeroIndex ? 'upcoming' : ''}`} style={{ backgroundImage: `url("${heroImageUrl(place)}")` }} aria-hidden="true"/>)}{heroPlaces[heroIndex] && <a className="hero-photo-source" href={heroPlaces[heroIndex].imageSource} target="_blank" rel="noreferrer">{heroPlaces[heroIndex].name} · foto ↗</a>}</div>
      </section>

      <section className="explore" id="objevovat">
        <div className="explorer-shell">
          <div className="controls-panel">
            <div className="mode-switch" role="group" aria-label="Režim výletu"><button className={mode === 'green' ? 'chosen' : ''} onClick={() => setMode('green')} aria-pressed={mode === 'green'}><Sprout size={28}/><span>Za zelení</span></button><button className={mode === 'snow' ? 'chosen' : ''} onClick={() => setMode('snow')} aria-pressed={mode === 'snow'}><Snowflake size={28}/><span>Za sněhem</span></button></div>
            <label className="sr-only" htmlFor="town">Výchozí obec</label><div className="select-wrap"><MapPin size={24} aria-hidden="true"/><strong className="select-value" aria-hidden="true">{town.name}</strong><select id="town" value={townIndex} onChange={(event) => setTownIndex(Number(event.target.value))}>{towns.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select><span className="select-arrow" aria-hidden="true"><ChevronDown size={22} strokeWidth={2.5}/></span></div>
            <div className="range-head"><label className="sr-only" htmlFor="range">Maximální vzdálenost</label><strong ref={rangeLabelRef}>Do {range} km</strong></div><input id="range" className="range-input" type="range" min="0" max={distanceOptions.length - 1} step="1" value={currentRangeIndex} aria-valuetext={`Do ${range} km`} onChange={(event) => setRangeIndex(Number(event.target.value))} style={{'--progress': `${distanceOptions.length === 1 ? 100 : currentRangeIndex / (distanceOptions.length - 1) * 100}%`} as React.CSSProperties}/><div className="range-labels">{distanceOptions.map((distance) => <span key={distance}>{distance}</span>)}</div>
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
          </MapContainer><div className="map-overlay"><LocateFixed size={15}/> {town.name} <span>·</span> {display.length} tipů z {eligibleCount} míst v dosahu</div>{tileError && <div className="map-error" role="status">Mapový podklad se nenačetl. Body výletů zůstávají dostupné v kartách.</div>}
          {selected && <div className="selected-note" role="region" aria-label={`Trasy k místu ${selected.name}`}>
            <div className="selected-note-head"><Compass size={18}/><span><strong>{selected.name}</strong><small>Okolí 250 m · <a href={selected.accessSource} target="_blank" rel="noreferrer">{selected.access === 'Přístupnost není ověřena.' ? 'Další informace' : 'Ověřit přístup'} ↗</a></small></span><button className="selection-close" type="button" onClick={() => setSelectedId(null)} aria-label="Zavřít vybrané místo"><X size={17}/></button></div>
            <div className="route-actions"><a href={directionsUrl(town.coordinates, selected.coordinates, 'walking')} target="_blank" rel="noreferrer">Trasa pěšky <ArrowUpRight size={14}/></a><a href={directionsUrl(town.coordinates, selected.coordinates, 'driving')} target="_blank" rel="noreferrer">Trasa autem <ArrowUpRight size={14}/></a></div>
            <details className="selected-sources"><summary>Zdroje a měření</summary>
              {selectedMeasurement && <p>{mode === 'green' ? `NDVI ${selectedMeasurement.value.toFixed(2).replace('.', ',')}` : `Sníh ${Math.round(selectedMeasurement.value)} %`} · platná plocha {Math.round(selectedMeasurement.validFraction * 100)} % · oblačnost {Math.round(selectedMeasurement.cloudFraction * 100)} % · snímek {new Date(selectedMeasurement.date).toLocaleDateString('cs-CZ')}{mode === 'snow' && isOld(selectedMeasurement.date) && ' · Historický snímek nevypovídá o dnešním sněhu.'}</p>}
              {selectedMeasurement && <><a href={browserUrl(selected, selectedMeasurement)} target="_blank" rel="noreferrer">Zobrazit oblast v Copernicus Browser <ExternalLink size={12}/></a><p title={selectedMeasurement.source}>ID scény: {selectedMeasurement.sceneId}</p></>}
              {selected.imageSource && <a href={selected.imageSource} target="_blank" rel="noreferrer">Foto: {selected.imageCredit} <ExternalLink size={12}/></a>}
              {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Údaje: {selected.sourceLabel ?? 'zdroj'} <ExternalLink size={12}/></a>}
              <a href={selected.osm} target="_blank" rel="noreferrer">Poloha v OpenStreetMap <ExternalLink size={12}/></a>
            </details>
          </div>}</div>
        </div>
      </section>

      <section className="results-section" id="vysledky" aria-label="Výletní cíle" ref={resultsRef}>
        {eligibleCount === 0 && <p className="empty-results">V tomto dosahu zatím nemáme výletní cíl.</p>}
        <div className="cards-viewport" ref={destinationViewportRef} onMouseMove={(event) => { destinationInteractedRef.current = true; stopIdleDrift(); moveDestinationDrift(event.clientX); }} onMouseLeave={() => { destinationInteractedRef.current = false; stopDestinationDrift(); returnDestinationHome(); }} onTouchStart={() => { destinationInteractedRef.current = true; stopIdleDrift(); }} onFocusCapture={() => { destinationInteractedRef.current = true; stopIdleDrift(); }}>
          <div className="cards-track">{display.map((item) => <article className={`place-card js-reveal ${selectedId === item.place.id ? 'selected' : ''}`} key={item.place.id}>
          <button className="card-select" onClick={() => { setSelectedId(item.place.id); document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }} aria-label={`Zobrazit ${item.place.name} na mapě`}>
            <div className={`card-image ${item.place.image ? '' : 'image-placeholder'}`} style={item.place.image ? { backgroundImage: `url("${item.place.image}")` } : undefined}><span className="card-distance" title="Vzdušná vzdálenost">{Math.round(item.distance)} km</span></div>
            <div className="card-body"><h3>{item.place.name}</h3><p>{item.place.description}</p>
              {item.measurement && <div className="card-metric"><MetricSymbols mode={mode} value={item.measurement.value}/></div>}
            </div>
          </button>
          </article>)}</div>
        </div>
      </section>

    </main>
    <div className="final-section" id="zdroje">
      <section className={`method ${methodActive ? 'is-active' : ''}`} id="jak-to-funguje" ref={methodRef}>
        <h2 className="method-heading js-reveal">Jak to funguje</h2>
        <div className="method-camera"><div className="method-world"><SurfaceReflectance/><OrbitMethodVisual/></div></div>
      </section>
      <footer><div className="footer-top"><img className="footer-logo" src="/kam-ven-logo-transparent.png" alt="Kam ven"/><p>Svět čeká za dveřmi.</p></div><div className="footer-bottom"><span>© 2026 KAM VEN?</span><div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a><a href="https://dataspace.copernicus.eu/" target="_blank" rel="noreferrer">Copernicus</a><a href="https://land.copernicus.eu/en/products/snow/fractional-snow-cover" target="_blank" rel="noreferrer">FSC</a><a href="https://www.plzenskykraj-kct.cz/" target="_blank" rel="noreferrer">KČT</a></div></div></footer>
    </div>
  </div>;
}

window.history.scrollRestoration = 'manual';
if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
createRoot(document.getElementById('app')!).render(<App/>);
