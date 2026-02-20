# Architecture Overview

## Runtime stack

- Vite app (ES modules)
- Three.js scene rendering
- Browser localStorage for persistent stats

## Module boundaries (`shape-trainer/src`)

- `main.js`: app composition, Three.js scene setup, DOM wiring, and animation loop.
- `config/env.js`: environment configuration defaults.
- `engine/session.js`: pure session timing and round progression logic.
- `state/statsStore.js`: storage serialization/deserialization and sanitization.
- `utils/*`: generic formatting and random helpers.

## Data flow

1. `main.js` loads config and stats from storage.
2. UI events update session state and call pure engine functions.
3. Updated stats are persisted through `state/statsStore.js`.
4. Render loop updates timer and Three.js scene.

## Notes

- Keep business logic in pure modules where possible.
- Keep DOM mutation inside `main.js` to avoid hidden side effects.
