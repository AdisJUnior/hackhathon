-- Spusťte jednou po 002 (nebo po neon-bootstrap.sql) na existující větvi Neonu.
-- Čas pořízení snímku může chybět; nikdy jej nenahrazujeme časem importu.
BEGIN;

ALTER TABLE public.satellite_measurements
  ADD COLUMN IF NOT EXISTS observed_at timestamptz;

-- Kompaktní název produktu Sentinel-2 obsahuje UTC čas začátku snímání.
-- Doplňujeme pouze záznamy, jejichž jméno a uložené datum souhlasí.
UPDATE public.satellite_measurements
SET observed_at = make_timestamptz(
  substr(scene_id, 12, 4)::integer,
  substr(scene_id, 16, 2)::integer,
  substr(scene_id, 18, 2)::integer,
  substr(scene_id, 21, 2)::integer,
  substr(scene_id, 23, 2)::integer,
  substr(scene_id, 25, 2)::double precision,
  'UTC'
)
WHERE observed_at IS NULL
  AND mode = 'green'
  AND scene_id ~ '^S2[ABCD]_MSIL2A_[0-9]{8}T[0-9]{6}_'
  AND substr(scene_id, 12, 4) || '-' || substr(scene_id, 16, 2) || '-' || substr(scene_id, 18, 2) = scene_date::text;

CREATE OR REPLACE VIEW public.latest_satellite_measurements AS
  SELECT DISTINCT ON (place_id, mode)
    place_id, mode, scene_id, scene_date, value, valid_fraction, cloud_fraction,
    source_url, product, statistic, radius_meters, acquired_at, observed_at
  FROM public.satellite_measurements
  ORDER BY place_id, mode, scene_date DESC, acquired_at DESC;

-- Přehled pro SQL Editor: jedno místo na řádek, NDVI a FSC vedle sebe.
-- NULL znamená, že pro daný režim neexistuje přijaté měření; 0 je platná hodnota.
CREATE OR REPLACE VIEW public.destination_satellite_overview AS
  SELECT
    d.id AS place_id, d.name AS place_name, d.latitude, d.longitude,
    g.value AS ndvi_median, g.scene_date AS ndvi_date,
    g.observed_at AS ndvi_observed_at, g.acquired_at AS ndvi_saved_at,
    g.valid_fraction AS ndvi_valid_fraction, g.cloud_fraction AS ndvi_cloud_fraction,
    g.scene_id AS ndvi_scene_id, g.source_url AS ndvi_source_url,
    s.value AS snow_fraction_percent, s.scene_date AS snow_date,
    s.observed_at AS snow_observed_at, s.acquired_at AS snow_saved_at,
    s.valid_fraction AS snow_valid_fraction, s.cloud_fraction AS snow_cloud_fraction,
    s.scene_id AS snow_scene_id, s.source_url AS snow_source_url
  FROM public.destinations AS d
  LEFT JOIN public.latest_satellite_measurements AS g ON g.place_id = d.id AND g.mode = 'green'
  LEFT JOIN public.latest_satellite_measurements AS s ON s.place_id = d.id AND s.mode = 'snow';

COMMIT;

SELECT place_name, latitude, longitude, ndvi_median, ndvi_date,
       ndvi_observed_at, ndvi_saved_at, snow_fraction_percent, snow_date,
       snow_observed_at, snow_saved_at
FROM public.destination_satellite_overview
ORDER BY place_name;
