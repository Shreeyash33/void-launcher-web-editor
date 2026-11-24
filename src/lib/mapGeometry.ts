import type { Page } from "./model";

export const TILE_HEIGHT = 140;
export const TILE_WIDTH = (TILE_HEIGHT * 9) / 16;
export const GAP = 28;
export const STRIDE_X = TILE_WIDTH + GAP;
export const STRIDE_Y = TILE_HEIGHT + GAP;
export const MIN_SCALE = 0.35;
export const MAX_SCALE = 2.5;
export const MARGIN_CELLS = 3;

export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface Point {
  x: number;
  y: number;
}

export function getMapBounds(pages: Page[]): MapBounds {
  if (pages.length === 0) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  }
  return {
    minX: Math.min(...pages.map((p) => p.coordX)),
    maxX: Math.max(...pages.map((p) => p.coordX)),
    minY: Math.min(...pages.map((p) => p.coordY)),
    maxY: Math.max(...pages.map((p) => p.coordY)),
  };
}

export function worldSize(bounds: MapBounds): { width: number; height: number } {
  const cols = bounds.maxX - bounds.minX + MARGIN_CELLS * 2 + 1;
  const rows = bounds.maxY - bounds.minY + MARGIN_CELLS * 2 + 1;
  return { width: cols * STRIDE_X, height: rows * STRIDE_Y };
}

export function cellCenterForCoord(x: number, y: number, bounds: MapBounds): Point {
  const mapX = x - bounds.minX + MARGIN_CELLS;
  const mapY = bounds.maxY - y + MARGIN_CELLS;
  return {
    x: (mapX + 0.5) * STRIDE_X,
    y: (mapY + 0.5) * STRIDE_Y,
  };
}

export function coordFromWorldPoint(worldX: number, worldY: number, bounds: MapBounds): Point {
  const mapX = worldX / STRIDE_X - 0.5;
  const mapY = worldY / STRIDE_Y - 0.5;
  return {
    x: Math.round(mapX - MARGIN_CELLS + bounds.minX),
    y: Math.round(bounds.maxY - (mapY - MARGIN_CELLS)),
  };
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}
