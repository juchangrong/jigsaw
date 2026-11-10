# Procedural Puzzle Icon Generator — Technical Design (v1.0)

> Seed → jigsaw-puzzle-piece icon. Strict top-down view, classic tab/socket outline, soft multi-color diffuse gradient, subtle 3D "soft resin / matte acrylic" look produced by an SDF bevel and lighting.
>
> **Principle:** geometry defines the shape, the SDF defines the bevel, shaders define the material, the seed defines the identity.

## 1. Visual goals

- Minimal, geometric, soft resin, diffuse gradient, subtle 3D.
- Orthographic top-down only. The surface is flat; depth comes from rounded bevel highlights, never from extruded sides.
- No color banding, no drop shadow by default, legible from 32 px to 256 px.
- Avoid: thick strokes, metal, strong specular, cartoon look.

**Non-goals:** animation, physics, perspective, ray tracing, game interaction, AI image generation, glass refraction, SVG export of the rendered material. (Flat vector forms of a piece are provided; see §10.1.)

## 2. Architecture

```
Seed + Config
   │
   ▼
Geometry ── topology, shared edges, cubic Bézier paths      (@jigsaw/core/geometry)
   │
   ▼
Mask rasterization → exact EDT → signed distance field      (@jigsaw/core/sdf)
   │
   ▼
WebGPU renderer ── diffuse gradient, bevel normals,          (@jigsaw/renderer)
                   lighting, ambient shadow, AA
   │
   ▼
Composite → React preview / PNG / WebP export               (@jigsaw/react, @jigsaw/export)
```

Geometry, color, material and rendering live in separate modules.

## 3. Geometry

### 3.1 Edges

```ts
type EdgeKind = "flat" | "tab" | "socket";

interface PuzzleEdge {
  id: string;
  kind: EdgeKind;
  center: number;     // 0.42 – 0.58
  width: number;      // 0.22 – 0.35  (head width)
  depth: number;      // 0.24 – 0.30
  neckWidth: number;  // 0.18 – 0.26 (neck-point spacing; narrowest neck ≈ 0.78 ×)
  asymmetry: number;  // ±0.08
  curvature: number;  // 0.5 – 0.9
}
```

All values are normalized to the side length. The generator must prevent self-intersection and overly thin necks (head width ≥ neck + margin; the neck is widened so it is at least a few output pixels wide at the target size). Each connector is three cubic Béziers with closed-form control points (corner → neck, head, neck → corner) whose handles continue each other's tangents, so every edge is one continuous line, as on a die-cut puzzle.

### 3.2 Shared edges (multi-piece layouts)

```ts
interface SharedEdge {
  id: string;
  geometry: BezierSegment[]; // in layout (world) coordinates, ownerA's direction
  ownerA: string;
  ownerB: string;
}
```

Neighbors traverse the same geometry in opposite directions, so pieces fit exactly with no gaps or overlaps. A `tab` from A's point of view is a `socket` for B.

### 3.3 Single-piece rules

- At least one non-flat edge, at most 3 tabs, not all 4 edges the same kind.
- Visually balanced; bounding-box aspect ratio stays reasonable (≈ 0.75–1.33).
- Corners: rounded only where both sides are flat (the frame corners of an assembled puzzle); every other corner is square, so pieces close with no gaps.
- Connector sides are hand-cut, not ruler-straight: the side runs bow in a gentle S and heads lean slightly; only the frame (flat sides) is straight. Sockets are the point reflection of tabs, so leaning, wavy connectors still fit exactly.
- Single pieces interlock with each other. They share one connector derived from the geometry options (not the seed), and one scale per output size, so any single piece's tab fits any other single piece's socket. Outlines therefore vary only by which sides are tabs, sockets or flat; seeds also vary palette, gradient and stamp.

### 3.4 Layouts

- `single`
- `cluster`: 2–5 pieces from a compact connected patch of a grid, with slight separation and rotation.
- `grid`: 2×2 or 3×3.

## 4. SDF

- Convention: **positive inside**.
- CPU flattens the Bézier path, rasterizes a coverage mask, runs an exact Euclidean distance transform (Felzenszwalb–Huttenlocher) for inside and outside, and combines them into a signed field. Distances near the outline are refined with exact point-to-segment distances so the bevel normals are smooth.
- The field is uploaded as a texture (a compute shader would also be fine).
- **Never** use a blurred mask in place of a real SDF.
- Resolution is about one texel per output pixel, in steps from 128 to 1024; regenerate at higher resolution for big exports. Enforce a minimum connection width per pixel size.

## 5. Material & lighting

- Height: `h = H · smoothstep(0, b, d)` (H = thickness, b = bevel width).
- Normal: `normalize(-∂h/∂x, -∂h/∂y, 1)` with derivatives computed by central differences of the SDF texture in piece-local units, so the scale is the same at every resolution and control flow stays uniform.
- One directional light plus ambient: `direction [-0.5, -0.6, 1]`, `intensity 0.85`, `ambient 0.65`, `specular 0.28`.
- Lambert + simplified Blinn–Phong. Lighting is normalized so the flat top keeps the true gradient color; top and left bevels get brighter, opposite bevels slightly darker. Never fake highlights with a fixed white stroke.
- `softResin` preset: `bevelWidth 0.055`, `bevelStrength 0.7`, `roughness 0.48`, `specularIntensity 0.3`, `ambientOcclusion 0.18`, `thickness 0.025`.

### 5.1 Surface textures

`material.texture` layers a procedural finish on any preset: `none` (default), `paper`, `linen`, `frosted`, `wood`, `brushedMetal`, `polishedMetal`. `textureStrength` (0–1, default 0.6) scales the bump and albedo variation; `textureScale` (0.25–4, default 1) scales the grain.

- Height field: value noise with an analytic gradient, summed as fbm, in grain-aligned piece-local coordinates. Each piece gets a lattice seed (0–65535) and a grain angle (±0.3 rad) from the `texture` stream, forked by piece id. The lattice hash is 32-bit integer math keeping 24 bits, so CPU and GPU see identical lattice values.
- Recipes (cells per piece unit at scale 1): paper is isotropic fbm at 70 plus crossed fibers (10 × 140); linen is two crossed thread layers (14 × 160); frosted is fine grain at 150 plus 30; wood is warped growth rings (12) with pores (4 × 110); brushed metal is streaks (2 × 320 and 1 × 60); polished metal is a faint orange peel at 12.
- Antialiasing: each octave fades out between 0.5 and 1 lattice cells per output pixel, and wood rings between 0.25 and 0.5 cycles per pixel, so fine grain averages to flat at small sizes instead of aliasing.
- The bump adds `bump × ∇h` to the bevel and stamp slopes before normalizing; albedo is multiplied by `1 + albedo × h`.
- Each texture also scales the Blinn-Phong exponent and specular (`TEXTURE_LOOKS` in `packages/core/src/material/texture.ts`). The two metals set `metal = 1`: diffuse drops to 15 %, the highlight is tinted by the base color, and a studio environment is reflected: a gradient towards the light with one bright and one dark band, indexed by the reflected view vector plus a position term so it also drifts across the flat face.
- `none` skips all texture terms, so untextured output is byte-for-byte what it was before textures existed.

## 6. Diffuse gradient

```ts
interface GradientSpot { position: [number, number]; color: string; radius: number; intensity: number; }
```

- 3–5 Gaussian spots per piece; normalized weighted sum plus a base color and base weight (avoids division by zero).
- Mixing happens in linear RGB; palettes are built/jittered in OKLCH.
- Vivid presets, picked by seeds: each is an analogous hue sweep from a saturated deep anchor to a luminous highlight, ordered deep to light (`dusk`, `tide`, `ember`, `orchid`, `meadow`, `glacier`, `bloom`; values in `packages/core/src/color/palettes.ts`).
- Muted presets, by name only: low-chroma sweeps (OKLCH chroma 0.03–0.065, lightness 0.46 → 0.82) within one hue family: `slate`, `sage`, `clay`, `plum`, `fog`, `moss`.
- Pastel presets, by name only: aurora `#B9A0FF #7DE5ED #6478F2`, sunset `#FFE18C #FF91B2 #CB91F5`, mint `#91EFC8 #71CBEF #9F9CFF`, candy `#FFA6CF #A6A3FF #82D9FF`, plus `lagoon` and `peach`.
- Lighter colors sit toward the light (top-left) and the deep anchor opposite, along a seeded flow direction, so the gradient agrees with the bevel lighting.
- Spot positions come from the seed. Pieces may share a palette but each gets its own spots.

## 7. Shadow

Soft ambient shadow, off by default and enabled with `shadow.enabled`: `opacity 0.12`, `blur 0.04`, `offset 0.01 / 0.025` (normalized icon units). Shadow alpha is kept when exporting with a transparent background.

## 8. Rendering pipeline

- Premultiplied-alpha compositing, SDF-based anti-aliasing, lighting in linear space, sRGB output. Exports must match the preview.
- Per piece: geometry, SDF, gradient, material, transform. Shared: lighting, camera, color management, renderer.

## 9. Determinism

- Seeded PRNG only (Mulberry32), never `Math.random`.
- Separate streams: `seed:geometry`, `seed:palette`, `seed:gradient`, `seed:layout`, `seed:texture`.
- `GeneratorMetadata { seed, algorithmVersion, presetVersion }`.
- Per-pixel identity across GPUs is **not** promised.

## 10. API

```ts
interface PuzzleIconOptions {
  seed: string | number;
  size?: number;
  layout?: "single" | "cluster" | "grid";
  pieceCount?: number;
  geometry?: { tabSize?: number; curvature?: number; asymmetry?: number; separation?: number; rotation?: number };
  gradient?: { palette?: PaletteName | string[]; spots?: number; softness?: number };
  material?: Partial<MaterialParams> & Partial<TextureParams> & { preset?: MaterialPreset };
  lighting?: Partial<LightingParams>;
  shadow?: { enabled?: boolean; opacity?: number; blur?: number };
  background?: string | "transparent";
}
```

```tsx
<PuzzleIcon seed="alpha" size={128} layout="single" gradient={{ palette: "aurora" }} background="transparent" />
```

```ts
const gen = new PuzzleIconGenerator({ renderer: "webgpu" });
gen.generate(opts);    // deterministic description, no GPU needed
await gen.render(opts);
await gen.export(opts, { format: "png" }); // also toPNG() / toWebP()
```

### 10.1 Vector forms

`packages/core/src/pictogram.ts` gives renderer-free SVG forms, drawn inline by `<PuzzlePictogram>` and `<PuzzleMosaic>`.

- **Pictogram.** A sign built on one grid: a unit square whose corners, knobs and notches are arcs of one radius (0.18), with knob and notch circles centred 0.06 outside or inside the side and an arc of radius 0.09 easing each into the side, so the silhouette has no cusp. It is one closed path in one flat colour, viewed around its area centroid. Only the 30 arrangements with one or two knobs, one or two notches and at most one flat side are used; a seed keeps its own piece's arrangement when it qualifies and otherwise takes one by hash.
- **Mosaic.** A tile cut into four pieces by seams through its centre, each seam half carrying one knob at half the pictogram's scale. Each piece takes one of a family's four shades; the two deep shades share a diagonal, so every seam separates a deep piece from a light one. The accent variant keeps one deep piece and leaves the rest light. The pieces are separated by transparent cuts 0.022 of the tile wide, with corners of radius 0.03 where cuts cross or reach the edge, and the tile's outline is a superellipse of exponent 4.
- **Outline.** The realistic piece's Bézier path in icon units, meant to be stroked.

`packages/core/src/color/families.ts` holds `COLOR_SETS` (at most five families of four shades each, generated from OKLCH) and the flat-colour choices `pictogramColor`, `tileColor` and `tintColor`.

## 11. Playground

- Left: preview (checkerboard / white / dark background, 32/64/128/256 sizes, Randomize, seed input).
- Right: Geometry, Gradient, Material, Lighting, Export (PNG, WebP, resolution, transparent background, copy config).
- Randomize generates a new seed and re-renders immediately.

## 12. Repository layout

```
packages/core        PRNG, geometry, SDF, color, material presets, generate()
packages/renderer    WebGPU (shaders/*.wgsl), WebGL2 and CPU backends, PuzzleIconGenerator
packages/react       <PuzzleIcon/>
packages/export      PNG / WebP encoding
apps/playground      Vite + React playground
tests/               geometry, deterministic, rendering tests
```

## 13. Performance

- One shared GPU device/renderer, never one per icon.
- Cache paths, SDFs, parameters and images.
- Build icons in short slices and skip renders that were aborted while queued, so a page that mounts many icons never blocks.
- Small-size tuning for 24–48 px (minimum bevel and AA width in pixels).
- Production should prefer cached PNG/WebP.
- Fallback chain WebGPU → WebGL2 → CPU, checking adapter/device acquisition.
- Targets: 128 px hot render < 16 ms, 100-icon batch without re-initializing the device, 1024 px PNG export, no GPU leaks.

## 14. Tests

- Geometry: paths closed, no self-intersection, shared edges match, correct tab/socket direction, reasonable area, no thin necks, pieces in bounds.
- Determinism per seed; visible variety across seeds.
- Visual checks at 32–512 px on white, dark and transparent backgrounds.

## 15. Phases

1. PRNG + single-piece Bézier + mask preview (valid outlines; single pieces vary by side kinds, since they share one connector).
2. SDF + WebGPU material + shadow (a single-color piece already looks real).
3. Diffuse gradient + presets.
4. Shared-edge multi-piece layouts.
5. React component, playground, export, fallbacks, caching.
