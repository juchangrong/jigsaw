import type { PuzzleIconOptions } from "@jigsaw/core";
import { getSharedGenerator, type BackendKind, type RenderResult, type RendererPreference } from "@jigsaw/renderer";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export interface PuzzleIconProps extends Omit<PuzzleIconOptions, "seed"> {
  seed: PuzzleIconOptions["seed"];
  /** CSS pixel size (rendered at size × devicePixelRatio) */
  size?: number;
  renderer?: RendererPreference;
  className?: string;
  style?: CSSProperties;
  /** accessible label */
  title?: string;
  onRender?: (result: RenderResult) => void;
  onError?: (error: Error) => void;
}

/**
 * `<PuzzleIcon seed="alpha" size={64} gradient={{ palette: "aurora" }} />`
 *
 * All icons share one generator (one GPU device); rendered images are cached,
 * so re-mounting or repeating an icon costs a cache lookup.
 */
export function PuzzleIcon({ renderer, className, style, title, onRender, onError, ...options }: PuzzleIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = options.size ?? 128;
  const dpr = typeof window !== "undefined" ? Math.min(3, window.devicePixelRatio || 1) : 1;
  const px = Math.round(size * dpr);
  const key = JSON.stringify(options);
  const opts = useMemo(() => options, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const callbacks = useRef({ onRender, onError });
  callbacks.current = { onRender, onError };

  useEffect(() => {
    // aborting skips the work for an icon that changed or unmounted while queued
    const abort = new AbortController();
    getSharedGenerator(renderer ? { renderer } : undefined)
      .render({ ...opts, size }, { size: px, signal: abort.signal })
      .then((r) => {
        const c = canvasRef.current;
        if (abort.signal.aborted || !c) return;
        c.getContext("2d")!.putImageData(new ImageData(r.image.data as Uint8ClampedArray<ArrayBuffer>, r.image.width, r.image.height), 0, 0);
        callbacks.current.onRender?.(r);
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) callbacks.current.onError?.(e);
      });
    return () => abort.abort();
  }, [opts, size, px, renderer]);

  return (
    <canvas
      ref={canvasRef}
      width={px}
      height={px}
      className={className}
      role="img"
      aria-label={title ?? `Puzzle icon ${String(options.seed)}`}
      style={{ width: size, height: size, display: "block", ...style }}
    />
  );
}

/** Which backend the shared generator ended up with. */
export function useRendererBackend(renderer?: RendererPreference): BackendKind | null {
  const [kind, setKind] = useState<BackendKind | null>(null);
  useEffect(() => {
    let live = true;
    getSharedGenerator(renderer ? { renderer } : undefined)
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
