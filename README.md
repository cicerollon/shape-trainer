# Shape Trainer

A small Three.js + Vite web app for timed 3D shape training drills.

## Project layout

- `shape-trainer/`: runnable Vite app source
- `index.html`: legacy prototype kept for reference only (not used by Vite)

## Setup

```bash
cd shape-trainer
npm ci
cp .env.example .env # optional
npm run dev
```

## Scripts

Run from `shape-trainer/`:

- `npm run dev`: start local dev server
- `npm run build`: production build
- `npm run preview`: preview production build
- `npm run lint`: syntax/lint baseline checks
- `npm run test`: unit tests for core logic modules

## Environment variables

Defined in `shape-trainer/.env.example`:

- `VITE_STATS_STORAGE_KEY`: localStorage key used for persisted stats

## Testing & quality

- Unit tests cover timer/session logic and stats persistence helpers.
- CI runs build + lint + tests on pushes and pull requests.
