import test from 'node:test';
import assert from 'node:assert/strict';

import { formatClock, formatShortDuration } from '../src/utils/time.js';

test('formatClock renders mm:ss and clamps negatives', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(-10), '00:00');
});

test('formatShortDuration renders readable durations', () => {
  assert.equal(formatShortDuration(30), '30s');
  assert.equal(formatShortDuration(60), '1m');
  assert.equal(formatShortDuration(75), '1m 15s');
});
