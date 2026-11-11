/**
 * Letter stamp: a signed distance field of one glyph in piece-local
 * coordinates, centred on the piece cell. The shaders turn it into a second
 * height field (pressed in or raised) on top of the bevel, so the letter is lit
 * by the same light as the rest of the piece.
 *
 * Glyph outlines come from the platform's fonts through a canvas. Without a
 * canvas (Node), no stamp is drawn unless a rasterizer is installed with
 * `setGlyphRasterizer` (tests do this).
 */
import type { SdfField } from "./sdf";
import { squaredEdt } from "./sdf";

/** Coverage of one glyph, fitted into the central `FIT` part of a square. */
export interface GlyphCoverage {
  /** N×N coverage in 0..1, row-major, top row first */
  alpha: Float32Array;
  size: number;
}

export interface GlyphRequest {
  char: string;
  font: string;
  weight: number;
  /** raster size in pixels (square) */
  size: number;
  /** fraction of the square the glyph's ink box may fill (both axes) */
  fit: number;
}

export type GlyphRasterizer = (req: GlyphRequest) => GlyphCoverage | null;

/** The glyph's ink box fills this fraction of the stamp square. */
export const GLYPH_FIT = 0.62;

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeContext(n: number): Ctx2D | null {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(n, n).getContext("2d", { willReadFrequently: true });
  }
  if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = n;
    c.height = n;
    return c.getContext("2d", { willReadFrequently: true });
  }
  return null;
}

/** Default rasterizer: draws the glyph with Canvas 2D, centred on its ink box. */
export const canvasGlyphRasterizer: GlyphRasterizer = ({ char, font, weight, size: n, fit }) => {
  const ctx = makeContext(n);
  if (!ctx) return null;
  const probe = 100;
  ctx.font = `${weight} ${probe}px ${font}`;
  const m = ctx.measureText(char);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  if (!(w > 0 && h > 0)) return null;
  const k = Math.min((fit * n) / w, (fit * n) / h);
  ctx.font = `${weight} ${probe * k}px ${font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#000";
  ctx.clearRect(0, 0, n, n);
  // put the centre of the ink box on the centre of the square
  const x = n / 2 - ((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2) * k;
  const y = n / 2 + ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2) * k;
  ctx.fillText(char, x, y);
  const img = ctx.getImageData(0, 0, n, n).data;
  const alpha = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) alpha[i] = img[i * 4 + 3]! / 255;
  return { alpha, size: n };
};

let rasterizer: GlyphRasterizer = canvasGlyphRasterizer;

/** Replace the glyph rasterizer (returns the previous one). */
export function setGlyphRasterizer(r: GlyphRasterizer): GlyphRasterizer {
  const prev = rasterizer;
  rasterizer = r;
  stampCache.clear();
  return prev;
}

/** A 2×2 field that is "outside" everywhere: bound when a piece has no stamp. */
export const EMPTY_STAMP: SdfField = Object.freeze({
  width: 2,
  height: 2,
  data: new Float32Array([-1, -1, -1, -1]),
  originX: 0,
  originY: 0,
  texel: 1,
});

export interface StampFieldOptions {
  font: string;
  weight: number;
  /** glyph height (ink box), piece units */
  size: number;
  /** centre of the stamp, piece-local */
  center?: [number, number];
  /** raster size (texels per side) */
  resolution: number;
}

/**
 * SDF of a glyph (piece units, positive inside the letter). Coverage is
 * thresholded at ½ and run through the exact EDT; texels on the outline use
 * their coverage for a sub-texel distance so the carved walls stay smooth.
 */
export function buildStampSdf(char: string, o: StampFieldOptions): SdfField | null {
  const n = Math.max(32, Math.round(o.resolution));
  const cov = rasterizer({ char, font: o.font, weight: o.weight, size: n, fit: GLYPH_FIT });
  if (!cov || cov.size !== n) return null;
  const a = cov.alpha;
  const inside = new Uint8Array(n * n);
  const outside = new Uint8Array(n * n);
  let any = false;
  for (let i = 0; i < n * n; i++) {
    const v = a[i]! >= 0.5;
    inside[i] = v ? 1 : 0;
    outside[i] = v ? 0 : 1;
    any ||= v;
  }
  if (!any) return null;
  const side = o.size / GLYPH_FIT;
  const texel = side / n;
  const dOut = squaredEdt(outside, n, n);
  const dIn = squaredEdt(inside, n, n);
  const data = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    let d = inside[i] ? Math.sqrt(dOut[i]!) - 0.5 : -(Math.sqrt(dIn[i]!) - 0.5);
    // on the outline, coverage is a better (sub-texel) distance estimate
    if (Math.abs(d) <= 1) d = a[i]! - 0.5;
    data[i] = d * texel;
  }
  const c = o.center ?? [0.5, 0.5];
  return { width: n, height: n, data, originX: c[0] - side / 2, originY: c[1] - side / 2, texel };
}

/** Raster size for a stamp: about the texel density of the piece SDF. */
export function stampResolution(sdfResolution: number, size: number): number {
  const want = (sdfResolution * (size / GLYPH_FIT)) / 1.2;
  return Math.min(512, Math.max(64, Math.ceil(want / 32) * 32));
}

class StampCache {
  private map = new Map<string, SdfField>();
  constructor(private capacity = 64) {}
  get(char: string, o: StampFieldOptions): SdfField {
    const k = `${char}|${o.font}|${o.weight}|${o.size}|${o.resolution}|${o.center?.join() ?? ""}`;
    const hit = this.map.get(k);
    if (hit) {
      this.map.delete(k);
      this.map.set(k, hit);
      return hit;
    }
    const f = buildStampSdf(char, o) ?? EMPTY_STAMP;
    this.map.set(k, f);
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value!);
    return f;
  }
  clear() {
    this.map.clear();
  }
}

export const stampCache = new StampCache();
