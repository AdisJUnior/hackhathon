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

- Interaktivní podklad OpenStreetMap omezený na Plzeňský kraj s malým okrajem. Pevný katalog 300 cílů tvoří pět původních ověřených bodů v `src/places.json`, 289 regionálních bodů z Wikidata v `src/regional-places.json` a šest doplňkových OSM bodů v `src/places-extra.json`. Výchozích obcí je pět. Regionální hranice je v `src/plzen-boundary.json`. GeoJSON má pořadí `[zeměpisná délka, šířka]`; Leaflet používá `[šířka, délka]`.
- Dosah má kroky 5, 15, 35, 65 km a maximum podle nejvzdálenějšího regionálního cíle od zvolené obce. Mapa ukazuje průsvitný kruh dosahu, až šest vybraných míst uvnitř a nejvýše tři tlumené body mimo něj. Při 5 km ukazuje přesně pět míst. Satelitní pořadí TOP dostanou pouze cíle s platným měřením; další tipy se vybírají podle typu místa a vzdálenosti, nikoli podle domnělého NDVI nebo sněhu.
- Pás doporučení ukazuje tři celé karty a okraj další; jemně se posouvá podle polohy kurzoru, po opuštění pásu se plynule vrátí na začátek. Karty ukazují fotografii, vzdálenost zaokrouhlenou na celé kilometry, název, krátký popis a pět lístků nebo vloček. Karty nezobrazují datum ani stav chybějícího měření; bez platného výsledku zůstane prostor pro symboly prázdný. Datum a archivní charakter zimního snímku jsou dohledatelné v detailu místa. Přesná hodnota, kvalita, foto kredit a odkazy jsou po výběru místa v rozbalitelných zdrojích nad mapou.

Symboly jsou pouze orientační zobrazení naměřené hodnoty, nikoli další satelitní ukazatel. U NDVI se lístek rozsvítí po překročení hranic 0,2 / 0,4 / 0,55 / 0,7 / 0,8. U sněhu odpovídá jedna vločka každým započatým 20 %; při 0 % jsou všechny ztlumené. Přesná číselná hodnota a zdroj jsou po výběru místa v panelu mapy.
- Po výběru karty nebo bodu se mapa zaměří na místo, vykreslí kruh 250 m a ukáže panel tras přímo nad mapou.
- Vybrané místo nabízí odkazy na pěší a automobilovou trasu z výchozí obce v Google Maps. Samotná trasa a navigace běží v Google Maps; aplikace zatím nekreslí cestu ve své mapě.
- Zdrojové odkazy pro polohu, přístup a fotografie jsou v panelu vybraného místa nad mapou. Údaje o přístupu neověřují dnešní provoz nebo uzavírky.

## Pevný katalog 300 míst a Neon

Katalog má přesně 300 bodů; devět vyřazených záznamů a důvody jsou v `data/destination-curation.json`. Test hlídá počet i otisk ID a souřadnic, takže náhodné přidání, odebrání nebo posun bodu neprojde. `scripts/import-plzen-places.mjs` ukládá nově nalezené body pouze jako kandidáty do `data/places-candidates.json` a automaticky nemění katalog aplikace.

`db/001_frozen_destinations.sql` obsahuje schéma a jednorázové vložení stejných 300 bodů do PostgreSQL. Po vložení zapne databázové triggery, které odmítnou další přidávání, úpravy i mazání bodů; záměrná změna by vyžadovala samostatnou kontrolovanou migraci. Ve větvi `production` projektu Neon je katalog již založený a uzamčený. Připojovací řetězec patří pouze do ignorovaného `.env.local` nebo tajných proměnných hostingu; Vite frontend ho nesmí dostat.

Satelitní historie se při synchronizaci ukládá do lokálního SQLite a skript `scripts/push-neon.ps1` ji průběžně přenáší do Neonu. Součástí přenosu jsou i prověřené scény a poslední pokusy o synchronizaci; opakovaný běh nevytváří duplicitní měření. Prohlížeč zatím čte verzovaný `src/measurements.json` ze sestavení, nikoli živě z Neonu. Po obnově dat je pro veřejný web nutné sestavit a nasadit novou verzi nebo doplnit bezpečný čtecí endpoint.

## Import předpočítaných výsledků

### Automatická obnova přes Copernicus

Příkaz `pnpm sync:data` prochází [Sentinel‑2 L2A](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html) a [FSC Europe 20m](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/bio-geophysical-parameters/snow/snow-cover-extent/clms_wsi_fractional-snow-cover_europe_utm_20m_daily_v2.html). U míst bez výsledku hledá NDVI až 180 dnů zpět. Pro sníh bere **pouze snímky od 1. prosince do posledního dne února**; pokud nejnovější zima nemá přijatý výsledek, může prověřit i předchozí zimu. Podzimní měření zůstávají v historii, ale neukazují se jako zimní doporučení. Prochází všech 300 cílů v průběžné frontě. Běžný běh zpracuje nejvýše 60 dvojic místo/režim a 40 statistických dotazů, až dvě scény na dvojici. Archivní `node .\scripts\copernicus-sync.mjs --backfill` zpracuje nejvýše 120 dvojic a 80 statistických dotazů, až tři scény na dvojici; `--green-only` nebo `--snow-only` omezí režim. Přepínač `--places=cerchov,pancir` umožní cíleně prozkoumat vybraná místa a `--scenes=5` počet zkoušených scén. Metadata o oblačnosti celé dlaždice pomáhají pořadí hledání, konečné přijetí určuje kvalita přímo v kruhu. Odmítnuté scény si skript pamatuje v SQLite. Používá OAuth klienta Copernicus Data Space a [Sentinel Hub Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html). Počítá medián NDVI nebo průměr FSCOG v kruhu 250 m; vyžaduje nejméně 70 % platné plochy, nejvýše 30 % oblačnosti a alespoň 20 platných pixelů. Nevyhovující snímek zahodí a ponechá starší kvalitní měření. Historický zimní snímek se v aplikaci označí jako archivní a nevypovídá o aktuálním stavu sněhu.

V [Copernicus Data Space](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html) založte OAuth klienta. Jeho `client_id` a `client_secret` nastavte jako uživatelské proměnné prostředí. Pro jednorázový běh v PowerShellu:

Alternativně lze údaje uložit do souboru `.env.local` v kořeni projektu jako dva řádky `CDSE_CLIENT_ID=...` a `CDSE_CLIENT_SECRET=...`. Soubor je v `.gitignore`, nesmí se zveřejnit ani nahrát na hosting; synchronizační skript jej načte sám. Hodnoty z `.env.local` mají při běhu přednost před uživatelskými proměnnými prostředí.

```powershell
$env:CDSE_CLIENT_ID = 'váš-client-id'
$env:CDSE_CLIENT_SECRET = 'váš-client-secret'
pnpm sync:data
pnpm build
```

Stejný jednorázový běh bez pnpm: `node .\scripts\copernicus-sync.mjs`. Při Windows PowerShellu 5.1 spusťte denní plánovač příkazem `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-schedule.ps1`.

Cílený archivní běh pouze pro sníh lze spustit například `node .\scripts\copernicus-sync.mjs --snow-only --backfill --as-of 2026-02-28`. Datum určuje konec prohledávaného období; vždy se vybírají jen prosincové až únorové snímky. Hodnoty projdou stejnou kontrolou kvality a uloží se s původním datem snímku.

Synchronizace ukládá historii do ignorované lokální databáze `data/measurements.sqlite` a poslední platný výsledek pro každý cíl a režim exportuje do `src/measurements.json`. Prohlížeč nečte SQLite přímo; export se do aplikace přibalí při sestavení. `scripts/run-sync.ps1` provede synchronizaci, kontrolu TypeScriptu, sestavení a přenos historie do Neonu přes `scripts/push-neon.ps1`. Poslední skript používá již přihlášené Neon CLI a ignorovaný projektový soubor `.neon`; lze jej spustit také samostatně po archivním běhu. `scripts/install-schedule.ps1` zakládá denní úlohu `KamVenCopernicusSync` na 06:00. Po nasazení je nutné nově sestavenou verzi ještě zveřejnit.

Pokud chcete diagnostikovat nedostatek měření, spusťte z kořene projektu `node .\scripts\copernicus-sync.mjs` a sdílejte pouze výpis o přijatých/vyřazených scénách a souhrnný řádek. Neposílejte `.env.local`, OAuth token ani URL databáze. Jeden běžný běh zpracuje nejvýše 60 dvojic místo/režim z celkových 600; zamítnutí pro oblačnost či nízkou platnou plochu není chyba importu. Při přijetí měření se ukládá i UTC čas pořízení, pokud jej katalog poskytuje; čas uložení výsledku je samostatný údaj.

Testy ověřují sestavení kruhu, interpretaci statistik, oblačnostní práh, nulový sníh a uchování posledního kvalitního záznamu v SQLite. Samotná přítomnost záznamu v katalogu ani nízká oblačnost celé dlaždice nestačí: rozhoduje platná plocha a oblačnost přímo v 250m kruhu. Skript přeskočí den s více katalogovými položkami v oblasti, aby denní mozaiku nepřipsal náhodné scéně. API může mít kvóty a zpoždění publikace; neúspěšný dotaz se vypíše a starší data zůstanou zachována.

Živé běhy přijaly skutečná NDVI i některá zimní FSC měření pro část katalogu; přesný aktuální počet je v exportu `src/measurements.json` a pohledu `destination_satellite_overview` v Neonu. Chybějící data se nenahrazují nulou ani odhadem. Mnoho FSC scén zatím neprošlo kvůli nulovému pokrytí, nízkému podílu platných pixelů nebo vysoké oblačnosti. [Copernicus navíc oznámil přerušení výroby HR‑WSI od 6. 11. 2026](https://land.copernicus.eu/en/production-updates/temporary-service-interruption-for-the-high-resolution-water-snow-and-ice-products), takže nová zimní data mohou mít zpoždění. Při [omezení požadavků API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/RateLimiting.html) synchronizace čte `Retry-After`, čeká a dotaz opakuje; po opakovaném odmítnutí končí s chybovým stavem. Stará kvalitní hodnota se v detailu místa zobrazí s původním datem; do TOP se řadí pouze měření ze srovnatelného období 14 dnů.

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
