-- Zimní žebříček používá pouze snímky od 1. prosince do konce února.
-- Jiná skutečná měření zůstávají v historii, ale nejsou posledním zimním výsledkem.
CREATE OR REPLACE VIEW public.latest_satellite_measurements AS
  SELECT DISTINCT ON (place_id, mode)
    place_id, mode, scene_id, scene_date, value, valid_fraction, cloud_fraction,
    source_url, product, statistic, radius_meters, acquired_at, observed_at
  FROM public.satellite_measurements
  WHERE mode <> 'snow' OR extract(month FROM scene_date) IN (12, 1, 2)
  ORDER BY place_id, mode, scene_date DESC, acquired_at DESC;
