# Kam ven v Plzeňském kraji?

Responzivní mapa výletních cílů v Plzeňském kraji. Vybírá podle výchozí obce a vzdušné vzdálenosti. Satelitní pořadí používá pouze výsledky z Copernicus synchronizace či ověřeného importu; ostatní cíle se zobrazují jako tipy bez měření. Stav zdrojů je v [SOURCES.md](SOURCES.md); původní audit a jeho dodatky v [AUDIT.md](AUDIT.md).

## Spuštění

Vyžaduje Node.js 24+ a pnpm (synchronizace používá vestavěný `node:sqlite`).

```bash
pnpm install
pnpm dev
```

Otevřete adresu vypsanou Vite (obvykle `http://localhost:5173`). Testy a sestavení:

```bash
pnpm test
pnpm build
```

Pokud `pnpm` ve Windows není nainstalované, pro synchronizaci stačí `node .\scripts\copernicus-sync.mjs`. Plánovací skripty používají přímo Node a lokálně nainstalované TypeScript/Vite, takže `pnpm` pro ně není nutné. Pro první instalaci závislostí lze použít `npm install`.

## Co lze nyní používat

- Interaktivní podklad OpenStreetMap omezený na Plzeňský kraj s malým okrajem. Pět původních ověřených bodů v `src/places.json`, regionální výběr z Wikidata v `src/regional-places.json`, doplňkové OSM body v `src/places-extra.json` a pět výchozích obcí. Regionální hranice je v `src/plzen-boundary.json`. GeoJSON má pořadí `[zeměpisná délka, šířka]`; Leaflet používá `[šířka, délka]`.
- Dosah má kroky 5, 15, 35, 65 km a maximum podle nejvzdálenějšího regionálního cíle od zvolené obce. Mapa ukazuje průsvitný kruh dosahu, až sedm vybraných míst uvnitř a nejvýše tři tlumené body mimo něj. Při 5 km ukazuje přesně pět míst. Satelitní pořadí TOP dostanou pouze cíle s platným měřením; další tipy se vybírají podle typu místa a vzdálenosti, nikoli podle domnělého NDVI nebo sněhu.
- Karty vyjadřují míru zeleně pěti lístky a sníh pěti vločkami. Stručná karta ukazuje přesnou hodnotu a datum; kvalita, foto kredit a odkazy jsou v rozbalitelných podrobnostech. Bez platného výsledku se symboly nevykreslí.

Symboly jsou pouze orientační zobrazení naměřené hodnoty, nikoli další satelitní ukazatel. U NDVI se lístek rozsvítí po překročení hranic 0,1 / 0,3 / 0,5 / 0,7 / 0,85. U sněhu odpovídá jedna vločka každým započatým 20 %; při 0 % jsou všechny ztlumené. Číselná hodnota zůstává na kartě kvůli přesnosti a dohledatelnosti.
- Po výběru karty nebo bodu se mapa zaměří na místo, vykreslí kruh 250 m a ukáže panel tras přímo nad mapou.
- Vybrané místo nabízí odkazy na pěší a automobilovou trasu z výchozí obce v Google Maps. Samotná trasa a navigace běží v Google Maps; aplikace zatím nekreslí cestu ve své mapě.
- Zdrojové odkazy pro polohu, přístup a fotografie jsou v kartách. Údaje o přístupu neověřují dnešní provoz nebo uzavírky.

## Import předpočítaných výsledků

### Automatická obnova přes Copernicus

Příkaz `pnpm sync:data` prochází [Sentinel‑2 L2A](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html) a [FSC Europe 20m](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/bio-geophysical-parameters/snow/snow-cover-extent/clms_wsi_fractional-snow-cover_europe_utm_20m_daily_v2.html). U míst bez výsledku hledá NDVI až 90 dnů zpět a FSC až 365 dnů; u již změřených míst kontroluje novějších 30 dnů. Prochází všech 309 cílů ve střídající se frontě, nejdříve přírodní místa. Kvůli kvótám zpracuje nejvýše 24 dvojic místo/režim a 16 statistických dotazů za běh, vždy nejvýše jeden nový snímek na dvojici. Odmítnuté scény si pamatuje v SQLite. Používá OAuth klienta Copernicus Data Space a [Sentinel Hub Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html). Počítá medián NDVI nebo průměr FSCOG v kruhu 250 m; vyžaduje nejméně 70 % platné plochy, nejvýše 30 % oblačnosti a alespoň 20 platných pixelů. Nevyhovující snímek zahodí a ponechá starší kvalitní měření. Historický zimní snímek se v aplikaci označí jako archivní a nevypovídá o aktuálním stavu sněhu.

V [Copernicus Data Space](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html) založte OAuth klienta. Jeho `client_id` a `client_secret` nastavte jako uživatelské proměnné prostředí. Pro jednorázový běh v PowerShellu:

Alternativně lze údaje uložit do souboru `.env.local` v kořeni projektu jako dva řádky `CDSE_CLIENT_ID=...` a `CDSE_CLIENT_SECRET=...`. Soubor je v `.gitignore`, nesmí se zveřejnit ani nahrát na hosting; synchronizační skript jej načte sám. Hodnoty z `.env.local` mají při běhu přednost před uživatelskými proměnnými prostředí.

```powershell
$env:CDSE_CLIENT_ID = 'váš-client-id'
$env:CDSE_CLIENT_SECRET = 'váš-client-secret'
pnpm sync:data
pnpm build
```

Stejný jednorázový běh bez pnpm: `node .\scripts\copernicus-sync.mjs`. Při Windows PowerShellu 5.1 spusťte denní plánovač příkazem `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-schedule.ps1`.

Cílený archivní běh pouze pro sníh lze spustit například `node .\scripts\copernicus-sync.mjs --snow-only --as-of 2026-02-28`. Datum určuje konec prohledávaného období; hodnoty projdou stejnou kontrolou kvality a uloží se s původním datem snímku.

Synchronizace ukládá historii do ignorované lokální databáze `data/measurements.sqlite` a poslední platný výsledek pro každý cíl a režim exportuje do `src/measurements.json`. Prohlížeč nečte SQLite přímo; export se do aplikace přibalí při sestavení. Pro lokální denní běh na Windows slouží `scripts/run-sync.ps1` (synchronizace + sestavení) a `scripts/install-schedule.ps1`. Úloha `KamVenCopernicusSync` je na tomto počítači naplánována denně na 06:00. Po nasazení je nutné nově sestavenou verzi ještě zveřejnit.

Testy ověřují sestavení kruhu, interpretaci statistik, oblačnostní práh, nulový sníh a uchování posledního kvalitního záznamu v SQLite. Samotná přítomnost záznamu v katalogu ani nízká oblačnost celé dlaždice nestačí: rozhoduje platná plocha a oblačnost přímo v 250m kruhu. Skript přeskočí den s více katalogovými položkami v oblasti, aby denní mozaiku nepřipsal náhodné scéně. API může mít kvóty a zpoždění publikace; neúspěšný dotaz se vypíše a starší data zůstanou zachována.

Živé běhy dosud přijaly NDVI pro Prášilské jezero (5. 11. 2026) a jeden nově přidaný cíl (13. 11. 2026). Pro ostatní místa a zimní režim zatím nemusí být přijatý výsledek; chybějící data se nenahrazují nulou ani odhadem. Archivní FSC dotazy za prosinec 2025 až březen 2026 ukázaly nulové pokrytí, příliš malý podíl platných pixelů nebo vysokou oblačnost. [Omezení požadavků API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/RateLimiting.html) vyvolalo při prvním běhu HTTP 429; synchronizace při 429 skončí s chybovým stavem. Stará kvalitní hodnota se v kartě zobrazí s původním datem; do TOP se řadí pouze měření ze srovnatelného období 14 dnů.

### Ruční import

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

**Důležitá hranice důvěry ručního importu:** procesor dodaného JSON nedokáže sám prokázat úplnost mřížky, georeferenci ani pravost `source` a `sceneId`. Před ručním importem je nutné zajistit autentické produkty, sjednotit rozlišení a zachovat všechny pixely kruhu včetně neplatných. Automatická synchronizace používá přímo Statistical API, které rastry zpracovává na straně Copernicu.

## Struktura

- `src/places.json`: statický GeoJSON s OSM odkazy a fotografiemi.
- `src/data.ts`: datové typy a výchozí obce.
- `src/recommend.ts`: vzdálenosti, kvalita, časové okno a řazení.
- `src/satellite.ts`: výpočty nad dodanými pixely.
- `scripts/process-scenes.mjs`, `scripts/import-measurements.mjs`: příprava předpočítaných výsledků.
- `src/main.tsx`, `src/style.css`: mapa a rozhraní.

Další krok je získat kvalitní pokrytí dalších míst a zimní FSC, průběžně kontrolovat shodu statistik s produkty a připojit sestavení k nasazení. Aplikace nezobrazuje žádné vymyšlené hodnoty.
