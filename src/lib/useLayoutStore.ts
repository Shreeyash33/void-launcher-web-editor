"use client";

import { useCallback, useEffect, useState } from "react";
import { createCanonicalLayout, type LayoutDocument } from "./model";
import { loadLayout, saveLayout } from "./storage";

export function useLayoutStore() {
  const [layout, setLayoutState] = useState<LayoutDocument>(() => createCanonicalLayout());
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLayout()
      .then((saved) => {
        if (cancelled) return;
        if (saved) setLayoutState(saved);
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setSaving(true);
    saveLayout(layout)
      .then(() => {
        if (cancelled) return;
        setSaving(false);
        setSaveError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSaving(false);
        setSaveError(error instanceof Error ? error.message : "Local save unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [layout, hydrated]);

  const setLayout = useCallback((next: LayoutDocument | ((current: LayoutDocument) => LayoutDocument)) => {
    setLayoutState((current) => (typeof next === "function" ? next(current) : next));
  }, []);

  const resetToCanonical = useCallback(() => {
    setLayoutState(createCanonicalLayout());
  }, []);

  return { layout, setLayout, hydrated, saving, saveError, resetToCanonical };
}
