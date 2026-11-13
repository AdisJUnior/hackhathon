-- Připravuje cloudové ukládání skutečných NDVI a FSC měření. Spusťte po 001.
CREATE TABLE IF NOT EXISTS public.satellite_measurements (
  place_id text NOT NULL REFERENCES public.destinations(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('green', 'snow')),
  scene_id text NOT NULL,
  scene_date date NOT NULL,
  value double precision NOT NULL,
  valid_fraction double precision NOT NULL CHECK (valid_fraction BETWEEN 0.7 AND 1),
  cloud_fraction double precision NOT NULL CHECK (cloud_fraction BETWEEN 0 AND 0.3),
  source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
  product text NOT NULL,
  statistic text NOT NULL,
  radius_meters integer NOT NULL DEFAULT 250 CHECK (radius_meters = 250),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, mode, scene_id),
  CHECK ((mode = 'green' AND product = 'S2-L2A-NDVI' AND statistic = 'median' AND value BETWEEN -1 AND 1)
    OR (mode = 'snow' AND product = 'CLMS-FSC-20M' AND statistic = 'mean' AND value BETWEEN 0 AND 100))
);

CREATE TABLE IF NOT EXISTS public.satellite_scene_checks (
  place_id text NOT NULL REFERENCES public.destinations(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('green', 'snow')),
  scene_id text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, mode, scene_id)
);

CREATE TABLE IF NOT EXISTS public.satellite_sync_attempts (
  place_id text NOT NULL REFERENCES public.destinations(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK (mode IN ('green', 'snow')),
  attempted_at timestamptz NOT NULL,
  PRIMARY KEY (place_id, mode)
);

CREATE OR REPLACE VIEW public.latest_satellite_measurements AS
  SELECT DISTINCT ON (place_id, mode) * FROM public.satellite_measurements
  ORDER BY place_id, mode, scene_date DESC, acquired_at DESC;
