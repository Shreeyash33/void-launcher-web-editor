import {
  COORD_MAX,
  COORD_MIN,
  OPPOSITE,
  PALETTE_KEYS,
  type Edge,
  type LayoutDocument,
  type Page,
} from "./model";

export interface ValidationIssue {
  code: string;
  message: string;
  pageId?: number;
  coord?: { x: number; y: number };
}

const STRANDING_CODES = new Set(["PAGE WITHOUT CONNECTION", "PAGE WITHOUT PATH TO HOME"]);

function issue(code: string, message: string, page?: Page, coord?: { x: number; y: number }): ValidationIssue {
  return { code, message, ...(page ? { pageId: page.pageId } : {}), ...(coord ? { coord } : {}) };
}

function validInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function validateLayout(doc: LayoutDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (doc.version !== 1) {
    issues.push(issue("UNSUPPORTED VERSION", `UNSUPPORTED VERSION ${doc.version}`));
  }

  if (doc.pages.length === 0) {
    issues.push(issue("NO PAGES", "NO PAGES"));
    return issues;
  }

  const byId = new Map<number, Page>();
  const byCoord = new Map<string, Page>();

  for (const page of doc.pages) {
    if (byId.has(page.pageId)) {
      issues.push(issue("DUPLICATE PAGE ID", `DUPLICATE PAGE ID ${page.pageId}`, page));
    }
    byId.set(page.pageId, page);

    const key = `${page.coordX},${page.coordY}`;
    if (byCoord.has(key)) {
      issues.push(issue("DUPLICATE PAGE COORD", `DUPLICATE PAGE COORD ${page.coordX},${page.coordY}`, page, { x: page.coordX, y: page.coordY }));
    }
    byCoord.set(key, page);

    if (page.coordX < COORD_MIN || page.coordX > COORD_MAX || page.coordY < COORD_MIN || page.coordY > COORD_MAX) {
      issues.push(issue("PAGE COORD OUT OF RANGE", `PAGE COORD OUT OF RANGE ${page.pageId} ${page.coordX},${page.coordY}`, page));
    }
    if (!validInteger(page.gridCols) || page.gridCols <= 0) {
      issues.push(issue("INVALID GRID COLS", `INVALID GRID COLS ${page.pageId}`, page));
    }
    if (!validInteger(page.gridRows) || page.gridRows <= 0) {
      issues.push(issue("INVALID GRID ROWS", `INVALID GRID ROWS ${page.pageId}`, page));
    }
  }

  const home = byCoord.get(`${doc.homeCoordX},${doc.homeCoordY}`);
  if (!home) {
    issues.push(issue("MISSING HOME PAGE", `MISSING HOME PAGE ${doc.homeCoordX},${doc.homeCoordY}`));
  } else if (home.pageType === "APP_DRAWER") {
    issues.push(issue("HOME PAGE IS APP DRAWER", `HOME PAGE IS APP DRAWER ${home.pageId}`, home));
  }

  const slots = new Map<string, number>();
  for (const edge of doc.edges) {
    const from = byId.get(edge.fromPageId);
    const to = byId.get(edge.toPageId);
    if (!from || !to) {
      issues.push(issue("DANGLING EDGE", `DANGLING EDGE ${edge.fromPageId} ${edge.swipeDirection} ${edge.toPageId}`, from ?? to));
    }
    if (edge.fromPageId === edge.toPageId) {
      issues.push(issue("SELF EDGE", `SELF EDGE ${edge.fromPageId}`, from));
    }
    const slot = `${edge.fromPageId}:${edge.swipeDirection}`;
    const count = (slots.get(slot) ?? 0) + 1;
    slots.set(slot, count);
    if (count === 2) {
      issues.push(issue("CONFLICTING EDGE SLOT", `CONFLICTING EDGE SLOT ${edge.fromPageId} ${edge.swipeDirection}`, from));
    }
  }

  const incident = new Set<number>();
  for (const edge of doc.edges) {
    if (byId.has(edge.fromPageId) && byId.has(edge.toPageId)) {
      incident.add(edge.fromPageId);
      incident.add(edge.toPageId);
    }
  }
  for (const page of doc.pages) {
    if (!incident.has(page.pageId)) {
      issues.push(issue("PAGE WITHOUT CONNECTION", `PAGE WITHOUT CONNECTION ${page.pageId}`, page));
    }
  }

  if (home) {
    const adjacency = new Map<number, Set<number>>();
    const add = (a: number, b: number) => {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a)!.add(b);
    };
    for (const edge of doc.edges) {
      if (!byId.has(edge.fromPageId) || !byId.has(edge.toPageId)) continue;
      add(edge.fromPageId, edge.toPageId);
      add(edge.toPageId, edge.fromPageId);
    }
    const visited = new Set<number>([home.pageId]);
    const queue = [home.pageId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    for (const page of doc.pages) {
      if (!visited.has(page.pageId)) {
        issues.push(issue("PAGE WITHOUT PATH TO HOME", `PAGE WITHOUT PATH TO HOME ${page.pageId}`, page));
      }
    }
  }

  for (const item of doc.items) {
    const page = byCoord.get(`${item.pageCoordX},${item.pageCoordY}`);
    if (!page) {
      issues.push(issue("ITEM PAGE NOT FOUND", `ITEM PAGE NOT FOUND ${item.pageCoordX},${item.pageCoordY}`, undefined, { x: item.pageCoordX, y: item.pageCoordY }));
      continue;
    }
    if (item.itemType !== "WIDGET" && item.itemType !== "APP_SHORTCUT") {
      issues.push(issue("INVALID ITEM TYPE", `INVALID ITEM TYPE ${item.itemType}`, page));
    }
    if (!validInteger(item.col) || item.col < 1) {
      issues.push(issue("INVALID ITEM COL", `INVALID ITEM COL ${item.col}`, page));
    }
    if (!validInteger(item.row) || item.row < 1) {
      issues.push(issue("INVALID ITEM ROW", `INVALID ITEM ROW ${item.row}`, page));
    }
    const colSpanOk = validInteger(item.colSpan) && item.colSpan > 0;
    const rowSpanOk = validInteger(item.rowSpan) && item.rowSpan > 0;
    if (!colSpanOk) issues.push(issue("INVALID ITEM COL SPAN", `INVALID ITEM COL SPAN ${item.colSpan}`, page));
    if (!rowSpanOk) issues.push(issue("INVALID ITEM ROW SPAN", `INVALID ITEM ROW SPAN ${item.rowSpan}`, page));
    if (colSpanOk && item.col + item.colSpan > page.gridCols) {
      issues.push(issue("ITEM EXCEEDS GRID COLS", `ITEM EXCEEDS GRID COLS ${item.pageCoordX},${item.pageCoordY}`, page));
    }
    if (rowSpanOk && item.row + item.rowSpan > page.gridRows) {
      issues.push(issue("ITEM EXCEEDS GRID ROWS", `ITEM EXCEEDS GRID ROWS ${item.pageCoordX},${item.pageCoordY}`, page));
    }
    if (!item.referenceId || item.referenceId.trim().length === 0) {
      issues.push(issue("BLANK ITEM REFERENCE", `BLANK ITEM REFERENCE ${item.pageCoordX},${item.pageCoordY}`, page));
    } else if (item.referenceId.startsWith("custom:")) {
      const id = item.referenceId.slice("custom:".length);
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) {
        issues.push(issue("INVALID CUSTOM WIDGET REFERENCE", `INVALID CUSTOM WIDGET REFERENCE ${item.referenceId}`, page));
      }
    }
  }

  for (const customization of doc.customizations) {
    if (!customization.packageName || customization.packageName.trim().length === 0) {
      issues.push(issue("BLANK CUSTOMIZATION PACKAGE", "BLANK CUSTOMIZATION PACKAGE"));
    }
  }

  for (const background of doc.backgrounds) {
    if (background.scope !== "GLOBAL" && background.scope !== "PAGE") {
      issues.push(issue("INVALID BACKGROUND SCOPE", `INVALID BACKGROUND SCOPE ${background.scope}`));
    }
    if (background.kind !== "COLOR" && background.kind !== "GRADIENT" && background.kind !== "IMAGE") {
      issues.push(issue("INVALID BACKGROUND KIND", `INVALID BACKGROUND KIND ${background.kind}`));
    }
    if (background.scope === "PAGE") {
      if (background.pageCoordX == null || background.pageCoordY == null) {
        issues.push(issue("PAGE BACKGROUND MISSING COORDS", "PAGE BACKGROUND MISSING COORDS"));
      } else if (!byCoord.has(`${background.pageCoordX},${background.pageCoordY}`)) {
        issues.push(issue("PAGE BACKGROUND COORD NOT FOUND", `PAGE BACKGROUND COORD NOT FOUND ${background.pageCoordX},${background.pageCoordY}`));
      }
    } else if (background.scope === "GLOBAL" && (background.pageCoordX != null || background.pageCoordY != null)) {
      issues.push(issue("GLOBAL BACKGROUND HAS PAGE COORDS", "GLOBAL BACKGROUND HAS PAGE COORDS"));
    }
    if (background.kind === "IMAGE") {
      if (background.imageToken != null) {
        const token = background.imageToken;
        if (!/^[A-Za-z0-9._-]+$/.test(token) || token === "." || token === "..") {
          issues.push(issue("INVALID IMAGE TOKEN", `INVALID IMAGE TOKEN ${token}`));
        }
      }
      if (background.imageBase64 != null && background.imageBase64.trim().length === 0) {
        issues.push(issue("BLANK IMAGE BASE64", "BLANK IMAGE BASE64"));
      }
    }
  }

  if (doc.theme !== "SYSTEM" && doc.theme !== "DARK" && doc.theme !== "LIGHT" && doc.theme !== "CUSTOM") {
    issues.push(issue("INVALID THEME", `INVALID THEME ${doc.theme}`));
  }
  if (doc.orientation !== "PORTRAIT" && doc.orientation !== "LANDSCAPE" && doc.orientation !== "AUTO") {
    issues.push(issue("INVALID ORIENTATION", `INVALID ORIENTATION ${doc.orientation}`));
  }
  if (doc.customPalette) {
    for (const key of PALETTE_KEYS) {
      const value = doc.customPalette[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push(issue("BLANK PALETTE COLOR", `BLANK PALETTE COLOR ${key.toUpperCase()}`));
      }
    }
  }

  return issues;
}

export function findNewStrandingError(before: LayoutDocument, after: LayoutDocument): ValidationIssue | null {
  const beforeMessages = new Set(
    validateLayout(before)
      .filter((i) => STRANDING_CODES.has(i.code))
      .map((i) => i.message),
  );
  return (
    validateLayout(after).find((i) => STRANDING_CODES.has(i.code) && !beforeMessages.has(i.message)) ?? null
  );
}

export function edgesWithoutPage(edges: Edge[], pageId: number): Edge[] {
  return edges.filter((e) => e.fromPageId !== pageId && e.toPageId !== pageId);
}

export function removeEdgePair(edges: Edge[], a: Page, b: Page): Edge[] {
  const dir = (() => {
    const dx = b.coordX - a.coordX;
    const dy = b.coordY - a.coordY;
    if (dx === 1 && dy === 0) return "RIGHT" as const;
    if (dx === -1 && dy === 0) return "LEFT" as const;
    if (dx === 0 && dy === 1) return "DOWN" as const;
    if (dx === 0 && dy === -1) return "UP" as const;
    return null;
  })();
  if (!dir) return edges;
  const opposite = OPPOSITE[dir];
  return edges.filter(
    (e) =>
      !(e.fromPageId === a.pageId && e.swipeDirection === dir && e.toPageId === b.pageId) &&
      !(e.fromPageId === b.pageId && e.swipeDirection === opposite && e.toPageId === a.pageId),
  );
}
