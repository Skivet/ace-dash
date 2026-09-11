import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Importer } from '../server/importer.js';

describe('Importer', () => {
  it('skips manifest.json files', () => {
    const importer = new Importer(null, '/tmp', '/tmp');
    assert.equal(importer._isSkippedFilename('manifest.json'), true);
    assert.equal(importer._isSkippedFilename('.DS_Store'), true);
    assert.equal(importer._isSkippedFilename('results_20260904_014048_practice.json'), false);
    assert.equal(importer._isSkippedFilename('random.json'), false);
  });

  it('validates ACE result shape', () => {
    const importer = new Importer(null, '/tmp', '/tmp');
    assert.equal(importer._isValidAceResult(null), false);
    assert.equal(importer._isValidAceResult({}), false);
    assert.equal(importer._isValidAceResult({ track_name: 'Test', session_type: 'Practice', drivers: [], cars: [], driver_standings: [], car_standings: [] }), true);
    assert.equal(importer._isValidAceResult({ track_name: '', session_type: 'Practice', drivers: [], cars: [], driver_standings: [], car_standings: [] }), false);
    assert.equal(importer._isValidAceResult({ track_name: 'Test', drivers: [], cars: [], driver_standings: [], car_standings: [] }), false);
  });
});
