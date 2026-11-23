# Void Launcher — Web Editor Handoff

**Date:** 2026-11-21  
**Launcher baseline:** `main` / `origin/main` at `658f2ae`  
**Source backup before this handoff:** `backups\void-launcher-source-20261121-184651.zip`  
**Build state at baseline:** `testDebugUnitTest`, `assembleDebug`, `assembleRelease` green with the serialized `--no-daemon --max-workers=1` command.

## For the receiving OpenCode session

Build a **separate web editor** that lets the user edit the whole Void Launcher map, per-page `10 x 20` grids, and widget placements, then **export JSON files** that the existing Android launcher can import with its `IMPORT` flow.

Do **not** implement or modify the Android launcher in this web-editor project. Do not invent a new backup format. The launcher's importer is strict about `version`, and a pre-import validator **rejects the whole file** with the first error it finds, so the editor must emit the exact shape below.

Widgets are **modular and extensible**. The layout file only references widgets; a separate **custom widget bundle** carries web-authored widget definitions, and a separate **device inventory** tells the editor which apps/system widgets the phone actually has. See §5a, §9a and §9b. All three files use the same JSON conventions.

The user will handle cross-project details and future schema sync. This file is the data contract.

## Target platform: Next.js, frontend only

The replacement is a **static client-side Next.js app deployed to Vercel**. There is no backend, no API route, no database and no login. Everything runs in the browser:

- **State:** keep each document in React state, persisted to `localStorage` so a refresh does not lose edits. Do not write to any server.
- **Import:** `<input type="file" accept="application/json,.json" multiple>` + `FileReader.readAsText` (UTF-8) → `JSON.parse` → classify by root keys (`pages` = layout, `widgets` = custom bundle, `apps` + `systemWidgets` = inventory) → run the relevant checklist in §11 → replace the matching editor document.
- **Export:** `JSON.stringify(doc, null, 2)` → `new Blob([json], { type: "application/json" })` → `URL.createObjectURL` → a temporary `<a download="...">` click → `URL.revokeObjectURL`. This is the browser equivalent of the launcher's SAF `CreateDocument("application/json")` export; no upload is involved.
- **Filenames:** `voidlauncher-backup.json` (layout), `voidlauncher-widgets.json` (custom bundle), `voidlauncher-inventory.json` (device inventory). MIME `application/json`, UTF-8, 2-space pretty print, no compression or encryption — match the launcher exactly.
- **Rendering:** the map and grid are pure SVG/CSS over the data below. Built-in widgets and system providers are labelled rectangles; web-authored `WEBVIEW` widgets can be previewed in an iframe or shown as labelled rectangles with their source visible.

For this first slice, implement **the map module** (§3, §4, §10 plus geometry), **the import/export module** (§1, §9a, §9b, §11, §12), and **custom widget bundle authoring** (§5a). The grid editor, theme/background editors and app-customization editor can follow later; their data shapes are already specified here so they do not need a schema change.

---

## Map rendering geometry (mirror of the Android overview)

These are renderer-only values from `ui/overview/OverviewMapCanvas.kt` and `PageOverview.kt`. They affect layout, not the JSON.

| Value | Android source | Web equivalent |
|---|---|---|
| Page tile | `140.dp` tall, width `height * 9 / 16` | `140px` tall, `78.75px` wide (16:9 portrait) |
| Gap between cells | `28.dp` | `28px` |
| Centre stride | `tile + gap` on both axes | `106.75px` X, `168px` Y |
| Zoom range | `0.35f .. 2.5f` | clamp scale to `0.35 .. 2.5` |
| Margin cells | `2` around the used coordinate range | draw 2 empty cells beyond min/max |
| Grid | faint dotted lattice, boundary rectangle visible | CSS radial-gradient dots or SVG `<pattern>` |
| Pan/zoom | drag + pinch, anchored at the gesture centroid | pointer drag + wheel/pinch with transform-origin at cursor |

Lattice maths (do this in JS, do not use DOM Y directly):

```ts
const mapX = page.coordX - minCoordX + 2;
const mapY = maxCoordY - page.coordY + 2; // invert Y: +y renders above 0
const cx = (mapX + 0.5) * strideX;
const cy = (mapY + 0.5) * strideY;
```

Arrows: draw all four directions for every page; only slots with a real orthogonal neighbour are interactive, the rest are visual "walls". A user-facing link toggle must emit **both** directed edge rows (§4).

---

## Authority files in the launcher repo

All paths are under `D:\projects\Void Launcher`.

| Concern | Authority |
|---|---|
| Exact JSON keys, version, row parsers | `app/src/main/java/com/ark/voidlauncher/data/backup/BackupManager.kt` |
| Payload fields/defaults | `app/src/main/java/com/ark/voidlauncher/data/backup/BackupPayload.kt` |
| Portable grid item shape | `app/src/main/java/com/ark/voidlauncher/data/backup/BackedUpItem.kt` |
| Portable background shape | `app/src/main/java/com/ark/voidlauncher/data/backup/BackedUpBackground.kt` |
| Export assembly, import application, status messages | `app/src/main/java/com/ark/voidlauncher/MainActivity.kt` |
| Restore/ID remap/home derivation | `app/src/main/java/com/ark/voidlauncher/data/repository/LauncherRepository.kt` |
| Enums, coordinate constants, `PageInfo`, `EdgeInfo` | `app/src/main/java/com/ark/voidlauncher/domain/Model.kt` |
| Canonical default map | `app/src/main/java/com/ark/voidlauncher/domain/DefaultLayout.kt` |
| Built-in widget encoding | `app/src/main/java/com/ark/voidlauncher/domain/BuiltInWidgets.kt` |
| Grid placement rules | `app/src/main/java/com/ark/voidlauncher/domain/placement/PlacementResolver.kt` |
| Page placement/neighbour rules | `app/src/main/java/com/ark/voidlauncher/domain/PagePlacement.kt` |
| Graph validation | `app/src/main/java/com/ark/voidlauncher/domain/PageGraphValidator.kt` |
| Pre-import validator (hard gate) | `app/src/main/java/com/ark/voidlauncher/data/backup/BackupValidator.kt` |
| Portable widget identity | `app/src/main/java/com/ark/voidlauncher/domain/WidgetReference.kt` |
| Bidirectional link semantics | `app/src/main/java/com/ark/voidlauncher/domain/PageLinks.kt` |
| Map tile/zoom geometry | `app/src/main/java/com/ark/voidlauncher/ui/overview/OverviewMapCanvas.kt`, `PageOverview.kt` |
| Background encoding | `app/src/main/java/com/ark/voidlauncher/domain/background/BackgroundModels.kt`, `GradientCodec.kt` |
| Room entities | `app/src/main/java/com/ark/voidlauncher/data/db/*.kt` |
| Product decisions 42–48 and earlier | `docs/INTERACTIVE_WIDGET_UX.md` |
| Full round-trip sample | `app/src/test/java/com/ark/voidlauncher/data/backup/BackupManagerTest.kt:26-107` |

---

# 1. Top-level JSON contract

The launcher uses **backup format version 1** only.

```json
{
  "version": 1,
  "homeCoordX": 0,
  "homeCoordY": 0,
  "theme": "SYSTEM",
  "orientation": "PORTRAIT",
  "showCoordinateDetail": true,
  "customPalette": null,
  "backgrounds": [],
  "pages": [],
  "edges": [],
  "items": [],
  "customizations": []
}
```

## Root keys

| Key | Type | Emit? | Importer behavior |
|---|---|---|---|
| `version` | integer | **Always `1`** | Required. Missing/wrong value rejects the whole file with `INVALID OR UNSUPPORTED BACKUP FILE`. Must be a number, not `"1"`. |
| `homeCoordX` | integer | Always | Defaults to `0` if absent. Must match a non-`APP_DRAWER` page coordinate. |
| `homeCoordY` | integer | Always | Defaults to `0` if absent. |
| `theme` | string | Always | Uppercase `ThemeMode` name. Defaults to `""` if absent, which leaves the previous theme unchanged. Invalid values are silently ignored. |
| `orientation` | string | Always | Uppercase `OrientationMode` name. Missing/invalid becomes `PORTRAIT`. |
| `showCoordinateDetail` | boolean | Always | Defaults to `true`; also controls the `PAGE_INFO` coordinate line and map tile coordinate text. |
| `customPalette` | object or `null` | Optional | Omitted/`null` leaves the device's existing palette unchanged. If present, all eight color keys are required strings. |
| `backgrounds` | array | Always emit an array | Empty array is a **no-op** on import; existing backgrounds remain. A non-empty valid array replaces all backgrounds. Invalid rows are skipped. |
| `pages` | array | Always | Missing/wrong type becomes `[]`. Malformed rows are skipped. |
| `edges` | array | Always | Missing/wrong type becomes `[]`. Malformed rows are skipped. |
| `items` | array | Always | Missing/wrong type becomes `[]`. Malformed rows are skipped. |
| `customizations` | array | Always | Missing/wrong type becomes `[]`. Malformed rows are skipped. |

Android export writes keys in this order: `version`, `homeCoordX`, `homeCoordY`, `theme`, `orientation`, `showCoordinateDetail`, `customPalette` (only if non-null), `backgrounds`, `pages`, `edges`, `items`, `customizations`.

`BackupManager.toJson` always writes `version: 1` regardless of any in-memory payload value.

**Import is a two-stage gate.** `BackupManager.fromJson` produces a payload (skipping malformed rows), then `BackupValidator.validate(payload)` runs. If validation reports any error, Android shows `INVALID BACKUP DATA: <first error>` and restores **nothing**. There is no partial restore of an invalid file. Implement §11 in the editor so this never happens to a user.

---

# 2. Exact enums

All enum values are **case-sensitive uppercase enum names**. Do not emit labels such as `"App List"` or lowercase DataStore strings.

| Enum | Exact values |
|---|---|
| `PageType` | `HOME`, `WIDGET`, `APP_DRAWER` |
| `GridItemType` | `APP_SHORTCUT`, `WIDGET` |
| `BuiltInWidgetKind` | `APP_LIST`, `CLOCK`, `PAGE_INFO` |
| `SwipeDirection` | `UP`, `DOWN`, `LEFT`, `RIGHT` |
| `ThemeMode` | `SYSTEM`, `DARK`, `LIGHT`, `CUSTOM` |
| `OrientationMode` | `PORTRAIT`, `LANDSCAPE`, `AUTO` |
| `BackgroundKind` | `COLOR`, `GRADIENT`, `IMAGE` — **no `NONE`** |
| `BackgroundScope` | `GLOBAL`, `PAGE` |
| `FontFamily` | `MONOSPACE`, `SANS`, `SERIF`, `DISPLAY` |
| `AppFontWeight` | `LIGHT`, `NORMAL`, `MEDIUM`, `BOLD` |
| `TextAlign` | `START`, `CENTER`, `END` |
| `TextTransform` | `NONE`, `LOWERCASE`, `UPPERCASE` |

Gesture enums exist in the launcher but are **not part of the backup JSON**:

| Enum | Exact values |
|---|---|
| `GestureScope` | `GLOBAL`, `PAGE` |
| `GestureTrigger` | `LONG_PRESS`, `DOUBLE_TAP`, `TRIPLE_TAP`, `PINCH_ZOOM_IN`, `PINCH_ZOOM_OUT`, `SWIPE_2_UP`, `SWIPE_2_DOWN`, `SWIPE_2_LEFT`, `SWIPE_2_RIGHT`, `SWIPE_3_UP`, `SWIPE_3_DOWN`, `SWIPE_3_LEFT`, `SWIPE_3_RIGHT` |
| `GestureAction` | `NONE`, `ZOOM_IN`, `ZOOM_OUT`, `LOCK_SCREEN`, `LOCK_LAUNCHER`, `OPEN_EDITOR`, `OPEN_MAP`, `GO_HOME`, `OPEN_SETTINGS`, `OPEN_APP_DRAWER`, `OPEN_WIDGET_PICKER`, `TOGGLE_COORDINATES`, `SYSTEM_BACK`, `SYSTEM_RECENTS`, `SYSTEM_NOTIFICATIONS` |

Gesture bindings live only in DataStore and are not restored by this format. A future sync would require a launcher schema change. Drawer-only app nicknames and `APP_LIST` widget appearance are also DataStore-only and are not part of backup v1; global `customNickname` values remain in `customizations`.

Default gesture behavior: an unbound `LONG_PRESS` on empty page space opens that page's grid editor, not the map. `OPEN_MAP` must be explicitly bound (or the editor's visible MAP button used) to show the overview.

---

# 3. Pages

```json
{
  "pageId": 1,
  "coordX": 0,
  "coordY": 0,
  "title": "Home",
  "gridCols": 10,
  "gridRows": 20,
  "isSecret": false,
  "pageType": "HOME"
}
```

| Key | Required | Default if omitted | Notes |
|---|---|---|---|
| `pageId` | Yes | — | Opaque integer remap key. Must be unique across pages. Use small positive integers such as `1..N` to stay JavaScript-safe. It is **not** a coordinate and is regenerated by Android on import. |
| `coordX` | Yes | — | Integer `-10..10`. |
| `coordY` | Yes | — | Integer `-10..10`. |
| `title` | Yes | — | String; blank is allowed but display falls back to `Page x,y`. User-visible name appears first; coordinates are secondary. |
| `gridCols` | No | `10` | Emit always. Must be positive. |
| `gridRows` | No | `20` | Emit always. Must be positive. |
| `isSecret` | No | `false` | Emit always. |
| `pageType` | No | `WIDGET` | Invalid value becomes `WIDGET`. |

## Page rules

- Coordinates are globally unique.
- Domain coordinates are X-right / Y-up: `LEFT = x-1`, `RIGHT = x+1`, `UP = y-1`, `DOWN = y+1`.
- The map renderer inverts screen Y. A page at `y + 1` is drawn above `y` on the map. Do not use DOM/screen Y math when computing stored directions.
- New pages should be adjacent to at least one existing page. The launcher's map only offers empty in-bounds orthogonal neighbours as `+` previews.
- `APP_DRAWER` is authoritative. Effective role resolution is:
  1. stored `APP_DRAWER` wins;
  2. page at `(homeCoordX, homeCoordY)` is `HOME`;
  3. everything else is `WIDGET`.
- Multiple `APP_DRAWER` pages are allowed by the data model, but the launcher uses the first one for `APPS`.
- `homeCoordX/homeCoordY` should point to a non-drawer page. Android silently refuses to set HOME to a drawer coordinate.
- Widgets should not be placed on `APP_DRAWER` pages. The importer does not enforce this.
- Map page cards show the stored/effective `pageType` as `HOME`, `WIDGET`, or `APP_DRAWER`. Do not recompute it from coordinates in the web renderer.

---

# 4. Edges and bidirectional links

```json
{
  "fromPageId": 1,
  "swipeDirection": "RIGHT",
  "toPageId": 2
}
```

| Key | Required | Notes |
|---|---|---|
| `fromPageId` | Yes | Must equal some `pages[].pageId`. |
| `swipeDirection` | Yes | `UP`, `DOWN`, `LEFT`, or `RIGHT`. Invalid rows are skipped. |
| `toPageId` | Yes | Must equal some `pages[].pageId`. Dangling edges are skipped on import. |

## One slot per source + direction

Room stores edges with composite primary key `(fromPageId, swipeDirection)`. The DAO uses `REPLACE`, so emitting two edges for the same source/direction silently leaves only one (the later insert wins). The editor should enforce at most one edge per `(fromPageId, swipeDirection)`.

## Stored direction vs gesture direction

Stored directions are compass-style neighbour deltas:

| Stored `swipeDirection` | Target coordinate from `(x, y)` |
|---|---|
| `LEFT` | `(x - 1, y)` |
| `RIGHT` | `(x + 1, y)` |
| `UP` | `(x, y - 1)` |
| `DOWN` | `(x, y + 1)` |

User gesture direction is mirrored on X because paging reveals the neighbour on the opposite side:

| User swipes | Stored edge looked up | Destination |
|---|---|---|
| `UP` | `UP` | `(x, y - 1)` |
| `DOWN` | `DOWN` | `(x, y + 1)` |
| `LEFT` | `RIGHT` | `(x + 1, y)` |
| `RIGHT` | `LEFT` | `(x - 1, y)` |

If the editor draws arrows, keep this distinction. Vertical arrow placement is a render-only concern; do not change the stored enum to make the arrow look right.

## Bidirectional links

The Android UI exposes one toggle for a link between two pages, but the JSON must contain **two directed rows**.

`opposite`: `UP <-> DOWN`, `LEFT <-> RIGHT`.

Example: linking page `1` to page `2` with stored direction `RIGHT` requires:

```json
[
  { "fromPageId": 1, "swipeDirection": "RIGHT", "toPageId": 2 },
  { "fromPageId": 2, "swipeDirection": "LEFT",  "toPageId": 1 }
]
```

## Graph validation (enforced on import)

`BackupValidator` runs these checks before any data is written. The editor must satisfy all of them:

1. At least one page exists (`NO PAGES`).
2. Page IDs and page coordinates are unique; coordinates are within `-10..10`.
3. `homeCoordX/homeCoordY` points to an existing page, and that page is **not** `APP_DRAWER`.
4. Edge endpoints must exist (`DANGLING EDGE`) and an edge may not point to itself (`SELF EDGE`).
5. At most one target per `(fromPageId, swipeDirection)` slot (`CONFLICTING EDGE SLOT`).
6. Every page has at least one incident edge, incoming or outgoing.
7. Every page has a directed path to HOME after **bidirectional expansion**.

**Half-links are legal.** Unlike the older contract, import no longer requires two rows per user link: `BackupValidator` and `LauncherRepository.restore` expand each edge into both directions using `PageLinks.link` (`UP<->DOWN`, `LEFT<->RIGHT`) before checking the graph. Emitting both rows is still recommended because it makes the intent explicit and idempotent.

Implementation note: path-to-home is a reverse BFS starting at HOME, following incoming edges backwards. A one-way link that leaves a page with no path to HOME is rejected.

---

# 5. Grid items

```json
{
  "pageCoordX": 0,
  "pageCoordY": 0,
  "itemType": "WIDGET",
  "col": 1,
  "row": 1,
  "colSpan": 4,
  "rowSpan": 2,
  "referenceId": "builtin:CLOCK",
  "allowOverlap": true,
  "widgetKind": "CLOCK"
}
```

| Key | Required | Default | Notes |
|---|---|---|---|
| `pageCoordX` | Yes | — | Must match a page coordinate. Items are addressed by coordinates, not `pageId`. |
| `pageCoordY` | Yes | — | Must match a page coordinate. |
| `itemType` | Yes | — | `APP_SHORTCUT` or `WIDGET`. |
| `col` | Yes | — | **1-based** column in backup files; must be `>= 1`. See note below. |
| `row` | Yes | — | **1-based** row in backup files; must be `>= 1`. |
| `colSpan` | Yes | — | Positive; must fit the page grid. |
| `rowSpan` | Yes | — | Positive; must fit the page grid. |
| `referenceId` | Yes | — | Portable identity. Never a live Android `appWidgetId`. |
| `allowOverlap` | No | `false` | Required `true` for widget/widget overlap. |
| `widgetKind` | No | `null` | `APP_LIST`, `CLOCK`, or `PAGE_INFO` for built-ins. |

Default built-in spans used by the launcher picker and seed data:

| Built-in | Default colSpan × rowSpan |
|---|---|
| `CLOCK` | 4 × 2 |
| `APP_LIST` | 4 × 3 |
| `PAGE_INFO` | 2 × 2 |
| `appListPackages` | No | `null` | Newline-delimited package list for `APP_LIST`. |

## Placement rules

- Grid dimensions are per page; default `10` cols by `20` rows.
- `col`, `row`, spans must be integers.
- Backup files must use `col >= 1` and `row >= 1`; `BackupValidator` emits `INVALID ITEM COL`/`INVALID ITEM ROW` otherwise and the whole file is rejected.
- `col + colSpan <= gridCols`.
- `row + rowSpan <= gridRows`.
- `colSpan` and `rowSpan` must be positive and not larger than the grid.
- Rectangles are half-open: an item at `col=1, colSpan=4` occupies columns 1,2,3,4.
- Known launcher inconsistency: the in-app `PlacementResolver` allows `col >= 0`, so a widget dragged to the first column in the app can be exported with `col=0` and then rejected on re-import. The web editor must emit `>= 1`. This launcher-side mismatch is tracked separately.
- `APP_SHORTCUT` cannot overlap anything.
- `WIDGET`/`WIDGET` overlap requires `allowOverlap: true` on the candidate.
- Export items already resolved onto a page. Do not emit out-of-bounds items expecting the launcher to hop them across pages.

The launcher's interactive resolver uses deterministic overflow priority `LEFT`, `UP`, `RIGHT`, `DOWN`, but that is a UI-time one-hop rule, not an import behavior.

## Reference ID rules

### Built-in `CLOCK`

```json
{
  "pageCoordX": 0,
  "pageCoordY": -1,
  "itemType": "WIDGET",
  "col": 1,
  "row": 1,
  "colSpan": 4,
  "rowSpan": 2,
  "referenceId": "builtin:CLOCK",
  "allowOverlap": true,
  "widgetKind": "CLOCK"
}
```

### Built-in `APP LIST`

```json
{
  "pageCoordX": 1,
  "pageCoordY": 0,
  "itemType": "WIDGET",
  "col": 1,
  "row": 1,
  "colSpan": 4,
  "rowSpan": 3,
  "referenceId": "builtin:APP_LIST",
  "allowOverlap": true,
  "widgetKind": "APP_LIST",
  "appListPackages": "com.android.vending\ncom.example.mail"
}
```

`APP_LIST` is a resizable miniature app drawer: one app label per row, variable width, tap to launch. The launcher picker drops it at the default 4 columns × 3 rows. Its editor modal edits membership, per-app nicknames (global scope), and widget colour/density appearance; the external add-widget `+` flow remains separate.

`appListPackages` encoding:

- newline-delimited;
- each entry trimmed;
- blank entries removed;
- duplicates removed;
- lexicographically sorted;
- omit the key or use `null` when empty.

JSON serializers will normally escape newlines as `\n`; that is correct.

### Built-in `PAGE_INFO`

```json
{
  "pageCoordX": 0,
  "pageCoordY": 0,
  "itemType": "WIDGET",
  "col": 1,
  "row": 1,
  "colSpan": 2,
  "rowSpan": 2,
  "referenceId": "builtin:PAGE_INFO",
  "allowOverlap": true,
  "widgetKind": "PAGE_INFO"
}
```

It renders the page display title, coordinates (when `showCoordinateDetail` is true), and a `HOME` tag when the page type is `HOME`. No `appListPackages`. Fresh installs and RESET ALL seed one on HOME; upgrade imports do not.

### System widget providers (portable identity)

`referenceId` for a non-built-in `WIDGET` is the provider's **flattened `ComponentName`**: `com.example.provider/.ExampleWidgetProvider`. The launcher export resolves a live numeric `appWidgetId` back to this string via `AppWidgetManager.getAppWidgetInfo(id)?.provider?.flattenToString()`.

```json
{
  "pageCoordX": 1,
  "pageCoordY": 0,
  "itemType": "WIDGET",
  "col": 1,
  "row": 1,
  "colSpan": 4,
  "rowSpan": 2,
  "referenceId": "com.example.provider/.ExampleWidgetProvider",
  "allowOverlap": true
}
```

Rules:

- **Never emit an integer host `appWidgetId`.** It is device-local and meaningless after a restore.
- On import, Android rewrites every non-built-in `WIDGET` reference to `placeholder:<reference>` after stripping any existing `placeholder:` prefix.
- The HOME grid renders that placeholder as a clickable `REBIND WIDGET` label. Tapping it tries a direct bind to the stored provider, falls back to `ACTION_APPWIDGET_BIND` consent and then the system `ACTION_APPWIDGET_PICK` picker, and writes the fresh numeric id only into the device DB. Status becomes `WIDGET REBOUND` or `WIDGET REBIND CANCELLED`.
- The web editor cannot render live system widgets. Show a labelled rectangle with the provider string; that is exactly what the portable reference carries.
- Legacy numeric placeholders such as `placeholder:52` are still accepted as import input, but they carry no provider and therefore always open the system picker. Prefer a real provider string.

### Custom WebView widgets (modular widgets)

Web-authored custom widgets are referenced from the layout by a stable ID and defined in the sidecar bundle (§9a):

```json
{
  "pageCoordX": 0,
  "pageCoordY": -1,
  "itemType": "WIDGET",
  "col": 1,
  "row": 1,
  "colSpan": 4,
  "rowSpan": 2,
  "referenceId": "custom:weather-card",
  "allowOverlap": true
}
```

Rules:

- `referenceId` is exactly `custom:<id>`, where `<id>` matches `[A-Za-z0-9._-]+`. No `widgetKind` key is emitted for custom widgets.
- The `<id>` must exist in the imported `voidlauncher-widgets.json` bundle, unless the user intentionally places an unavailable widget. An unavailable custom widget is **never dropped**: Android renders a `CUSTOM WIDGET MISSING` placeholder with the ID, and importing the bundle later lights it up.
- The bundle definition owns the label, default/minimum spans, overlap policy, and HTML/CSS/JS source. The layout only owns position and current span.
- The launcher renders the widget in a sandboxed `WebView`: JavaScript is on, but file/content access, universal file access, network loads, navigation, dialogs, storage and geolocation are blocked. There is no JavaScript bridge and no external resource loading. Keep all assets inline in the bundle.
- Unknown future widget schemes must survive an import → export round trip. If the reference is not `builtin:`, not `custom:`, and not a flattened component/provider string, treat it as an opaque string: preserve it and render a labelled placeholder rather than rejecting or rewriting it.

### App shortcuts

Product decisions no longer create new `APP_SHORTCUT` placements, but the format still supports them:

```json
{
  "pageCoordX": 0,
  "pageCoordY": 0,
  "itemType": "APP_SHORTCUT",
  "col": 1,
  "row": 1,
  "colSpan": 1,
  "rowSpan": 1,
  "referenceId": "com.example.app",
  "allowOverlap": false
}
```

---

# 6. App customizations

These are per-app label/style overrides, not grid items.

```json
{
  "packageName": "com.example.app",
  "isFavorite": false,
  "isHidden": false,
  "customNickname": "Mail",
  "fontFamily": "SANS",
  "fontSizeSp": 14.0,
  "fontWeight": "NORMAL",
  "letterSpacingSp": 0.0,
  "textColorHex": "#FFEDEDED",
  "textAlign": "START",
  "textTransform": "NONE"
}
```

| Key | Required | Default | Notes |
|---|---|---|---|
| `packageName` | Yes | — | Blank package names are skipped. Acts as primary key. |
| `isFavorite` | No | `false` |  |
| `isHidden` | No | `false` |  |
| `customNickname` | No | `null` |  |
| `fontFamily` | No | `null` | `MONOSPACE`, `SANS`, `SERIF`, `DISPLAY`. |
| `fontSizeSp` | No | `null` | Number. |
| `fontWeight` | No | `null` | `LIGHT`, `NORMAL`, `MEDIUM`, `BOLD`. |
| `letterSpacingSp` | No | `null` | Number. |
| `textColorHex` | No | `null` | Color string. |
| `textAlign` | No | `null` | `START`, `CENTER`, `END`. |
| `textTransform` | No | `null` | `NONE`, `LOWERCASE`, `UPPERCASE`. |

`null` means “use launcher default”. Omitted optional keys decode to `null` or `false` as shown.

`customNickname` is GLOBAL: it replaces the package label in the drawer, home shortcuts, `APP_LIST` rows and the widget picker. The drawer's per-app EDIT modal can instead store a DRAWER-ONLY nickname in DataStore (not in this backup format); in that case the global nickname is cleared for the package so the scopes stay unambiguous. `APP_LIST` membership is per widget placement.

---

# 7. Theme, palette, orientation

## Theme strings

Use uppercase enum names:

- `SYSTEM`
- `DARK`
- `LIGHT`
- `CUSTOM`

DataStore internally uses lowercase strings (`system`, `dark`, `light`, `custom`). Those are **not** backup values.

If `theme: "CUSTOM"` is emitted, also emit a `customPalette` for a deterministic result. If the palette is missing, the existing device palette remains.

## Custom palette

```json
{
  "background": "#FF080808",
  "surface": "#FF141414",
  "surfaceVariant": "#FF202020",
  "onBackground": "#FFEDEDED",
  "onSurface": "#FFEDEDED",
  "primary": "#FFE6E2D8",
  "secondary": "#FFA8A29A",
  "outline": "#FF3A3A3A"
}
```

All eight keys are required strings when `customPalette` is an object. Prefer `#AARRGGBB`. The parser does not validate palette colors; invalid colors fall back at render time.

Dark preset from the launcher:

```text
background      #FF080808
surface         #FF141414
surfaceVariant  #FF202020
onBackground    #FFEDEDED
onSurface       #FFEDEDED
primary         #FFE6E2D8
secondary       #FFA8A29A
outline         #FF3A3A3A
```

Light preset from the launcher:

```text
background      #FFF7F4EE
surface         #FFFFFCF8
surfaceVariant  #FFEDE6DA
onBackground    #FF1C1917
onSurface       #FF292524
primary         #FF43382E
secondary       #FF6B6157
outline         #FFD6CDBF
```

## Orientation

Use uppercase enum names:

- `PORTRAIT`
- `LANDSCAPE`
- `AUTO`

Invalid or missing values become `PORTRAIT` on import.

---

# 8. Backgrounds

There is no `NONE` kind. “No background” is the absence of a background row. Because an empty `backgrounds` array is an import no-op, the current Android importer cannot clear all backgrounds through JSON.

```json
{
  "scope": "GLOBAL",
  "kind": "COLOR",
  "colorHex": "#FF101010",
  "gradientAngle": 0.0
}
```

```json
{
  "scope": "PAGE",
  "pageCoordX": 1,
  "pageCoordY": 0,
  "kind": "GRADIENT",
  "gradientSpec": "#FF000000@0.0|#FFFFFFFF@1.0",
  "gradientAngle": 90.0
}
```

| Key | Required | Default | Notes |
|---|---|---|---|
| `scope` | Yes | — | `GLOBAL` or `PAGE`. Blank/unknown is skipped. |
| `pageCoordX` | PAGE only | `null` | Must match a page coordinate. |
| `pageCoordY` | PAGE only | `null` | Must match a page coordinate. |
| `kind` | Yes | — | `COLOR`, `GRADIENT`, or `IMAGE`. Blank/unknown is skipped. |
| `colorHex` | No | `null` | For `COLOR`. Accepts `#RRGGBB` or `#AARRGGBB`. Prefer `#AARRGGBB`. |
| `gradientSpec` | No | `null` | For `GRADIENT`. See below. |
| `gradientAngle` | No | `0.0` | Degrees. `0` = left-to-right, `90` = top-to-bottom. |
| `imageToken` | No | `null` | Opaque flat filename only. Never a `content://` URI. |
| `imageBase64` | No | `null` | Standard Base64 bytes for `IMAGE`. |

## Gradient spec format

```text
#AARRGGBB@0.0|#AARRGGBB@1.0
```

Rules:

- `2..5` stops.
- Separators: `|` between stops, `@` before position.
- Colors accept `#RRGGBB` or `#AARRGGBB`.
- Positions are finite floats in `0.0..1.0`.
- Stops are sorted by position on encode.
- Equal neighboring positions are allowed.
- Invalid specs decode to an empty stop list and render the theme background.

## Image rules

- `imageToken` must match `[A-Za-z0-9._-]+` and must not be `.` or `..`.
- The launcher stores bytes as `filesDir/backgrounds/<token>.img`.
- Raw exported images are capped at `2 * 1024 * 1024` bytes.
- Page precedence: page-specific row first, then global row.

---

# 9. Import behavior in the Android launcher

When the user imports the exported file:

1. `BackupManager.readFromUri` parses JSON. Wrong/missing `version` or malformed root JSON yields `INVALID OR UNSUPPORTED BACKUP FILE`.
2. Malformed individual rows are skipped; the rest still parse.
3. `BackupValidator.validate(payload)` runs. Any error aborts the whole import with `INVALID BACKUP DATA: <first error>` — see §4 and §11.
4. `repository.restore(payload)` runs in one Room transaction:
   - deletes all pages and app customizations;
   - old edges and grid items cascade-delete;
   - inserts each payload page and builds `oldPageId -> newRoomPageId`;
   - inserts a HOME page at `(0,0)` if missing;
   - guarantees at least one `APP_DRAWER` page, creating/converting at `(0,1)` if needed;
   - remaps edges through the ID map; dangling edges are dropped;
   - resolves items by `(pageCoordX, pageCoordY)`; unmatched items are dropped;
   - restores app customizations keyed by `packageName`.
5. Room page IDs and grid item IDs are regenerated. Only the JSON `pageId` consistency between `pages` and `edges` matters.
6. Home coordinate is set from `homeCoordX/homeCoordY`.
7. Theme is applied with `ThemeMode.valueOf(payload.theme)`; invalid theme leaves the previous theme unchanged.
8. `MainActivity` applies orientation, coordinate-detail, and custom palette. A missing palette clears the previous custom palette.
9. Backgrounds are restored by page coordinates. Valid rows replace all backgrounds. Invalid rows are skipped. Empty array is a no-op.
10. Status is `BACKUP RESTORED (N LINKS)`, or `BACKUP RESTORED (N ITEMS SKIPPED)` / `BACKUP RESTORED (PAGES SYNTHESIZED)` when the restore reports skips or synthesized pages.

Not restored by this format:

- gesture bindings;
- pinned apps;
- live Android widget IDs / widget host state;
- background `id` values;
- grid `itemId` / `themeId`;
- any field not listed in this document.

---

# 9a. Custom widget bundle file

**File:** `voidlauncher-widgets.json` · MIME `application/json` · UTF-8 · 2-space pretty print · version `1`.

This is the sidecar that makes widgets modular. It contains definitions only; the layout file references them by `custom:<id>`.

```json
{
  "version": 1,
  "widgets": [
    {
      "id": "weather-card",
      "name": "Weather Card",
      "runtime": "WEBVIEW",
      "colSpan": 4,
      "rowSpan": 2,
      "minColSpan": 2,
      "minRowSpan": 1,
      "allowResize": true,
      "allowOverlap": true,
      "html": "<div class='card'><h1>18°</h1><p>Clear</p></div>",
      "css": ".card{padding:16px;text-align:center}",
      "js": ""
    }
  ]
}
```

Root keys:

| Key | Required | Notes |
|---|---|---|
| `version` | Yes | Must be `1`. |
| `widgets` | Yes | Array; may be empty. Order is preserved on export. |

Widget fields:

| Key | Required | Notes |
|---|---|---|
| `id` | Yes | `[A-Za-z0-9._-]+`, unique, max 64 chars. Stable across devices. |
| `name` | Yes | Non-empty display label, max 64 chars. |
| `runtime` | Yes | Only `WEBVIEW` in version 1. Unknown runtimes must be preserved but rendered as a placeholder. |
| `colSpan`, `rowSpan` | Yes | Positive defaults, `<= 10` / `<= 20`. |
| `minColSpan`, `minRowSpan` | No | Default `1`; must be `<=` the matching default span. |
| `allowResize` | No | Default `true`. |
| `allowOverlap` | No | Default `true`. |
| `html` | Yes | Non-empty inline HTML fragment. No external URLs, `<script src>`, `<link>`, iframes or images. |
| `css` | No | Inline CSS string. |
| `js` | No | Inline JavaScript string. Executed in the sandbox described in §5a. |

Validation rules (mirror of Android's bundle validator):

- Unknown root/widget keys are ignored but preserved on round trip where practical.
- Duplicate IDs, invalid ID characters, empty names, empty HTML, bad spans, and payloads over 256 KB per widget are rejected with the first error.
- The whole bundle is rejected on any error; there is no partial import.
- Missing `css`/`js` decode to empty strings.

Import/export behavior:

- Android `EXPORT` always writes this file, even when `widgets` is empty, so export → import → export is stable.
- Android `IMPORT` accepts the layout and this bundle in the same multi-file SAF selection, in either order. A bundle-only import updates definitions and rehydrates existing `CUSTOM WIDGET MISSING` placeholders without changing the layout.
- A layout-only import keeps custom references even when the definitions are absent; those items render as missing-widget placeholders and are never dropped.
- The web editor must offer parallel import/export for both files and keep bundle definitions in `localStorage`.

---

# 9b. Device inventory file

**File:** `voidlauncher-inventory.json` · MIME `application/json` · UTF-8 · 2-space pretty print · version `1`.

The web editor is frontend-only and cannot query the phone. This export-only file is how it learns what the device has, so it can offer only widgets/apps that can actually fit.

```json
{
  "version": 1,
  "generatedAt": "2026-11-21T19:20:00Z",
  "grid": { "cols": 10, "rows": 20 },
  "builtInWidgets": ["APP_LIST", "CLOCK", "PAGE_INFO"],
  "apps": [
    { "packageName": "com.example.mail", "label": "Mail" }
  ],
  "systemWidgets": [
    {
      "provider": "com.example.weather/.WeatherWidget",
      "label": "Weather",
      "minColSpan": 4,
      "minRowSpan": 2
    }
  ]
}
```

Rules:

- `provider` is a flattened `ComponentName`, identical to the `referenceId` used for system widget items in §5.
- `builtInWidgets` is the live enum from the launcher build; treat it as authoritative for that device/app version.
- The inventory is informational. The launcher does not import it; the web editor does.
- Export it from the launcher's `BACKUP & RESTORE` screen with a separate `EXPORT DEVICE INVENTORY` action.
- The web editor should use it to populate app-shortcut and system-widget palettes, prefill default spans, and flag custom widgets that depend on unavailable providers.

---

# 10. Canonical default state

Use this as a reset/default template. It creates the launcher's five-page starter map with bidirectional HOME links.

```json
{
  "version": 1,
  "homeCoordX": 0,
  "homeCoordY": 0,
  "theme": "SYSTEM",
  "orientation": "PORTRAIT",
  "showCoordinateDetail": true,
  "customPalette": null,
  "backgrounds": [],
  "pages": [
    { "pageId": 1, "coordX": 0,  "coordY": 0,  "title": "Home",       "gridCols": 10, "gridRows": 20, "isSecret": false, "pageType": "HOME" },
    { "pageId": 2, "coordX": 1,  "coordY": 0,  "title": "Page 1,0",   "gridCols": 10, "gridRows": 20, "isSecret": false, "pageType": "WIDGET" },
    { "pageId": 3, "coordX": -1, "coordY": 0,  "title": "Page -1,0",  "gridCols": 10, "gridRows": 20, "isSecret": false, "pageType": "WIDGET" },
    { "pageId": 4, "coordX": 0,  "coordY": -1, "title": "Page 0,-1",  "gridCols": 10, "gridRows": 20, "isSecret": false, "pageType": "WIDGET" },
    { "pageId": 5, "coordX": 0,  "coordY": 1,  "title": "Page 0,1",   "gridCols": 10, "gridRows": 20, "isSecret": false, "pageType": "APP_DRAWER" }
  ],
  "edges": [
    { "fromPageId": 1, "swipeDirection": "RIGHT", "toPageId": 2 },
    { "fromPageId": 1, "swipeDirection": "LEFT",  "toPageId": 3 },
    { "fromPageId": 1, "swipeDirection": "UP",    "toPageId": 4 },
    { "fromPageId": 1, "swipeDirection": "DOWN",  "toPageId": 5 },
    { "fromPageId": 2, "swipeDirection": "LEFT",  "toPageId": 1 },
    { "fromPageId": 3, "swipeDirection": "RIGHT", "toPageId": 1 },
    { "fromPageId": 4, "swipeDirection": "DOWN",  "toPageId": 1 },
    { "fromPageId": 5, "swipeDirection": "UP",    "toPageId": 1 }
  ],
  "items": [
    {
      "pageCoordX": 0,
      "pageCoordY": 0,
      "itemType": "WIDGET",
      "col": 1,
      "row": 1,
      "colSpan": 2,
      "rowSpan": 2,
      "referenceId": "builtin:PAGE_INFO",
      "allowOverlap": true,
      "widgetKind": "PAGE_INFO"
    }
  ],
  "customizations": []
}
```

Note: importing this template does not clear existing backgrounds because `backgrounds` is empty.

---

# 11. Web editor validation checklist

Before enabling export, validate:

- [ ] Root `version === 1` as a number.
- [ ] All four arrays are present.
- [ ] Page IDs are unique, small, safe integers.
- [ ] Page coordinates are integers in `-10..10`.
- [ ] Page coordinates are unique.
- [ ] `homeCoord` points to an existing non-drawer page.
- [ ] `gridCols`/`gridRows` are positive.
- [ ] Edge endpoints exist and no edge points to itself.
- [ ] At most one edge per `(fromPageId, swipeDirection)`, and all targets for a slot agree.
- [ ] Every page has at least one incident edge.
- [ ] Every page can reach HOME after bidirectional edge expansion.
- [ ] Bidirectional link UI emits both directed rows (half-links are legal but less explicit).
- [ ] Item page coordinates exist.
- [ ] Item `col >= 1` and `row >= 1` (validator rejects 0).
- [ ] Item spans are positive and fit the target page grid.
- [ ] Item rectangles do not violate overlap rules.
- [ ] No widget items are placed on `APP_DRAWER` pages.
- [ ] Built-in widgets have matching `widgetKind` and `referenceId`.
- [ ] Built-in spans use `CLOCK 4x2`, `APP_LIST 4x3`, `PAGE_INFO 2x2` unless deliberately resized.
- [ ] `APP_LIST` packages are trimmed, distinct, sorted, newline-delimited, or omitted.
- [ ] `custom:<id>` references use a valid ID; missing definitions are explicitly allowed as placeholders, never silently dropped.
- [ ] Unknown widget reference schemes are preserved verbatim for round-trip, not rewritten.
- [ ] No live `appWidgetId`, `itemId`, `themeId`, gesture binding, or pinned-app field is emitted.
- [ ] Non-built-in, non-custom widget `referenceId` is a flattened provider string, never a number.
- [ ] Custom bundle: `version === 1`, IDs unique and filename-safe, names/HTML non-empty, spans within `10 x 20`, payload under 256 KB per widget.
- [ ] Inventory: `version === 1`, `grid.cols === 10`, `grid.rows === 20`, provider strings are flattened component names.
- [ ] Theme/orientation/palette enum strings are uppercase.
- [ ] Gradient specs have `2..5` valid sorted stops in `0..1`.
- [ ] Image tokens are flat filename-safe strings and Base64 payloads are reasonable in size.

---

# 12. Build order for the Next.js slice

## Module A — Map (do this first)

1. Seed state from the canonical template in §10.
2. Render the lattice with the geometry table above: 16:9 portrait tiles, dotted grid, 2 margin cells, Y inverted, all four direction slots drawn per page.
3. Pan/zoom with pointer drag + wheel/pinch, clamped to `0.35..2.5`, centred on the current page at first render.
4. `+` previews only on empty orthogonal neighbours of existing pages; adding a page asks for `WIDGET` or `APP_DRAWER`.
5. Long-press/click to select, drag to move, rename, and set HOME (never a drawer page).
6. One user link toggle emits both directed rows and removes both; block a removal that strands a page (§4).
7. Show validation errors inline from the §11 checklist, especially "no path to HOME".

## Module B — Import / export

1. Export three independent documents via `Blob` + object URL (no network): layout `voidlauncher-backup.json`, custom bundle `voidlauncher-widgets.json`, and, when the user asks for a device snapshot, inventory `voidlauncher-inventory.json`.
2. Import local files with `FileReader` and `multiple`; `JSON.parse`, classify by root keys, validate with §11, then replace the matching document. Show the first error and keep the old document on failure.
3. Persist layout, bundle and inventory separately in `localStorage`; offer a "load canonical default" action that merges the §10 template.
4. Round-trip check: export → import → export must produce deep-equal documents for layout and bundle.
5. Treat a `custom:<id>` reference whose definition is absent as a valid placeholder; show it clearly but do not block export.

## Module C — Custom widgets

1. Let users create/edit/delete widget definitions with the §9a fields; store HTML/CSS/JS inline and render an iframe preview where possible.
2. Expose only runtimes the launcher understands (`WEBVIEW`); preserve unknown runtime strings on round trip and show a placeholder.
3. Use §9b inventory to populate app/system-widget choices and to warn when a referenced provider is not installed on the target device.
4. Never emit network URLs, external scripts/styles, `window` bridges or device-specific IDs inside a custom widget definition.

## Defer

- Grid/items editor, theme/palette/background editors, app customizations — data shapes are already in §5–§8, but these are a later slice.
- Native/system widget previews — show labelled rectangles; only web-authored `WEBVIEW` widgets can be previewed in the browser.
- Gesture bindings — still not part of the version-1 backup format.
- `PAGE_INFO` has shipped: render it as a built-in widget card using `widgetKind`/`referenceId` and the 2×2 default span. The fixed coordinate badge is gone.

## Avoid

- Do not depend on Android resource IDs or `dp` units in exported data; the geometry table is render-only.
- Do not emit system widget provider live IDs, `itemId`, `themeId`, or host widget ids.
- Do not add a server, API route, or external storage; everything is browser-local.
