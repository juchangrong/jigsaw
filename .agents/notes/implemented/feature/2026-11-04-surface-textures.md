# Agent Note: Procedural surface textures

Status: implemented

## Problem

Every piece had the same smooth resin surface. The user wants texture options on the surface, so a piece can look like paper, metal and similar materials.

## Decision

`material.texture` selects a procedural finish: `none` (default), `paper`, `linen`, `frosted`, `wood`, `brushedMetal` or `polishedMetal`. `material.textureStrength` (0–1, default 0.6) scales the bump and albedo variation, and `material.textureScale` (0.25–4, default 1) scales the grain. The playground has a Texture control with Strength and Grain sliders in the Material section.

Each texture is a height field built from value noise with an analytic gradient, summed as fbm in grain-aligned piece-local coordinates (`texHeight` in `packages/core/src/material/texture.ts`). The gradient tilts the normal, the height varies the albedo, and `TEXTURE_LOOKS` scales the Blinn-Phong exponent and specular per texture. The two metals also cut diffuse to 15 %, tint the highlight with the base color and add a reflected studio environment oriented by the light direction. `docs/design.md` §5.1 lists the recipes.

Each piece gets a lattice seed and a grain angle from a new `texture` RNG stream forked by piece id, stored on `PieceDescription.material`. The lattice hash is 32-bit integer arithmetic that keeps 24 bits, so the TS reference, WGSL and GLSL see the same lattice values. Each octave fades out between 0.5 and 1 lattice cells per output pixel, so fine grain averages to flat at small sizes instead of aliasing.

The texture terms sit behind a `kind != 0` branch in all three implementations, and every new uniform is inert for `none`. Untextured output is therefore unchanged byte for byte, so `ALGORITHM_VERSION`, `PRESET_VERSION` and `tests/golden/signatures.json` stay as they were. The piece uniform block grows from 24 to 27 vec4s (`tex`, `tex2`, `tex3`), which still fits the 512-byte WebGPU stride.

## Alternatives considered

**Image textures.** Tileable paper or metal photos look rich, but they need assets, sampling and a texture per material. They also break the rule that a seed alone defines the icon. Procedural noise has no assets and stays reproducible, so it won.

**A separate material preset per texture.** Making `paper` or `metal` presets would replace the bevel and roughness values a user tuned. It also could not combine, for example, wood grain with the satin bevel. A texture layered on any preset keeps those choices independent.

**Gradient noise or a float hash such as `fract(sin(dot(p, k)) · 43758)`.** A float-sine hash differs between GPUs and the CPU at large arguments, so the backends would disagree. Gradient noise looks smoother but costs more per octave, and at icon sizes value noise with the fbm fade shows no grid artifacts.

**Finite differences of the height field.** Taking the bump gradient by sampling the height three times triples the noise cost. The analytic derivative of value noise is exact and cheap.

## Consequences

Textured icons render the same on all three backends. In the playground at 256 px, WebGPU and WebGL2 each differ from the CPU renderer by at most 1/255 per channel for every texture, in single and grid layouts. `tests/texture.test.ts` checks that `none` matches the untextured render exactly, that each texture changes the surface but not the coverage, that textures are deterministic and placed per piece without perturbing other streams, and that metal has brighter highlights and more contrast than resin. It also pins the lattice hash and noise values. Before the tests were written, a scratch check compared every surface pixel of the default render against the previous `shading.ts` and found them equal.

At 128 px and below, the finest grain (paper fibers, linen, frosted, brushed streaks) fades out by design; wood rings and the metal reflections still show. Use `textureScale` above 1 for visible grain at small sizes.

Gap: the look of each texture was judged by eye at 128 and 512 px on one seed and palette. Very dark or very light palettes may need different strengths.
