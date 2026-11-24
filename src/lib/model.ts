export type PageType = "HOME" | "WIDGET" | "APP_DRAWER";
export type GridItemType = "APP_SHORTCUT" | "WIDGET";
export type BuiltInWidgetKind = "APP_LIST" | "CLOCK" | "PAGE_INFO";
export type SwipeDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type ThemeMode = "SYSTEM" | "DARK" | "LIGHT" | "CUSTOM";
export type OrientationMode = "PORTRAIT" | "LANDSCAPE" | "AUTO";
export type BackgroundKind = "COLOR" | "GRADIENT" | "IMAGE";
export type BackgroundScope = "GLOBAL" | "PAGE";

export interface Page {
  pageId: number;
  coordX: number;
  coordY: number;
  title: string;
  gridCols: number;
  gridRows: number;
  isSecret: boolean;
  pageType: PageType;
}

export interface Edge {
  fromPageId: number;
  swipeDirection: SwipeDirection;
  toPageId: number;
}

export interface GridItem {
  pageCoordX: number;
  pageCoordY: number;
  itemType: GridItemType;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  referenceId: string;
  allowOverlap?: boolean;
  widgetKind?: BuiltInWidgetKind;
  appListPackages?: string | null;
}

export interface CustomPalette {
  background: string;
  surface: string;
  surfaceVariant: string;
  onBackground: string;
  onSurface: string;
  primary: string;
  secondary: string;
  outline: string;
}

export interface Background {
  scope: BackgroundScope;
  pageCoordX?: number | null;
  pageCoordY?: number | null;
  kind: BackgroundKind;
  colorHex?: string | null;
  gradientSpec?: string | null;
  gradientAngle?: number;
  imageToken?: string | null;
  imageBase64?: string | null;
}

export interface AppCustomization {
  packageName: string;
  isFavorite?: boolean;
  isHidden?: boolean;
  customNickname?: string | null;
  fontFamily?: string | null;
  fontSizeSp?: number | null;
  fontWeight?: string | null;
  letterSpacingSp?: number | null;
  textColorHex?: string | null;
  textAlign?: string | null;
  textTransform?: string | null;
}

export interface LayoutDocument {
  version: 1;
  homeCoordX: number;
  homeCoordY: number;
  theme: ThemeMode;
  orientation: OrientationMode;
  showCoordinateDetail: boolean;
  customPalette: CustomPalette | null;
  backgrounds: Background[];
  pages: Page[];
  edges: Edge[];
  items: GridItem[];
  customizations: AppCustomization[];
}

export interface CustomWidgetDefinition {
  id: string;
  name: string;
  runtime: string;
  colSpan: number;
  rowSpan: number;
  minColSpan?: number;
  minRowSpan?: number;
  allowResize?: boolean;
  allowOverlap?: boolean;
  html: string;
  css?: string;
  js?: string;
}

export interface WidgetBundle {
  version: 1;
  widgets: CustomWidgetDefinition[];
}

export interface InventoryApp {
  packageName: string;
  label: string;
}

export interface InventorySystemWidget {
  provider: string;
  label: string;
  minColSpan: number;
  minRowSpan: number;
}

export interface DeviceInventory {
  version: 1;
  generatedAt?: string;
  launcherVersion?: string;
  contractVersion?: number;
  device?: {
    manufacturer?: string;
    brand?: string;
    model?: string;
    device?: string;
    name?: string;
    androidVersion?: string;
    sdkInt?: number;
    screen?: {
      widthPx?: number;
      heightPx?: number;
      densityDpi?: number;
      density?: number;
      orientation?: string;
      aspectRatio?: number;
    };
  };
  grid: { cols: number; rows: number };
  builtInWidgets: BuiltInWidgetKind[];
  apps: InventoryApp[];
  systemWidgets: InventorySystemWidget[];
}

export const COORD_MIN = -10;
export const COORD_MAX = 10;

export const DIRECTIONS: SwipeDirection[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export const OPPOSITE: Record<SwipeDirection, SwipeDirection> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

export const PALETTE_KEYS = [
  "background",
  "surface",
  "surfaceVariant",
  "onBackground",
  "onSurface",
  "primary",
  "secondary",
  "outline",
] as const;

const THEMES: ThemeMode[] = ["SYSTEM", "DARK", "LIGHT", "CUSTOM"];
const ORIENTATIONS: OrientationMode[] = ["PORTRAIT", "LANDSCAPE", "AUTO"];

export function createCanonicalLayout(): LayoutDocument {
  return {
    version: 1,
    homeCoordX: 0,
    homeCoordY: 0,
    theme: "SYSTEM",
    orientation: "PORTRAIT",
    showCoordinateDetail: true,
    customPalette: null,
    backgrounds: [],
    pages: [
      { pageId: 1, coordX: 0, coordY: 0, title: "Home", gridCols: 10, gridRows: 20, isSecret: false, pageType: "HOME" },
      { pageId: 2, coordX: 1, coordY: 0, title: "Page 1,0", gridCols: 10, gridRows: 20, isSecret: false, pageType: "WIDGET" },
      { pageId: 3, coordX: -1, coordY: 0, title: "Page -1,0", gridCols: 10, gridRows: 20, isSecret: false, pageType: "WIDGET" },
      { pageId: 4, coordX: 0, coordY: -1, title: "Page 0,-1", gridCols: 10, gridRows: 20, isSecret: false, pageType: "WIDGET" },
      { pageId: 5, coordX: 0, coordY: 1, title: "Page 0,1", gridCols: 10, gridRows: 20, isSecret: false, pageType: "APP_DRAWER" },
    ],
    edges: [
      { fromPageId: 1, swipeDirection: "RIGHT", toPageId: 2 },
      { fromPageId: 1, swipeDirection: "LEFT", toPageId: 3 },
      { fromPageId: 1, swipeDirection: "UP", toPageId: 4 },
      { fromPageId: 1, swipeDirection: "DOWN", toPageId: 5 },
      { fromPageId: 2, swipeDirection: "LEFT", toPageId: 1 },
      { fromPageId: 3, swipeDirection: "RIGHT", toPageId: 1 },
      { fromPageId: 4, swipeDirection: "DOWN", toPageId: 1 },
      { fromPageId: 5, swipeDirection: "UP", toPageId: 1 },
    ],
    items: [
      {
        pageCoordX: 0,
        pageCoordY: 0,
        itemType: "WIDGET",
        col: 1,
        row: 1,
        colSpan: 2,
        rowSpan: 2,
        referenceId: "builtin:PAGE_INFO",
        allowOverlap: true,
        widgetKind: "PAGE_INFO",
      },
    ],
    customizations: [],
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizePage(raw: unknown): Page | null {
  const p = asObject(raw);
  if (!p) return null;
  const type = asString(p.pageType, "WIDGET");
  return {
    pageId: asInt(p.pageId, 0),
    coordX: asInt(p.coordX, 0),
    coordY: asInt(p.coordY, 0),
    title: asString(p.title, ""),
    gridCols: Math.max(1, asInt(p.gridCols, 10)),
    gridRows: Math.max(1, asInt(p.gridRows, 20)),
    isSecret: p.isSecret === true,
    pageType: type === "HOME" || type === "APP_DRAWER" ? type : "WIDGET",
  };
}

function normalizeEdge(raw: unknown): Edge | null {
  const e = asObject(raw);
  if (!e) return null;
  const dir = asString(e.swipeDirection, "UP");
  if (dir !== "UP" && dir !== "DOWN" && dir !== "LEFT" && dir !== "RIGHT") return null;
  return {
    fromPageId: asInt(e.fromPageId, 0),
    swipeDirection: dir,
    toPageId: asInt(e.toPageId, 0),
  };
}

function normalizeItem(raw: unknown): GridItem | null {
  const i = asObject(raw);
  if (!i) return null;
  const itemType = asString(i.itemType, "WIDGET") === "APP_SHORTCUT" ? "APP_SHORTCUT" : "WIDGET";
  const kind = asString(i.widgetKind, "");
  return {
    pageCoordX: asInt(i.pageCoordX, 0),
    pageCoordY: asInt(i.pageCoordY, 0),
    itemType,
    col: asInt(i.col, 1),
    row: asInt(i.row, 1),
    colSpan: Math.max(1, asInt(i.colSpan, 1)),
    rowSpan: Math.max(1, asInt(i.rowSpan, 1)),
    referenceId: asString(i.referenceId, ""),
    allowOverlap: i.allowOverlap === true,
    ...(kind === "APP_LIST" || kind === "CLOCK" || kind === "PAGE_INFO" ? { widgetKind: kind } : {}),
    ...(typeof i.appListPackages === "string" ? { appListPackages: i.appListPackages } : {}),
  };
}

export function normalizeLayout(raw: unknown): LayoutDocument {
  const r = asObject(raw);
  if (!r) return createCanonicalLayout();

  const pages = Array.isArray(r.pages)
    ? r.pages.map(normalizePage).filter((p): p is Page => !!p)
    : [];
  if (pages.length === 0) return createCanonicalLayout();

  const edges = Array.isArray(r.edges) ? r.edges.map(normalizeEdge).filter((e): e is Edge => !!e) : [];
  const items = Array.isArray(r.items) ? r.items.map(normalizeItem).filter((i): i is GridItem => !!i) : [];
  const theme = asString(r.theme, "SYSTEM");
  const orientation = asString(r.orientation, "PORTRAIT");

  return {
    version: 1,
    homeCoordX: asInt(r.homeCoordX, 0),
    homeCoordY: asInt(r.homeCoordY, 0),
    theme: THEMES.includes(theme as ThemeMode) ? (theme as ThemeMode) : "SYSTEM",
    orientation: ORIENTATIONS.includes(orientation as OrientationMode) ? (orientation as OrientationMode) : "PORTRAIT",
    showCoordinateDetail: r.showCoordinateDetail !== false,
    customPalette: asObject(r.customPalette) as CustomPalette | null,
    backgrounds: Array.isArray(r.backgrounds) ? (r.backgrounds as Background[]) : [],
    pages,
    edges,
    items,
    customizations: Array.isArray(r.customizations) ? (r.customizations as AppCustomization[]) : [],
  };
}

export function isHomePage(layout: LayoutDocument, page: Page): boolean {
  return page.coordX === layout.homeCoordX && page.coordY === layout.homeCoordY;
}

export function effectivePageType(layout: LayoutDocument, page: Page): PageType {
  if (page.pageType === "APP_DRAWER") return "APP_DRAWER";
  if (isHomePage(layout, page) || page.pageType === "HOME") return "HOME";
  return "WIDGET";
}

export function pageAt(layout: LayoutDocument, x: number, y: number): Page | undefined {
  return layout.pages.find((p) => p.coordX === x && p.coordY === y);
}

export function nextPageId(layout: LayoutDocument): number {
  return Math.max(0, ...layout.pages.map((p) => p.pageId)) + 1;
}

export function directionBetween(from: Page, to: Page): SwipeDirection | null {
  const dx = to.coordX - from.coordX;
  const dy = to.coordY - from.coordY;
  if (dx === 1 && dy === 0) return "RIGHT";
  if (dx === -1 && dy === 0) return "LEFT";
  if (dx === 0 && dy === 1) return "DOWN";
  if (dx === 0 && dy === -1) return "UP";
  return null;
}

export function addBidirectionalLink(edges: Edge[], a: Page, b: Page): Edge[] {
  const dir = directionBetween(a, b);
  if (!dir) return edges;
  const opposite = OPPOSITE[dir];
  const filtered = edges.filter(
    (e) =>
      !(e.fromPageId === a.pageId && e.swipeDirection === dir) &&
      !(e.fromPageId === b.pageId && e.swipeDirection === opposite),
  );
  return [
    ...filtered,
    { fromPageId: a.pageId, swipeDirection: dir, toPageId: b.pageId },
    { fromPageId: b.pageId, swipeDirection: opposite, toPageId: a.pageId },
  ];
}

export function removeBidirectionalLink(edges: Edge[], a: Page, b: Page): Edge[] {
  const dir = directionBetween(a, b);
  if (!dir) return edges;
  const opposite = OPPOSITE[dir];
  return edges.filter(
    (e) =>
      !(e.fromPageId === a.pageId && e.swipeDirection === dir && e.toPageId === b.pageId) &&
      !(e.fromPageId === b.pageId && e.swipeDirection === opposite && e.toPageId === a.pageId),
  );
}

export function hasLink(edges: Edge[], a: Page, b: Page): boolean {
  const dir = directionBetween(a, b);
  if (!dir) return false;
  const opposite = OPPOSITE[dir];
  return edges.some(
    (e) =>
      (e.fromPageId === a.pageId && e.swipeDirection === dir && e.toPageId === b.pageId) ||
      (e.fromPageId === b.pageId && e.swipeDirection === opposite && e.toPageId === a.pageId),
  );
}

export function cloneLayout(layout: LayoutDocument): LayoutDocument {
  return structuredClone(layout);
}
