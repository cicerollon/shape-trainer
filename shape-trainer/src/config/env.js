const DEFAULT_STATS_STORAGE_KEY = 'shape_trainer_stats_v1';

export const APP_CONFIG = {
  statsStorageKey: import.meta.env.VITE_STATS_STORAGE_KEY ?? DEFAULT_STATS_STORAGE_KEY,
};
