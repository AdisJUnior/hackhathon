# Zdroje a dostupnost dat

Ověřeno 13. 11. 2026. Původní `SOURCES.md` v repozitáři obsahoval omylem kopii `tsconfig.json`, nikoli seznam zdrojů. Níže je přehled pěti adres dodaných zadavatelem a návazných služeb.

| Zdroj | Co poskytuje | Formát / dostupnost | Použití v aplikaci |
|---|---|---|---|
| [Hackathon Pohled z vesmíru](https://hpk.maleskoly.info/) | Zadání a rozcestník na krajská, národní a družicová data | Webová stránka, bez přímého datového API | Kontext projektu |
| [Otevřená data Plzeňského kraje](https://opendata.plzensky-kraj.cz/) | Seznam obcí, památky, přírodní parky a další sady | `download/?type=obce` a `download/?type=pamatky` odpověděly 200 jako CSV (cca 33 kB a 6,2 MB); `prirodniparky` v přímém dotazu vrátilo HTML. CSV obcí má název, UIR a adresní údaje, nikoliv GPS bod obce. | Kandidát pro budoucí rozšíření, v aplikaci se nyní nepoužívá |
| [Národní katalog dat](https://data.gov.cz/) | Metadatový katalog českých otevřených dat | Webový katalog a odkazy na distribuce; není satelitním API | Vyhledání dalších sad v budoucnu |
| [Copernicus Data Space](https://dataspace.copernicus.eu/) | Sentinel‑2 L2A, katalogy a zpracovací služby | [STAC API](https://documentation.dataspace.copernicus.eu/APIs/STAC.html), [kolekce Sentinel‑2 L2A](https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a), rastry v produktech | Definovaný zdroj budoucího výpočtu NDVI, zatím bez vypočítaných hodnot |
| [KČT Plzeňského kraje](https://www.plzenskykraj-kct.cz/) | Tipy na výlety, aktuální změny a neprůchodnost značených tras | Web, bez ověřeného veřejného strojového API | Odkaz k ověření aktuálního přístupu; data tras nejsou kopírována |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) / [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) | Geografické body a geokódování | OSM prvky, JSON API, ODbL; [dlaždice](https://operations.osmfoundation.org/policies/tiles/) vyžadují uvedení původu a odpovídající URL | Živý mapový podklad; pět ručně vybraných míst v `src/places.json`, další blízké body v `src/places-extra.json`, pět obcí v `src/data.ts`. Žádné živé geokódování v aplikaci |
| [Copernicus Fractional Snow Cover](https://land.copernicus.eu/en/products/snow/fractional-snow-cover) | Podíl sněhu v 20m pixelech ze Sentinel‑2, Evropa | Raster, katalog CDSE; některé dlaždice mohou při migraci chybět | Definovaný zdroj budoucího výpočtu sněhu, zatím bez vypočítaných hodnot |
| [Wikimedia Commons](https://commons.wikimedia.org/) | Fotografie konkrétních lokalit | Náhledy v aplikaci s odkazy na autory a licence jednotlivých souborů | Karty míst; odkazy a kredity v `src/places.json` |

## Doplňující zdroje z přiloženého textu

Tyto adresy a produkty byly doplněny a ověřeny 13. 11. 2026. OpenStreetMap, Sentinel‑2 L2A a 20m Fractional Snow Cover už byly uvedené výše; zde jsou jejich užitečná konkrétní rozhraní a alternativy.

| Zdroj | Formát a možnosti | Vztah k aplikaci |
|---|---|---|
| [Overpass Turbo](https://overpass-turbo.eu/) / [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | Webový editor dotazů nad OSM; API vrací OSM JSON nebo XML, veřejné instance mají provozní omezení | Pět stávajících OSM ID bylo při auditu ověřeno dávkovým dotazem Overpass. Běhové volání Overpass aplikace nedělá. |
| [Sentinel Hub](https://www.sentinel-hub.com/) a [CDSE Sentinel Hub API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview.html) | Služby Catalog, Processing a [Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html); Statistical API umí vracet JSON statistiky pro polygon, maskovat pixely a počítat percentil 50 (medián). Pro volání je potřeba autentizace CDSE/OAuth. | Perspektivní cesta k automatickému výpočtu NDVI nad 250m kruhy; v této verzi bez přihlašovacích údajů není napojena. |
| [Dokumentace Copernicus Data Space](https://documentation.dataspace.copernicus.eu/) | Oficiální dokumentace STAC, OData, Sentinel Hub a produktů | Technický podklad pro importní a pozdější automatizační proces. |
| [Gap-filled Fractional Snow Cover](https://land.copernicus.eu/en/products/snow/high-resolution-gap-filled-fractional-snow-cover) | Denní evropský rastr s prostorovým rozlišením 60 m; mezery ve sněhových pozorováních jsou doplněné | Možná zimní alternativa tam, kde má 20m FSC výpadky. V importu je nutné produkt jasně odlišit ve `source` a nepovažovat dopočtenou hodnotu za přímé pozorování. |

## Satelitní metodika pro import

Žebříček porovnává jen výsledky nejvýše 14 dnů od nejnovějšího platného snímku a vyžaduje známý podíl oblačnosti.

Přímým dotazem do [CDSE STAC](https://stac.dataspace.copernicus.eu/v1/collections) byly ověřeny kolekce `sentinel-2-l2a` a `clms_wsi_fractional-snow-cover_europe_utm_20m_daily_v2`. Pro Sentinel‑2 v oblasti byl nalezen skutečný katalogový záznam včetně aktiv B04, B08 a SCL; jeho JP2 aktiva ale nejsou veřejným bezautentizačním podkladem pro aplikaci. U FSC v testovaných dotazech kolekce `/items` vrátila nula položek; z toho nelze odvozovat, že data neexistují, pouze že touto cestou nebylo možné získat měření. [Dokumentace S2 L2A](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html) uvádí B04/B08 v 10 m a SCL ve 20 m; vrstvy se proto musí prostorově zarovnat.

Pro NDVI použít Sentinel‑2 L2A a vzorec `(B08 - B04) / (B08 + B04)`. Scény vyhledat přes STAC, vybrat společné či blízké datum pro všechna místa, maskovat oblačnost a neplatné pixely pomocí vrstvy SCL. Kruhy 250 m převést do vhodné metrické projekce, z platných pixelů vzít medián. U FSC použít [produkt Fractional Snow Cover](https://land.copernicus.eu/en/products/snow/fractional-snow-cover), konkrétně vrstvu **FSCOG** (sníh na zemi), hodnoty platných pixelů v kruhu zprůměrovat. Podle [produktového manuálu](https://land.copernicus.eu/en/technical-library/product-user-manual-high-resolution-snow-products-europe/@@download/file) jsou 0–100 procenta, 205 mrak/stín, 210 voda a 255 bez dat; QA 0/1 představují lepší kvalitu. FSCTOC měří sníh na povrchu korun, NDSI je jiný index. Scény a pixely se nesmějí nahrazovat nulami. Pro každý výsledek uložit identifikátor scény, datum, podíl platné plochy, oblačnost a zdroj. Atribuce Copernicus viz [CLMS data policy](https://land.copernicus.eu/en/data-policy).

Aktuální export `src/measurements.json` obsahuje dva předpočítané NDVI ze skutečných scén Sentinel‑2 L2A: Prášilské jezero (5. 11. 2026) a místo `wd-Q123190997` (13. 11. 2026). Zimní FSC zatím nemá přijatý výsledek ani po cílené kontrole scén z prosince 2025 až března 2026: zkoušené kruhy měly nulové pokrytí, málo platných pixelů nebo příliš vysokou oblačnost. Synchronizace nyní při chybějícím výsledku prohledává postupně NDVI až 90 dnů a FSC až 365 dnů zpět; starý výsledek bude v aplikaci označen datem, zimní jako archivní. Ukázkové hodnoty byly odstraněny z produkční aplikace. KČT upozorňuje na aktuální změny a uzavírky tras; obecné poznámky o přístupu v aplikaci nejsou terénním ověřením.

Aktualizační skript `scripts/copernicus-sync.mjs` používá [CDSE OAuth](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html), [Sentinel Hub Catalog](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Catalog.html) a [Statistical API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html). Pro zimní režim je ověřen konkrétní [FSC Europe 20m Daily V2 BYOC produkt](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/bio-geophysical-parameters/snow/snow-cover-extent/clms_wsi_fractional-snow-cover_europe_utm_20m_daily_v2.html) s ID `2bb9974a-0eb8-484d-adf1-20cc307021b6`, vrstvami `FSCOG` a `FSCOG_QA`. Připojení bylo živě ověřeno; FSC dotazy pro aktuálně zkoušené scény nevrátily dostatek použitelné plochy pro žebříček.

Přímý odkaz na položku `sh.dataspace.copernicus.eu/catalog/v1/...` vyžaduje OAuth token a v běžném prohlížeči vrací 401. Proto karta vede do veřejného [Copernicus Browser](https://github.com/eu-cdse/copernicus-browser/blob/main/public/deep-linking.txt) na polohu a datum; v zeleném režimu otevírá ověřené ID sady `S2_L2A_CDAS` a vrstvu `3_NDVI`. Browser může zobrazit denní vizualizaci, nikoliv nutně přesně jedinou scénu použitou pro statistiku. Její ID zůstává v detailu karty a technický URL v exportu měření. Pro FSC se otevře poloha a datum a produkt je třeba v Browseru zvolit ručně.
# Inspirace pro výběr cílů v Plzeňském kraji (doplněno 13. 11. 2026)

Následující odkazy dodal uživatel. Slouží k výběru zajímavých přírodních a zimních výletů; souřadnice, satelitní měření ani práva k fotografiím z nich nepřebíráme bez samostatného ověření.

| Zdroj | Využití |
| --- | --- |
| [GetYourGuide – příroda a dobrodružství v Česku](https://www.getyourguide.com/cs-cz/cesko-l169019/priroda-a-dobrodruzstvi-tc35/) | Inspirace k typům výletů; komerční nabídky nejsou zdrojem geografických souřadnic. |
| [Kudy z nudy – 100 přírodních zajímavostí](https://www.kudyznudy.cz/aktuality/100-prirodnich-zajimavosti-ktere-musite-videt) | Výběr významných přírodních cílů napříč ČR. |
| [Invia – nejkrásnější přírodní místa v ČR](https://www.invia.cz/blog/nejkrasnejsi-prirodni-mista-v-ceske-republice/) | Další náměty pro přírodní cíle. |
| [BENEcamp – zimní cestování v ČR](https://www.benecamp.cz/post/top-10-m%C3%ADst-v-%C4%8Dr-pro-zimn%C3%AD-cestov%C3%A1n%C3%AD) | Inspirace pro zimní režim; počasí a sníh se ověřují satelitními daty. |
| [Střední Čechy – zimní výlety do přírody](https://www.strednicechy.cz/kam-vyrazit-v-zime-do-prirody-10-tipu-na-vylety-i-sport/) | Tipy na cíle a trasy ve Středočeském kraji. |

Regionální katalog s fotografiemi je vyfiltrován z [GeoJSON turistických cílů DatováMapa.cz / Wikidata](https://datovamapa.cz/mapa/wikidata/turisticke-cile) (CC0; nepravidelná aktualizace). Stažený vstup je v `data/wikidata-tourism.geojson`; reprodukovatelný filtr v `scripts/import-plzen-places.mjs` tvoří `src/regional-places.json`. Další blízké body jsou ověřeny v [OpenStreetMap turistické vrstvě](https://services-eu1.arcgis.com/zci5bUiJ8olAal7N/arcgis/rest/services/OSM_EU_Tourism/FeatureServer/0). Přesnou regionální hranici poskytuje [geoBoundaries ADM1 / ČÚZK](https://www.geoboundaries.org/api.html) (CC BY 4.0); zjednodušený polygon je v `src/plzen-boundary.json`. Články výše slouží k inspiraci, souřadnice a fotografie pocházejí z otevřených datasetů.

