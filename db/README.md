# Pevný katalog destinací

Soubor `001_frozen_destinations.sql` obsahuje přesně 300 bodů používaných aplikací. Je určen k **jednorázovému** spuštění na nové prázdné databázi v Neonu. Vloží záznamy a pak nastaví triggery, které blokují `INSERT`, `UPDATE`, `DELETE` a `TRUNCATE` nad tabulkou `public.destinations`. Migrace selže, pokud tabulka už obsahuje data; žádná stávající data nepřepisuje.

Zdrojový katalog zůstává ve verzovaných souborech `src/places.json`, `src/regional-places.json` a `src/places-extra.json`. Otisk ID a souřadnic kontroluje test. Vyřazených devět bodů a důvody jsou v `data/destination-curation.json`.

Připojovací řetězce jsou citlivé údaje. Patří do `.env.local` nebo tajných proměnných hostingu, nikdy do SQL souboru, kódu pro prohlížeč ani do Gitu.

Soubor `002_satellite_measurements.sql` připravuje tabulky pro historii NDVI/FSC, prověřené scény a pořadí synchronizace. `latest_satellite_measurements` vybírá poslední přijatý výsledek pro každý cíl a režim. Migrace jsou ve větvi `production` projektu Neon nasazené; průběžný přenos z místní SQLite zajišťují `scripts/export-neon-sync.mjs` a `scripts/push-neon.ps1`.

Po již provedeném bootstrapu spusťte v SQL Editoru soubor `003_measurement_timestamps.sql`. Přidá nullable `observed_at` (UTC čas pořízení snímku), doložené časy Sentinel‑2 doplní z názvu produktu a vytvoří pohled `destination_satellite_overview` s polohou, NDVI a FSC vedle sebe. `acquired_at` je čas uložení výsledku do historie. FSC zůstává `NULL`, dokud neexistuje přijaté měření; nula se zachovává jako platná hodnota. Migrace je opakovatelná a nemění tabulku pevných destinací.

Migrace `004_winter_snow_season.sql` upravuje pohled posledních měření tak, aby zimní sloupec vybíral jen snímky z prosince, ledna a února. Měření z jiných měsíců zůstávají v historii, ale ve výběru destinací se nepoužijí. Ve větvi `production` je migrace nasazená.

## Jednorázový skript pro Neon

`neon-bootstrap.sql` spojuje migrace a snímek místní historie ze `data/measurements.sqlite` do jedné transakce. Počty jsou uvedené v posledním dotazu souboru. Záznamy scén/pokusů pro dříve vyřazené cíle se při exportu vynechávají. Přijaté FSC měření se uvádí pouze tehdy, když skutečně prošlo kontrolou kvality.

Skript je určen **jen pro novou prázdnou větev nebo databázi**. V Neon Console zvolte správný projekt a větev `production`, otevřete **Postgres database → SQL Editor**, vložte celý obsah `neon-bootstrap.sql` a spusťte jej jednou. Poslední dotaz vrátí počty řádků. Pokud tabulka `public.destinations` už obsahuje data, skript skončí chybou a transakce nic nezmění.

Při změně místních satelitních dat lze soubor před prvním použitím obnovit příkazem `node scripts/build-neon-bootstrap.mjs` nebo `npm run build:neon-sql`. Vygenerování souboru **neprovádí připojení k Neonu** a po prvním importu se nesmí znovu spouštět jako aktualizace. Pro existující větev `production` slouží pouze průběžná synchronizace `scripts/push-neon.ps1`; generovaný `data/neon-sync.sql` je ignorovaný Gitem a neobsahuje přihlašovací údaje.

Výběr pro rychlou kontrolu po migraci:

```sql
SELECT place_name, latitude, longitude, ndvi_median, ndvi_observed_at,
       ndvi_saved_at, snow_fraction_percent, snow_observed_at, snow_saved_at
FROM public.destination_satellite_overview
ORDER BY place_name;
```
