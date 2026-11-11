import { useId, type SVGProps } from "react";

/** Four shades of one colour, deep to light. */
export type MosaicShades = readonly [string, string, string, string];

export const MOSAIC_PALETTES = {
  blue: ["#1373C9", "#4496F4", "#8BBBFC", "#CBE0FE"],
  coral: ["#D84352", "#F8696D", "#FBA29E", "#FDD2CE"],
  orange: ["#E3770E", "#F89638", "#FEBB7B", "#FDDFBE"],
  green: ["#4A952A", "#65B557", "#8AD387", "#B9EEBB"],
  purple: ["#7A5AD0", "#9B7CEF", "#BDA4FE", "#DCCFFD"],
  pink: ["#CE428E", "#EF67A8", "#FE9AC2", "#FDD0DE"],
  yellow: ["#E3A419", "#F0BE2D", "#F6D95E", "#F9F2A4"],
  teal: ["#118379", "#10AAA1", "#66CCC6", "#ABEDEA"],
  sky: ["#318DCE", "#5EABED", "#98C9FB", "#D4E7FD"],
  caramel: ["#915018", "#B77843", "#D8A275", "#F5D0AF"],
  gray: ["#8F9397", "#AEB1B6", "#CED1D5", "#F0F2F5"],
} as const satisfies Record<string, MosaicShades>;

export type MosaicPaletteName = keyof typeof MOSAIC_PALETTES;

/** The palettes a seed chooses from when none is given. Edit this list to change the mix of colours in a list. */
export const DEFAULT_MOSAIC_PALETTES: readonly MosaicPaletteName[] = ["blue", "coral", "orange", "green", "purple"];

export interface PuzzleMosaicProps extends Omit<SVGProps<SVGSVGElement>, "seed" | "width" | "height" | "viewBox" | "children"> {
  /** What the icon is drawn from: the same seed always gives the same icon. An id or a name works well. */
  seed: string | number;
  /** A palette name, or four shades of one colour from deep to light. Left out, the seed picks from DEFAULT_MOSAIC_PALETTES. */
  palette?: MosaicPaletteName | MosaicShades;
  /** `accent` (default): one deep piece on light ones. `tonal`: one shade per piece. */
  variant?: "accent" | "tonal";
  /** Width and height in px (default 40). */
  size?: number;
  /** Thin transparent cuts between the four pieces (default true). */
  gaps?: boolean;
  /** Set the icon inside a tile with a margin around it (default false). */
  padding?: boolean;
  /** Fill of that tile, any CSS colour (default white). Only used with `padding`. */
  tile?: string;
  /** Accessible name. Without one the icon is decorative and hidden from assistive technology. */
  title?: string;
}

/**
 * An icon made of four interlocking puzzle pieces in the shades of one colour.
 * A seed always draws the same icon, so an item keeps its icon without
 * anything being stored.
 *
 * This file is self-contained: plain SVG, no canvas, no styles and no
 * dependency but React. It uses no hook other than `useId`, so it also works
 * in a React Server Component.
 *
 *   <PuzzleMosaic seed={app.id} />
 *   <PuzzleMosaic seed="alpha" palette="coral" variant="tonal" size={48} />
 *   <PuzzleMosaic seed="alpha" padding gaps={false} tile="var(--card)" />
 */
export function PuzzleMosaic({
  seed,
  palette,
  variant = "accent",
  size = 40,
  gaps = true,
  padding = false,
  tile = "#ffffff",
  title,
  ...props
}: PuzzleMosaicProps) {
  const id = `mosaic${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mosaic = generateMosaic(seed);
  const shades = typeof palette === "string" ? MOSAIC_PALETTES[palette] : (palette ?? mosaicPaletteFor(seed));
  const fills = mosaicFills(mosaic, shades, variant);
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);

  const pieces = (
    <>
      <clipPath id={id}>
        <path d={OUTLINE} />
      </clipPath>
      {gaps && (
        <mask id={`${id}cuts`}>
          <rect width={1} height={1} fill="#fff" />
          {mosaic.seams.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#000" strokeWidth={GAP} />
          ))}
          <path d={CUT_CORNERS} fill="#000" />
        </mask>
      )}
      <g clipPath={`url(#${id})`}>
        <g mask={gaps ? `url(#${id}cuts)` : undefined}>
          {/* a mid tone underneath, so antialiasing between two fills never shows the page through */}
          <rect width={1} height={1} fill={mixOklab(fills)} />
          {mosaic.layers.map((layer, i) => (
            <path key={i} d={layer.path} fill={fills[layer.cell]} />
          ))}
          {/* without a tile around it, a hairline keeps light pieces from fading into a light page; half of it is clipped away */}
          {!padding && <path d={OUTLINE} fill="none" stroke="rgba(20,20,40,0.14)" strokeWidth={0.03} />}
        </g>
      </g>
    </>
  );

  if (!padding) {
    return (
      <svg width={size} height={size} viewBox="0 0 1 1" {...a11y} {...props}>
        {pieces}
      </svg>
    );
  }
  const line = 1 / size;
  const inset = (1 - PADDED_SCALE) / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 1 1" {...a11y} {...props}>
      <rect x={line / 2} y={line / 2} width={1 - line} height={1 - line} rx={0.25} fill={tile} stroke="rgba(20,20,40,0.1)" strokeWidth={line} />
      <svg x={inset} y={inset} width={PADDED_SCALE} height={PADDED_SCALE} viewBox="0 0 1 1">
        {pieces}
      </svg>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Drawing. Everything below is plain functions with no React in them.
 * ------------------------------------------------------------------------- */

/** width of the cuts between pieces, as a fraction of the icon */
const GAP = 0.022;
/** radius that rounds the pieces' corners where cuts cross or reach the edge */
const CUT_CORNER = 0.03;
/** size of the icon inside its tile when `padding` is on */
const PADDED_SCALE = 0.75;
/** knob radius, how far its centre sits beyond the seam, and the radius of the arcs that ease it into the seam */
const KNOB = 0.09;
const KNOB_OFFSET = 0.03;
const KNOB_JOIN = 0.045;

type Vec2 = readonly [number, number];
const f = (v: number) => v.toFixed(4);

/**
 * The icon's outline: a superellipse of exponent 4, one cubic per quadrant.
 * Its curvature changes smoothly, without the kink where a rounded
 * rectangle's straight side meets its corner arc.
 */
const OUTLINE = (() => {
  const a = f(0.5 + 0.5 * 0.918);
  const b = f(0.5 - 0.5 * 0.918);
  return `M 1 0.5 C 1 ${a} ${a} 1 0.5 1 C ${b} 1 0 ${a} 0 0.5 C 0 ${b} ${b} 0 0.5 0 C ${a} 0 1 ${b} 1 0.5 Z`;
})();

/** Shapes cut away with the seams so the pieces' corners are round: an opening where the cuts cross, and a notch where each reaches the edge. */
const CUT_CORNERS = (() => {
  const r = CUT_CORNER;
  const h = GAP / 2;
  const o = h + r;
  const lo = f(0.5 - h);
  const hi = f(0.5 + h);
  const near = f(0.5 - o);
  const far = f(0.5 + o);
  const arc = `A ${r} ${r} 0 0 0`;
  let d = `M ${lo} ${near} L ${hi} ${near} ${arc} ${far} ${lo} L ${far} ${hi} ${arc} ${hi} ${far} L ${lo} ${far} ${arc} ${near} ${hi} L ${near} ${lo} ${arc} ${lo} ${near} Z`;
  // each edge: where it starts, the direction along it and the direction out of the icon
  const edges: { a: Vec2; d: Vec2; n: Vec2 }[] = [
    { a: [0, 0], d: [1, 0], n: [0, -1] },
    { a: [1, 0], d: [0, 1], n: [1, 0] },
    { a: [1, 1], d: [-1, 0], n: [0, 1] },
    { a: [0, 1], d: [0, -1], n: [-1, 0] },
  ];
  for (const g of edges) {
    const at = (t: number, m: number) => `${f(g.a[0] + g.d[0] * (0.5 + t) - g.n[0] * m)} ${f(g.a[1] + g.d[1] * (0.5 + t) - g.n[1] * m)}`;
    d += ` M ${at(-o, -0.01)} L ${at(o, -0.01)} L ${at(o, 0)} ${arc} ${at(h, r)} L ${at(-h, r)} ${arc} ${at(-o, 0)} Z`;
  }
  return d;
})();

export interface Mosaic {
  /** shade (0 deep to 3 light) of each cell, in the order top-left, top-right, bottom-left, bottom-right */
  tones: readonly [number, number, number, number];
  /** closed paths in paint order, in a unit square; `cell` is the cell whose colour fills the path */
  layers: { path: string; cell: number }[];
  /** the four cuts between pieces, as open paths */
  seams: string[];
}

/** The two deep tones sit on one diagonal and the two light ones on the other, so every seam has contrast. */
const TONES: readonly Mosaic["tones"][] = [
  [0, 2, 3, 1],
  [0, 3, 2, 1],
  [1, 2, 3, 0],
  [1, 3, 2, 0],
  [2, 0, 1, 3],
  [3, 0, 1, 2],
  [2, 1, 0, 3],
  [3, 1, 0, 2],
];
/** The four half-seams: midpoint, direction, the side a knob may point to, and the cells behind and in front of it. */
const SEAMS: { p: Vec2; d: Vec2; n: Vec2; cells: readonly [number, number] }[] = [
  { p: [0.5, 0.25], d: [0, 1], n: [1, 0], cells: [0, 1] },
  { p: [0.5, 0.75], d: [0, 1], n: [1, 0], cells: [2, 3] },
  { p: [0.25, 0.5], d: [1, 0], n: [0, 1], cells: [0, 2] },
  { p: [0.75, 0.5], d: [1, 0], n: [0, 1], cells: [1, 3] },
];
const CELLS: Vec2[] = [
  [0, 0],
  [0.5, 0],
  [0, 0.5],
  [0.5, 0.5],
];
const designs = new Map<string, Mosaic>();

/** The mosaic for a seed: one of eight tone layouts and sixteen knob layouts. */
export function generateMosaic(seed: string | number): Mosaic {
  const random = seededRandom(`${String(seed)}:mosaic`);
  const tones = TONES[Math.floor(random() * TONES.length)]!;
  // true when the knob on that half-seam points right or down
  const knobs = [random() < 0.5, random() < 0.5, random() < 0.5, random() < 0.5];
  const key = `${tones.join("")}:${knobs.map((k) => (k ? 1 : 0)).join("")}`;
  const hit = designs.get(key);
  if (hit) return hit;

  // an arc of KNOB_JOIN touches the seam and the knob, so the outline has no cusp
  const reach = Math.sqrt((KNOB + KNOB_JOIN) ** 2 - (KNOB_JOIN - KNOB_OFFSET) ** 2);
  const k = KNOB / (KNOB + KNOB_JOIN);
  const tx = reach * k;
  const ty = KNOB_OFFSET + (KNOB_JOIN - KNOB_OFFSET) * k;
  // a knob is painted over its neighbour, and starts a little behind the seam so no hairline shows between it and its own cell
  const BACK = 0.01;

  const layers: Mosaic["layers"] = CELLS.map(([x, y], cell) => ({ path: `M ${x} ${y} h 0.5 v 0.5 h -0.5 Z`, cell }));
  const seams: string[] = [];
  SEAMS.forEach((seam, i) => {
    const s = knobs[i] ? 1 : -1;
    const at = (t: number, out: number) => `${f(seam.p[0] + seam.d[0] * t + seam.n[0] * out * s)} ${f(seam.p[1] + seam.d[1] * t + seam.n[1] * out * s)}`;
    // clockwise on screen when the knob lies to the right of the direction of travel
    const turn = (seam.d[0] * seam.n[1] - seam.d[1] * seam.n[0]) * s < 0 ? 1 : 0;
    const knob = `A ${KNOB_JOIN} ${KNOB_JOIN} 0 0 ${1 - turn} ${at(-tx, ty)} A ${KNOB} ${KNOB} 0 0 ${turn} ${at(tx, ty)} A ${KNOB_JOIN} ${KNOB_JOIN} 0 0 ${1 - turn} ${at(reach, 0)}`;
    layers.push({ path: `M ${at(-reach, -BACK)} L ${at(-reach, 0)} ${knob} L ${at(reach, -BACK)} Z`, cell: seam.cells[knobs[i] ? 0 : 1] });
    seams.push(`M ${at(-0.25, 0)} L ${at(-reach, 0)} ${knob} L ${at(0.25, 0)}`);
  });
  const mosaic: Mosaic = { tones, layers, seams };
  designs.set(key, mosaic);
  return mosaic;
}

/** The fill of each cell: its own shade (`tonal`), or one deep piece with the rest light (`accent`). */
export function mosaicFills(mosaic: Mosaic, shades: readonly string[], variant: "accent" | "tonal" = "accent"): string[] {
  const shade = (i: number) => shades[Math.min(i, shades.length - 1)] ?? "#808080";
  if (variant === "tonal") return mosaic.tones.map(shade);
  const soft = mixOklab([shade(3), shade(2)]);
  // tone 1 sits diagonal to the accent and is the lightest; the two cells touching the accent are a step darker
  return mosaic.tones.map((t) => (t === 0 ? shade(0) : t === 1 ? shade(3) : soft));
}

/** The palette a seed uses when none is given. */
export function mosaicPaletteFor(seed: string | number): MosaicShades {
  const names = DEFAULT_MOSAIC_PALETTES;
  return MOSAIC_PALETTES[names[hashString(`${String(seed)}:palette`) % names.length]!];
}

/* ---------------------------------------------------------------------------
 * Seeded randomness and colour mixing.
 * ------------------------------------------------------------------------- */

/** 32-bit string hash (cyrb53 folded to 32 bits). */
function hashString(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** Mulberry32: a function that returns the next float in [0, 1) each time it is called. */
function seededRandom(text: string): () => number {
  let state = hashString(text);
  return () => {
    let t = (state = (state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Triple = [number, number, number];

/** Average hex colours in OKLab, so the mix looks halfway between them and not muddy. */
function mixOklab(hexes: readonly string[]): string {
  const sum: Triple = [0, 0, 0];
  for (const hex of hexes) {
    const n = parseInt(hex.replace("#", ""), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as Triple;
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    sum[0] += 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    sum[1] += 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    sum[2] += 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  }
  const [L, a, b] = sum.map((v) => v / (hexes.length || 1)) as Triple;
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear: Triple = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const channel = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    const srgb = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${linear.map(channel).join("")}`.toUpperCase();
}
