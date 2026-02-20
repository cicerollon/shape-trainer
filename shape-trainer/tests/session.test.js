import test from 'node:test';
import assert from 'node:assert/strict';

import { applyCompletedRound, calculateCycleTime } from '../src/engine/session.js';

test('calculateCycleTime respects auto-switch cadence', () => {
  assert.equal(
    calculateCycleTime({ durationSeconds: 60, autoSwitchSeconds: 15 }),
    15,
  );
  assert.equal(calculateCycleTime({ durationSeconds: 60, autoSwitchSeconds: 0 }), 60);
});

test('applyCompletedRound updates stats and streaks', () => {
  const state = applyCompletedRound({
    stats: { totalRounds: 2, totalTime: 30, bestStreak: 2 },
    sessionRounds: 2,
    sessionStreak: 2,
    roundDurationSeconds: 15,
  });

  assert.deepEqual(state.nextStats, {
    totalRounds: 3,
    totalTime: 45,
    bestStreak: 3,
  });
  assert.equal(state.nextSessionRounds, 3);
  assert.equal(state.nextSessionStreak, 3);
});
