const DEFAULT_STATS = Object.freeze({
  totalRounds: 0,
  totalTime: 0,
  bestStreak: 0,
});

function sanitizeStats(parsedStats) {
  return {
    totalRounds: Number(parsedStats.totalRounds) || 0,
    totalTime: Number(parsedStats.totalTime) || 0,
    bestStreak: Number(parsedStats.bestStreak) || 0,
  };
}

export function createDefaultStats() {
  return { ...DEFAULT_STATS };
}

export function loadStats(storage, storageKey) {
  try {
    const rawValue = storage.getItem(storageKey);

    if (!rawValue) {
      return createDefaultStats();
    }

    return sanitizeStats(JSON.parse(rawValue));
  } catch {
    return createDefaultStats();
  }
}

export function saveStats(storage, storageKey, stats) {
  storage.setItem(storageKey, JSON.stringify(stats));
}
