"use client";

import {
  COORD_MAX,
  COORD_MIN,
  DIRECTIONS,
  effectivePageType,
  directionBetween,
  hasLink,
  isHomePage,
  pageAt,
  type LayoutDocument,
  type Page,
  type PageType,
  type SwipeDirection,
} from "@/lib/model";

interface InspectorProps {
  layout: LayoutDocument;
  page: Page | null;
  onUpdatePage: (pageId: number, patch: Partial<Page>) => void;
  onSetHome: (pageId: number) => void;
  onToggleLink: (pageId: number, targetPageId: number, dir: SwipeDirection) => void;
  onRemoveLink: (pageId: number, targetPageId: number, dir: SwipeDirection) => void;
  onDeletePage: (pageId: number) => void;
}

const LABELS: Record<SwipeDirection, string> = {
  UP: "Below",
  DOWN: "Above",
  LEFT: "Left",
  RIGHT: "Right",
};

function fieldClass(): string {
  return "w-full rounded-lg border border-[#2f2f2f] bg-[#0b0b0b] px-2.5 py-1.5 text-sm text-[#ededed] outline-none transition focus:border-[#e6e2d8]";
}

function labelClass(): string {
  return "block font-mono text-[9px] uppercase tracking-[0.18em] text-[#6b6157]";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-[#1e1e1e] px-4 py-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6b6157]">{title}</h3>
      {children}
    </section>
  );
}

export function Inspector({
  layout,
  page,
  onUpdatePage,
  onSetHome,
  onToggleLink,
  onRemoveLink,
  onDeletePage,
}: InspectorProps) {
  if (!page) {
    return (
      <aside className="flex h-full w-full flex-col overflow-y-auto bg-[#0e0e0e]">
        <div className="border-b border-[#1e1e1e] px-4 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6b6157]">Inspector</p>
          <h2 className="mt-1 text-sm font-semibold text-[#ededed]">No page selected</h2>
        </div>
        <div className="px-4 py-4 text-xs leading-relaxed text-[#a8a29a]">
          Select a page on the map to edit its title, grid size, type, and links. Use the{" "}
          <span className="font-mono text-[#e6e2d8]">+</span> buttons to add adjacent pages and the dots on page
          edges to toggle links.
        </div>
      </aside>
    );
  }

  const home = isHomePage(layout, page);
  const type = effectivePageType(layout, page);
  const neighbors = DIRECTIONS.map((dir) => {
    const dx = dir === "RIGHT" ? 1 : dir === "LEFT" ? -1 : 0;
    const dy = dir === "DOWN" ? 1 : dir === "UP" ? -1 : 0;
    const neighbor = pageAt(layout, page.coordX + dx, page.coordY + dy);
    const expected = neighbor ? directionBetween(page, neighbor) : null;
    const linked = neighbor ? hasLink(layout.edges, page, neighbor) : false;
    return { dir, dx, dy, neighbor, expected, linked };
  });

  const diagonal = layout.pages.filter(
    (other) =>
      other.pageId !== page.pageId &&
      other.coordX !== page.coordX &&
      other.coordY !== page.coordY &&
      Math.abs(other.coordX - page.coordX) <= 1 &&
      Math.abs(other.coordY - page.coordY) <= 1,
  );

  const otherLinks = layout.edges
    .filter((edge) => edge.fromPageId === page.pageId)
    .map((edge) => ({ edge, target: layout.pages.find((p) => p.pageId === edge.toPageId) }))
    .filter(
      (entry) =>
        entry.target && !neighbors.some((neighbor) => neighbor.neighbor?.pageId === entry.target!.pageId),
    );

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-[#0e0e0e]">
      <div className="border-b border-[#1e1e1e] px-4 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6b6157]">Inspector</p>
        <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#ededed]">
          <span className="truncate">{page.title || `Page ${page.coordX},${page.coordY}`}</span>
          <span className="shrink-0 rounded bg-[#202020] px-1.5 py-0.5 font-mono text-[9px] text-[#a8a29a]">
            #{page.pageId}
          </span>
        </h2>
        <p className="mt-1 font-mono text-[10px] text-[#6b6157]">
          {page.coordX},{page.coordY} · {type}
        </p>
      </div>

      <Section title="Identity">
        <div>
          <label className={labelClass()} htmlFor="page-title">
            Title
          </label>
          <input
            id="page-title"
            className={`${fieldClass()} mt-1`}
            value={page.title}
            onChange={(event) => onUpdatePage(page.pageId, { title: event.target.value })}
            placeholder="Page title"
          />
        </div>
        <div>
          <label className={labelClass()} htmlFor="page-type">
            Page type
          </label>
          <select
            id="page-type"
            className={`${fieldClass()} mt-1`}
            value={page.pageType}
            onChange={(event) => onUpdatePage(page.pageId, { pageType: event.target.value as PageType })}
          >
            <option value="WIDGET">WIDGET (grid)</option>
            <option value="APP_DRAWER">APP_DRAWER (app list)</option>
            {home && <option value="HOME">HOME</option>}
          </select>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[#2f2f2f] bg-[#0b0b0b] px-2.5 py-2">
          <span className="text-xs text-[#a8a29a]">Secret page</span>
          <button
            type="button"
            role="switch"
            aria-checked={page.isSecret}
            className={`relative h-5 w-9 rounded-full transition ${
              page.isSecret ? "bg-[#e6e2d8]" : "bg-[#2f2f2f]"
            }`}
            onClick={() => onUpdatePage(page.pageId, { isSecret: !page.isSecret })}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full transition ${
                page.isSecret ? "left-4.5 bg-[#080808]" : "left-0.5 bg-[#a8a29a]"
              }`}
            />
          </button>
        </div>
      </Section>

      <Section title="Grid">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass()} htmlFor="grid-cols">
              Columns
            </label>
            <input
              id="grid-cols"
              type="number"
              min={1}
              max={40}
              className={`${fieldClass()} mt-1`}
              value={page.gridCols}
              onChange={(event) =>
                onUpdatePage(page.pageId, {
                  gridCols: Math.min(40, Math.max(1, Number(event.target.value) || 1)),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass()} htmlFor="grid-rows">
              Rows
            </label>
            <input
              id="grid-rows"
              type="number"
              min={1}
              max={60}
              className={`${fieldClass()} mt-1`}
              value={page.gridRows}
              onChange={(event) =>
                onUpdatePage(page.pageId, {
                  gridRows: Math.min(60, Math.max(1, Number(event.target.value) || 1)),
                })
              }
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass()} htmlFor="coord-x">
              Coord X
            </label>
            <input
              id="coord-x"
              type="number"
              min={COORD_MIN}
              max={COORD_MAX}
              className={`${fieldClass()} mt-1`}
              value={page.coordX}
              onChange={(event) =>
                onUpdatePage(page.pageId, {
                  coordX: Math.min(COORD_MAX, Math.max(COORD_MIN, Number(event.target.value) || 0)),
                })
              }
            />
          </div>
          <div>
            <label className={labelClass()} htmlFor="coord-y">
              Coord Y
            </label>
            <input
              id="coord-y"
              type="number"
              min={COORD_MIN}
              max={COORD_MAX}
              className={`${fieldClass()} mt-1`}
              value={page.coordY}
              onChange={(event) =>
                onUpdatePage(page.pageId, {
                  coordY: Math.min(COORD_MAX, Math.max(COORD_MIN, Number(event.target.value) || 0)),
                })
              }
            />
          </div>
        </div>
      </Section>

      <Section title="Home">
        <div className="flex items-center justify-between rounded-lg border border-[#2f2f2f] bg-[#0b0b0b] px-2.5 py-2">
          <span className="text-xs text-[#a8a29a]">
            {home ? "This is the home page" : "Home is at " + `${layout.homeCoordX},${layout.homeCoordY}`}
          </span>
          <button
            type="button"
            disabled={home || page.pageType === "APP_DRAWER"}
            className="rounded-lg border border-[#3a3a3a] bg-[#141414] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-[#a8a29a] transition hover:border-[#e6e2d8] hover:text-[#e6e2d8] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onSetHome(page.pageId)}
          >
            Set home
          </button>
        </div>
        {page.pageType === "APP_DRAWER" && (
          <p className="text-[10px] leading-relaxed text-[#ef4444]">APP_DRAWER pages cannot be the home page.</p>
        )}
      </Section>

      <Section title="Links">
        <div className="space-y-1.5">
          {neighbors.map(({ dir, neighbor, expected, linked }) => {
            if (!neighbor) {
              return (
                <div
                  key={dir}
                  className="flex items-center justify-between rounded-lg border border-dashed border-[#242424] px-2.5 py-1.5"
                >
                  <span className="text-xs text-[#4a4a4a]">{LABELS[dir]}</span>
                  <span className="font-mono text-[9px] text-[#4a4a4a]">empty</span>
                </div>
              );
            }
            const active = expected ? linked : true;
            return (
              <button
                key={dir}
                type="button"
                disabled={!expected}
                title={
                  expected
                    ? active
                      ? "Remove link"
                      : "Create link"
                    : "Only edge-adjacent pages can be linked"
                }
                className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left transition ${
                  expected
                    ? active
                      ? "border-[#e6e2d8] bg-[#e6e2d8]/10 hover:bg-[#e6e2d8]/20"
                      : "border-[#2f2f2f] bg-[#0b0b0b] hover:border-[#e6e2d8]"
                    : "cursor-not-allowed border-[#1e1e1e] bg-[#0b0b0b] opacity-50"
                }`}
                onClick={() => {
                  if (!expected) return;
                  if (linked) onRemoveLink(page.pageId, neighbor.pageId, dir);
                  else onToggleLink(page.pageId, neighbor.pageId, dir);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-[#e6e2d8]" : "bg-[#3a3a3a]"}`} />
                  <span className="truncate text-xs text-[#ededed]">{neighbor.title || `Page ${neighbor.coordX},${neighbor.coordY}`}</span>
                </span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-[#6b6157]">
                  {expected ? LABELS[dir] : "not adjacent"}
                </span>
              </button>
            );
          })}
        </div>
        {otherLinks.length > 0 && (
          <div className="space-y-1.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#6b6157]">Off-grid links</p>
            {otherLinks.map(({ edge, target }) => (
              <button
                key={`${edge.toPageId}-${edge.swipeDirection}`}
                type="button"
                title="Remove this link"
                className="flex w-full items-center justify-between rounded-lg border border-[#3a3a3a] bg-[#121212] px-2.5 py-1.5 text-left transition hover:border-[#ef4444]"
                onClick={() => onRemoveLink(page.pageId, target!.pageId, edge.swipeDirection)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#a8a29a]" />
                  <span className="truncate text-xs text-[#ededed]">
                    {target!.title || `Page ${target!.coordX},${target!.coordY}`}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-[#6b6157]">
                  swipe {edge.swipeDirection}
                </span>
              </button>
            ))}
            <p className="text-[10px] leading-relaxed text-[#6b6157]">
              These links point to pages that are not on a shared edge. The launcher still honours them by swipe
              direction; the map shows them here instead of on a page edge.
            </p>
          </div>
        )}
        {diagonal.length > 0 && (
          <p className="text-[10px] leading-relaxed text-[#6b6157]">
            {diagonal.length} diagonal page{diagonal.length === 1 ? "" : "s"} cannot be linked directly. Links
            only exist between edge-adjacent pages; move a page to a shared edge to connect it.
          </p>
        )}
      </Section>

      <Section title="Danger zone">
        <button
          type="button"
          className="w-full rounded-lg border border-[#4a1f1f] bg-[#1c0f0f] px-2.5 py-2 text-xs text-[#ef4444] transition hover:border-[#ef4444] hover:bg-[#2a1414]"
          onClick={() => onDeletePage(page.pageId)}
        >
          Delete this page
        </button>
        <p className="text-[10px] leading-relaxed text-[#6b6157]">
          Items on this page and any links to it are removed. This cannot be undone.
        </p>
      </Section>
    </aside>
  );
}
