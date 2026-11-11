import { useCallback, useState } from "react";

/** Prefix of every key the playground stores. */
export const STORAGE_PREFIX = "jigsaw.";

/**
 * `useState` that survives a reload. Stored values are a per-viewer
 * convenience: when storage is blocked, or holds something `parse` rejects,
 * this behaves like plain state starting from `fallback`.
 */
export function useStoredState<T>(key: string, fallback: T, parse: (stored: unknown) => T | undefined): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      if (raw === null) return fallback;
      let stored: unknown = raw;
      try {
        stored = JSON.parse(raw);
      } catch {
        // written as a bare string before values were stored as JSON
      }
      return parse(stored) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(next));
      } catch {
        // storage blocked: the value lasts for this visit only
      }
    },
    [key],
  );
  return [value, set];
}

/** Remove everything the playground stored. */
export function clearStored() {
  try {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith(STORAGE_PREFIX)) window.localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing was stored
  }
}
