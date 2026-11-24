"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  COORD_MAX,
  COORD_MIN,
  effectivePageType,
  hasLink,
  isHomePage,
  type LayoutDocument,
  type Page,
  type SwipeDirection,
} from "@/lib/model";
import {
  cellCenterForCoord,
  clampScale,
  coordFromWorldPoint,
  getMapBounds,
  STRIDE_X,
  STRIDE_Y,
  TILE_HEIGHT,
  TILE_WIDTH,
  worldSize,
  type Point,
} from "@/lib/mapGeometry";

interface MapEditorProps {
  layout: LayoutDocument;
  selectedPageId: number | null;
  invalidPageIds: Set<number>;
  onSelectPage: (pageId: number | null) => void;
  onMovePage: (pageId: number, x: number, y: number) => void;
  onAddPage: (coord: { x: number; y: number }, type: "WIDGET" | "APP_DRAWER", sourcePageId: number) => void;
  onToggleLink: (pageId: number, targetPageId: number, dir: SwipeDirection) => void;
}

interface AddTarget {
  x: number;
  y: number;
  source: Page;
}

interface PanDrag {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
}

interface PageDrag {
  pageId: number;
  startClientX: number;
  startClientY: number;
  startWorldX: number;
  startWorldY: number;
  lastDx: number;
  lastDy: number;
  moved: boolean;
}

const GRID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${STRIDE_X}" height="${STRIDE_Y}"><path d="M 0 0 V ${STRIDE_Y} M 0 0 H ${STRIDE_X}" stroke="#262626" stroke-width="1" stroke-dasharray="2 6" fill="none"/></svg>`;
const GRID_BG = `url("data:image/svg+xml,${encodeURIComponent(GRID_SVG)}")`;

function controlButton(active = false): string {
  return [
    "rounded-lg border px-2.5 py-1.5 font-mono text-[10px] transition",
    active
      ? "border-[#e6e2d8] bg-[#e6e2d8] text-[#080808]"
      : "border-[#3a3a3a] bg-[#141414] text-[#a8a29a] hover:border-[#e6e2d8] hover:text-[#e6e2d8]",
  ].join(" ");
}

export function MapEditor({
  layout,
  selectedPageId,
  invalidPageIds,
  onSelectPage,
  onMovePage,
  onAddPage,
  onToggleLink,
}: MapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragPreview, setDragPreview] = useState<{ pageId: number; dx: number; dy: number } | null>(null);
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);

  const didInit = useRef(false);
  const panDragRef = useRef<PanDrag | null>(null);
  const pageDragRef = useRef<PageDrag | null>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<{ startDist: number; startScale: number; worldPoint: Point } | null>(null);
  const viewRef = useRef({ pan, scale });

  const bounds = useMemo(() => getMapBounds(layout.pages), [layout.pages]);
  const world = useMemo(() => worldSize(bounds), [bounds]);
  const pagesByCoord = useMemo(
    () => new Map(layout.pages.map((page) => [`${page.coordX},${page.coordY}`, page])),
    [layout.pages],
  );
  const addCandidates = useMemo(() => {
    const seen = new Set<string>();
    const candidates: AddTarget[] = [];
    for (const page of layout.pages) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const x = page.coordX + dx;
        const y = page.coordY + dy;
        if (x < COORD_MIN || x > COORD_MAX || y < COORD_MIN || y > COORD_MAX) continue;
        const key = `${x},${y}`;
        if (pagesByCoord.has(key) || seen.has(key)) continue;
        seen.add(key);
        candidates.push({ x, y, source: page });
      }
    }
    return candidates;
  }, [layout.pages, pagesByCoord]);

  const linkArrows = useMemo(() => {
    const arrows: {
      key: string;
      from: Page;
      to: Page;
      dir: SwipeDirection;
      x: number;
      y: number;
      horizontal: boolean;
      linked: boolean;
    }[] = [];
    for (const page of layout.pages) {
      for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
        const other = pagesByCoord.get(`${page.coordX + dx},${page.coordY + dy}`);
        if (!other) continue;
        const a = cellCenterForCoord(page.coordX, page.coordY, bounds);
        const b = cellCenterForCoord(other.coordX, other.coordY, bounds);
        arrows.push({
          key: `${page.pageId}-${other.pageId}`,
          from: page,
          to: other,
          dir: dx !== 0 ? "RIGHT" : "DOWN",
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          horizontal: dx !== 0,
          linked: hasLink(layout.edges, page, other),
        });
      }
    }
    return arrows;
  }, [layout.pages, layout.edges, pagesByCoord, bounds]);

  useEffect(() => {
    viewRef.current = { pan, scale };
  }, [pan, scale]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (didInit.current || viewport.width === 0) return;
    const home =
      layout.pages.find((p) => p.coordX === layout.homeCoordX && p.coordY === layout.homeCoordY) ?? layout.pages[0];
    if (!home) return;
    const center = cellCenterForCoord(home.coordX, home.coordY, bounds);
    setScale(1);
    setPan({ x: viewport.width / 2 - center.x, y: viewport.height / 2 - center.y });
    didInit.current = true;
  }, [viewport, layout, bounds]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const current = viewRef.current;
      const worldX = (mx - current.pan.x) / current.scale;
      const worldY = (my - current.pan.y) / current.scale;
      const nextScale = clampScale(current.scale * Math.exp(-event.deltaY * 0.0015));
      setScale(nextScale);
      setPan({ x: mx - worldX * nextScale, y: my - worldY * nextScale });
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);

  const zoomAtCenter = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = rect.width / 2;
    const my = rect.height / 2;
    const worldX = (mx - pan.x) / scale;
    const worldY = (my - pan.y) / scale;
    const nextScale = clampScale(scale * factor);
    setScale(nextScale);
    setPan({ x: mx - worldX * nextScale, y: my - worldY * nextScale });
  };

  const resetView = () => {
    const home =
      layout.pages.find((p) => p.coordX === layout.homeCoordX && p.coordY === layout.homeCoordY) ?? layout.pages[0];
    if (!home || viewport.width === 0) return;
    const center = cellCenterForCoord(home.coordX, home.coordY, bounds);
    setScale(1);
    setPan({ x: viewport.width / 2 - center.x, y: viewport.height / 2 - center.y });
  };

  const fitView = () => {
    if (viewport.width === 0 || viewport.height === 0 || layout.pages.length === 0) return;
    const centers = layout.pages.map((page) => cellCenterForCoord(page.coordX, page.coordY, bounds));
    const minX = Math.min(...centers.map((p) => p.x)) - TILE_WIDTH / 2;
    const maxX = Math.max(...centers.map((p) => p.x)) + TILE_WIDTH / 2;
    const minY = Math.min(...centers.map((p) => p.y)) - TILE_HEIGHT / 2;
    const maxY = Math.max(...centers.map((p) => p.y)) + TILE_HEIGHT / 2;
    const padding = 80;
    const nextScale = clampScale(
      Math.min((viewport.width - padding * 2) / (maxX - minX), (viewport.height - padding * 2) / (maxY - minY)),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setScale(nextScale);
    setPan({ x: viewport.width / 2 - cx * nextScale, y: viewport.height / 2 - cy * nextScale });
  };

  const handleContainerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (event.pointerType === "touch") {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pointersRef.current.size === 2) {
        const [a, b] = Array.from(pointersRef.current.values());
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
          pinchRef.current = {
            startDist: Math.max(distance, 1),
            startScale: scale,
            worldPoint: { x: (mid.x - pan.x) / scale, y: (mid.y - pan.y) / scale },
          };
          panDragRef.current = null;
          return;
        }
      }
    }
    onSelectPage(null);
    panDragRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleContainerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
        const nextScale = clampScale(pinch.startScale * (distance / pinch.startDist));
        setScale(nextScale);
        setPan({ x: mid.x - pinch.worldPoint.x * nextScale, y: mid.y - pinch.worldPoint.y * nextScale });
      }
      return;
    }
    const drag = panDragRef.current;
    if (drag) {
      setPan({
        x: drag.panX + (event.clientX - drag.startX),
        y: drag.panY + (event.clientY - drag.startY),
      });
    }
  };

  const handleContainerPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    panDragRef.current = null;
  };

  const handlePagePointerDown = (event: ReactPointerEvent<HTMLDivElement>, page: Page) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelectPage(page.pageId);
    const center = cellCenterForCoord(page.coordX, page.coordY, bounds);
    pageDragRef.current = {
      pageId: page.pageId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWorldX: center.x,
      startWorldY: center.y,
      lastDx: 0,
      lastDy: 0,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = pageDragRef.current;
    if (!drag) return;
    event.stopPropagation();
    const dx = (event.clientX - drag.startClientX) / scale;
    const dy = (event.clientY - drag.startClientY) / scale;
    if (Math.hypot(dx, dy) > 3) drag.moved = true;
    drag.lastDx = dx;
    drag.lastDy = dy;
    setDragPreview({ pageId: drag.pageId, dx, dy });
  };

  const handlePagePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = pageDragRef.current;
    if (!drag) return;
    event.stopPropagation();
    pageDragRef.current = null;
    setDragPreview(null);
    if (drag.moved) {
      const target = coordFromWorldPoint(drag.startWorldX + drag.lastDx, drag.startWorldY + drag.lastDy, bounds);
      onMovePage(drag.pageId, target.x, target.y);
    }
  };

  const handlePagePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    pageDragRef.current = null;
    setDragPreview(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-[#080808]"
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: GRID_BG,
          backgroundSize: `${STRIDE_X * scale}px ${STRIDE_Y * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: world.width,
          height: world.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        }}
      >
        <div
          className="absolute rounded-sm border border-dashed border-[#2a2a2a]"
          style={{ left: 0, top: 0, width: world.width, height: world.height }}
        />

        {addCandidates.map((candidate) => {
          const center = cellCenterForCoord(candidate.x, candidate.y, bounds);
          return (
            <button
              key={`add-${candidate.x},${candidate.y}`}
              type="button"
              title={`Add page at ${candidate.x},${candidate.y}`}
              className="absolute z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-[#3a3a3a] bg-[#0b0b0b] text-lg text-[#6b6157] transition hover:border-[#e6e2d8] hover:text-[#e6e2d8]"
              style={{ left: center.x, top: center.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setAddTarget(candidate)}
            >
              +
            </button>
          );
        })}

        {layout.pages.map((page) => {
          const center = cellCenterForCoord(page.coordX, page.coordY, bounds);
          const selected = page.pageId === selectedPageId;
          const invalid = invalidPageIds.has(page.pageId);
          const home = isHomePage(layout, page);
          const type = effectivePageType(layout, page);
          const drag = dragPreview?.pageId === page.pageId ? dragPreview : null;
          const border = selected
            ? "border-[#e6e2d8] shadow-[0_0_0_2px_rgba(230,226,216,0.25)]"
            : invalid
              ? "border-[#ef4444]"
              : home
                ? "border-[#a8a29a]"
                : "border-[#3a3a3a]";
          const badge =
            type === "HOME"
              ? "bg-[#e6e2d8] text-[#080808]"
              : type === "APP_DRAWER"
                ? "bg-[#6b6157] text-white"
                : "bg-[#202020] text-[#a8a29a]";

          return (
            <div
              key={page.pageId}
              role="button"
              tabIndex={0}
              aria-label={`Page ${page.title || `${page.coordX},${page.coordY}`} at ${page.coordX},${page.coordY}`}
              className={`absolute cursor-grab rounded-[10px] border-2 bg-[#141414] ${border} ${drag ? "cursor-grabbing" : ""}`}
              style={{
                left: center.x - TILE_WIDTH / 2,
                top: center.y - TILE_HEIGHT / 2,
                width: TILE_WIDTH,
                height: TILE_HEIGHT,
                transform: drag ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
              }}
              onPointerDown={(event) => handlePagePointerDown(event, page)}
              onPointerMove={handlePagePointerMove}
              onPointerUp={handlePagePointerUp}
              onPointerCancel={handlePagePointerCancel}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPage(page.pageId);
                }
              }}
            >
              <div className="flex h-full flex-col justify-between overflow-hidden rounded-[8px] p-1.5">
                <div>
                  <span className={`inline-flex rounded px-1 py-0.5 font-mono text-[7px] uppercase tracking-wider ${badge}`}>
                    {type}
                  </span>
                  <div className="mt-1 line-clamp-2 text-[10px] font-medium leading-tight text-[#ededed]">
                    {page.title || `Page ${page.coordX},${page.coordY}`}
                  </div>
                </div>
                <div className="space-y-0.5 font-mono text-[8px] leading-tight text-[#a8a29a]">
                  {layout.showCoordinateDetail && <div>{page.coordX},{page.coordY}</div>}
                  <div>{page.gridCols}×{page.gridRows}</div>
                  <div>#{page.pageId}</div>
                </div>
              </div>

            </div>
          );
        })}
        {linkArrows.map((arrow) => (
          <button
            key={arrow.key}
            type="button"
            title={
              arrow.linked
                ? `Unlink ${arrow.from.title || "page"} and ${arrow.to.title || "page"}`
                : `Link ${arrow.from.title || "page"} and ${arrow.to.title || "page"}`
            }
            aria-label={arrow.linked ? "Unlink pages" : "Link pages"}
            aria-pressed={arrow.linked}
            className={`absolute z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[11px] leading-none transition ${
              arrow.linked
                ? "border-[#e6e2d8] bg-[#e6e2d8] text-[#080808]"
                : "border-[#3a3a3a] bg-[#0b0b0b] text-[#5a5a5a] hover:border-[#e6e2d8] hover:text-[#e6e2d8]"
            }`}
            style={{ left: arrow.x, top: arrow.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleLink(arrow.from.pageId, arrow.to.pageId, arrow.dir);
            }}
          >
            {arrow.horizontal ? "↔" : "↕"}
          </button>
        ))}
      </div>

      <div
        className="absolute left-4 top-4 z-30 flex items-center gap-1.5 rounded-xl border border-[#242424] bg-[#0b0b0b]/90 p-1.5 backdrop-blur"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button type="button" className={controlButton()} onClick={() => zoomAtCenter(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <span className="w-10 text-center font-mono text-[10px] text-[#a8a29a]">{Math.round(scale * 100)}%</span>
        <button type="button" className={controlButton()} onClick={() => zoomAtCenter(1.2)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={controlButton()} onClick={fitView}>
          Fit
        </button>
        <button type="button" className={controlButton()} onClick={resetView}>
          Home
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-20 rounded-lg border border-[#242424] bg-[#0b0b0b]/80 px-3 py-2 font-mono text-[10px] text-[#6b6157]">
        Drag empty space to pan · Scroll to zoom · Drag a page to move
      </div>

      {addTarget && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onPointerDown={() => setAddTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#3a3a3a] bg-[#141414] p-5 shadow-2xl"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6b6157]">New page</p>
            <h2 className="mt-2 text-lg font-semibold text-[#ededed]">
              Page {addTarget.x},{addTarget.y}
            </h2>
            <p className="mt-1 text-xs text-[#a8a29a]">
              Adjacent to {addTarget.source.title || `Page ${addTarget.source.coordX},${addTarget.source.coordY}`}.
              The link back to it is created automatically.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-xl border border-[#3a3a3a] bg-[#202020] px-4 py-2.5 text-left text-sm text-[#ededed] transition hover:border-[#e6e2d8]"
                onClick={() => {
                  onAddPage({ x: addTarget.x, y: addTarget.y }, "WIDGET", addTarget.source.pageId);
                  setAddTarget(null);
                }}
              >
                <span className="font-medium">WIDGET page</span>
                <span className="ml-2 font-mono text-[10px] text-[#a8a29a]">normal grid page</span>
              </button>
              <button
                type="button"
                className="rounded-xl border border-[#3a3a3a] bg-[#202020] px-4 py-2.5 text-left text-sm text-[#ededed] transition hover:border-[#e6e2d8]"
                onClick={() => {
                  onAddPage({ x: addTarget.x, y: addTarget.y }, "APP_DRAWER", addTarget.source.pageId);
                  setAddTarget(null);
                }}
              >
                <span className="font-medium">APP_DRAWER page</span>
                <span className="ml-2 font-mono text-[10px] text-[#a8a29a]">app list page</span>
              </button>
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-xl px-4 py-2 text-xs text-[#6b6157] transition hover:text-[#e6e2d8]"
              onClick={() => setAddTarget(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
