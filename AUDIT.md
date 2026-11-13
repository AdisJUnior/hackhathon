# Technický audit aplikace Kam ven v Plzeňském kraji?

**Dodatek po auditu:** Přibyl `scripts/copernicus-sync.mjs` pro automatické dotazy na Sentinel Hub (Sentinel‑2 L2A a FSC BYOC), lokální SQLite archiv a denní úloha. Živý běh přes OAuth, katalog a statistické API přijal první NDVI pro Prášilské jezero ze snímku 5. 11. 2026; zimní FSC zatím nemá přijatý výsledek. Původní demonstrační hodnoty a ovládání ukázkového režimu byly z produkční aplikace odstraněny. Testovací hodnoty existují jen v automatických testech. Tvrzení níže o chybějícím automatickém sběru a demonstračním režimu popisují stav při původním auditu. Aktuální návod je v [README.md](README.md).

Ověřeno 13. 11. 2026. Stav označuje skutečně doloženou schopnost této verze, nikoliv plánovaný vývoj.

| Oblast | Stav | Důkaz / omezení |
|---|---|---|
| Mapa, pět výletních cílů a pět obcí | **FUNKČNÍ A OVĚŘENO** | OSM ID a souřadnice ověřeny; v prohlížeči se načetlo 12 dlaždic, body a ovládání zoomu. |
| Filtr podle vzdušné vzdálenosti, změny nastavení, nejvýše tři tipy | **FUNKČNÍ A OVĚŘENO** | Jednotkové testy a interakce v prohlížeči. Bez měření nabízí nejbližší místa se správným vysvětlením. |
| Řazení podle NDVI / FSC na dodaných hodnotách | **FUNKČNÍ A OVĚŘENO** | Testy odlišných metrik, kvality, nulového sněhu a časového okna. Ověřeno na syntetických hodnotách. |
| Ukázkové hodnoty NDVI a sněhu | **DEMONSTRAČNÍ** | Smyšlené hodnoty v `src/data.ts`, vypnuté při startu a viditelně označené po zapnutí. |
| Výpočet NDVI a FSC z připravených pixelů | **ČÁSTEČNĚ FUNKČNÍ** | Ověřené vzorce, masky, statistiky a limity v testech; vstupní rastry se automaticky nestahují ani nedekódují. Přesnost hranice kruhu odpovídá středům pixelů. |
| Skutečné aktuální satelitní výsledky pro pět míst | **NEFUNKČNÍ** | `src/measurements.json` je `[]`. Aplikace neukazuje žádný skutečně odvozený NDVI ani FSC. |
| Dostupnost aktuální trasy / vstupu | **NEOVĚŘENO** | Ověřeny veřejné popisy přístupu, nikoliv provozní stav v den výletu. |
| Mobilní rozhraní a prázdné stavy | **FUNKČNÍ A OVĚŘENO** | Interakce při šířce 375 px, bez horizontálního přetoku; prázdný satelitní stav a stav bez místa v dosahu. |
| Výpadek OSM dlaždic | **ČÁSTEČNĚ FUNKČNÍ** | `tileerror` zobrazí hlášení, body/karty jsou lokální; řízený síťový výpadek v prohlížeči nebyl nasimulován. |

## 1. Co bylo zkontrolováno

Repozitář, konfigurace, všechny zdroje v [SOURCES.md](SOURCES.md), GeoJSON a pořadí souřadnic, pět míst a obce, datové typy, import, výpočet vzdálenosti a pořadí doporučení, maskování NDVI a FSC, Leaflet, licence fotografií, mobilní zobrazení, prázdné a chybové stavy. `pnpm test` a `pnpm build` prošly; prohlížeč nahlásil prázdný seznam konzolových chyb. V aplikačním kódu ani skriptech nebyl nalezen API klíč nebo heslo. Projekt nemá složitou serverovou infrastrukturu; zdrojové soubory měření se skládají do klienta při buildu.

## 2. Které zdroje jsou skutečně zapojené

Za běhu se stahují pouze [OSM mapové dlaždice](https://operations.osmfoundation.org/policies/tiles/) a náhledy konkrétních míst z [Wikimedia Commons](https://commons.wikimedia.org/). OSM geografie je **statický, ručně kurátorovaný GeoJSON** v `src/places.json`; obce jsou statické v `src/data.ts`. OSM ani Overpass se při otevření aplikace nedotazují na body. Odkazy KČT, správce NP a provozovatelů slouží jako důkaz přístupu, nejsou živým údajem. CDSE a CLMS jsou metodické zdroje pro budoucí import, žádné jejich produkty nyní aplikace nestahuje. Krajské CSV a data.gov.cz se v aplikaci zatím nepoužívají. Podrobné přístupy a omezení jsou v [SOURCES.md](SOURCES.md).

## 3. Která data aplikace reálně získává

Reálně získává OSM dlaždice a fotografie. Geografické body jsou podloženy konkrétními OSM objekty. Satelitní soubor je záměrně prázdný. Žádná hodnota NDVI či podílu sněhu proto není výsledkem současného sběru. Pokud se zapne demonstrační režim, zobrazená čísla jsou smyšlená a jasně označená. Importní skript přijme předpočítané výsledky jen s metadaty a kvalitativními limity, ale nemůže ověřit pravost vstupu či úplnost rasteru.

### Geografické body

Uzel označuje přímo OSM bod. U polygonu je v GeoJSON reprezentativní bod uvnitř/na místě získaný při ověřování přes Nominatim; je možné, že se mírně liší od centroidu polygonu v Overpass. Souřadnice tabulky jsou `šířka, délka`.

| Cíl | Souřadnice | OSM prvek a typ | Přístup |
|---|---|---|---|
| Čerchov | 49.3833361, 12.7837268 | [node 256939539](https://www.openstreetmap.org/node/256939539), vrchol | [KČT](https://kct.cz/den-ceskeho-lesa-nabidne-slavnostni-otevreni-chaty-na-cerchove-i-vyrocni-pivo/) popisuje pěší přístup. |
| Černé jezero | 49.1791401, 13.1822816 | [way 29503960](https://www.openstreetmap.org/way/29503960), jezero | [NP Šumava](https://www.npsumava.cz/vylet/ledovcova-jezera-cerne-a-certovo/) uvádí trasu a omezení pohybu mimo značené cesty. |
| Prášilské jezero | 49.0753498, 13.4000368 | [way 51219582](https://www.openstreetmap.org/way/51219582), jezero | [NP Šumava](https://www.npsumava.cz/vylet/k-prasilskemu-jezeru-a-na-polednik/) uvádí značenou trasu. |
| Pancíř | 49.1779255, 13.2532300 | [node 568265874](https://www.openstreetmap.org/node/568265874), vrchol | [Provozovatel rozhledny](https://www.chatapancir.cz/rozhledna/) popisuje pěší přístup. |
| Radyně | 49.6809967, 13.4651091 | [way 29010769](https://www.openstreetmap.org/way/29010769), hrad | [Provozovatel hradu](https://www.hrad-radyne.cz/kontakt/) uvádí sezónní provoz. |

Všech pět názvů, typů a poloh odpovídá OSM objektům v Plzeňském kraji. Obce jsou reprezentativní navigační body z Nominatim, nikoliv hranice obcí: [Plzeň](https://www.openstreetmap.org/relation/438344) 49.7477415, 13.3775249; [Klatovy](https://www.openstreetmap.org/relation/438363) 49.3951183, 13.2935954; [Domažlice](https://www.openstreetmap.org/relation/438629) 49.4403546, 12.9297480; [Železná Ruda](https://www.openstreetmap.org/relation/438302) 49.1374249, 13.2350287; [Sušice](https://www.openstreetmap.org/relation/438289) 49.2313907, 13.5204076. Jsou vhodné pro orientační **vzdušnou** vzdálenost, nikoliv pro délku skutečné cesty.

## 4. Letní NDVI

**ČÁSTEČNĚ FUNKČNÍ jako výpočet; NEFUNKČNÍ jako skutečné měření.** [Sentinel‑2 L2A](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html) nabízí B04 (červená), B08 (blízká infračervená) a SCL. Kód počítá `(B08-B04)/(B08+B04)`, chrání nulový jmenovatel, vynechává neplatné SCL, mraky/stín a bere medián platných středů pixelů do 250 m. B04/B08 mají 10 m, SCL 20 m; jejich zarovnání musí zajistit externí předzpracování. Žádný takový raster v projektu není a `process:scenes` jej neumí stáhnout/dekódovat. Podíl platné plochy je počet platných pixelů dělený počtem dodaných středů v kruhu; při neúplném vstupu by byl zavádějící. Žádný satelitní výsledek tedy nebyl ověřen proti reálnému produktu.

## 5. Zimní sníh

**ČÁSTEČNĚ FUNKČNÍ jako výpočet; NEFUNKČNÍ jako skutečné měření.** [Copernicus FSC 20 m](https://land.copernicus.eu/en/products/snow/fractional-snow-cover) má vrstvu FSCOG pro sníh na zemi. Podle [manuálu](https://land.copernicus.eu/en/technical-library/product-user-manual-high-resolution-snow-products-europe/@@download/file) jsou 0–100 procenta; kódy 205, 210, 255 a slabé QA se vyloučí. Kód počítá aritmetický průměr platných pixelů v kruhu; 0 % zachovává jako měření, `null` jako chybění. NDSI není zaměněno s FSC. Ve zkoušených STAC dotazech FSC kolekce nevydala položky; skutečný produkt se nestáhl ani nezpracoval. Pokryv pod stromovou korunou zůstává satelitně hůře pozorovatelný; tato metodická nejistota se nyní nekvantifikuje.

## 6. Doporučovací algoritmus

**FUNKČNÍ A OVĚŘENO pro vložená data.** Haversinova formule určuje vzdušnou vzdálenost, filtr odstraní cíle nad maximem, kvalitativní validace odstraní neplatné měření, pro každé místo se bere nejnovější použitelné měření. Žebříček omezuje rozdíl dat na 14 dnů, řadí NDVI nebo FSC sestupně a končí třemi výsledky. Shodu rozhoduje kratší vzdálenost. Při žádných měřeních se místo žebříčku nabídnou nejbližší cíle v dosahu s vysvětlením. Změny režimu, obce i posuvníku přepočítávají výsledek bez reloadu. Hranice nulového sněhu, chybějící hodnoty, špatné kvality a stáří dat pokrývají testy.

## 7. Nalezené chyby

Původní GeoJSON byl duplicitní a nepoužitý; aplikace měla body z jiné datové struktury. Mapa neměla viditelné ovládání zoomu; podklad používal subdomény místo současné doporučené URL OSM. Chyběla reakce na chybující dlaždice a přímé kredity fotografií. Hrdina označovala ilustrační snímek jako konkrétní krajinu. Popis Černého jezera nesprávně naznačoval pravidla národního parku. Importní struktura neověřovala produkt, statistiku, poloměr a správné datum, ačkoliv šlo o klíčové předpoklady žebříčku. Nebyl výpočet nad pixely FSC/NDVI; `SOURCES.md` nepřesně tvrdil nedostupnost krajského CSV. Hlavní datová mezera byla a zůstává absence skutečných satelitních měření.

## 8. Provedené opravy

Místa se načítají z jediného validovaného GeoJSON. Ověřeny OSM ID, typy, reprezentativní body, obce a přístupy; karty odkazují na zdroje a licence fotografií. Mapa má zoom a chybový stav, OSM dlaždice používají správnou adresu. Import kontroluje produkt, statistiku, 250 m, datum, meze kvality a identifikátor scény. Přibyl oddělený procesor pixelů a testy NDVI/FSC, mraků, QA, nulových hodnot a kruhu. Opraveny dokumenty README a SOURCES. Vizuální styl a hlavní interakce zůstaly zachované.

## 9. Co vyžaduje další práci

Pro skutečný satelitní žebříček je nutné získat autentické scénové rastry, respektovat autentizaci [CDSE STAC/Sentinel Hub](https://documentation.dataspace.copernicus.eu/APIs/STAC.html), u FSC ověřit funkční distribuci produktu, dekódovat JP2/GeoTIFF, zarovnat pásma a QA do jednoho CRS, kontrolovat úplnost pixelové mřížky a opakovatelně vytvořit měření. Vstupní JSON a HTTPS URL samy o sobě původ nedokazují. Pro přesnější okraj 250m kruhu je vhodné plošně vážené překrytí pixelů a kruhu. Je třeba sledovat aktuálnost tras, dostupnost dlaždic a fotografií a případně rozšířit seznam cílů. Bez těchto kroků nelze tvrdit, že aplikace doporučuje podle aktuální zeleně či sněhu.

## 10. Spuštění a testování

Viz [README.md](README.md): `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm build`. V prohlížeči ověřte přepínač obou režimů, obec, posuvník (například Železná Ruda + 5 km), kliknutí na kartu a 250m kruh, ukázkový režim a mobilní šířku. Ověření při auditu: 9 automatických testů prošlo, sestavení prošlo, v prohlížeči se načetly OSM dlaždice, změna zoomu fungovala, Železná Ruda při 5 km zobrazila Pancíř, vybraná karta vykreslila kruh, při 375 px nevznikl vodorovný přetok a konzola nevydala chyby. Testy používají syntetické pixely a demonstrační měření; **nejsou validací reálných satelitních výsledků**.

## Závěr

Aplikace je připravená k předvedení jako **funkční mapové demo** s ověřenými body, filtrem vzdálenosti, kartami a transparentně označeným ukázkovým žebříčkem. Klíčovou satelitní část zatím **simuluje**, pokud se zapne demo; ve výchozím stavu měření správně nepředstírá. Jako aplikace doporučující podle skutečně změřené současné vegetace a sněhu ještě připravená není.
