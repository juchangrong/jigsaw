"use client";

import type { PuzzleIconOptions } from "@jigsaw/core";
import { getSharedGenerator, type BackendKind, type RenderResult, type RendererPreference } from "@jigsaw/renderer";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { clientDpr, serverDpr, subscribeDpr } from "./dpr";

export interface PuzzleIconProps extends Omit<PuzzleIconOptions, "seed"> {
  seed: PuzzleIconOptions["seed"];
  /** CSS pixel size (rendered at size × devicePixelRatio) */
  size?: number;
  renderer?: RendererPreference;
  className?: string;
  style?: CSSProperties;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
  onRender?: (result: RenderResult) => void;
  onError?: (error: Error) => void;
}

/**
 * `<PuzzleIcon seed="alpha" size={64} gradient={{ palette: "aurora" }} />`
 *
 * Icons asking for the same renderer share one generator (one GPU device);
 * rendered images are cached, so re-mounting or repeating an icon costs a
 * cache lookup. The canvas is drawn at `size × devicePixelRatio` and redrawn
 * when that ratio changes; server markup uses a ratio of 1.
 */
export function PuzzleIcon({ renderer, className, style, title, onRender, onError, ...options }: PuzzleIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = options.size ?? 128;
  const dpr = useSyncExternalStore(subscribeDpr, clientDpr, serverDpr);
  const px = Math.round(size * dpr);
  const key = JSON.stringify(options);
  const opts = useMemo(() => options, [key]);
  const callbacks = useRef({ onRender, onError });
  // declared before the render effect so a callback that changed with the options is the one called
  useEffect(() => {
    callbacks.current = { onRender, onError };
  });

  useEffect(() => {
    // aborting skips the work for an icon that changed or unmounted while queued
    const abort = new AbortController();
    getSharedGenerator(renderer ? { renderer } : undefined)
      .render({ ...opts, size }, { size: px, signal: abort.signal })
      .then((r) => {
        const c = canvasRef.current;
        if (abort.signal.aborted || !c) return;
        c.getContext("2d")!.putImageData(new ImageData(r.image.data, r.image.width, r.image.height), 0, 0);
        callbacks.current.onRender?.(r);
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) callbacks.current.onError?.(e);
      });
    return () => abort.abort();
  }, [opts, size, px, renderer]);

  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
  return <canvas ref={canvasRef} width={px} height={px} className={className} style={{ width: size, height: size, display: "block", ...style }} {...a11y} />;
}

/** Which backend the shared generator ended up with. */
export function useRendererBackend(renderer?: RendererPreference): BackendKind | null {
  const [kind, setKind] = useState<BackendKind | null>(null);
  useEffect(() => {
    let live = true;
    void getSharedGenerator(renderer ? { renderer } : undefined)
      .backend()
      .then((b) => live && setKind(b.kind));
    return () => {
      live = false;
    };
  }, [renderer]);
  return kind;
}

export { getSharedGenerator, PuzzleIconGenerator } from "@jigsaw/renderer";
export * from "./PuzzlePictogram";
export * from "./PuzzleMosaic";
