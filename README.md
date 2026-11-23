# Void Launcher Web Editor

A static, client-side Next.js editor for Void Launcher layouts, page grids, and custom widgets.

**Author:** Ark

## Status

Scaffold initialized. The first implementation slice is the map editor, import/export, and custom widget authoring. The phone import path is a separate module and will be tested after the editor is complete.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the local development server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint

## Project notes

- The editor is frontend-only. No backend, API route, database, or login.
- Working data is stored locally in IndexedDB.
- Export filenames: `voidlauncher-backup.json`, `voidlauncher-widgets.json`, `voidlauncher-inventory.json`.
- The layout and custom widget bundle must round-trip through the Android launcher's `IMPORT` flow.

The cross-project data contract lives in the monorepo's `Shared/` folder. The editor also keeps the full handoff in `WEB_EDITOR_HANDOFF.md`.
