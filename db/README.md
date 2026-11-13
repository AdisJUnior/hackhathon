# Pevný katalog destinací

Soubor `001_frozen_destinations.sql` obsahuje přesně 300 bodů používaných aplikací. Je určen k **jednorázovému** spuštění na nové prázdné databázi v Neonu. Vloží záznamy a pak nastaví triggery, které blokují `INSERT`, `UPDATE`, `DELETE` a `TRUNCATE` nad tabulkou `public.destinations`. Migrace selže, pokud tabulka už obsahuje data; žádná stávající data nepřepisuje.

Zdrojový katalog zůstává ve verzovaných souborech `src/places.json`, `src/regional-places.json` a `src/places-extra.json`. Otisk ID a souřadnic kontroluje test. Vyřazených devět bodů a důvody jsou v `data/destination-curation.json`.

Připojovací řetězce jsou citlivé údaje. Patří do `.env.local` nebo tajných proměnných hostingu, nikdy do SQL souboru, kódu pro prohlížeč ani do Gitu.

Soubor `002_satellite_measurements.sql` připravuje tabulky pro historii NDVI/FSC, prověřené scény a pořadí synchronizace. `latest_satellite_measurements` vybírá poslední přijatý výsledek pro každý cíl a režim. Migrace stávající SQLite historie a přepnutí synchronizačního skriptu na Neon vyžadují dostupné připojení k projektu; samotný SQL soubor to neprovádí.
