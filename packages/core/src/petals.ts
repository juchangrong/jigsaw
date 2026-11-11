/**
 * Petals: a tile of four cells with one leaf in each. A leaf is the lens
 * between two quarter circles of radius one cell, so it runs corner to corner
 * across its cell and leans one of two ways. Leaves meet at their tips and
 * nothing separates the cells, so four leaves read as one figure: a flower, a
 * pinwheel, a wave. The result is plain SVG path data.
 */
import { mosaicOutline, type MosaicShape, type MosaicVariant } from "./mosaic";
import { createRng, type Seed } from "./prng";

export interface Petals {
  /** per cell (top-left, top-right, bottom-left, bottom-right): true when the leaf rises from the cell's bottom-left corner to its top-right */
  leans: [boolean, boolean, boolean, boolean];
  /** shade of each leaf: 0 deep, 1 middle, 2 light */
  tones: [number, number, number, number];
  /** one closed leaf path per cell, in a unit tile */
  leaves: string[];
  viewBox: string;
  /** identifies the design: equal keys draw the same petals */
  key: string;
}

/** One deep leaf, one middle and two light, in every order: the deep leaf leads and the light pair keeps the tile calm. */
const PETAL_TONES: readonly Petals["tones"][] = (() => {
  const out: Petals["tones"][] = [];
  for (let deep = 0; deep < 4; deep++)
    for (let mid = 0; mid < 4; mid++) {
      if (mid === deep) continue;
      out.push([0, 1, 2, 3].map((i) => (i === deep ? 0 : i === mid ? 1 : 2)) as Petals["tones"]);
    }
  return out;
})();
const CELLS: [number, number][] = [
  [0, 0],
  [0.5, 0],
  [0, 0.5],
  [0.5, 0.5],
];
const petalsCache = new Map<string, Petals>();

/** The petals with the given leaf tones and leans. */
export function petalsOf(tones: Petals["tones"], leans: Petals["leans"]): Petals {
  const key = `${tones.join("")}:${leans.map((l) => (l ? 1 : 0)).join("")}`;
  const hit = petalsCache.get(key);
  if (hit) return hit;
  const arc = "A 0.5 0.5 0 0 1";
  const leaves = CELLS.map(([x, y], i) => {
    const [x1, y1] = [x + 0.5, y + 0.5];
    return leans[i] ? `M ${x} ${y1} ${arc} ${x1} ${y} ${arc} ${x} ${y1} Z` : `M ${x} ${y} ${arc} ${x1} ${y1} ${arc} ${x} ${y} Z`;
  });
  const out: Petals = { tones, leans, leaves, viewBox: "0 0 1 1", key };
  petalsCache.set(key, out);
  return out;
}

/** The petals for a seed: one of twelve tone layouts and sixteen lean layouts. */
export function generatePetals(seed: Seed): Petals {
  const rng = createRng(seed, "petals");
  const tones = PETAL_TONES[rng.int(0, PETAL_TONES.length - 1)]!;
  return petalsOf(tones, [rng.bool(), rng.bool(), rng.bool(), rng.bool()]);
}

/**
 * The fill of the ground and of each leaf from a family's shades (deep to light).
 * The ground is the lightest shade.
 * - `tonal`: each leaf takes its own shade.
 * - `accent`: the deep leaf keeps its shade and the rest take the light one, so one leaf stands out.
 */
export function petalsFills(petals: Petals, colors: readonly string[], variant: MosaicVariant = "tonal"): { ground: string; leaves: string[] } {
  const shade = (i: number) => colors[Math.min(i, colors.length - 1)] ?? "#808080";
  return { ground: shade(3), leaves: petals.tones.map((t) => shade(variant === "accent" && t > 0 ? 2 : t)) };
}

export interface PetalsStyle {
  variant?: MosaicVariant;
  /** the tile's outline (default squircle) */
  shape?: MosaicShape;
  /** corner radius of a `round` tile, as a fraction of its side (default 0.25) */
  radius?: number;
  /** a hairline around the tile, so a light ground holds on a light page (default true) */
  edge?: boolean;
}

/** Everything needed to draw petals: clip to `outline`, paint `ground`, then each leaf in its fill. */
export interface PetalsDrawing {
  outline: string;
  ground: string;
  /** the fill of each leaf */
  fills: string[];
  /** colour of a line along `outline` (half of it is clipped away), or null */
  edge: string | null;
  /** width of that line */
  edgeWidth: number;
}

export function petalsDrawing(petals: Petals, colors: readonly string[], o: PetalsStyle = {}): PetalsDrawing {
  const { ground, leaves } = petalsFills(petals, colors, o.variant);
  return { outline: mosaicOutline(o.shape, o.radius), ground, fills: leaves, edge: o.edge === false ? null : "rgba(20,20,40,0.14)", edgeWidth: 0.03 };
}

export interface PetalsSvgOptions extends PetalsStyle {
  /** rendered width and height in px (default 24) */
  size?: number;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A standalone SVG document for petals in a family's shades. */
export function petalsSvg(petals: Petals, colors: readonly string[], o: PetalsSvgOptions = {}): string {
  const size = o.size ?? 24;
  const d = petalsDrawing(petals, colors, o);
  const a11y = o.title ? `role="img" aria-label="${esc(o.title)}"` : `aria-hidden="true"`;
  const id = `petals-${petals.key.replace(":", "-")}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${petals.viewBox}" ${a11y}>` +
    `<clipPath id="${id}"><path d="${d.outline}"/></clipPath>` +
    `<g clip-path="url(#${id})">` +
    `<rect width="1" height="1" fill="${esc(d.ground)}"/>` +
    petals.leaves.map((leaf, i) => `<path d="${leaf}" fill="${esc(d.fills[i]!)}"/>`).join("") +
    (d.edge ? `<path d="${d.outline}" fill="none" stroke="${d.edge}" stroke-width="${d.edgeWidth}"/>` : "") +
    `</g></svg>`
  );
}
