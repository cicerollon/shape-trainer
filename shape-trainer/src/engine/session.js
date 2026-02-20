export function calculateCycleTime({ durationSeconds, autoSwitchSeconds }) {
  return autoSwitchSeconds > 0
    ? Math.min(autoSwitchSeconds, durationSeconds)
    : durationSeconds;
}

export function applyCompletedRound({
  stats,
  sessionRounds,
  sessionStreak,
  roundDurationSeconds,
}) {
  const nextSessionRounds = sessionRounds + 1;
  const nextSessionStreak = sessionStreak + 1;

  const nextStats = {
    ...stats,
    totalRounds: stats.totalRounds + 1,
    totalTime: stats.totalTime + roundDurationSeconds,
    bestStreak: Math.max(stats.bestStreak, nextSessionStreak),
  };

  return {
    nextStats,
    nextSessionRounds,
    nextSessionStreak,
  };
}
