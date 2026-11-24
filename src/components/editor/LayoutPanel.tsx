"use client";

import {
  PALETTE_KEYS,
  type CustomPalette,
  type LayoutDocument,
  type OrientationMode,
  type ThemeMode,
} from "@/lib/model";

interface LayoutPanelProps {
  layout: LayoutDocument;
  onChange: (patch: Partial<LayoutDocument>) => void;
  onPaletteChange: (key: keyof CustomPalette, value: string) => void;
  onPaletteReset: () => void;
}

const THEMES: { value: ThemeMode; label: string; hint: string }[] = [
  { value: "SYSTEM", label: "System", hint: "Follow the device setting" },
  { value: "DARK", label: "Dark", hint: "Always dark" },
  { value: "LIGHT", label: "Light", hint: "Always light" },
  { value: "CUSTOM", label: "Custom", hint: "Your own palette" },
];

const ORIENTATIONS: OrientationMode[] = ["PORTRAIT", "LANDSCAPE", "AUTO"];

const PALETTE_LABELS: Record<keyof CustomPalette, string> = {
  background: "Background",
  surface: "Surface",
  surfaceVariant: "Surface variant",
  onBackground: "Text on background",
  onSurface: "Text on surface",
  primary: "Primary",
  secondary: "Secondary",
  outline: "Outline",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-[#1e1e1e] px-4 py-4">
      <h3 className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6b6157]">{title}</h3>
      {children}
    </section>
  );
}

export function LayoutPanel({ layout, onChange, onPaletteChange, onPaletteReset }: LayoutPanelProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#0e0e0e]">
      <div className="border-b border-[#1e1e1e] px-4 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6b6157]">Layout</p>
        <h2 className="mt-1 text-sm font-semibold text-[#ededed]">Theme &amp; display</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-[#6b6157]">
          These settings are saved into the launcher backup and applied on the device.
        </p>
      </div>

      <Section title="Theme">
        <div className="grid grid-cols-2 gap-1.5">
          {THEMES.map((theme) => {
            const active = layout.theme === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                title={theme.hint}
                className={`rounded-lg border px-2.5 py-2 text-left transition ${
                  active
                    ? "border-[#e6e2d8] bg-[#e6e2d8]/10"
                    : "border-[#2f2f2f] bg-[#0b0b0b] hover:border-[#e6e2d8]"
                }`}
                onClick={() => onChange({ theme: theme.value })}
              >
                <span className={`block text-xs ${active ? "text-[#ededed]" : "text-[#a8a29a]"}`}>{theme.label}</span>
                <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-wider text-[#6b6157]">
                  {theme.value}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {layout.theme === "CUSTOM" && (
        <Section title="Custom palette">
          <div className="space-y-1.5">
            {PALETTE_KEYS.map((key) => {
              const value = layout.customPalette?.[key] ?? "";
              return (
                <label
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#2f2f2f] bg-[#0b0b0b] px-2.5 py-1.5"
                >
                  <span className="min-w-0 truncate text-[11px] text-[#a8a29a]">{PALETTE_LABELS[key]}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="font-mono text-[9px] uppercase text-[#6b6157]">{value || "—"}</span>
                    <input
                      type="color"
                      className="h-6 w-7 cursor-pointer rounded border border-[#3a3a3a] bg-transparent p-0"
                      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
                      onChange={(event) => onPaletteChange(key, event.target.value)}
                      aria-label={`${PALETTE_LABELS[key]} color`}
                    />
                  </span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            className="w-full rounded-lg border border-[#2f2f2f] bg-[#0b0b0b] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-[#6b6157] transition hover:border-[#e6e2d8] hover:text-[#e6e2d8]"
            onClick={onPaletteReset}
          >
            Reset palette
          </button>
          <p className="text-[10px] leading-relaxed text-[#6b6157]">
            A visual theme maker (live preview, contrast checks, presets) is planned for a later pass. For now the
            eight palette slots map straight to the launcher&apos;s colour roles.
          </p>
        </Section>
      )}

      <Section title="Orientation">
        <div className="grid grid-cols-3 gap-1.5">
          {ORIENTATIONS.map((orientation) => {
            const active = layout.orientation === orientation;
            return (
              <button
                key={orientation}
                type="button"
                className={`rounded-lg border px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider transition ${
                  active
                    ? "border-[#e6e2d8] bg-[#e6e2d8] text-[#080808]"
                    : "border-[#2f2f2f] bg-[#0b0b0b] text-[#a8a29a] hover:border-[#e6e2d8]"
                }`}
                onClick={() => onChange({ orientation })}
              >
                {orientation.slice(0, 4)}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Map">
        <div className="flex items-center justify-between rounded-lg border border-[#2f2f2f] bg-[#0b0b0b] px-2.5 py-2">
          <span className="text-xs text-[#a8a29a]">Show coordinate detail</span>
          <button
            type="button"
            role="switch"
            aria-checked={layout.showCoordinateDetail}
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${
              layout.showCoordinateDetail ? "bg-[#e6e2d8]" : "bg-[#2f2f2f]"
            }`}
            onClick={() => onChange({ showCoordinateDetail: !layout.showCoordinateDetail })}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full transition ${
                layout.showCoordinateDetail ? "left-4.5 bg-[#080808]" : "left-0.5 bg-[#a8a29a]"
              }`}
            />
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-[#6b6157]">
          Coordinate detail shows the page position inside each page card and on the launcher map.
        </p>
      </Section>
    </div>
  );
}
