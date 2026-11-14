import assert from 'node:assert/strict';
import test from 'node:test';
import { neonSyncSql } from './export-neon-sync.mjs';

test('Neon export keeps zero FSC, nullable observation time and idempotent keys', () => {
  const sql = neonSyncSql({
    placeIds: new Set(['prasily']),
    measurements: [{
      place_id: 'prasily', mode: 'snow', scene_id: 'FSC_SCENE', date: '2026-01-10',
      value: 0, valid_fraction: .8, cloud_fraction: .1,
      source: "https://example.org/scene's-detail", product: 'CLMS-FSC-20M',
      statistic: 'mean', radius_meters: 250, acquired_at: '2026-11-14T10:00:00.000Z', observed_at: null,
    }],
    checks: [{ place_id: 'prasily', mode: 'snow', scene_id: 'BAD', checked_at: '2026-11-14T10:00:00.000Z' }],
    attempts: [{ place_id: 'prasily', mode: 'snow', attempted_at: '2026-11-14T10:00:00.000Z' }],
  });
  assert.match(sql, /'2026-01-10', 0, 0\.8, 0\.1/);
  assert.match(sql, /scene''s-detail/);
  assert.match(sql, /NULL\)/);
  assert.match(sql, /ON CONFLICT \(place_id, mode, scene_id\) DO UPDATE/);
  assert.match(sql, /GREATEST\(public\.satellite_sync_attempts\.attempted_at/);
});
