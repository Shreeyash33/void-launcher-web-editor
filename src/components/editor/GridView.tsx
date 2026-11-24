"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BuiltInWidgetKind, DeviceInventory, GridItem, LayoutDocument, Page } from "@/lib/model";

interface GridViewProps {
  layout: LayoutDocument;
  page: Page | null;
  inventory: DeviceInventory | null;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onAdd: (draft: Omit<GridItem, "pageCoordX" | "pageCoordY">) => void;
  onUpdate: (index: number, patch: Partial<GridItem>) => void;
  onDelete: (index: number) => void;
  onNotice: (kind: "error" | "info", text: string) => void;
}

const CELL_RATIO = 1.1;
const BUILTIN_SPANS: Record<BuiltInWidgetKind, { colSpan: number; rowSpan: number }> = {
  APP_LIST: { colSpan: 4, rowSpan: 3 },
  CLOCK: { colSpan: 4, rowSpan: 2 },
  PAGE_INFO: { colSpan: 2, rowSpan: 2 },
};

interface DragState {
  kind: "move" | "resize";
  index: number;
  startX: number;
  startY: number;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  next: { col: number; row: number; colSpan: number; rowSpan: number };
  moved: boolean;
}

function overlaps(a: { col: number; row: number; colSpan: number; rowSpan: number }, b: GridItem): boolean {
  return (
    a.col < b.col + b.colSpan &&
    a.col + a.colSpan > b.col &&
    a.row < b.row + b.rowSpan &&
    a.row + a.rowSpan > b.row
  );
}

function itemTitle(item: GridItem): string {
  if (item.itemType === "APP_SHORTCUT") return item.referenceId;
  if (item.referenceId.startsWith("builtin:")) return item.referenceId.slice(8);
  if (item.referenceId.startsWith("custom:")) return item.referenceId.slice(7);
  return item.referenceId;
}

export function GridView({
  layout,
  page,
  inventory,
  selectedIndex,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onNotice,
}: GridViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  const [preview, setPreview] = useState<{ index: number; col: number; row: number; colSpan: number; rowSpan: number } | null>(null);
  const [query, setQuery] = useState("");

  const pageItems = useMemo(() => {
    if (!page) return [] as { item: GridItem; index: number }[];
    return layout.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.pageCoordX === page.coordX && item.pageCoordY === page.coordY);
  }, [layout.items, page]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const update = () => setAvailable({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [page?.pageId]);

  const metrics = useMemo(() => {
    if (!page) return { cellW: 0, cellH: 0, width: 0, height: 0 };
    const padding = 48;
    const availW = Math.max(80, available.width - padding);
    const availH = Math.max(80, available.height - padding);
    const cellW = Math.max(
      6,
      Math.min(availW / page.gridCols, availH / page.gridRows / CELL_RATIO, 56),
    );
    const cellH = cellW * CELL_RATIO;
    return { cellW, cellH, width: cellW * page.gridCols, height: cellH * page.gridRows };
  }, [page, available]);

  const freeCell = (colSpan: number, rowSpan: number, extra?: GridItem): { col: number; row: number } | null => {
    if (!page) return null;
    // Backup format bound: col + colSpan <= gridCols with 1-based columns.
    for (let row = 1; row + rowSpan <= page.gridRows; row += 1) {
      for (let col = 1; col + colSpan <= page.gridCols; col += 1) {
        const candidate = { col, row, colSpan, rowSpan };
        const blocked = pageItems.some(
          ({ item, index }) => index !== (extra ? layout.items.indexOf(extra) : -1) && overlaps(candidate, item),
        );
        if (!blocked) return { col, row };
      }
    }
    return null;
  };

  const addBuiltIn = (kind: BuiltInWidgetKind) => {
    if (!page) return;
    const span = BUILTIN_SPANS[kind];
    const colSpan = Math.max(1, Math.min(span.colSpan, page.gridCols - 1));
    const rowSpan = Math.max(1, Math.min(span.rowSpan, page.gridRows - 1));
    const slot = freeCell(colSpan, rowSpan);
    if (!slot) {
      onNotice("error", "No free space on this page for that widget.");
      return;
    }
    onAdd({
      itemType: "WIDGET",
      col: slot.col,
      row: slot.row,
      colSpan,
      rowSpan,
      referenceId: `builtin:${kind}`,
      widgetKind: kind,
      allowOverlap: true,
    });
  };

  const addApp = (packageName: string) => {
    const slot = freeCell(1, 1);
    if (!slot) {
      onNotice("error", "No free space on this page for another shortcut.");
      return;
    }
    onAdd({
      itemType: "APP_SHORTCUT",
      col: slot.col,
      row: slot.row,
      colSpan: 1,
      rowSpan: 1,
      referenceId: packageName,
      allowOverlap: false,
    });
  };

  const addSystemWidget = (provider: string, minColSpan: number, minRowSpan: number) => {
    if (!page) return;
    const colSpan = Math.max(1, Math.min(minColSpan, page.gridCols - 1));
    const rowSpan = Math.max(1, Math.min(minRowSpan, page.gridRows - 1));
    const slot = freeCell(colSpan, rowSpan);
    if (!slot) {
      onNotice("error", "No free space on this page for that widget.");
      return;
    }
    onAdd({
      itemType: "WIDGET",
      col: slot.col,
      row: slot.row,
      colSpan,
      rowSpan,
      referenceId: provider,
      allowOverlap: false,
    });
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, item: GridItem, index: number, kind: DragState["kind"]) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect(index);
    dragRef.current = {
      kind,
      index,
      startX: event.clientX,
      startY: event.clientY,
      col: item.col,
      row: item.row,
      colSpan: item.colSpan,
      rowSpan: item.rowSpan,
      next: { col: item.col, row: item.row, colSpan: item.colSpan, rowSpan: item.rowSpan },
      moved: false,
    };
    setPreview({ index, col: item.col, row: item.row, colSpan: item.colSpan, rowSpan: item.rowSpan });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !page) return;
    event.stopPropagation();
    const dCol = Math.round((event.clientX - drag.startX) / Math.max(metrics.cellW, 1));
    const dRow = Math.round((event.clientY - drag.startY) / Math.max(metrics.cellH, 1));
    if (Math.abs(dCol) + Math.abs(dRow) > 0) drag.moved = true;

    if (drag.kind === "move") {
      const col = Math.min(Math.max(1, drag.col + dCol), page.gridCols - drag.colSpan);
      const row = Math.min(Math.max(1, drag.row + dRow), page.gridRows - drag.rowSpan);
      drag.next = { col, row, colSpan: drag.colSpan, rowSpan: drag.rowSpan };
      setPreview({ index: drag.index, ...drag.next });
    } else {
      const colSpan = Math.min(Math.max(1, drag.colSpan + dCol), page.gridCols - drag.col, 10);
      const rowSpan = Math.min(Math.max(1, drag.rowSpan + dRow), page.gridRows - drag.row, 20);
      drag.next = { col: drag.col, row: drag.row, colSpan, rowSpan };
      setPreview({ index: drag.index, ...drag.next });
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !drag.moved) {
      setPreview(null);
      return;
    }
    event.stopPropagation();
    const item = layout.items[drag.index];
    if (!item) {
      setPreview(null);
      return;
    }
    const candidate = drag.next;
    const conflict = pageItems.some(({ item: other, index }) => {
      if (index === drag.index) return false;
      if (item.itemType === "APP_SHORTCUT" || other.itemType === "APP_SHORTCUT") return overlaps(candidate, other);
      return false;
    });
    if (conflict) {
      onNotice("error", "Shortcuts cannot overlap other items.");
      setPreview(null);
      return;
    }
    onUpdate(drag.index, candidate);
    setPreview(null);
  };

  if (!page) {
    return (
      <div className="grid h-full place-items-center bg-[#080808] p-8 text-center">
        <div className="max-w-xs">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6b6157]">Page grid</p>
          <p className="mt-2 text-sm text-[#a8a29a]">Select a page on the map to place widgets and apps.</p>
        </div>
      </div>
    );
  }

  const apps = (inventory?.apps ?? []).filter((app) =>
    query.trim().length === 0
      ? true
      : app.label.toLowerCase().includes(query.trim().toLowerCase()) ||
        app.packageName.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected = selectedIndex !== null ? layout.items[selectedIndex] : null;

  return (
    <div className="flex h-full min-h-0 bg-[#080808]">
      <div className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-[#1e1e1e] bg-[#0b0b0b]">
        <div className="border-b border-[#1e1e1e] px-3 py-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6b6157]">Add to page</p>
          <p className="mt-1 truncate text-xs text-[#c9c4bb]">{page.title || `Page ${page.coordX},${page.coordY}`}</p>
        </div>

        <div className="space-y-1.5 border-b border-[#1e1e1e] p-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6b6157]">Built-in widgets</p>
          {(["APP_LIST", "CLOCK", "PAGE_INFO"] as BuiltInWidgetKind[]).map((kind) => {
            const enabled = inventory ? inventory.builtInWidgets.includes(kind) : true;
            return (
              <button
                key={kind}
                type="button"
                disabled={!enabled}
                className="flex w-full items-center justify-between rounded-lg border border-[#2f2f2f] bg-[#121212] px-2.5 py-1.5 text-left transition hover:border-[#e6e2d8] disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => addBuiltIn(kind)}
              >
                <span className="text-xs text-[#ededed]">{kind}</span>
                <span className="font-mono text-[9px] text-[#6b6157]">
                  {BUILTIN_SPANS[kind].colSpan}×{BUILTIN_SPANS[kind].rowSpan}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-1.5 border-b border-[#1e1e1e] p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6b6157]">
              Apps {inventory ? `(${inventory.apps.length})` : ""}
            </p>
            <input
              className="w-full rounded-lg border border-[#2f2f2f] bg-[#0b0b0b] px-2 py-1 text-[11px] text-[#ededed] outline-none focus:border-[#e6e2d8]"
              placeholder="Search apps"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {!inventory ? (
            <p className="px-3 py-3 text-[10px] leading-relaxed text-[#6b6157]">
              Import a device inventory to place real apps. Until then you can still place built-in widgets.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-[#141414] overflow-y-auto">
              {apps.map((app) => (
                <li key={app.packageName}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[#161616]"
                    onClick={() => addApp(app.packageName)}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#3a3a3a] bg-[#1a1a1a] text-[10px] text-[#e6e2d8]">
                      {(app.label || app.packageName).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-[#ededed]">{app.label}</span>
                      <span className="block truncate font-mono text-[8px] text-[#6b6157]">{app.packageName}</span>
                    </span>
                  </button>
                </li>
              ))}
              {apps.length === 0 && (
                <li className="px-3 py-2 text-[10px] text-[#6b6157]">No apps match that search.</li>
              )}
            </ul>
          )}
        </div>

        {inventory && inventory.systemWidgets.length > 0 && (
          <div className="space-y-1.5 border-t border-[#1e1e1e] p-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6b6157]">System widgets</p>
            {inventory.systemWidgets.map((widget) => (
              <button
                key={widget.provider}
                type="button"
                title={widget.provider}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#2f2f2f] bg-[#121212] px-2.5 py-1.5 text-left transition hover:border-[#e6e2d8]"
                onClick={() => addSystemWidget(widget.provider, widget.minColSpan, widget.minRowSpan)}
              >
                <span className="min-w-0 truncate text-[11px] text-[#ededed]">{widget.label}</span>
                <span className="shrink-0 font-mono text-[9px] text-[#6b6157]">
                  {widget.minColSpan}×{widget.minRowSpan}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-[#1e1e1e] bg-[#0b0b0b] px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-[10px] text-[#6b6157]">
              {page.coordX},{page.coordY} · {page.gridCols}×{page.gridRows}
            </span>
            <span className="font-mono text-[10px] text-[#6b6157]">· {pageItems.length} items</span>
          </div>
          {selected && selectedIndex !== null && (
            <div className="flex items-center gap-2">
              <span className="max-w-48 truncate font-mono text-[10px] text-[#a8a29a]">{itemTitle(selected)}</span>
              <span className="font-mono text-[9px] text-[#6b6157]">
                {selected.col},{selected.row} · {selected.colSpan}×{selected.rowSpan}
              </span>
              <button
                type="button"
                className="rounded-lg border border-[#4a1f1f] bg-[#1c0f0f] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#ef4444] transition hover:border-[#ef4444]"
                onClick={() => onDelete(selectedIndex)}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        <div ref={frameRef} className="relative grid min-h-0 flex-1 place-items-center overflow-hidden p-6">
          <div
            tabIndex={0}
            className="relative rounded-[18px] border-2 border-[#2f2f2f] bg-[#0b0b0b] outline-none focus-visible:border-[#e6e2d8]"
            style={{ width: metrics.width, height: metrics.height }}
            onPointerDown={() => onSelect(null)}
            onKeyDown={(event) => {
              if ((event.key === "Delete" || event.key === "Backspace") && selectedIndex !== null) {
                event.preventDefault();
                onDelete(selectedIndex);
              }
            }}
          >
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
              <defs>
                <pattern
                  id="page-grid"
                  width={metrics.cellW}
                  height={metrics.cellH}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${metrics.cellW} 0 V ${metrics.height} M 0 ${metrics.cellH} H ${metrics.width}`}
                    stroke="#1c1c1c"
                    strokeWidth="1"
                    fill="none"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#page-grid)" />
            </svg>

            {pageItems.map(({ item, index }) => {
              const active = preview?.index === index ? preview : null;
              const col = active?.col ?? item.col;
              const row = active?.row ?? item.row;
              const colSpan = active?.colSpan ?? item.colSpan;
              const rowSpan = active?.rowSpan ?? item.rowSpan;
              const isSelected = selectedIndex === index;
              const kind = item.widgetKind ?? (item.referenceId.startsWith("builtin:") ? item.referenceId.slice(8) : null);
              return (
                <div
                  key={index}
                  role="button"
                  tabIndex={0}
                  aria-label={`Item ${itemTitle(item)} at ${item.col},${item.row}`}
                  className={`absolute cursor-grab select-none overflow-hidden rounded-[7px] border-2 p-1 transition-colors ${
                    isSelected
                      ? "border-[#e6e2d8] bg-[#1d1d1d] shadow-[0_0_0_2px_rgba(230,226,216,0.2)]"
                      : "border-[#3a3a3a] bg-[#171717] hover:border-[#6b6157]"
                  }`}
                  style={{
                    left: (col - 1) * metrics.cellW + 1,
                    top: (row - 1) * metrics.cellH + 1,
                    width: colSpan * metrics.cellW - 2,
                    height: rowSpan * metrics.cellH - 2,
                  }}
                  onPointerDown={(event) => beginDrag(event, item, index, "move")}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={() => {
                    dragRef.current = null;
                    setPreview(null);
                  }}
                >
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between gap-1">
                      <span className="truncate text-[9px] font-medium leading-tight text-[#ededed]">
                        {item.itemType === "APP_SHORTCUT" ? "App" : (kind ?? itemTitle(item))}
                      </span>
                      {item.itemType === "APP_SHORTCUT" && (
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-[#3a3a3a] bg-[#0b0b0b] text-[8px] text-[#e6e2d8]">
                          {(itemTitle(item).split(".").pop() ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="truncate font-mono text-[7px] leading-tight text-[#6b6157]">
                      {item.referenceId.startsWith("builtin:") ? item.referenceId : itemTitle(item)}
                    </span>
                  </div>

                  {isSelected && (
                    <div
                      className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-tl border-l border-t border-[#e6e2d8] bg-[#e6e2d8]"
                      onPointerDown={(event) => beginDrag(event, item, index, "resize")}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
