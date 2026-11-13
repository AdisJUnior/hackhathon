# Zdroje a dostupnost dat

Ověřeno 13. 11. 2026. Původní `SOURCES.md` v repozitáři obsahoval omylem kopii `tsconfig.json`, nikoli seznam zdrojů. Níže je přehled pěti adres dodaných zadavatelem a návazných služeb.

| Zdroj | Co poskytuje | Formát / dostupnost | Použití v aplikaci |
|---|---|---|---|
| [Hackathon Pohled z vesmíru](https://hpk.maleskoly.info/) | Zadání a rozcestník na krajská, národní a družicová data | Webová stránka, bez přímého datového API | Kontext projektu |
| [Otevřená data Plzeňského kraje](https://opendata.plzensky-kraj.cz/) | Seznam obcí, památky, přírodní parky a další sady | `download/?type=obce` a `download/?type=pamatky` odpověděly 200 jako CSV (cca 33 kB a 6,2 MB); `prirodniparky` v přímém dotazu vrátilo HTML. CSV obcí má název, UIR a adresní údaje, nikoliv GPS bod obce. | Kandidát pro budoucí rozšíření, v aplikaci se nyní nepoužívá |
| [Národní katalog dat](https://data.gov.cz/) | Metadatový katalog českých otevřených dat | Webový katalog a odkazy na distribuce; není satelitním API | Vyhledání dalších sad v budoucnu |
| [Copernicus Data Space](https://dataspace.copernicus.eu/) | Sentinel‑2 L2A, katalogy a zpracovací služby | [STAC API](https://documentation.dataspace.copernicus.eu/APIs/STAC.html), [kolekce Sentinel‑2 L2A](https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-l2a), rastry v produktech | Definovaný zdroj budoucího výpočtu NDVI, zatím bez vypočítaných hodnot |
| [KČT Plzeňského kraje](https://www.plzenskykraj-kct.cz/) | Tipy na výlety, aktuální změny a neprůchodnost značených tras | Web, bez ověřeného veřejného strojového API | Odkaz k ověření aktuálního přístupu; data tras nejsou kopírována |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) / [Nominatim](https://nominatim.org/release-docs/latest/api/Search/) | Geografické body a geokódování | OSM prvky, JSON API, ODbL; [dlaždice](https://operations.osmfoundation.org/policies/tiles/) vyžadují uvedení původu a odpovídající URL | Živý mapový podklad; pět ručně vybraných míst v `src/places.json`, pět obcí v `src/data.ts`. Žádné živé geokódování v aplikaci |
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

Aktuální verze **neobsahuje žádný skutečně spočítaný satelitní výsledek**. `src/measurements.json` je prázdný. Demonstrační režim používá záměrně smyšlená data výhradně k vyzkoušení rozhraní a je viditelně označený. KČT upozorňuje na aktuální změny a uzavírky tras; obecné poznámky o přístupu v aplikaci nejsou terénním ověřením.
