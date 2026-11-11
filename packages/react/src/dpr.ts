/**
 * The device pixel ratio as an external store for `useSyncExternalStore`, so a
 * canvas is redrawn when its window moves to another display or the page zoom
 * changes, and so server markup and the first client render agree.
 */

const MAX_DPR = 3;

export function subscribeDpr(onChange: () => void): () => void {
  let query: MediaQueryList | null = null;
  const changed = () => {
    watch();
    onChange();
  };
  // a resolution query matches one ratio, so it is replaced after every change
  const watch = () => {
    query?.removeEventListener("change", changed);
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener("change", changed);
  };
  watch();
  return () => query?.removeEventListener("change", changed);
}

export const clientDpr = () => Math.min(MAX_DPR, window.devicePixelRatio || 1);

/** The server cannot know the ratio; the client corrects it after hydration. */
export const serverDpr = () => 1;
