# Kam ven v Plzeňském kraji?

Responzivní mapa pěti skutečných výletních cílů. Vybírá podle výchozí obce a vzdušné vzdálenosti. Žebříček podle vegetace či sněhu se zapne jen při dodání výsledků; **výchozí instalace žádné skutečné satelitní měření neobsahuje**. Zpráva o ověření je v [AUDIT.md](AUDIT.md), přehled zdrojů v [SOURCES.md](SOURCES.md).

## Spuštění

Vyžaduje Node.js 22+ a pnpm.

```bash
pnpm install
pnpm dev
```

Otevřete adresu vypsanou Vite (obvykle `http://localhost:5173`). Testy a sestavení:

```bash
pnpm test
pnpm build
```

## Co lze nyní používat

- Interaktivní podklad OpenStreetMap, pět ručně vybraných a ověřených míst v `src/places.json` (GeoJSON) a pět výchozích obcí. GeoJSON má pořadí `[zeměpisná délka, šířka]`; Leaflet používá `[šířka, délka]`.
- Výpočet vzdušné vzdálenosti, filtr 5–100 km a nejvýše tři tipy. Při absenci měření jde o nejbližší cíle, **ne o satelitní žebříček**.
- Volitelný demonstrační režim se smyšlenými NDVI a FSC hodnotami; v UI je výslovně označen.
- Po výběru karty nebo bodu se mapa zaměří na místo a vykreslí kruh 250 m.
- Zdrojové odkazy pro polohu, přístup a fotografie jsou v kartách. Údaje o přístupu neověřují dnešní provoz nebo uzavírky.

## Import předpočítaných výsledků

Pro případ, že externí proces již vypočetl statistiky z **reálných** rastrů, připravte JSON pole a spusťte:

```bash
pnpm import:measurements -- cesta/k/vysledkum.json
```

Tvar jednoho záznamu (zde jen schéma s ilustračními čísly, **nikoliv měření**):

```json
{
  "placeId": "cerchov",
  "mode": "green",
  "value": 0.62,
  "date": "2026-08-30",
  "validFraction": 0.85,
  "cloudFraction": 0.08,
  "source": "https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a/items/ID_SCENY",
  "provenance": "precomputed",
  "sceneId": "ID_SCENY",
  "product": "S2-L2A-NDVI",
  "statistic": "median",
  "radiusMeters": 250
}
```

Pro sníh použijte `mode: "snow"`, `product: "CLMS-FSC-20M"`, `statistic: "mean"` a `value` v procentech 0–100. U NDVI je rozsah −1 až 1. Oba režimy vyžadují `validFraction >= 0.7`, `cloudFraction <= 0.3`, platné datum, ID scény a HTTPS zdroj. Scény v žebříčku se musí vejít do 14 dnů od nejnovějšího výsledku. Import kontroluje schéma a meze, **neumí ověřit pravost vložených dat ani stáhnout zdrojový raster**; původ měření musí doložit provozovatel. Zapisuje do `src/measurements.json`, které se načítá při sestavení aplikace.

## Výpočet ze zpracovaných pixelů

Samostatná cesta přijímá export kompletní mřížky středů pixelů v okolí každého místa:

```bash
pnpm process:scenes -- cesta/ke/scenam.json
```

Vstupem je JSON pole objektů `{ "placeId", "mode", "date", "sceneId", "source", "pixels" }`. Jeden zelený pixel má `{ "latitude": 49.38, "longitude": 12.78, "B04": 1000, "B08": 3000, "SCL": 4 }`; sněhový pixel má `{ "latitude": 49.38, "longitude": 12.78, "FSCOG": 0, "FSCOG_QA": 0 }`. Souřadnice v příkladech popisují pouze formát, **ne skutečnou mřížku ani pozorování**. Prázdné či chybějící hodnoty mají být `null`; cloudové a neplatné pixely musejí zůstat v mřížce, aby šlo spočítat skutečný podíl vyhodnotitelné plochy.

Výpočet `src/satellite.ts` vezme středy pixelů do 250 m od GeoJSON bodu. Pro Sentinel‑2 L2A počítá `(B08-B04)/(B08+B04)` a medián po maskování SCL tříd 0, 1, 3, 7, 8, 9, 10. Pro 20m Fractional Snow Cover používá **FSCOG**, hodnoty 0–100 a pouze QA 0/1; kódy 205, 210 a 255 nejsou procenta. Z platných pixelů bere průměr. Nulový sníh je platný výsledek. Měření s méně než 70 % platných pixelů nebo nad 30 % oblačnosti zahodí. V současné podobě jde o statistiku podle středů pixelů, nikoli přesně plošně vážený průnik rasteru a kruhu.

**Důležitá hranice důvěry:** procesor nedokáže z JSON dokázat úplnost mřížky, georeferenci ani pravost `source` a `sceneId`. Před importem je nutné samostatně stáhnout autentické produkty, vyříznout pásma/vrstvy, sjednotit rozlišení a georeferenci a zachovat všechny pixely kruhu včetně neplatných. Automatické stažení a dekódování JP2/GeoTIFF v této verzi není implementováno. Soubor `src/measurements.json` je záměrně `[]`; ukázková čísla se do něj nevkládají.

## Struktura

- `src/places.json`: statický GeoJSON s OSM odkazy a fotografiemi.
- `src/data.ts`: datové typy, obce a oddělená smyšlená demonstrační data.
- `src/recommend.ts`: vzdálenosti, kvalita, časové okno a řazení.
- `src/satellite.ts`: výpočty nad dodanými pixely.
- `scripts/process-scenes.mjs`, `scripts/import-measurements.mjs`: příprava předpočítaných výsledků.
- `src/main.tsx`, `src/style.css`: mapa a rozhraní.

Další krok pro datově funkční verzi je autentizovaný sběr scén Sentinel‑2 a FSC, dekódování rastrů v jednotném CRS a reprodukovatelný výpočet nad kruhy, včetně průběžné kontroly licence a aktuálnosti. Samotná instalace této verze je vhodná k ukázce mapy a výpočtového toku v demonstračním režimu; nelze z ní vyvozovat aktuální stav zeleně ani sněhu.
