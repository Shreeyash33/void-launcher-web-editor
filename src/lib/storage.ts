"use client";

import { createCanonicalLayout, normalizeLayout, type LayoutDocument } from "./model";

const DB_NAME = "void-launcher-web-editor";
const DB_VERSION = 1;
const STORE = "documents";
const LAYOUT_KEY = "layout";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB."));
  });
  return dbPromise;
}

function readValue<T>(key: string): Promise<T | null> {
  return openDatabase().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const request = tx.objectStore(STORE).get(key);
        request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error("Could not read local data."));
      }),
  );
}

function writeValue<T>(key: string, value: T): Promise<void> {
  return openDatabase().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Could not save local data."));
      }),
  );
}

export async function loadLayout(): Promise<LayoutDocument | null> {
  try {
    const saved = await readValue<unknown>(LAYOUT_KEY);
    return saved ? normalizeLayout(saved) : null;
  } catch {
    return null;
  }
}

export async function saveLayout(layout: LayoutDocument): Promise<void> {
  await writeValue(LAYOUT_KEY, layout);
}

export const INVENTORY_KEY = "inventory";
export const BUNDLE_KEY = "bundle";

export async function loadDocument<T>(key: string): Promise<T | null> {
  try {
    return await readValue<T>(key);
  } catch {
    return null;
  }
}

export async function saveDocument<T>(key: string, value: T): Promise<void> {
  await writeValue(key, value);
}

export function canonicalFallback(): LayoutDocument {
  return createCanonicalLayout();
}
