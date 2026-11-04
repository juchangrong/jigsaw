import type { BezierSegment, Bounds, Vec2 } from "../types";

export function line(a: Vec2, b: Vec2): BezierSegment {
  return {
    p0: a,
    p1: [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
    p2: [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3],
    p3: b,
  };
}

export function cubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2): BezierSegment {
  return { p0, p1, p2, p3 };
}

export function evalCubic(s: BezierSegment, t: number): Vec2 {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return [
    a * s.p0[0] + b * s.p1[0] + c * s.p2[0] + d * s.p3[0],
    a * s.p0[1] + b * s.p1[1] + c * s.p2[1] + d * s.p3[1],
  ];
}

export function reverseSegment(s: BezierSegment): BezierSegment {
  return { p0: s.p3, p1: s.p2, p2: s.p1, p3: s.p0 };
}

export function reversePath(path: BezierSegment[]): BezierSegment[] {
  return path.map(reverseSegment).reverse();
}

export function mapSegment(s: BezierSegment, f: (p: Vec2) => Vec2): BezierSegment {
  return { p0: f(s.p0), p1: f(s.p1), p2: f(s.p2), p3: f(s.p3) };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function isStraight(s: BezierSegment): boolean {
  const dx = s.p3[0] - s.p0[0];
  const dy = s.p3[1] - s.p0[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return true;
  const off = (p: Vec2) => Math.abs((p[0] - s.p0[0]) * dy - (p[1] - s.p0[1]) * dx) / len;
  return off(s.p1) < 1e-9 && off(s.p2) < 1e-9;
}

/**
 * Flatten a closed path into a polygon (the closing point is not repeated).
 * `maxSegment` is the maximum chord length in path units.
 */
export function flattenPath(path: BezierSegment[], maxSegment = 0.01): Vec2[] {
  const pts: Vec2[] = [];
  for (const s of path) {
    if (isStraight(s)) {
      pts.push(s.p0);
      continue;
    }
    const ctrl = dist(s.p0, s.p1) + dist(s.p1, s.p2) + dist(s.p2, s.p3);
    const n = Math.max(4, Math.ceil(ctrl / maxSegment));
    for (let i = 0; i < n; i++) pts.push(evalCubic(s, i / n));
  }
  return pts;
}

export function polygonArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += poly[j]![0] * poly[i]![1] - poly[i]![0] * poly[j]![1];
  }
  return a / 2;
}

export function polygonBounds(poly: Vec2[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Bounds of a Bézier path (via a fine flattening; exact enough for layout). */
export function pathBounds(path: BezierSegment[]): Bounds {
  return polygonBounds(flattenPath(path, 0.005));
}

function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o = (p: Vec2, q: Vec2, r: Vec2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** True if any two non-adjacent edges of the closed polygon cross. */
export function polygonSelfIntersects(poly: Vec2[]): boolean {
  const n = poly.length;
  // bucket edges into a coarse grid to keep this fast
  const b = polygonBounds(poly);
  const cells = 32;
  const w = (b.maxX - b.minX) / cells || 1;
  const h = (b.maxY - b.minY) / cells || 1;
  const grid = new Map<number, number[]>();
  const cellRange = (i: number) => {
    const a = poly[i]!;
    const c = poly[(i + 1) % n]!;
    const x0 = Math.floor((Math.min(a[0], c[0]) - b.minX) / w);
    const x1 = Math.floor((Math.max(a[0], c[0]) - b.minX) / w);
    const y0 = Math.floor((Math.min(a[1], c[1]) - b.minY) / h);
    const y1 = Math.floor((Math.max(a[1], c[1]) - b.minY) / h);
    return [x0, x1, y0, y1] as const;
  };
  for (let i = 0; i < n; i++) {
    const [x0, x1, y0, y1] = cellRange(i);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const k = y * (cells + 1) + x;
        let list = grid.get(k);
        if (!list) grid.set(k, (list = []));
        list.push(i);
      }
  }
  for (const list of grid.values()) {
    for (let p = 0; p < list.length; p++)
      for (let q = p + 1; q < list.length; q++) {
        const i = list[p]!;
        const j = list[q]!;
        if (Math.abs(i - j) <= 1 || Math.abs(i - j) === n - 1) continue;
        if (segmentsIntersect(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return true;
      }
  }
  return false;
}

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const c = poly[j]!;
    if (a[1] > p[1] !== c[1] > p[1] && p[0] < ((c[0] - a[0]) * (p[1] - a[1])) / (c[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}
