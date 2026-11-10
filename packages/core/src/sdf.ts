import { flattenPath, polygonBounds } from "./geometry/bezier";
import type { BezierSegment, Vec2 } from "./types";

/**
 * Signed distance field of a piece outline, in piece units, positive inside.
 * Texel (i, j) is centred at (originX + (i + 0.5)·texel, originY + (j + 0.5)·texel).
 */
export interface SdfField {
  width: number;
  height: number;
  data: Float32Array;
  originX: number;
  originY: number;
  texel: number;
}

export interface SdfOptions {
  /** extra space around the outline, piece units (room for shadow blur) */
  padding?: number;
  /** distances within this band (piece units) are computed exactly */
  exactBand?: number;
}

const INF = 1e20;

/** 1-D squared Euclidean distance transform (Felzenszwalb & Huttenlocher). */
function edt1d(f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const dq = q - v[k]!;
    d[q] = dq * dq + f[v[k]!]!;
  }
}

/** Exact 2-D squared EDT: distance (in texels²) from each texel to the nearest
 * texel where `seed` is 1. */
export function squaredEdt(seed: Uint8Array, w: number, h: number): Float64Array {
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = seed[i] ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]!;
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]!;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]!;
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]!;
  }
  return grid;
}

/** Binary coverage mask: 1 where the texel centre lies inside the polygon
 * (even–odd scanline fill). */
export function rasterizeMask(poly: Vec2[], w: number, h: number, ox: number, oy: number, texel: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const xs: number[] = [];
  const n = poly.length;
  for (let j = 0; j < h; j++) {
    const y = oy + (j + 0.5) * texel;
    xs.length = 0;
    for (let i = 0, k = n - 1; i < n; k = i++) {
      const a = poly[i]!;
      const b = poly[k]!;
      if (a[1] > y !== b[1] > y) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    xs.sort((p, q) => p - q);
    for (let s = 0; s + 1 < xs.length; s += 2) {
      const i0 = Math.max(0, Math.ceil((xs[s]! - ox) / texel - 0.5));
      const i1 = Math.min(w - 1, Math.floor((xs[s + 1]! - ox) / texel - 0.5));
      for (let i = i0; i <= i1; i++) mask[j * w + i] = 1;
    }
  }
  return mask;
}

/**
 * Build the SDF of a closed Bézier outline:
 *  1. flatten the path and rasterize a coverage mask,
 *  2. exact EDT of the inside and outside sets → signed field,
 *  3. refine texels near the outline with exact point-to-segment distances so
 *     the bevel (which lives in that band) gets smooth, sub-texel normals.
 */
export function buildSdf(path: BezierSegment[], resolution: number, opts: SdfOptions = {}): SdfField {
  const padding = opts.padding ?? 0.3;
  const band = opts.exactBand ?? 0.16;
  const coarse = polygonBounds(flattenPath(path, 0.02));
  const minX = coarse.minX - padding;
  const minY = coarse.minY - padding;
  const spanX = coarse.maxX - coarse.minX + 2 * padding;
  const spanY = coarse.maxY - coarse.minY + 2 * padding;
  const texel = Math.max(spanX, spanY) / resolution;
  const w = Math.ceil(spanX / texel);
  const h = Math.ceil(spanY / texel);

  const poly = flattenPath(path, Math.min(0.012, Math.max(0.003, texel * 4)));
  const mask = rasterizeMask(poly, w, h, minX, minY, texel);
  const outside = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) outside[i] = mask[i] ? 0 : 1;
  const dToOutside = squaredEdt(outside, w, h);
  const dToInside = squaredEdt(mask, w, h);

  const data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    data[i] = mask[i] ? (Math.sqrt(dToOutside[i]!) - 0.5) * texel : -(Math.sqrt(dToInside[i]!) - 0.5) * texel;
  }

  // exact refinement inside the band
  const exact = new Float32Array(w * h).fill(Infinity);
  const bandTex = Math.ceil(band / texel);
  for (let s = 0, k = poly.length - 1; s < poly.length; k = s++) {
    const a = poly[k]!;
    const b = poly[s]!;
    const ax = (a[0] - minX) / texel - 0.5;
    const ay = (a[1] - minY) / texel - 0.5;
    const bx = (b[0] - minX) / texel - 0.5;
    const by = (b[1] - minY) / texel - 0.5;
    const i0 = Math.max(0, Math.floor(Math.min(ax, bx)) - bandTex);
    const i1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx)) + bandTex);
    const j0 = Math.max(0, Math.floor(Math.min(ay, by)) - bandTex);
    const j1 = Math.min(h - 1, Math.ceil(Math.max(ay, by)) + bandTex);
    const ex = bx - ax;
    const ey = by - ay;
    const len2 = ex * ex + ey * ey || 1e-12;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        let t = ((i - ax) * ex + (j - ay) * ey) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = i - (ax + t * ex);
        const dy = j - (ay + t * ey);
        const d2 = dx * dx + dy * dy;
        const idx = j * w + i;
        if (d2 < exact[idx]!) exact[idx] = d2;
      }
    }
  }
  const band2 = bandTex * bandTex;
  for (let i = 0; i < w * h; i++) {
    const e = exact[i]!;
    if (e <= band2) data[i] = (mask[i] ? 1 : -1) * Math.sqrt(e) * texel;
  }

  return { width: w, height: h, data, originX: minX, originY: minY, texel };
}

/** Bilinear sample of the field at a piece-local point (clamped to the edge). */
export function sampleSdf(f: SdfField, x: number, y: number): number {
  let u = (x - f.originX) / f.texel - 0.5;
  let v = (y - f.originY) / f.texel - 0.5;
  u = Math.min(f.width - 1, Math.max(0, u));
  v = Math.min(f.height - 1, Math.max(0, v));
  const i = Math.min(f.width - 2, Math.floor(u));
  const j = Math.min(f.height - 2, Math.floor(v));
  const fu = u - i;
  const fv = v - j;
  const d = f.data;
  const w = f.width;
  const a = d[j * w + i]!;
  const b = d[j * w + i + 1]!;
  const c = d[(j + 1) * w + i]!;
  const e = d[(j + 1) * w + i + 1]!;
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + e * fu) * fv;
}

/** SDF sizes (longest side, texels) the renderer picks from. */
export const SDF_RESOLUTIONS = [128, 192, 256, 384, 512, 768, 1024] as const;

/**
 * SDF resolution (longest side, texels) for an output size: the smallest step
 * with about one texel per output pixel across the piece domain (about 1.7
 * piece units). The field is read with bilinear filtering and holds exact
 * distances near the outline, so more texels cost build time, which grows
 * with the texel count, for no visible change.
 */
export function recommendedSdfResolution(size: number, pieceScale: number): number {
  const want = size * pieceScale * 1.7;
  return SDF_RESOLUTIONS.find((r) => r >= want) ?? 1024;
}

/**
 * Least-recently-used cache of SDF fields. It is bounded by total texels (four
 * bytes each) rather than by entry count, because a 1024 field is 64 times
 * the size of a 128 one.
 */
export class SdfCache {
  private map = new Map<string, SdfField>();
  private texels = 0;
  constructor(private maxTexels = 16 * 1024 * 1024) {}

  get(key: string, path: BezierSegment[], resolution: number): SdfField {
    const k = `${key}@${resolution}`;
    const hit = this.map.get(k);
    if (hit) {
      this.map.delete(k);
      this.map.set(k, hit);
      return hit;
    }
    const f = buildSdf(path, resolution);
    this.map.set(k, f);
    this.texels += f.data.length;
    // the field just built stays even if it alone exceeds the budget
    for (const [old, field] of this.map) {
      if (this.texels <= this.maxTexels || old === k) break;
      this.map.delete(old);
      this.texels -= field.data.length;
    }
    return f;
  }

  clear() {
    this.map.clear();
    this.texels = 0;
  }

  get size() {
    return this.map.size;
  }
}

export const sharedSdfCache = new SdfCache();
