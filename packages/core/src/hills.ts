/**
 * Hills: a small landscape in the shades of one colour. Three hills, each the
 * top of a large circle, overlap from back to front and get deeper toward the
 * viewer; a sun sits in the sky behind them. The result is plain SVG circles.
 */
import { mixOklab } from "./color/oklch";
import { mosaicOutline, type MosaicShape, type MosaicVariant } from "./mosaic";
import { createRng, type Seed } from "./prng";

/** A circle in the unit tile. */
export interface HillsCircle {
  x: number;
  y: number;
  r: number;
}

export interface Hills {
  sun: HillsCircle;
  /** the three hills from back to front; only the top of each circle is inside the tile */
  hills: [HillsCircle, HillsCircle, HillsCircle];
  viewBox: string;
  /** identifies the design: equal keys draw the same hills */
  key: string;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * The hills for a seed. The back hill is the tallest and the front one the
 * lowest, so all three show; the back two sit on opposite sides and the front
 * one near the middle. Half the seeds mirror the scene.
 */
export function generateHills(seed: Seed): Hills {
  const rng = createRng(seed, "hills");
  const mirror = rng.bool();
  const at = (x: number) => round(mirror ? 1 - x : x);
  const sun: HillsCircle = { x: at(rng.range(0.25, 0.75)), y: round(rng.range(0.22, 0.34)), r: 0.09 };
  // centre x and the height of the crest above the tile's bottom edge
  const crests: [number, number][] = [
    [rng.range(0.1, 0.35), rng.range(0.5, 0.6)],
    [rng.range(0.65, 0.9), rng.range(0.4, 0.5)],
    [rng.range(0.35, 0.65), rng.range(0.24, 0.32)],
  ];
  const hills = crests.map(([x, height]) => {
    const r = rng.range(0.42, 0.54);
    return { x: at(x), y: round(1 - height + r), r: round(r) };
  }) as Hills["hills"];
  const key = [sun, ...hills].map((c) => `${c.x},${c.y},${c.r}`).join(";");
  return { sun, hills, viewBox: "0 0 1 1", key };
}

/**
 * The fills from a family's shades (deep to light). The sky is the lightest shade.
 * - `tonal`: the hills step from the light shade at the back to the deep one in front.
 * - `accent`: the front hill keeps the deep shade and the two behind it stay light, so one hill stands out.
 */
export function hillsFills(colors: readonly string[], variant: MosaicVariant = "tonal"): { sky: string; sun: string; hills: [string, string, string] } {
  const shade = (i: number) => colors[Math.min(i, colors.length - 1)] ?? "#808080";
  const soft = mixOklab([shade(2), shade(3)]);
  return variant === "accent"
    ? { sky: shade(3), sun: shade(2), hills: [soft, shade(2), shade(0)] }
    : { sky: shade(3), sun: shade(2), hills: [shade(2), shade(1), shade(0)] };
}

export interface HillsStyle {
  variant?: MosaicVariant;
  /** the tile's outline (default squircle) */
  shape?: MosaicShape;
  /** corner radius of a `round` tile, as a fraction of its side (default 0.25) */
  radius?: number;
  /** a hairline around the tile, so a light sky holds on a light page (default true) */
  edge?: boolean;
}

/** Everything needed to draw hills: clip to `outline`, paint `sky`, the sun, then the hills from back to front. */
export interface HillsDrawing {
  outline: string;
  sky: string;
  sun: string;
  /** the fill of each hill, back to front */
  fills: [string, string, string];
  /** colour of a line along `outline` (half of it is clipped away), or null */
  edge: string | null;
  /** width of that line */
  edgeWidth: number;
}

export function hillsDrawing(colors: readonly string[], o: HillsStyle = {}): HillsDrawing {
  const { sky, sun, hills } = hillsFills(colors, o.variant);
  return { outline: mosaicOutline(o.shape, o.radius), sky, sun, fills: hills, edge: o.edge === false ? null : "rgba(20,20,40,0.14)", edgeWidth: 0.03 };
}

export interface HillsSvgOptions extends HillsStyle {
  /** rendered width and height in px (default 24) */
  size?: number;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A standalone SVG document for hills in a family's shades. */
export function hillsSvg(hills: Hills, colors: readonly string[], o: HillsSvgOptions = {}): string {
  const size = o.size ?? 24;
  const d = hillsDrawing(colors, o);
  const a11y = o.title ? `role="img" aria-label="${esc(o.title)}"` : `aria-hidden="true"`;
  const id = `hills-${hills.key.replace(/[^0-9]/g, "")}`;
  const circle = (c: HillsCircle, fill: string) => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${esc(fill)}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${hills.viewBox}" ${a11y}>` +
    `<clipPath id="${id}"><path d="${d.outline}"/></clipPath>` +
    `<g clip-path="url(#${id})">` +
    `<rect width="1" height="1" fill="${esc(d.sky)}"/>` +
    circle(hills.sun, d.sun) +
    hills.hills.map((h, i) => circle(h, d.fills[i]!)).join("") +
    (d.edge ? `<path d="${d.outline}" fill="none" stroke="${d.edge}" stroke-width="${d.edgeWidth}"/>` : "") +
    `</g></svg>`
  );
}
