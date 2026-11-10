/**
 * Vector forms of a piece, for places where a rendered icon is too heavy or
 * too literal: lists, menus, favicons.
 *
 * - A pictogram is the piece reduced to a sign, in the modernist manner of
 *   grid-built signage. Everything is a straight line or a circular arc on one
 *   grid. The corners of a unit square, the knobs and the notches share one
 *   radius; a knob or notch is that circle centred PICTOGRAM_KNOB_OFFSET
 *   outside or inside the side, and a smaller arc of PICTOGRAM_FILLET eases it
 *   into the side so the silhouette has no cusp.
 * - A mosaic is a tile cut into four such pieces, one tone each.
 * - An outline is the realistic piece's own Bézier path.
 *
 * Both are plain SVG path data and need no renderer.
 */
import { generatePuzzleIcon } from "./generate";
import { applyTransform, singlePieceKinds } from "./geometry/layout";
import { resolveOptions } from "./options";
import { mixOklab } from "./color/oklch";
import { createRng, hashString, type Seed } from "./prng";
import type { EdgeKind, PuzzleIconOptions, Vec2 } from "./types";

export const PICTOGRAM_RADIUS = 0.18;
export const PICTOGRAM_KNOB_OFFSET = 0.06;
/** radius of the arc that joins a knob or notch to its side */
export const PICTOGRAM_FILLET = 0.09;
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

/**
 * Where a knob of radius R, centred `O` beyond its side, meets the fillets of
 * radius F on either side, measured from the knob's axis along the side and
 * from the side toward the knob.
 */
function knobJoin(R: number, O: number, F: number) {
  // the fillet touches the side and the knob: its centre is F above the side and R + F from the knob's centre
  const reach = Math.sqrt((R + F) ** 2 - (F - O) ** 2);
  const k = R / (R + F);
  return { reach, tx: reach * k, ty: O + (F - O) * k };
}
const JOIN = knobJoin(PICTOGRAM_RADIUS, PICTOGRAM_KNOB_OFFSET, PICTOGRAM_FILLET);

/** The pictogram of an arrangement: one clockwise path, centred on its area centroid. */
export function pictogramOf(kinds: Arrangement): Pictogram {
  const key = kinds.join();
  const hit = pictogramCache.get(key);
  if (hit) return hit;
  const R = PICTOGRAM_RADIUS;
  const O = PICTOGRAM_KNOB_OFFSET;

  const F = PICTOGRAM_FILLET;
  const { reach, tx, ty } = JOIN;

  // along each side, around its knob or notch, then round the corner
  const at = (g: (typeof FRAME)[number], t: number, out = 0) => `${f(g.a[0] + g.d[0] * t + g.n[0] * out)} ${f(g.a[1] + g.d[1] * t + g.n[1] * out)}`;
  let path = `M ${at(FRAME[0]!, R)}`;
  FRAME.forEach((g, i) => {
    if (kinds[i] !== "flat") {
      // a knob turns clockwise like the outline and its fillets the other way; a notch is the mirror image
      const knob = kinds[i] === "tab" ? 1 : 0;
      const out = knob ? ty : -ty;
      path += ` L ${at(g, 0.5 - reach)} A ${F} ${F} 0 0 ${1 - knob} ${at(g, 0.5 - tx, out)}`;
      path += ` A ${R} ${R} 0 ${ty < O ? 1 : 0} ${knob} ${at(g, 0.5 + tx, out)}`;
      path += ` A ${F} ${F} 0 0 ${1 - knob} ${at(g, 0.5 + reach)}`;
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
  const F = PICTOGRAM_FILLET;
  const { reach, ty } = JOIN;
  let inKnob = false;
  for (let i = 0; i < 4; i++) {
    if (kinds[i] === "flat") continue;
    const g = FRAME[i]!;
    // u: distance from the knob's axis along the side; m: distance from the side toward the knob (inward for a notch)
    const u = Math.abs((x - g.a[0]) * g.d[0] + (y - g.a[1]) * g.d[1] - 0.5);
    const m = ((x - g.a[0]) * g.n[0] + (y - g.a[1]) * g.n[1]) * (kinds[i] === "tab" ? 1 : -1);
    const inCircle = u * u + (m - PICTOGRAM_KNOB_OFFSET) ** 2 <= R * R;
    // the fillet fills the wedge between the side, the circle and the fillet's own circle
    const inWedge = m >= 0 && m <= ty && u <= reach && (u - reach) ** 2 + (m - F) ** 2 >= F * F;
    if (inCircle || inWedge) {
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

/**
 * A tile cut into four pieces, each a tone of one colour family: the tile
 * itself is the puzzle. Paint `layers` in order inside a tile clipped to its
 * corner radius.
 */
export interface Mosaic {
  /** shade (0 deep to 3 light) of each cell, in the order top-left, top-right, bottom-left, bottom-right */
  tones: [number, number, number, number];
  /** closed paths in paint order, in a unit tile; `cell` is the cell whose colour fills the path */
  layers: { path: string; cell: number }[];
  viewBox: string;
  /** identifies the design: equal keys draw the same mosaic */
  key: string;
}

/** The two deep tones sit on one diagonal and the two light ones on the other, so every seam has contrast. */
const MOSAIC_TONES: readonly Mosaic["tones"][] = [
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
];
/** The four half-seams: midpoint, direction, and the cells on its negative and positive side. */
const MOSAIC_SEAMS: { p: Vec2; d: Vec2; n: Vec2; cells: [number, number] }[] = [
  { p: [0.5, 0.25], d: [0, 1], n: [1, 0], cells: [0, 1] },
  { p: [0.5, 0.75], d: [0, 1], n: [1, 0], cells: [2, 3] },
  { p: [0.25, 0.5], d: [1, 0], n: [0, 1], cells: [0, 2] },
  { p: [0.75, 0.5], d: [1, 0], n: [0, 1], cells: [1, 3] },
];
const MOSAIC_CELLS: Vec2[] = [
  [0, 0],
  [0.5, 0],
  [0, 0.5],
  [0.5, 0.5],
];
const mosaicCache = new Map<string, Mosaic>();

/**
 * The mosaic with the given tones and knob directions. `knobs[i]` is true when
 * the knob on half-seam i (upper, lower, left, right) points right or down.
 * The knobs are the pictogram's, at half scale.
 */
export function mosaicOf(tones: Mosaic["tones"], knobs: readonly [boolean, boolean, boolean, boolean]): Mosaic {
  const key = `${tones.join("")}:${knobs.map((k) => (k ? 1 : 0)).join("")}`;
  const hit = mosaicCache.get(key);
  if (hit) return hit;
  const R = PICTOGRAM_RADIUS / 2;
  const F = PICTOGRAM_FILLET / 2;
  const { reach, tx, ty } = knobJoin(R, PICTOGRAM_KNOB_OFFSET / 2, F);
  // a knob is painted over its neighbour, and starts a little behind the seam so no hairline shows between it and its own cell
  const BACK = 0.01;
  const layers: Mosaic["layers"] = MOSAIC_CELLS.map(([x, y], cell) => ({ path: `M ${x} ${y} h 0.5 v 0.5 h -0.5 Z`, cell }));
  MOSAIC_SEAMS.forEach((seam, i) => {
    const s = knobs[i] ? 1 : -1;
    const at = (t: number, out: number) => `${f(seam.p[0] + seam.d[0] * t + seam.n[0] * out * s)} ${f(seam.p[1] + seam.d[1] * t + seam.n[1] * out * s)}`;
    // clockwise on screen when the knob lies to the right of the direction of travel
    const turn = (seam.d[0] * seam.n[1] - seam.d[1] * seam.n[0]) * s < 0 ? 1 : 0;
    const path =
      `M ${at(-reach, -BACK)} L ${at(-reach, 0)} A ${F} ${F} 0 0 ${1 - turn} ${at(-tx, ty)}` +
      ` A ${R} ${R} 0 0 ${turn} ${at(tx, ty)} A ${F} ${F} 0 0 ${1 - turn} ${at(reach, 0)} L ${at(reach, -BACK)} Z`;
    layers.push({ path, cell: seam.cells[knobs[i] ? 0 : 1] });
  });
  const out: Mosaic = { tones, layers, viewBox: "0 0 1 1", key };
  mosaicCache.set(key, out);
  return out;
}

/** The mosaic for a seed: one of eight tone layouts and sixteen knob layouts. */
export function generateMosaic(seed: Seed): Mosaic {
  const rng = createRng(seed, "mosaic");
  const tones = MOSAIC_TONES[rng.int(0, MOSAIC_TONES.length - 1)]!;
  return mosaicOf(tones, [rng.bool(), rng.bool(), rng.bool(), rng.bool()]);
}

export type MosaicVariant = "tonal" | "accent";

/**
 * The fill of each cell from a family's shades (deep to light).
 * - `tonal`: each cell takes its own shade.
 * - `accent`: the deepest cell keeps its shade and the rest stay light, so one piece stands out.
 */
export function mosaicFills(mosaic: Mosaic, colors: readonly string[], variant: MosaicVariant = "tonal"): string[] {
  const shade = (i: number) => colors[Math.min(i, colors.length - 1)] ?? "#808080";
  if (variant === "tonal") return mosaic.tones.map(shade);
  const soft = mixOklab([shade(3), shade(2)]);
  // tone 1 sits diagonal to the accent and is the lightest; the two cells touching the accent are a step darker
  return mosaic.tones.map((t) => (t === 0 ? shade(0) : t === 1 ? shade(3) : soft));
}

export interface MosaicSvgOptions {
  /** rendered width and height in px (default 24) */
  size?: number;
  variant?: MosaicVariant;
  /** tile corner radius as a fraction of its side (default 0.25) */
  radius?: number;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/** A standalone SVG document for a mosaic in a family's shades. */
export function mosaicSvg(mosaic: Mosaic, colors: readonly string[], o: MosaicSvgOptions = {}): string {
  const size = o.size ?? 24;
  const fills = mosaicFills(mosaic, colors, o.variant);
  const a11y = o.title ? `role="img" aria-label="${esc(o.title)}"` : `aria-hidden="true"`;
  const id = `mosaic-${mosaic.key.replace(":", "-")}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${mosaic.viewBox}" ${a11y}>` +
    `<clipPath id="${id}"><rect width="1" height="1" rx="${o.radius ?? 0.25}"/></clipPath>` +
    `<g clip-path="url(#${id})">` +
    // a mid tone underneath, so antialiasing along the seams never shows the page through
    `<rect width="1" height="1" fill="${mixOklab(fills)}"/>` +
    mosaic.layers.map((l) => `<path d="${l.path}" fill="${esc(fills[l.cell]!)}"/>`).join("") +
    `</g></svg>`
  );
}
