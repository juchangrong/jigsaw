import type { Rng } from "../prng";
import type { BezierSegment, EdgeKind, PuzzleEdge, Vec2 } from "../types";
import { cubic, line, mapSegment, reversePath } from "./bezier";

export const EDGE_LIMITS = {
  center: [0.42, 0.58],
  width: [0.22, 0.35],
  depth: [0.24, 0.3],
  /** spacing of the two neck points P3, P6; the narrowest neck is NECK_WAIST × this */
  neckWidth: [0.18, 0.26],
  asymmetry: 0.08,
  curvature: [0.5, 0.9],
  wave: [0.025, 0.045],
  /** head must be at least this much wider than the neck */
  headOverNeck: 0.07,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface EdgeBias {
  tabSize: number; // 0..1
  curvature: number; // 0..1
  asymmetry: number; // 0..1 scale on ±0.08
}

/** Random edge parameters. `bias` values pull the random draw towards the
 * requested end of each range while keeping some per-edge variety. */
export function randomEdge(rng: Rng, id: string, kind: EdgeKind, bias: EdgeBias): PuzzleEdge {
  const mix = (r: number, target: number) => clamp(lerp(r, target, 0.55), 0, 1);
  const L = EDGE_LIMITS;
  const sizeT = mix(rng.next(), bias.tabSize);
  const e: PuzzleEdge = {
    id,
    kind,
    center: lerp(L.center[0], L.center[1], rng.next()),
    width: lerp(L.width[0], L.width[1], mix(rng.next(), bias.tabSize)),
    depth: lerp(L.depth[0], L.depth[1], sizeT),
    neckWidth: lerp(L.neckWidth[0], L.neckWidth[1], rng.next()),
    asymmetry: rng.signed(L.asymmetry) * clamp(bias.asymmetry, 0, 1),
    curvature: lerp(L.curvature[0], L.curvature[1], mix(rng.next(), bias.curvature)),
    wave: lerp(L.wave[0], L.wave[1], rng.next()),
  };
  return sanitizeEdge(e);
}

/**
 * The connector every single piece uses, so any single piece's tab fits any
 * other single piece's socket. It depends only on the geometry options (no
 * seed). Sockets are the point reflection of tabs (see `edgeProfile`), so the
 * connector may lean and wave and still meet its neighbour exactly.
 */
export function standardEdge(id: string, kind: EdgeKind, bias: EdgeBias): PuzzleEdge {
  const L = EDGE_LIMITS;
  const t = clamp(bias.tabSize, 0, 1);
  return sanitizeEdge({
    id,
    kind,
    center: 0.5,
    width: lerp(L.width[0], L.width[1], t),
    depth: lerp(L.depth[0], L.depth[1], t),
    neckWidth: lerp(L.neckWidth[0], L.neckWidth[1], 0.5),
    asymmetry: L.asymmetry * 0.6 * clamp(bias.asymmetry, 0, 1),
    curvature: lerp(L.curvature[0], L.curvature[1], clamp(bias.curvature, 0, 1)),
    wave: lerp(L.wave[0], L.wave[1], 0.6),
  });
}

/** Clamp all parameters into range and enforce head ≥ neck + margin so the
 * outline can never pinch or self-intersect. `minNeck` (side units) is raised
 * for small output sizes so the connection stays several pixels wide. */
export function sanitizeEdge(e: PuzzleEdge, minNeck: number = EDGE_LIMITS.neckWidth[0]): PuzzleEdge {
  const L = EDGE_LIMITS;
  // the pixel minimum applies to the narrowest point of the neck
  const neckWidth = clamp(Math.max(e.neckWidth, minNeck / NECK_WAIST), L.neckWidth[0], L.neckWidth[1]);
  const width = clamp(Math.max(e.width, neckWidth + L.headOverNeck), L.width[0], L.width[1]);
  const depth = clamp(e.depth, L.depth[0], L.depth[1]);
  return {
    ...e,
    center: clamp(e.center, L.center[0], L.center[1]),
    width,
    depth,
    neckWidth,
    asymmetry: clamp(e.asymmetry, -L.asymmetry, L.asymmetry),
    curvature: clamp(e.curvature, L.curvature[0], L.curvature[1]),
    wave: clamp(e.wave ?? L.wave[0], L.wave[0], L.wave[1]),
  };
}

/**
 * Edge profile in the edge frame: u runs 0 → 1 along the side, v points
 * outward from the piece. A tab bulges to +v, a socket to −v.
 */
export function edgeProfile(e: PuzzleEdge): BezierSegment[] {
  if (e.kind === "flat") return [line([0, 0], [1, 0])];
  const tab = tabProfile(e);
  // A socket is the tab's point reflection (u → 1 − u, v → −v, walked
  // backwards). The neighbour walks the shared side the other way and sees it
  // as exactly this tab, so tabs and sockets fit even when the profile leans
  // or waves.
  if (e.kind === "socket") return reversePath(tab.map((seg) => mapSegment(seg, ([u, v]) => [1 - u, -v])));
  return tab;
}

/** The narrowest neck of the profile, as a fraction of the neck-point spacing. */
export const NECK_WAIST = 0.78;

/**
 * The tab, as three cubic Béziers whose control points are closed-form in the
 * edge parameters. With c = center, n = neckWidth / 2, m = 0.3·n (flare),
 * d = 0.6·asymmetry (lean), w = wave, k = 1.2 + 3·(curvature − 0.5) (inward
 * dip, 1.2–2.4), λ = 1.1 + 0.5·(width − 0.22) / 0.13 (head size, 1.1–1.6) and
 * t the tab scale:
 *
 *   P0 = (0, 0)           P1 = (0.2, −w)          P2 = (c + m + d, −k·t)
 *   P3 = (c − n, t)       P4 = P3 + λ·(P3 − P2)
 *   P6 = (c + n, t)       P5 = P6 + λ·(P6 − P7)   P7 = (c − m + d, −k·t)
 *   P8 = (0.8, w)         P9 = (1, 0)
 *
 *   curve = C(P0, P1, P2, P3) · C(P3, P4, P5, P6) · C(P6, P7, P8, P9)
 *
 * P4 and P5 continue the incoming tangents at the neck points P3 and P6, so the
 * outline is one continuous (G¹) line from corner to corner, like a die-cut
 * puzzle. The head's top, at the middle of the second curve, is
 * (¼ + ¾·(1 + λ·(1 + k)))·t, so t is chosen to put it exactly at `depth`. At
 * the default options this gives a head about 0.30 of the side wide, a neck
 * about 0.17 at its narrowest (NECK_WAIST × neckWidth) and a near-round head
 * (rise above its widest point ≈ 0.77 × its half-width): the proportions of a
 * classic die-cut knob. The side bows by about ±0.44·w near the corners, in an
 * S, and dips in by the pull of P2 before the neck.
 */
function tabProfile(e: PuzzleEdge): BezierSegment[] {
  const c = e.center;
  const n = e.neckWidth / 2;
  const m = 0.3 * n;
  const d = 0.6 * e.asymmetry;
  const w = e.wave;
  const k = 1.2 + 3 * (e.curvature - 0.5);
  const lam = 1.1 + (0.5 * (e.width - EDGE_LIMITS.width[0])) / (EDGE_LIMITS.width[1] - EDGE_LIMITS.width[0]);
  const t = e.depth / (0.25 + 0.75 * (1 + lam * (1 + k)));
  const P0: Vec2 = [0, 0];
  const P1: Vec2 = [0.2, -w];
  const P2: Vec2 = [c + m + d, -k * t];
  const P3: Vec2 = [c - n, t];
  const P6: Vec2 = [c + n, t];
  const P7: Vec2 = [c - m + d, -k * t];
  const P4: Vec2 = [P3[0] + lam * (P3[0] - P2[0]), P3[1] + lam * (P3[1] - P2[1])];
  const P5: Vec2 = [P6[0] + lam * (P6[0] - P7[0]), P6[1] + lam * (P6[1] - P7[1])];
  const P8: Vec2 = [0.8, w];
  const P9: Vec2 = [1, 0];
  return [cubic(P0, P1, P2, P3), cubic(P3, P4, P5, P6), cubic(P6, P7, P8, P9)];
}

/** Shorten the straight first/last segment of an edge by `r0` at its start
 * and `r1` at its end (used to round the piece corners). */
export function trimEdgeEnds(segs: BezierSegment[], r0: number, r1: number = r0): BezierSegment[] {
  if (r0 <= 0 && r1 <= 0) return segs;
  const out = segs.slice();
  const move = (from: Vec2, to: Vec2, r: number): Vec2 => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const l = Math.hypot(dx, dy) || 1;
    return [from[0] + (dx / l) * r, from[1] + (dy / l) * r];
  };
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (out.length === 1) {
    out[0] = line(move(first.p0, first.p3, r0), move(first.p3, first.p0, r1));
    return out;
  }
  // only rewrite an end that is trimmed, so a curved end segment stays curved
  if (r0 > 0) out[0] = line(move(first.p0, first.p3, r0), first.p3);
  if (r1 > 0) out[out.length - 1] = line(last.p0, move(last.p3, last.p0, r1));
  return out;
}

/** How a corner is rounded: `trim` is where the curve leaves each side (side
 * units), `handle` places the control points that fraction of the way to the
 * sharp corner. 0.5523 draws a circular arc; larger values ease the curvature
 * in from the sides like a squircle corner. */
export interface CornerShape {
  trim: number;
  handle: number;
}

/** Frame corners (both sides flat): continuous-curvature, close to an app-icon squircle corner. */
export const SOFT_CORNER: CornerShape = { trim: 0.15, handle: 0.72 };
/** Every other corner: square, so pieces that meet there close to a point with no hole. */
export const SQUARE_CORNER: CornerShape = { trim: 0, handle: 0.5523 };

/** Corner curve from `a` to `b` around the sharp corner `c`. */
export function cornerArc(a: Vec2, c: Vec2, b: Vec2, handle = 0.5523): BezierSegment {
  const k = handle;
  return cubic(a, [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k], [b[0] + (c[0] - b[0]) * k, b[1] + (c[1] - b[1]) * k], b);
}

/** Place an edge profile onto the segment a → b with outward normal `n`. */
export function placeEdge(e: PuzzleEdge, a: Vec2, b: Vec2, n: Vec2): BezierSegment[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const f = (p: Vec2): Vec2 => [a[0] + p[0] * dx + p[1] * n[0], a[1] + p[0] * dy + p[1] * n[1]];
  return edgeProfile(e).map((s) => mapSegment(s, f));
}
