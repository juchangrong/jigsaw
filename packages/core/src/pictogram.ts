/**
 * Vector forms of a piece, for places where a rendered icon is too heavy or
 * too literal: lists, menus, favicons.
 *
 * - A pictogram is the piece reduced to a sign, in the modernist manner of
 *   grid-built signage. Everything is a straight line or a circular arc on one
 *   grid, and every arc has the same radius: the corners of a unit square, and
 *   knobs and notches that are the same circle centred PICTOGRAM_KNOB_OFFSET
 *   outside or inside the side.
 * - An outline is the realistic piece's own Bézier path.
 *
 * Both are plain SVG path data and need no renderer.
 */
import { generatePuzzleIcon } from "./generate";
import { applyTransform, singlePieceKinds } from "./geometry/layout";
import { resolveOptions } from "./options";
import { hashString, type Seed } from "./prng";
import type { EdgeKind, PuzzleIconOptions, Vec2 } from "./types";

export const PICTOGRAM_RADIUS = 0.18;
export const PICTOGRAM_KNOB_OFFSET = 0.06;
/** side length of a pictogram's view box, in cell units: room for a knob on both sides around any centroid */
export const PICTOGRAM_VIEW = 1.68;

/** Side kinds in the order top, right, bottom, left. */
export type Arrangement = [EdgeKind, EdgeKind, EdgeKind, EdgeKind];

const FRAME: { a: Vec2; d: Vec2; n: Vec2 }[] = [
  { a: [0, 0], d: [1, 0], n: [0, -1] },
  { a: [1, 0], d: [0, 1], n: [1, 0] },
  { a: [1, 1], d: [-1, 0], n: [0, 1] },
  { a: [0, 1], d: [0, -1], n: [-1, 0] },
];

/**
 * Whether an arrangement still reads as a puzzle piece at about 24 px: one or
 * two knobs, one or two notches, at most one flat side. Three knobs read as a
 * cross, three notches as an X, and two flat sides as a blob.
 */
export function isIconicArrangement(kinds: readonly EdgeKind[]): boolean {
  const count = (k: EdgeKind) => kinds.filter((x) => x === k).length;
  return kinds.length === 4 && count("tab") >= 1 && count("tab") <= 2 && count("socket") >= 1 && count("socket") <= 2 && count("flat") <= 1;
}

/** Every iconic arrangement (30 of the 81 possible). */
export const PICTOGRAM_ARRANGEMENTS: readonly Arrangement[] = (() => {
  const all: Arrangement[] = [];
  const kinds: EdgeKind[] = ["tab", "socket", "flat"];
  for (const a of kinds) for (const b of kinds) for (const c of kinds) for (const d of kinds) if (isIconicArrangement([a, b, c, d])) all.push([a, b, c, d]);
  return all;
})();

const arrangementCache = new Map<string, Arrangement>();
/** The side kinds of a seed's realistic single piece. */
export function pieceArrangement(seed: Seed): Arrangement {
  const key = String(seed);
  let k = arrangementCache.get(key);
  if (!k) {
    const sides = singlePieceKinds(resolveOptions({ seed, layout: "single" }));
    k = [sides.top, sides.right, sides.bottom, sides.left];
    arrangementCache.set(key, k);
    if (arrangementCache.size > 4096) arrangementCache.delete(arrangementCache.keys().next().value!);
  }
  return k;
}

export interface VectorShape {
  /** SVG path data */
  path: string;
  /** SVG viewBox the path is drawn in */
  viewBox: string;
}

export interface Pictogram extends VectorShape {
  kinds: Arrangement;
  /** identifies the shape: equal keys draw the same pictogram */
  key: string;
}

const pictogramCache = new Map<string, Pictogram>();
const f = (v: number) => v.toFixed(4);

/** The pictogram of an arrangement: one clockwise path, centred on its area centroid. */
export function pictogramOf(kinds: Arrangement): Pictogram {
  const key = kinds.join();
  const hit = pictogramCache.get(key);
  if (hit) return hit;
  const R = PICTOGRAM_RADIUS;
  const O = PICTOGRAM_KNOB_OFFSET;

  // along each side, around its knob or notch, then round the corner
  const half = Math.sqrt(R * R - O * O);
  const at = (g: (typeof FRAME)[number], t: number) => `${f(g.a[0] + g.d[0] * t)} ${f(g.a[1] + g.d[1] * t)}`;
  let path = `M ${at(FRAME[0]!, R)}`;
  FRAME.forEach((g, i) => {
    if (kinds[i] !== "flat") {
      // the arc on the far side of the chord is the larger one; a knob turns clockwise, a notch the other way
      path += ` L ${at(g, 0.5 - half)} A ${R} ${R} 0 1 ${kinds[i] === "tab" ? 1 : 0} ${at(g, 0.5 + half)}`;
    }
    path += ` L ${at(g, 1 - R)} A ${R} ${R} 0 0 1 ${at(FRAME[(i + 1) % 4]!, R)}`;
  });
  path += " Z";

  // The view is centred on the area centroid, so knobs do not push the body
  // off-centre. The centroid is found by sampling the shape's own definition.
  const [cx, cy] = pictogramCentroid(kinds);
  const out: Pictogram = { kinds, key, path, viewBox: `${f(cx - PICTOGRAM_VIEW / 2)} ${f(cy - PICTOGRAM_VIEW / 2)} ${PICTOGRAM_VIEW} ${PICTOGRAM_VIEW}` };
  pictogramCache.set(key, out);
  return out;
}

/** Whether a point (cell units) is inside the pictogram of an arrangement. */
export function pictogramContains(kinds: Arrangement, x: number, y: number): boolean {
  const R = PICTOGRAM_RADIUS;
  let inKnob = false;
  for (let i = 0; i < 4; i++) {
    if (kinds[i] === "flat") continue;
    const g = FRAME[i]!;
    const o = kinds[i] === "tab" ? PICTOGRAM_KNOB_OFFSET : -PICTOGRAM_KNOB_OFFSET;
    const dx = x - (g.a[0] + g.d[0] * 0.5 + g.n[0] * o);
    const dy = y - (g.a[1] + g.d[1] * 0.5 + g.n[1] * o);
    if (dx * dx + dy * dy <= R * R) {
      if (kinds[i] === "socket") return false;
      inKnob = true;
    }
  }
  if (inKnob) return true;
  if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  const qx = Math.min(Math.max(x, R), 1 - R);
  const qy = Math.min(Math.max(y, R), 1 - R);
  return (x - qx) ** 2 + (y - qy) ** 2 <= R * R;
}

function pictogramCentroid(kinds: Arrangement): Vec2 {
  const N = 160;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = -0.3 + (1.6 * (i + 0.5)) / N;
      const y = -0.3 + (1.6 * (j + 0.5)) / N;
      if (pictogramContains(kinds, x, y)) {
        n++;
        sx += x;
        sy += y;
      }
    }
  return [sx / n, sy / n];
}

/**
 * The pictogram for a seed. The seed keeps its own piece's arrangement when
 * that is iconic, and otherwise takes one from PICTOGRAM_ARRANGEMENTS by hash.
 */
export function generatePictogram(seed: Seed): Pictogram {
  const own = pieceArrangement(seed);
  return pictogramOf(isIconicArrangement(own) ? own : PICTOGRAM_ARRANGEMENTS[hashString(`glyph:${String(seed)}`) % PICTOGRAM_ARRANGEMENTS.length]!);
}

/** The realistic single piece's outline as SVG path data, in icon units (the [0,1]² canvas). */
export function pieceOutline(options: PuzzleIconOptions): VectorShape {
  const p = generatePuzzleIcon({ ...options, layout: "single" }).pieces[0]!;
  const pt = (q: Vec2) => {
    const [x, y] = applyTransform(p.transform, q);
    return `${f(x)} ${f(y)}`;
  };
  return { path: `M ${pt(p.path[0]!.p0)} ` + p.path.map((s) => `C ${pt(s.p1)} ${pt(s.p2)} ${pt(s.p3)}`).join(" ") + " Z", viewBox: "0 0 1 1" };
}

export interface VectorSvgOptions {
  /** rendered width and height in px (default 24) */
  size?: number;
  /** fill of a pictogram, or line colour of an outline (default currentColor) */
  color?: string;
  /** draw the shape as a line instead of a fill */
  outline?: boolean;
  /** line width in px for `outline` (default 1.1) */
  strokeWidth?: number;
  /** fills a rounded tile behind the shape */
  background?: string;
  /** tile corner radius as a fraction of its side (default 0.25) */
  radius?: number;
  /** shape size relative to the tile (default 0.8 with a background, else 1) */
  scale?: number;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/** Where the shape sits inside the unit tile. */
export function vectorPlacement(o: VectorSvgOptions): { offset: number; scale: number; radius: number } {
  const scale = o.scale ?? (o.background ? 0.8 : 1);
  return { offset: (1 - scale) / 2, scale, radius: o.radius ?? 0.25 };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A standalone SVG document for a pictogram or an outline. */
export function vectorSvg(shape: VectorShape, o: VectorSvgOptions = {}): string {
  const size = o.size ?? 24;
  const color = o.color ?? "currentColor";
  const { offset, scale, radius } = vectorPlacement(o);
  const a11y = o.title ? `role="img" aria-label="${esc(o.title)}"` : `aria-hidden="true"`;
  const mark = o.outline
    ? `<path d="${shape.path}" fill="none" stroke="${esc(color)}" stroke-width="${o.strokeWidth ?? 1.1}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
    : `<path d="${shape.path}" fill="${esc(color)}"/>`;
  const tile = o.background ? `<rect width="1" height="1" rx="${radius}" fill="${esc(o.background)}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1 1" ${a11y}>` +
    tile +
    `<svg x="${f(offset)}" y="${f(offset)}" width="${f(scale)}" height="${f(scale)}" viewBox="${shape.viewBox}">${mark}</svg>` +
    `</svg>`
  );
}
