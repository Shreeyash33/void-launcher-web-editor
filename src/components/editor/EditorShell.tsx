"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addBidirectionalLink,
  cloneLayout,
  DEFAULT_PALETTE,
  directionBetween,
  effectivePageType,
  hasLink,
  isHomePage,
  normalizeLayout,
  normalizeInventory,
  OPPOSITE,
  pageAt,
  type CustomPalette,
  type GridItem,
  type LayoutDocument,
  type Page,
  type SwipeDirection,
} from "@/lib/model";
import { useInventoryStore } from "@/lib/useInventoryStore";
import { useLayoutStore } from "@/lib/useLayoutStore";
import { findNewStrandingError, validateLayout, type ValidationIssue } from "@/lib/validate";
import { GridView } from "./GridView";
import { Inspector } from "./Inspector";
import { LayoutPanel } from "./LayoutPanel";
import { MapEditor } from "./MapEditor";
import { ValidationPanel } from "./ValidationPanel";

type Notice = { kind: "error" | "info"; text: string };
type Tab = "inspect" | "layout" | "issues";

function pageLabel(page: Page): string {
  return page.title || `Page ${page.coordX},${page.coordY}`;
}

export function EditorShell() {
  const { layout, setLayout, hydrated, saving, saveError, resetToCanonical } = useLayoutStore();
  const { inventory, setInventory } = useInventoryStore();
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [view, setView] = useState<"map" | "grid">("map");
  const [tab, setTab] = useState<Tab>("inspect");
  const [notice, setNotice] = useState<Notice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inventoryRef = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => validateLayout(layout), [layout]);
  const invalidPageIds = useMemo(() => {
    const ids = new Set<number>();
    for (const issue of issues) if (issue.pageId !== undefined) ids.add(issue.pageId);
    return ids;
  }, [issues]);

  const selectedPage = useMemo(
    () => layout.pages.find((page) => page.pageId === selectedPageId) ?? null,
    [layout.pages, selectedPageId],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const flash = (kind: Notice["kind"], text: string) => setNotice({ kind, text });

  const commit = (next: LayoutDocument, errorPrefix: string): boolean => {
    const stranding = findNewStrandingError(layout, next);
    if (stranding) {
      flash("error", `${errorPrefix} ${stranding.message}`);
      return false;
    }
    setLayout(next);
    return true;
  };

  const updatePage = (pageId: number, patch: Partial<Page>) => {
    const next = cloneLayout(layout);
    const page = next.pages.find((p) => p.pageId === pageId);
    if (!page) return;

    if (patch.pageType === "APP_DRAWER" && isHomePage(layout, page)) {
      flash("error", "The home page cannot be an app drawer. Set another page as home first.");
      return;
    }

    const wasHome = isHomePage(layout, page);
    const prevX = page.coordX;
    const prevY = page.coordY;
    Object.assign(page, patch);

    if (page.coordX !== prevX || page.coordY !== prevY) {
      next.items = next.items.map((item) =>
        item.pageCoordX === prevX && item.pageCoordY === prevY
          ? { ...item, pageCoordX: page.coordX, pageCoordY: page.coordY }
          : item,
      );
      next.backgrounds = next.backgrounds.map((background) =>
        background.scope === "PAGE" && background.pageCoordX === prevX && background.pageCoordY === prevY
          ? { ...background, pageCoordX: page.coordX, pageCoordY: page.coordY }
          : background,
      );
    }

    if (patch.pageType === "HOME" || (wasHome && (patch.coordX !== undefined || patch.coordY !== undefined))) {
      next.homeCoordX = page.coordX;
      next.homeCoordY = page.coordY;
      for (const other of next.pages) {
        if (other.pageId !== page.pageId && other.pageType === "HOME") other.pageType = "WIDGET";
      }
      page.pageType = "HOME";
    }

    setLayout(next);
  };

  const setHome = (pageId: number) => {
    const next = cloneLayout(layout);
    const target = next.pages.find((p) => p.pageId === pageId);
    if (!target) return;
    if (target.pageType === "APP_DRAWER") {
      flash("error", "An app drawer page cannot be the home page.");
      return;
    }
    for (const page of next.pages) {
      if (page.pageType === "HOME" && page.pageId !== pageId) page.pageType = "WIDGET";
      if (page.pageId === pageId) page.pageType = "HOME";
    }
    next.homeCoordX = target.coordX;
    next.homeCoordY = target.coordY;
    commit(next, "Could not change home:");
  };

  const movePage = (pageId: number, x: number, y: number) => {
    const page = layout.pages.find((p) => p.pageId === pageId);
    if (!page) return;
    if (page.coordX === x && page.coordY === y) return;

    const occupied = pageAt(layout, x, y);
    if (occupied && occupied.pageId !== pageId) {
      flash("error", `Cell ${x},${y} is already used by ${pageLabel(occupied)}.`);
      return;
    }

    const next = cloneLayout(layout);
    const moved = next.pages.find((p) => p.pageId === pageId)!;
    const oldX = moved.coordX;
    const oldY = moved.coordY;
    moved.coordX = x;
    moved.coordY = y;
    if (isHomePage(layout, page)) {
      next.homeCoordX = x;
      next.homeCoordY = y;
    }

    // Items and page backgrounds are keyed by page coordinates, so they move with the page.
    next.items = next.items.map((item) =>
      item.pageCoordX === oldX && item.pageCoordY === oldY ? { ...item, pageCoordX: x, pageCoordY: y } : item,
    );
    next.backgrounds = next.backgrounds.map((background) =>
      background.scope === "PAGE" && background.pageCoordX === oldX && background.pageCoordY === oldY
        ? { ...background, pageCoordX: x, pageCoordY: y }
        : background,
    );

    // Links are stored by page id, not by geometry, so they survive a move unchanged.
    if (commit(next, "Move blocked:")) {
      flash("info", `Moved ${pageLabel(page)} to ${x},${y}.`);
    }
  };

  const addPage = (coord: { x: number; y: number }, type: "WIDGET" | "APP_DRAWER", sourcePageId: number) => {
    const source = layout.pages.find((p) => p.pageId === sourcePageId);
    if (!source) return;
    if (pageAt(layout, coord.x, coord.y)) {
      flash("error", `Cell ${coord.x},${coord.y} is already used.`);
      return;
    }

    const next = cloneLayout(layout);
    const pageId = Math.max(0, ...next.pages.map((p) => p.pageId)) + 1;
    const page: Page = {
      pageId,
      coordX: coord.x,
      coordY: coord.y,
      title: `Page ${coord.x},${coord.y}`,
      gridCols: source.gridCols,
      gridRows: source.gridRows,
      isSecret: false,
      pageType: type,
    };
    next.pages.push(page);
    next.edges = addBidirectionalLink(next.edges, source, page);

    if (commit(next, "Could not add page:")) {
      setSelectedPageId(pageId);
      setTab("inspect");
      flash("info", `Added ${type === "APP_DRAWER" ? "app drawer" : "widget"} page at ${coord.x},${coord.y}.`);
    }
  };

  const toggleLink = (pageId: number, targetPageId: number, dir: SwipeDirection) => {
    const next = cloneLayout(layout);
    const from = next.pages.find((p) => p.pageId === pageId);
    const to = next.pages.find((p) => p.pageId === targetPageId);
    if (!from || !to) return;
    const actual = directionBetween(from, to);
    if (!actual || actual !== dir) {
      flash("error", "Links are only possible between edge-adjacent pages.");
      return;
    }
    next.edges = addBidirectionalLink(next.edges, from, to);
    commit(next, "Could not create link:");
  };

  const removeLink = (pageId: number, targetPageId: number, dir: SwipeDirection) => {
    const next = cloneLayout(layout);
    if (!next.pages.some((p) => p.pageId === pageId) || !next.pages.some((p) => p.pageId === targetPageId)) return;
    const opposite = OPPOSITE[dir];
    next.edges = next.edges.filter(
      (edge) =>
        !(edge.fromPageId === pageId && edge.swipeDirection === dir && edge.toPageId === targetPageId) &&
        !(edge.fromPageId === targetPageId && edge.swipeDirection === opposite && edge.toPageId === pageId),
    );
    commit(next, "Cannot remove link:");
  };

  const toggleLinkState = (pageId: number, targetPageId: number, dir: SwipeDirection) => {
    const from = layout.pages.find((p) => p.pageId === pageId);
    const to = layout.pages.find((p) => p.pageId === targetPageId);
    if (!from || !to) return;
    if (hasLink(layout.edges, from, to)) {
      removeLink(pageId, targetPageId, dir);
    } else {
      toggleLink(pageId, targetPageId, dir);
    }
  };

  const updateSettings = (patch: Partial<LayoutDocument>) => {
    const next = cloneLayout(layout);
    Object.assign(next, patch);
    if (next.theme === "CUSTOM" && !next.customPalette) next.customPalette = { ...DEFAULT_PALETTE };
    setLayout(next);
  };

  const updatePalette = (key: keyof CustomPalette, value: string) => {
    const next = cloneLayout(layout);
    next.customPalette = { ...(next.customPalette ?? DEFAULT_PALETTE), [key]: value };
    setLayout(next);
  };

  const resetPalette = () => {
    const next = cloneLayout(layout);
    next.customPalette = { ...DEFAULT_PALETTE };
    setLayout(next);
  };

  const deletePage = (pageId: number) => {
    const page = layout.pages.find((p) => p.pageId === pageId);
    if (!page) return;
    if (layout.pages.length <= 1) {
      flash("error", "A layout needs at least one page.");
      return;
    }
    if (isHomePage(layout, page)) {
      flash("error", "Set another page as home before deleting this one.");
      return;
    }

    const next = cloneLayout(layout);
    next.pages = next.pages.filter((p) => p.pageId !== pageId);
    next.edges = next.edges.filter((e) => e.fromPageId !== pageId && e.toPageId !== pageId);
    next.items = next.items.filter((i) => !(i.pageCoordX === page.coordX && i.pageCoordY === page.coordY));
    next.backgrounds = next.backgrounds.filter(
      (b) => !(b.scope === "PAGE" && b.pageCoordX === page.coordX && b.pageCoordY === page.coordY),
    );

    if (commit(next, "Cannot delete page:")) {
      setSelectedPageId(null);
      setSelectedItemIndex(null);
      flash("info", `Deleted ${pageLabel(page)}.`);
    }
  };

  const addItem = (draft: Omit<GridItem, "pageCoordX" | "pageCoordY">) => {
    if (!selectedPage) return;
    const next = cloneLayout(layout);
    next.items.push({ ...draft, pageCoordX: selectedPage.coordX, pageCoordY: selectedPage.coordY });
    setLayout(next);
    setSelectedItemIndex(next.items.length - 1);
  };

  const updateItem = (index: number, patch: Partial<GridItem>) => {
    const next = cloneLayout(layout);
    const item = next.items[index];
    if (!item) return;
    Object.assign(item, patch);
    setLayout(next);
  };

  const deleteItem = (index: number) => {
    const next = cloneLayout(layout);
    if (!next.items[index]) return;
    next.items.splice(index, 1);
    setLayout(next);
    setSelectedItemIndex(null);
  };

  const handleInventoryFile = async (file: File) => {
    try {
      const text = await file.text();
      const next = normalizeInventory(JSON.parse(text) as unknown);
      setInventory(next);
      flash(
        "info",
        `Loaded inventory: ${next.apps.length} apps, ${next.systemWidgets.length} system widgets.`,
      );
    } catch {
      flash("error", `Could not read ${file.name}. Expected voidlauncher-inventory.json.`);
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const next = normalizeLayout(parsed);
      setLayout(next);
      setSelectedPageId(null);
      const found = validateLayout(next);
      flash(
        "info",
        found.length === 0
          ? `Loaded ${file.name} with no validation issues.`
          : `Loaded ${file.name}. ${found.length} validation issue${found.length === 1 ? "" : "s"} found.`,
      );
    } catch {
      flash("error", `Could not read ${file.name}. Expected a Void Launcher layout JSON file.`);
    }
  };

  const handleExport = () => {
    const json = JSON.stringify(layout, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "voidlauncher-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    flash("info", "Exported voidlauncher-backup.json.");
  };

  const handleReset = () => {
    if (!window.confirm("Replace the current layout with the default five-page map? This cannot be undone.")) {
      return;
    }
    resetToCanonical();
    setSelectedPageId(null);
    flash("info", "Reset to the default layout.");
  };

  const handleSelectIssue = (issue: ValidationIssue) => {
    if (issue.pageId !== undefined) {
      setSelectedPageId(issue.pageId);
      setTab("inspect");
      return;
    }
    if (issue.coord) {
      const page = pageAt(layout, issue.coord.x, issue.coord.y);
      if (page) {
        setSelectedPageId(page.pageId);
        setTab("inspect");
      }
    }
  };

  const errorCount = issues.length;
  const saveLabel = saveError ? "Not saved" : saving ? "Saving…" : hydrated ? "Saved locally" : "Loading…";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[#080808] text-[#ededed]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#1e1e1e] bg-[#0b0b0b] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#3a3a3a] bg-[#141414] font-mono text-[10px] text-[#e6e2d8]">
            VL
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight">Void Launcher</h1>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6b6157]">Map editor · v1</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 rounded-lg border border-[#242424] bg-[#080808] p-0.5">
          {(["map", "grid"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
                view === mode ? "bg-[#e6e2d8] text-[#080808]" : "text-[#6b6157] hover:text-[#e6e2d8]"
              }`}
              onClick={() => {
                setView(mode);
                if (mode === "grid" && selectedPageId === null) {
                  const home =
                    layout.pages.find((p) => p.coordX === layout.homeCoordX && p.coordY === layout.homeCoordY) ??
                    layout.pages[0];
                  if (home) setSelectedPageId(home.pageId);
                }
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`mr-2 hidden font-mono text-[10px] sm:inline ${
              saveError ? "text-[#ef4444]" : "text-[#6b6157]"
            }`}
            title={saveError ?? "Layout is stored in this browser via IndexedDB."}
          >
            {saveLabel}
          </span>
          <button
            type="button"
            title={inventory ? `${inventory.apps.length} apps · ${inventory.systemWidgets.length} system widgets` : "Import voidlauncher-inventory.json"}
            className="flex items-center gap-1.5 rounded-lg border border-[#3a3a3a] bg-[#141414] px-2.5 py-1.5 font-mono text-[10px] text-[#a8a29a] transition hover:border-[#e6e2d8] hover:text-[#e6e2d8]"
            onClick={() => inventoryRef.current?.click()}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${inventory ? "bg-[#4ade80]" : "bg-[#3a3a3a]"}`} />
            Inventory
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#3a3a3a] bg-[#141414] px-2.5 py-1.5 font-mono text-[10px] text-[#a8a29a] transition hover:border-[#e6e2d8] hover:text-[#e6e2d8]"
            onClick={() => fileRef.current?.click()}
          >
            Import
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#3a3a3a] bg-[#141414] px-2.5 py-1.5 font-mono text-[10px] text-[#a8a29a] transition hover:border-[#e6e2d8] hover:text-[#e6e2d8]"
            onClick={handleExport}
          >
            Export
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#3a3a3a] bg-[#141414] px-2.5 py-1.5 font-mono text-[10px] text-[#a8a29a] transition hover:border-[#ef4444] hover:text-[#ef4444]"
            onClick={handleReset}
          >
            Reset
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleImportFile(file);
            }}
          />
          <input
            ref={inventoryRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleInventoryFile(file);
            }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 flex-col overflow-y-auto border-r border-[#1e1e1e] bg-[#0b0b0b] md:flex">
          <div className="flex items-center justify-between border-b border-[#1e1e1e] px-3 py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#6b6157]">Pages</span>
            <span className="font-mono text-[9px] text-[#6b6157]">{layout.pages.length}</span>
          </div>
          <ul className="flex-1 divide-y divide-[#141414]">
            {layout.pages.map((page) => {
              const active = page.pageId === selectedPageId;
              const type = effectivePageType(layout, page);
              return (
                <li key={page.pageId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPageId(page.pageId);
                      setSelectedItemIndex(null);
                      setTab("inspect");
                    }}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition ${
                      active ? "bg-[#171717]" : "hover:bg-[#121212]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-xs ${active ? "text-[#ededed]" : "text-[#c9c4bb]"}`}>
                        {pageLabel(page)}
                      </span>
                      {invalidPageIds.has(page.pageId) && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ef4444]" />
                      )}
                    </span>
                    <span className="font-mono text-[9px] text-[#6b6157]">
                      {page.coordX},{page.coordY} · {type} · #{page.pageId}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[#1e1e1e] px-3 py-2 font-mono text-[9px] leading-relaxed text-[#4a4a4a]">
            Home {layout.homeCoordX},{layout.homeCoordY}
          </div>
        </aside>

        <main className="relative min-w-0 flex-1">
          {view === "map" ? (
            <MapEditor
              layout={layout}
              selectedPageId={selectedPageId}
              invalidPageIds={invalidPageIds}
              onSelectPage={(pageId) => {
                setSelectedPageId(pageId);
                setSelectedItemIndex(null);
              }}
              onMovePage={movePage}
              onAddPage={addPage}
              onToggleLink={toggleLinkState}
            />
          ) : (
            <GridView
              layout={layout}
              page={selectedPage}
              inventory={inventory}
              selectedIndex={selectedItemIndex}
              onSelect={setSelectedItemIndex}
              onAdd={addItem}
              onUpdate={updateItem}
              onDelete={deleteItem}
              onNotice={flash}
            />
          )}
        </main>

        <aside className="flex w-80 shrink-0 flex-col border-l border-[#1e1e1e] bg-[#0e0e0e]">
          <div className="flex shrink-0 border-b border-[#1e1e1e]">
            <button
              type="button"
              className={`flex-1 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
                tab === "inspect" ? "text-[#ededed]" : "text-[#6b6157] hover:text-[#a8a29a]"
              }`}
              onClick={() => setTab("inspect")}
            >
              Inspect
            </button>
            <button
              type="button"
              className={`flex-1 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
                tab === "layout" ? "text-[#ededed]" : "text-[#6b6157] hover:text-[#a8a29a]"
              }`}
              onClick={() => setTab("layout")}
            >
              Layout
            </button>
            <button
              type="button"
              className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] transition ${
                tab === "issues" ? "text-[#ededed]" : "text-[#6b6157] hover:text-[#a8a29a]"
              }`}
              onClick={() => setTab("issues")}
            >
              Issues
              <span
                className={`rounded px-1 text-[9px] ${
                  errorCount === 0 ? "bg-[#1f3a25] text-[#4ade80]" : "bg-[#3a1414] text-[#ef4444]"
                }`}
              >
                {errorCount}
              </span>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {tab === "inspect" ? (
              <Inspector
                layout={layout}
                page={selectedPage}
                onUpdatePage={updatePage}
                onSetHome={setHome}
                onToggleLink={toggleLink}
                onRemoveLink={removeLink}
                onDeletePage={deletePage}
              />
            ) : tab === "layout" ? (
              <LayoutPanel
                layout={layout}
                onChange={updateSettings}
                onPaletteChange={updatePalette}
                onPaletteReset={resetPalette}
              />
            ) : (
              <ValidationPanel issues={issues} onSelectIssue={handleSelectIssue} />
            )}
          </div>
        </aside>
      </div>

      {notice && (
        <div
          role="status"
          className={`pointer-events-none absolute bottom-6 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-xl border px-4 py-2.5 text-xs shadow-2xl backdrop-blur ${
            notice.kind === "error"
              ? "border-[#4a1f1f] bg-[#1c0f0f]/95 text-[#fca5a5]"
              : "border-[#2f2f2f] bg-[#141414]/95 text-[#e6e2d8]"
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
