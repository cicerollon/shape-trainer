export function formatClock(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = String(clamped % 60).padStart(2, '0');

  return `${String(minutes).padStart(2, '0')}:${seconds}`;
}

export function formatShortDuration(totalSeconds) {
  const value = Math.floor(totalSeconds);

  if (value < 60) {
    return `${value}s`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
