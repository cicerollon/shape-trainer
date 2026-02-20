# Contributing

## Branching

- Use short-lived topic branches from `main`.
- Keep commits small and focused.

## Development workflow

1. `cd shape-trainer`
2. `npm ci`
3. `npm run dev`
4. Before opening a PR:
   - `npm run lint`
   - `npm run test`
   - `npm run build`

## Code style

- Keep modules cohesive (UI orchestration in `main.js`, pure logic in `src/engine`, state helpers in `src/state`, generic utilities in `src/utils`).
- Prefer pure functions for business logic to make testing easier.
- Preserve existing app behavior unless fixing a clear bug.

## Pull request expectations

- Include a clear summary and risk notes.
- Add/update tests for changed logic.
- Update docs when scripts, architecture, or setup changes.
