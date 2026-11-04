import { generateGradient } from "./color/gradient";
import { resolvePalette } from "./color/palettes";
import { buildLayout } from "./geometry/layout";
import { ALGORITHM_VERSION, PRESET_VERSION, resolveOptions } from "./options";
import { createRng } from "./prng";
import type { PuzzleIconDescription, PuzzleIconOptions } from "./types";

/** SDF resolution (longest side, texels) appropriate for an output size. */
export function recommendedSdfResolution(size: number, pieceScale: number): number {
  // ≈1.5 texels per output pixel across the piece domain (~1.7 piece units)
  const want = size * pieceScale * 1.7 * 1.5;
  if (want <= 256) return 256;
  if (want <= 512) return 512;
  return 1024;
}

/**
 * Turn options into a complete, deterministic description of the icon:
 * geometry, transforms, palette, gradients, material, lighting and shadow.
 * Needs no GPU. The same options always produce the same description.
 */
export function generatePuzzleIcon(options: PuzzleIconOptions): PuzzleIconDescription {
  const opts = resolveOptions(options);
  const layout = buildLayout(opts);
  const palette = resolvePalette(opts.gradient.palette, createRng(opts.seed, "palette"));
  const gradientRng = createRng(opts.seed, "gradient");
  const { preset: _preset, ...material } = opts.material;

  return {
    metadata: { seed: opts.seed, algorithmVersion: ALGORITHM_VERSION, presetVersion: PRESET_VERSION },
    size: opts.size,
    layout: opts.layout,
    background: opts.background,
    palette,
    pieces: layout.pieces.map((p) => ({
      ...p,
      gradient: generateGradient(gradientRng.fork(p.id), {
        palette: palette.colors,
        spots: opts.gradient.spots,
        softness: opts.gradient.softness,
      }),
      material: { ...material },
    })),
    sharedEdges: layout.sharedEdges,
    lighting: opts.lighting,
    shadow: opts.shadow,
    sdfResolution: recommendedSdfResolution(opts.size, layout.scale),
    options: opts,
  };
}
