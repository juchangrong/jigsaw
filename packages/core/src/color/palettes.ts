import type { Rng } from "../prng";
import { hexToOklch, oklchToHex } from "./oklch";

export const PALETTES = {
  aurora: ["#B9A0FF", "#7DE5ED", "#6478F2"],
  sunset: ["#FFE18C", "#FF91B2", "#CB91F5"],
  mint: ["#91EFC8", "#71CBEF", "#9F9CFF"],
  candy: ["#FFA6CF", "#A6A3FF", "#82D9FF"],
  lagoon: ["#7FE3D4", "#5AB8F0", "#B6F2A0"],
  peach: ["#FFC4A3", "#FF9AA2", "#FFE0B5"],
} as const satisfies Record<string, readonly string[]>;

export type PaletteName = keyof typeof PALETTES;
export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[];

export interface ResolvedPalette {
  name: string;
  /** the colors after the seeded OKLCH variation, sRGB hex */
  colors: string[];
}

/**
 * Resolve a palette for an icon. Named presets (or a custom hex list) are
 * varied slightly in OKLCH from the `palette` stream so two seeds with the
 * same preset are related but not identical.
 */
export function resolvePalette(spec: string | string[] | null, rng: Rng): ResolvedPalette {
  let name: string;
  let base: readonly string[];
  if (Array.isArray(spec)) {
    if (spec.length < 2) throw new Error("A custom palette needs at least 2 colors");
    name = "custom";
    base = spec;
  } else if (spec && spec in PALETTES) {
    name = spec;
    base = PALETTES[spec as PaletteName];
  } else {
    name = rng.pick(PALETTE_NAMES);
    base = PALETTES[name as PaletteName];
  }
  const hueShift = rng.signed(7);
  const chromaScale = 1 + rng.signed(0.06);
  const colors = base.map((hex) => {
    const [L, C, h] = hexToOklch(hex);
    return oklchToHex([L + rng.signed(0.015), C * chromaScale, h + hueShift]);
  });
  return { name, colors };
}
