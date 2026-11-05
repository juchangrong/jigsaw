import type { Rng } from "../prng";
import type { BezierSegment, EdgeKind, PuzzleEdge, Vec2 } from "../types";
import { cubic, line, mapSegment, reversePath } from "./bezier";

export const EDGE_LIMITS = {
  center: [0.42, 0.58],
  width: [0.22, 0.35],
  depth: [0.2, 0.26],
  neckWidth: [0.12, 0.2],
  asymmetry: 0.08,
  curvature: [0.5, 0.9],
  wave: [0.025, 0.045],
  /** head must be at least this much wider than the neck */
  headOverNeck: 0.07,
  /** head width ≤ this × depth, so the head stays round instead of a flat cap */
  headAspect: 1.1,
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
  const neckWidth = clamp(Math.max(e.neckWidth, minNeck), L.neckWidth[0], L.neckWidth[1]);
  let width = clamp(Math.max(e.width, neckWidth + L.headOverNeck), L.width[0], L.width[1]);
  const depth = clamp(Math.max(e.depth, width / L.headAspect), L.depth[0], L.depth[1]);
  // a deep-enough tab is not always possible; then narrow the head instead
  width = Math.max(neckWidth + L.headOverNeck, Math.min(width, depth * L.headAspect));
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

function tabProfile(e: PuzzleEdge): BezierSegment[] {
  const D = e.depth;
  const hw = e.width / 2;
  const nh = e.neckWidth / 2;
  const a = e.asymmetry;
  const hc = e.center + a * 0.4; // head centre leans with asymmetry
  const hwL = hw * (1 - a);
  const hwR = hw * (1 + a);
  const nL = e.center - nh;
  const nR = e.center + nh;
  // Every turn gets room: a wide fillet where the neck leaves the side (the
  // socket's lips), a tall S-curve from neck to head, and a near-circular
  // head. Tangents are horizontal at the side and vertical at the neck and the
  // head's widest point, so the outline has no kinks.
  const shoulder = 0.09;
  const K = 0.5 + 0.2 * e.curvature; // head handle factor (0.55 ≈ circle)

  const sL: Vec2 = [nL - shoulder, 0];
  const sR: Vec2 = [nR + shoulder, 0];
  const neckV = 0.33 * D;
  const neckL: Vec2 = [nL, neckV];
  const neckR: Vec2 = [nR, neckV];
  const headV = 0.58 * D;
  const headL: Vec2 = [hc - hwL, headV];
  const headR: Vec2 = [hc + hwR, headV];
  const top: Vec2 = [hc, D];
  const ry = D - headV;
  const span = headV - neckV;

  // The side runs bow in a gentle S, dipping in before the connector and out
  // after it. Each run is two curves that are level at the corner, at the
  // middle and at the fillet, so corners stay square and the bend sits mid-run.
  const w = e.wave;
  const mL = sL[0] / 2;
  const mR = (1 + sR[0]) / 2;
  return [
    cubic([0, 0], [mL * 0.5, 0], [mL * 0.5, -w], [mL, -w]),
    cubic([mL, -w], [mL * 1.5, -w], [mL * 1.5, 0], sL),
    cubic(sL, [sL[0] + shoulder * 0.6, 0], [nL, neckV * 0.4], neckL),
    cubic(neckL, [nL, neckV + span * 0.5], [headL[0], headV - span * 0.5], headL),
    cubic(headL, [headL[0], headV + ry * K], [hc - hwL * K, D], top),
    cubic(top, [hc + hwR * K, D], [headR[0], headV + ry * K], headR),
    cubic(headR, [headR[0], headV - span * 0.5], [nR, neckV + span * 0.5], neckR),
    cubic(neckR, [nR, neckV * 0.4], [sR[0] - shoulder * 0.6, 0], sR),
    cubic(sR, [sR[0] + (mR - sR[0]) * 0.5, 0], [sR[0] + (mR - sR[0]) * 0.5, w], [mR, w]),
    cubic([mR, w], [mR + (1 - mR) * 0.5, w], [mR + (1 - mR) * 0.5, 0], [1, 0]),
  ];
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
