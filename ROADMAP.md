# Void Launcher Web Editor — Roadmap

Author: **Ark**

Status order is the agreed build priority. Data shapes for every module already exist in
`WEB_EDITOR_HANDOFF.md`, so later modules do not require schema changes.

## 1. Map editor — **done (v1)**

- [x] Canonical layout model, normalization, IndexedDB autosave
- [x] Pan / zoom / fit / home, drag-to-move pages, add adjacent page previews
- [x] Bidirectional arrow links between edge-adjacent pages, click to toggle
- [x] Page inspector: title, type, grid size, coordinates, secret, home, links
- [x] Android-compatible validation panel with click-to-select
- [x] Layout JSON import and export (`voidlauncher-backup.json`)

## 2. Widget and app-list placement editor — **done (v1)**

- [x] Inventory import (`voidlauncher-inventory.json`): apps, built-in widgets, system widgets
- [x] Per-page grid renderer sized to the page's columns and rows
- [x] Place, select, move, resize and delete items (1-based col/row, spans)
- [x] Built-in widget placement: `APP_LIST`, `CLOCK`, `PAGE_INFO`
- [x] App shortcut placement from the imported app list, with overlap blocking
- [x] System widget placement using the inventory's minimum spans
- [x] Item bounds follow `col + colSpan <= gridCols` so exports pass Android validation
- [ ] Custom widget placement (`custom:<id>`) — waits on the bundle module

## 3. Import / export module

- [ ] Full layout + widget bundle export with round-trip verification
- [ ] Import widget bundle (`voidlauncher-widgets.json`)
- [ ] Import validation summary before applying
- [ ] Unknown-key preservation policy for future versions

## 4. Transfer method

- [ ] Pick a transport that works from a static Vercel deployment
- [ ] QR / file-handoff flow for phone import testing

## 5. UI polish

- [ ] Keyboard shortcuts and focus management
- [ ] Responsive layout for narrower windows
- [ ] Empty, loading and error states

## 6. Themes — **partly done**

- [x] Theme selector: `SYSTEM`, `DARK`, `LIGHT`, `CUSTOM`
- [x] Orientation selector and coordinate-detail toggle
- [x] Raw custom palette editor (8 colour roles, reset to default)
- [ ] Visual theme maker: live phone preview, presets, contrast checks
- [ ] Background editor: global and per-page, colour / gradient / image
- [ ] App customization editor: nickname, font, size, weight, colour, alignment

## 7. Custom widget authoring

- [ ] Bundle editor for HTML/CSS/JS widgets with the Android bundle limits
- [ ] Placeholder app icons; optional icon sidecar later
