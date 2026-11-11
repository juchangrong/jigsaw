import type { Rng } from "../prng";
import { hexToOklch, oklchToHex } from "./oklch";

/**
 * Vivid palettes, each an analogous hue sweep from a saturated deep anchor to a
 * luminous highlight, ordered deep → light. A piece takes one of the colours.
 */
export const VIVID_PALETTES = {
  dusk: ["#3B3FD6", "#8A3FE0", "#E24FA8", "#FFB38A"],
  tide: ["#1C4FD8", "#1F8EF1", "#33C7E6", "#9DF2D6"],
  ember: ["#E0283E", "#FF5A36", "#FF9A2E", "#FFD45A"],
  orchid: ["#6C3BE8", "#C044D9", "#FF5C9A", "#FFA48C"],
  meadow: ["#0B7F78", "#1FB57E", "#8BDB5A", "#F4E66A"],
  glacier: ["#3A4FD9", "#6F7CF6", "#C29BFF", "#F2D9FF"],
  bloom: ["#D4358F", "#F2607E", "#FF9B7A", "#FFD79A"],
} as const satisfies Record<string, readonly string[]>;

/**
 * Muted palettes: low chroma (0.03–0.065 in OKLCH), each a sweep within one
 * hue family from a deep shade (L 0.46) to a soft light shade (L 0.82), with a
 * little hue drift. Built from those OKLCH values; selectable by name, not
 * picked by seeds.
 */
export const MUTED_PALETTES = {
  slate: ["#395C77", "#607D9B", "#8BA0BD", "#B9C4DA"],
  sage: ["#486042", "#668368", "#8AA792", "#B4CBBE"],
  clay: ["#784B3F", "#9A6E5D", "#BA9582", "#D7BFAE"],
  plum: ["#664E6B", "#8B708B", "#B095AA", "#D3BDCA"],
  fog: ["#415D64", "#657F89", "#8DA2AD", "#B9C6CF"],
  moss: ["#5A5A39", "#797E5E", "#9AA387", "#BEC8B6"],
} as const satisfies Record<string, readonly string[]>;

/** The original pastel palettes; selectable by name, not picked by seeds. */
export const PASTEL_PALETTES = {
  aurora: ["#B9A0FF", "#7DE5ED", "#6478F2"],
  sunset: ["#FFE18C", "#FF91B2", "#CB91F5"],
  mint: ["#91EFC8", "#71CBEF", "#9F9CFF"],
  candy: ["#FFA6CF", "#A6A3FF", "#82D9FF"],
  lagoon: ["#7FE3D4", "#5AB8F0", "#B6F2A0"],
  peach: ["#FFC4A3", "#FF9AA2", "#FFE0B5"],
} as const satisfies Record<string, readonly string[]>;

export const PALETTES = { ...VIVID_PALETTES, ...MUTED_PALETTES, ...PASTEL_PALETTES };

export type PaletteName = keyof typeof PALETTES;
export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];
/** Palettes a seed picks from when no palette is given. */
export const SEED_PALETTE_NAMES = Object.keys(VIVID_PALETTES) as PaletteName[];

export interface ResolvedPalette {
  name: string;
  /** sRGB hex; a named preset's colors after the seeded OKLCH variation */
  colors: string[];
}

/**
 * Resolve a palette for an icon. A named preset is varied slightly in OKLCH
 * from the `palette` stream, so two seeds with the same preset are related but
 * not identical. A custom hex list is used exactly as given.
 */
export function resolvePalette(spec: string | string[] | null, rng: Rng): ResolvedPalette {
  if (Array.isArray(spec)) {
    if (spec.length < 1) throw new Error("A custom palette needs at least 1 color");
    return { name: "custom", colors: [...spec] };
  }
  const name = spec && spec in PALETTES ? spec : rng.pick(SEED_PALETTE_NAMES);
  const hueShift = rng.signed(7);
  const chromaScale = 1 + rng.signed(0.06);
  const colors = PALETTES[name as PaletteName].map((hex) => {
    const [L, C, h] = hexToOklch(hex);
    return oklchToHex([L + rng.signed(0.015), C * chromaScale, h + hueShift]);
  });
  return { name, colors };
}
