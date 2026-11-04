import type { Rng } from "../prng";
import type { BezierSegment, EdgeKind, PuzzleEdge, Vec2 } from "../types";
import { cubic, line, mapSegment } from "./bezier";

export const EDGE_LIMITS = {
  center: [0.42, 0.58],
  width: [0.22, 0.35],
  depth: [0.12, 0.22],
  neckWidth: [0.12, 0.2],
  asymmetry: 0.08,
  curvature: [0.5, 0.9],
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
  };
  return sanitizeEdge(e);
}

/** Clamp all parameters into range and enforce head ≥ neck + margin so the
 * outline can never pinch or self-intersect. `minNeck` (side units) is raised
 * for small output sizes so the connection stays several pixels wide. */
export function sanitizeEdge(e: PuzzleEdge, minNeck: number = EDGE_LIMITS.neckWidth[0]): PuzzleEdge {
  const L = EDGE_LIMITS;
  const neckWidth = clamp(Math.max(e.neckWidth, minNeck), L.neckWidth[0], L.neckWidth[1]);
  const width = clamp(Math.max(e.width, neckWidth + L.headOverNeck), L.width[0], L.width[1]);
  return {
    ...e,
    center: clamp(e.center, L.center[0], L.center[1]),
    width,
    depth: clamp(e.depth, L.depth[0], L.depth[1]),
    neckWidth,
    asymmetry: clamp(e.asymmetry, -L.asymmetry, L.asymmetry),
    curvature: clamp(e.curvature, L.curvature[0], L.curvature[1]),
  };
}

/**
 * Edge profile in the edge frame: u runs 0 → 1 along the side, v points
 * outward from the piece. A tab bulges to +v, a socket to −v.
 */
export function edgeProfile(e: PuzzleEdge): BezierSegment[] {
  if (e.kind === "flat") return [line([0, 0], [1, 0])];
  const s = e.kind === "tab" ? 1 : -1;
  const D = e.depth * s;
  const hw = e.width / 2;
  const nh = e.neckWidth / 2;
  const a = e.asymmetry;
  const hc = e.center + a * 0.4; // head centre leans with asymmetry
  const hwL = hw * (1 - a);
  const hwR = hw * (1 + a);
  const nL = e.center - nh;
  const nR = e.center + nh;
  const shoulder = 0.06;
  const K = 0.4 + 0.35 * e.curvature; // ellipse handle factor (0.55 ≈ circle)

  const sL: Vec2 = [nL - shoulder, 0];
  const sR: Vec2 = [nR + shoulder, 0];
  const neckV = 0.28 * D;
  const neckL: Vec2 = [nL, neckV];
  const neckR: Vec2 = [nR, neckV];
  const headV = 0.58 * D;
  const headL: Vec2 = [hc - hwL, headV];
  const headR: Vec2 = [hc + hwR, headV];
  const top: Vec2 = [hc, D];
  const ry = D - headV;
  const pinch = 0.015;

  return [
    line([0, 0], sL),
    cubic(sL, [sL[0] + shoulder * 0.7, 0], [nL + pinch, 0.14 * D], neckL),
    cubic(neckL, [nL - pinch, 0.42 * D], [headL[0], headV - 0.16 * D], headL),
    cubic(headL, [headL[0], headV + ry * K], [hc - hwL * K, D], top),
    cubic(top, [hc + hwR * K, D], [headR[0], headV + ry * K], headR),
    cubic(headR, [headR[0], headV - 0.16 * D], [nR + pinch, 0.42 * D], neckR),
    cubic(neckR, [nR - pinch, 0.14 * D], [sR[0] - shoulder * 0.7, 0], sR),
    line(sR, [1, 0]),
  ];
}

/** Shorten the straight first/last segment of an edge by `r` at both ends
 * (used to round the piece corners). */
export function trimEdgeEnds(segs: BezierSegment[], r: number): BezierSegment[] {
  if (r <= 0) return segs;
  const out = segs.slice();
  const move = (from: Vec2, to: Vec2): Vec2 => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const l = Math.hypot(dx, dy) || 1;
    return [from[0] + (dx / l) * r, from[1] + (dy / l) * r];
  };
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (out.length === 1) {
    out[0] = line(move(first.p0, first.p3), move(first.p3, first.p0));
    return out;
  }
  out[0] = line(move(first.p0, first.p3), first.p3);
  out[out.length - 1] = line(last.p0, move(last.p3, last.p0));
  return out;
}

/** Quarter-ish arc from `a` to `b` around the sharp corner `c`. */
export function cornerArc(a: Vec2, c: Vec2, b: Vec2): BezierSegment {
  const k = 0.5523;
  return cubic(a, [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k], [b[0] + (c[0] - b[0]) * k, b[1] + (c[1] - b[1]) * k], b);
}

/** Place an edge profile onto the segment a → b with outward normal `n`. */
export function placeEdge(e: PuzzleEdge, a: Vec2, b: Vec2, n: Vec2): BezierSegment[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const f = (p: Vec2): Vec2 => [a[0] + p[0] * dx + p[1] * n[0], a[1] + p[0] * dy + p[1] * n[1]];
  return edgeProfile(e).map((s) => mapSegment(s, f));
}
