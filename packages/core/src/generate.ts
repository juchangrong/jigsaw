import { generateGradient } from "./color/gradient";
import { resolvePalette } from "./color/palettes";
import { buildLayout } from "./geometry/layout";
import { ALGORITHM_VERSION, PRESET_VERSION, resolveOptions } from "./options";
import { createRng, type Rng } from "./prng";
import { recommendedSdfResolution } from "./sdf/sdf";
import type { PuzzleIconDescription, PuzzleIconOptions } from "./types";

function pieceTexture(rng: Rng) {
  return { textureSeed: rng.int(0, 65535), textureAngle: rng.signed(0.3) };
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
  const textureRng = createRng(opts.seed, "texture");
  const { preset: _preset, ...material } = opts.material;
  const letters = Array.from(opts.stamp.text);

  return {
    metadata: { seed: opts.seed, algorithmVersion: ALGORITHM_VERSION, presetVersion: PRESET_VERSION },
    size: opts.size,
    layout: opts.layout,
    background: opts.background,
    palette,
    pieces: layout.pieces.map((p, i) => ({
      ...p,
      gradient: generateGradient(gradientRng.fork(p.id), {
        palette: palette.colors,
        spots: opts.gradient.spots,
        softness: opts.gradient.softness,
      }),
      material: { ...material, ...pieceTexture(textureRng.fork(p.id)) },
      stamp: letters[i] ?? "",
    })),
    sharedEdges: layout.sharedEdges,
    lighting: opts.lighting,
    shadow: opts.shadow,
    stamp: opts.stamp,
    sdfResolution: recommendedSdfResolution(opts.size, layout.scale),
    options: opts,
  };
}
