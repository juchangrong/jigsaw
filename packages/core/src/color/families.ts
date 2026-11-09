/**
 * Colour families and sets for icons that use one flat colour or a calm
 * gradient, as in a product list. A family is four shades from deep to light;
 * a set is at most five families that sit well together.
 */
import { hexToOklch, mixOklab, oklchToHex } from "./oklch";
import { PALETTES, type PaletteName } from "./palettes";

export interface ColorFamily {
  id: string;
  /** four sRGB hex shades, deep to light; usable as a gradient palette */
  colors: string[];
}

export interface ColorSet {
  id: string;
  label: string;
  families: ColorFamily[];
}

/**
 * A family from OKLCH: lightness from `deep` to `light` in four steps, chroma
 * tapering toward the light end (less chroma reads cleaner near white), and a
 * small hue drift across the sweep.
 */
export function colorFamily(id: string, hue: number, chroma: number, deep: number, light: number, drift = 10): ColorFamily {
  const taper = [1, 0.95, 0.8, 0.55];
  return {
    id,
    colors: taper.map((k, i) => oklchToHex([deep + ((light - deep) * i) / 3, chroma * k, hue - drift / 2 + (drift * i) / 3])),
  };
}

const preset = (id: PaletteName): ColorFamily => ({ id, colors: [...PALETTES[id]] });

/**
 * Sets of at most five families. They take their cue from restrained product
 * finishes: near-neutral metals with one accent, or a few soft hues of equal
 * weight. Names and values are original.
 */
export const COLOR_SETS: readonly ColorSet[] = [
  { id: "studio", label: "Studio", families: [preset("slate"), preset("plum"), preset("clay"), preset("sage")] },
  {
    id: "aluminum",
    label: "Aluminum",
    families: [
      colorFamily("graphite", 265, 0.014, 0.34, 0.74),
      colorFamily("silver", 250, 0.012, 0.58, 0.92),
      colorFamily("champagne", 78, 0.035, 0.6, 0.9),
      colorFamily("navy", 258, 0.06, 0.3, 0.66),
      colorFamily("sky", 232, 0.05, 0.58, 0.9),
    ],
  },
  {
    id: "titanium",
    label: "Titanium",
    families: [
      colorFamily("dark", 265, 0.01, 0.28, 0.6),
      colorFamily("natural", 80, 0.02, 0.55, 0.86),
      // a white finish has to stay visible on a white tile, so it stops short of white
      colorFamily("white", 95, 0.01, 0.64, 0.9),
      colorFamily("blue", 245, 0.035, 0.36, 0.72),
      colorFamily("desert", 62, 0.045, 0.55, 0.86),
    ],
  },
  {
    id: "desktop",
    label: "Desktop",
    families: [
      colorFamily("blue", 250, 0.11, 0.5, 0.86),
      colorFamily("green", 152, 0.1, 0.5, 0.86),
      colorFamily("pink", 5, 0.1, 0.55, 0.88),
      colorFamily("orange", 55, 0.11, 0.58, 0.88),
      colorFamily("purple", 300, 0.1, 0.5, 0.86),
    ],
  },
  {
    // one gray-white family, so every icon shares a colour and only the shapes
    // differ; the deep end stays dark enough to read on a white tile
    id: "mono",
    label: "Mono",
    families: [colorFamily("gray", 255, 0.008, 0.66, 0.96, 4)],
  },
  {
    id: "system",
    label: "System",
    families: [
      colorFamily("blue", 255, 0.13, 0.48, 0.84),
      colorFamily("indigo", 282, 0.12, 0.44, 0.82),
      colorFamily("teal", 200, 0.08, 0.5, 0.86),
      colorFamily("orange", 58, 0.13, 0.58, 0.88),
      colorFamily("pink", 8, 0.12, 0.55, 0.86),
    ],
  },
];

const lightestAtMost = (f: ColorFamily, L: number) => [...f.colors].reverse().find((c) => hexToOklch(c)[0] <= L) ?? f.colors[0]!;

/**
 * The flat colour of a pictogram on a white tile: the lightest shade of the
 * family that still stands clear of white (OKLCH lightness at most 0.68), else
 * its deepest shade.
 */
export function pictogramColor(f: ColorFamily): string {
  return lightestAtMost(f, 0.68);
}

/** The fill of a solid tile under a white pictogram: a deeper shade (lightness at most 0.6), else the deepest. */
export function tileColor(f: ColorFamily): string {
  return lightestAtMost(f, 0.6);
}

const tints = new Map<string, string>();
/** A light tint of a family for the tile behind its icon: its OKLab mix at lightness 0.955 and low chroma. */
export function tintColor(f: ColorFamily): string {
  const key = f.colors.join();
  let t = tints.get(key);
  if (!t) {
    const [, C, h] = hexToOklch(mixOklab(f.colors));
    t = oklchToHex([0.955, Math.min(C, 0.2) * 0.35, h]);
    tints.set(key, t);
  }
  return t;
}
