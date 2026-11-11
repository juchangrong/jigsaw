/**
 * A mosaic: a tile cut into four interlocking pieces, each a tone of one
 * colour family, so the tile itself is the puzzle. Everything is a straight
 * line or a circular arc: a knob is a circle centred KNOB_OFFSET beyond its
 * seam, and a smaller arc of KNOB_FILLET eases it into the seam so the cut has
 * no cusp. The result is plain SVG path data.
 */
import { mixOklab } from "./color/oklch";
import { createRng, type Seed } from "./prng";

type Vec2 = [number, number];

/** radius of a knob, as a fraction of the tile */
const KNOB_RADIUS = 0.09;
/** how far a knob's centre sits beyond its seam */
const KNOB_OFFSET = 0.03;
/** radius of the arc that joins a knob to its seam */
const KNOB_FILLET = 0.045;

/** The tile's four edges: start corner, direction along the edge and outward normal. */
const FRAME: { a: Vec2; d: Vec2; n: Vec2 }[] = [
  { a: [0, 0], d: [1, 0], n: [0, -1] },
  { a: [1, 0], d: [0, 1], n: [1, 0] },
  { a: [1, 1], d: [-1, 0], n: [0, 1] },
  { a: [0, 1], d: [0, -1], n: [-1, 0] },
];

const f = (v: number) => v.toFixed(4);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Where a knob of radius R, centred `O` beyond its seam, meets the fillets of
 * radius F on either side, measured from the knob's axis along the seam and
 * from the seam toward the knob.
 */
function knobJoin(R: number, O: number, F: number) {
  // the fillet touches the seam and the knob: its centre is F above the seam and R + F from the knob's centre
  const reach = Math.sqrt((R + F) ** 2 - (F - O) ** 2);
  const k = R / (R + F);
  return { reach, tx: reach * k, ty: O + (F - O) * k };
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
  /** the four cuts between pieces as open paths, for drawing the seams as lines */
  seams: string[];
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
 */
export function mosaicOf(tones: Mosaic["tones"], knobs: readonly [boolean, boolean, boolean, boolean]): Mosaic {
  const key = `${tones.join("")}:${knobs.map((k) => (k ? 1 : 0)).join("")}`;
  const hit = mosaicCache.get(key);
  if (hit) return hit;
  const R = KNOB_RADIUS;
  const F = KNOB_FILLET;
  const { reach, tx, ty } = knobJoin(R, KNOB_OFFSET, F);
  // a knob is painted over its neighbour, and starts a little behind the seam so no hairline shows between it and its own cell
  const BACK = 0.01;
  const layers: Mosaic["layers"] = MOSAIC_CELLS.map(([x, y], cell) => ({ path: `M ${x} ${y} h 0.5 v 0.5 h -0.5 Z`, cell }));
  const seams: string[] = [];
  MOSAIC_SEAMS.forEach((seam, i) => {
    const s = knobs[i] ? 1 : -1;
    const at = (t: number, out: number) => `${f(seam.p[0] + seam.d[0] * t + seam.n[0] * out * s)} ${f(seam.p[1] + seam.d[1] * t + seam.n[1] * out * s)}`;
    // clockwise on screen when the knob lies to the right of the direction of travel
    const turn = (seam.d[0] * seam.n[1] - seam.d[1] * seam.n[0]) * s < 0 ? 1 : 0;
    const path =
      `M ${at(-reach, -BACK)} L ${at(-reach, 0)} A ${F} ${F} 0 0 ${1 - turn} ${at(-tx, ty)}` +
      ` A ${R} ${R} 0 0 ${turn} ${at(tx, ty)} A ${F} ${F} 0 0 ${1 - turn} ${at(reach, 0)} L ${at(reach, -BACK)} Z`;
    layers.push({ path, cell: seam.cells[knobs[i] ? 0 : 1] });
    seams.push(
      `M ${at(-0.25, 0)} L ${at(-reach, 0)} A ${F} ${F} 0 0 ${1 - turn} ${at(-tx, ty)}` +
        ` A ${R} ${R} 0 0 ${turn} ${at(tx, ty)} A ${F} ${F} 0 0 ${1 - turn} ${at(reach, 0)} L ${at(0.25, 0)}`,
    );
  });
  const out: Mosaic = { tones, layers, seams, viewBox: "0 0 1 1", key };
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

export type MosaicShape = "squircle" | "round";

/** width of the cuts between a mosaic's pieces, as a fraction of the tile */
export const MOSAIC_GAP = 0.022;
/** radius that rounds the pieces' corners where cuts cross or reach the tile's edge */
export const MOSAIC_CORNER = 0.03;
const MOSAIC_EDGE = "rgba(20,20,40,0.14)";

/**
 * The tile's outline as path data in the unit tile.
 * - `squircle`: a superellipse of exponent 4 (one cubic per quadrant, within
 *   0.5% of the true curve), whose curvature changes smoothly, without the
 *   kink where a rounded rectangle's straight side meets its corner arc.
 * - `round`: a rectangle with corners of `radius`.
 */
export function mosaicOutline(shape: MosaicShape = "squircle", radius = 0.25): string {
  if (shape === "round") {
    const r = Math.min(Math.max(radius, 0), 0.5);
    return `M ${f(r)} 0 H ${f(1 - r)} A ${r} ${r} 0 0 1 1 ${f(r)} V ${f(1 - r)} A ${r} ${r} 0 0 1 ${f(1 - r)} 1 H ${f(r)} A ${r} ${r} 0 0 1 0 ${f(1 - r)} V ${f(r)} A ${r} ${r} 0 0 1 ${f(r)} 0 Z`;
  }
  const a = f(0.5 + 0.5 * 0.918);
  const b = f(0.5 - 0.5 * 0.918);
  return `M 1 0.5 C 1 ${a} ${a} 1 0.5 1 C ${b} 1 0 ${a} 0 0.5 C 0 ${b} ${b} 0 0.5 0 C ${a} 0 1 ${b} 1 0.5 Z`;
}

/**
 * Shapes to cut away with the seams so the pieces' corners are round: a
 * four-pointed opening where the cuts cross, and a notch where each cut
 * reaches the tile's edge.
 */
function mosaicCorners(gap: number, r: number): string {
  const h = gap / 2;
  const o = h + r;
  const lo = f(0.5 - h);
  const hi = f(0.5 + h);
  const near = f(0.5 - o);
  const far = f(0.5 + o);
  const arc = `A ${r} ${r} 0 0 0`;
  let d = `M ${lo} ${near} L ${hi} ${near} ${arc} ${far} ${lo} L ${far} ${hi} ${arc} ${hi} ${far} L ${lo} ${far} ${arc} ${near} ${hi} L ${near} ${lo} ${arc} ${lo} ${near} Z`;
  // each edge's midpoint, the direction along it and the direction into the tile; the notch starts just outside
  for (const g of FRAME) {
    const at = (t: number, m: number) => `${f(g.a[0] + g.d[0] * (0.5 + t) - g.n[0] * m)} ${f(g.a[1] + g.d[1] * (0.5 + t) - g.n[1] * m)}`;
    d += ` M ${at(-o, -0.01)} L ${at(o, -0.01)} L ${at(o, 0)} ${arc} ${at(h, r)} L ${at(-h, r)} ${arc} ${at(-o, 0)} Z`;
  }
  return d;
}

export interface MosaicStyle {
  variant?: MosaicVariant;
  /** the tile's outline (default squircle) */
  shape?: MosaicShape;
  /** corner radius of a `round` tile, as a fraction of its side (default 0.25) */
  radius?: number;
  /** width of the cuts between pieces, as a fraction of the tile; 0 joins them (default MOSAIC_GAP) */
  gap?: number;
  /** a hairline around the pieces, so light ones hold on a light page (default true) */
  edge?: boolean;
}

/** Everything needed to draw a mosaic: clip to `outline`, cut `seams` and `corners` away, paint `ground` and the layers. */
export interface MosaicDrawing {
  outline: string;
  /** the fill of each cell */
  fills: string[];
  /** a mid tone to paint first, so antialiasing between two fills never shows the page */
  ground: string;
  /** width to stroke the seams with when cutting them away; 0 for no cuts */
  gap: number;
  /** filled shapes cut away with the seams to round the pieces' corners; empty without cuts */
  corners: string;
  /** colour of a line along `outline` (half of it is clipped away), or null */
  edge: string | null;
  /** width of that line */
  edgeWidth: number;
}

export function mosaicDrawing(mosaic: Mosaic, colors: readonly string[], o: MosaicStyle = {}): MosaicDrawing {
  const fills = mosaicFills(mosaic, colors, o.variant);
  const gap = Math.max(0, o.gap ?? MOSAIC_GAP);
  return {
    outline: mosaicOutline(o.shape, o.radius),
    fills,
    ground: mixOklab(fills),
    gap,
    corners: gap > 0 ? mosaicCorners(gap, MOSAIC_CORNER) : "",
    edge: o.edge === false ? null : MOSAIC_EDGE,
    edgeWidth: 0.03,
  };
}

export interface MosaicSvgOptions extends MosaicStyle {
  /** rendered width and height in px (default 24) */
  size?: number;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/** A standalone SVG document for a mosaic in a family's shades. The cuts are transparent, so it sits on any background. */
export function mosaicSvg(mosaic: Mosaic, colors: readonly string[], o: MosaicSvgOptions = {}): string {
  const size = o.size ?? 24;
  const d = mosaicDrawing(mosaic, colors, o);
  const a11y = o.title ? `role="img" aria-label="${esc(o.title)}"` : `aria-hidden="true"`;
  const id = `mosaic-${mosaic.key.replace(":", "-")}`;
  const cuts = d.gap
    ? `<mask id="${id}-cuts"><rect width="1" height="1" fill="#fff"/>` +
      mosaic.seams.map((s) => `<path d="${s}" fill="none" stroke="#000" stroke-width="${d.gap}"/>`).join("") +
      `<path d="${d.corners}" fill="#000"/></mask>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${mosaic.viewBox}" ${a11y}>` +
    `<clipPath id="${id}"><path d="${d.outline}"/></clipPath>` +
    cuts +
    `<g clip-path="url(#${id})"><g${d.gap ? ` mask="url(#${id}-cuts)"` : ""}>` +
    `<rect width="1" height="1" fill="${d.ground}"/>` +
    mosaic.layers.map((l) => `<path d="${l.path}" fill="${esc(d.fills[l.cell]!)}"/>`).join("") +
    (d.edge ? `<path d="${d.outline}" fill="none" stroke="${d.edge}" stroke-width="${d.edgeWidth}"/>` : "") +
    `</g></g></svg>`
  );
}
