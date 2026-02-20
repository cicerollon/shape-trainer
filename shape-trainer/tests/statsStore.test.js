import test from 'node:test';
import assert from 'node:assert/strict';

import { createDefaultStats, loadStats, saveStats } from '../src/state/statsStore.js';

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

test('loadStats returns defaults for missing storage entries', () => {
  const storage = makeStorage();
  assert.deepEqual(loadStats(storage, 'stats'), createDefaultStats());
});

test('loadStats sanitizes malformed values', () => {
  const storage = makeStorage({ stats: JSON.stringify({ totalRounds: '2', totalTime: 'x' }) });

  assert.deepEqual(loadStats(storage, 'stats'), {
    totalRounds: 2,
    totalTime: 0,
    bestStreak: 0,
  });
});

test('saveStats writes serialized payload', () => {
  const storage = makeStorage();
  saveStats(storage, 'stats', { totalRounds: 1, totalTime: 30, bestStreak: 1 });

  assert.equal(
    storage.getItem('stats'),
    JSON.stringify({ totalRounds: 1, totalTime: 30, bestStreak: 1 }),
  );
});
