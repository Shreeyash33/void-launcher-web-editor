"use client";

import type { ValidationIssue } from "@/lib/validate";

interface ValidationPanelProps {
  issues: ValidationIssue[];
  onSelectIssue: (issue: ValidationIssue) => void;
}

export function ValidationPanel({ issues, onSelectIssue }: ValidationPanelProps) {
  const errors = issues.length;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#0e0e0e]">
      <div className="border-b border-[#1e1e1e] px-4 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6b6157]">Android validation</p>
        <h2 className="mt-1 text-sm font-semibold text-[#ededed]">
          {errors === 0 ? "Layout is valid" : `${errors} ${errors === 1 ? "issue" : "issues"}`}
        </h2>
        <p className="mt-1 text-[10px] leading-relaxed text-[#6b6157]">
          Mirrors the launcher&apos;s import checks. Export is only safe when this list is empty.
        </p>
      </div>

      {errors === 0 ? (
        <div className="mx-4 mt-4 rounded-lg border border-[#1f3a25] bg-[#0f1a12] px-3 py-3">
          <p className="flex items-center gap-2 text-xs font-medium text-[#4ade80]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
            No issues found
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#6b7f6b]">
            Every page is connected, reachable from home, and every item fits inside its grid.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#1a1a1a]">
          {issues.map((issue, index) => {
            const clickable = issue.pageId !== undefined || issue.coord !== undefined;
            return (
              <li key={`${issue.code}-${index}`}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => onSelectIssue(issue)}
                  className={`flex w-full flex-col gap-1 px-4 py-2.5 text-left transition ${
                    clickable ? "hover:bg-[#161616]" : "cursor-default"
                  }`}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#ef4444]">
                    {issue.code.replaceAll(" ", " · ")}
                  </span>
                  <span className="text-[11px] leading-snug text-[#c9c4bb]">{issue.message}</span>
                  {(issue.pageId !== undefined || issue.coord) && (
                    <span className="font-mono text-[9px] text-[#6b6157]">
                      {issue.pageId !== undefined ? `page #${issue.pageId}` : ""}
                      {issue.pageId !== undefined && issue.coord ? " · " : ""}
                      {issue.coord ? `${issue.coord.x},${issue.coord.y}` : ""}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
