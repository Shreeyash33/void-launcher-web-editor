"use client";

import { useCallback, useEffect, useState } from "react";
import { createEmptyInventory, normalizeInventory, type DeviceInventory } from "./model";
import { INVENTORY_KEY, loadDocument, saveDocument } from "./storage";

export function useInventoryStore() {
  const [inventory, setInventoryState] = useState<DeviceInventory | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDocument<unknown>(INVENTORY_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (saved) setInventoryState(normalizeInventory(saved));
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setInventory = useCallback((next: DeviceInventory | null) => {
    setInventoryState(next);
    if (next) {
      saveDocument(INVENTORY_KEY, next).catch(() => undefined);
    }
  }, []);

  const clearInventory = useCallback(() => {
    setInventoryState(null);
    saveDocument(INVENTORY_KEY, null).catch(() => undefined);
  }, []);

  return { inventory, setInventory, clearInventory, hydrated };
}

export { createEmptyInventory };
