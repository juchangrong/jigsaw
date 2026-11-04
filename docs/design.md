# Procedural Puzzle Icon Generator — Technical Design (v1.0)

> Seed → jigsaw-puzzle-piece icon. Strict top-down view, classic tab/socket outline, soft multi-color diffuse gradient, subtle 3D "soft resin / matte acrylic" look produced by an SDF bevel and lighting.
>
> **Principle:** geometry defines the shape, the SDF defines the bevel, shaders define the material, the seed defines the identity.

## 1. Visual goals

- Minimal, geometric, soft resin, diffuse gradient, subtle 3D.
- Orthographic top-down only. The surface is flat; depth comes from rounded bevel highlights, never from extruded sides.
- No color banding, light shadow, legible from 32 px to 256 px.
- Avoid: thick strokes, metal, strong specular, cartoon look.

**Non-goals:** animation, physics, perspective, ray tracing, game interaction, AI image generation, glass refraction, SVG export.

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
  depth: number;      // 0.12 – 0.22
  neckWidth: number;  // 0.12 – 0.20
  asymmetry: number;  // ±0.08
  curvature: number;  // 0.5 – 0.9
}
```

All values are normalized to the side length. The generator must prevent self-intersection and overly thin necks (head width ≥ neck + margin; the neck is widened so it is at least a few output pixels wide at the target size).

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

### 3.4 Layouts

- `single`
- `cluster`: 2–5 pieces from a compact connected patch of a grid, with slight separation and rotation.
- `grid`: 2×2 or 3×3.

## 4. SDF

- Convention: **positive inside**.
- CPU flattens the Bézier path, rasterizes a coverage mask, runs an exact Euclidean distance transform (Felzenszwalb–Huttenlocher) for inside and outside, and combines them into a signed field. Distances near the outline are refined with exact point-to-segment distances so the bevel normals are smooth.
- The field is uploaded as a texture (a compute shader would also be fine).
- **Never** use a blurred mask in place of a real SDF.
- Default resolution 256 or 512; regenerate at higher resolution for big exports. Enforce a minimum connection width per pixel size.

## 5. Material & lighting

- Height: `h = H · smoothstep(0, b, d)` (H = thickness, b = bevel width).
- Normal: `normalize(-∂h/∂x, -∂h/∂y, 1)` with derivatives computed by central differences of the SDF texture in piece-local units, so the scale is the same at every resolution and control flow stays uniform.
- One directional light plus ambient: `direction [-0.5, -0.6, 1]`, `intensity 0.85`, `ambient 0.65`, `specular 0.28`.
- Lambert + simplified Blinn–Phong. Lighting is normalized so the flat top keeps the true gradient color; top and left bevels get brighter, opposite bevels slightly darker. Never fake highlights with a fixed white stroke.
- `softResin` preset: `bevelWidth 0.055`, `bevelStrength 0.7`, `roughness 0.48`, `specularIntensity 0.3`, `ambientOcclusion 0.18`, `thickness 0.025`.

## 6. Diffuse gradient

```ts
interface GradientSpot { position: [number, number]; color: string; radius: number; intensity: number; }
```

- 3–5 Gaussian spots per piece; normalized weighted sum plus a base color and base weight (avoids division by zero).
- Mixing happens in linear RGB; palettes are built/jittered in OKLCH.
- Presets: aurora `#B9A0FF #7DE5ED #6478F2`, sunset `#FFE18C #FF91B2 #CB91F5`, mint `#91EFC8 #71CBEF #9F9CFF`, candy `#FFA6CF #A6A3FF #82D9FF`.
- Spot positions come from the seed. Pieces may share a palette but each gets its own spots.

## 7. Shadow

Soft ambient shadow: `opacity 0.12`, `blur 0.04`, `offset 0.01 / 0.025` (normalized icon units). Shadow alpha is kept when exporting with a transparent background.

## 8. Rendering pipeline

- Premultiplied-alpha compositing, SDF-based anti-aliasing, lighting in linear space, sRGB output. Exports must match the preview.
- Per piece: geometry, SDF, gradient, material, transform. Shared: lighting, camera, color management, renderer.

## 9. Determinism

- Seeded PRNG only (Mulberry32), never `Math.random`.
- Separate streams: `seed:geometry`, `seed:palette`, `seed:gradient`, `seed:layout`.
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
  material?: Partial<MaterialParams> & { preset?: MaterialPreset };
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
- Small-size tuning for 24–48 px (minimum bevel and AA width in pixels).
- Production should prefer cached PNG/WebP.
- Fallback chain WebGPU → WebGL2 → CPU, checking adapter/device acquisition.
- Targets: 128 px hot render < 16 ms, 100-icon batch without re-initializing the device, 1024 px PNG export, no GPU leaks.

## 14. Tests

- Geometry: paths closed, no self-intersection, shared edges match, correct tab/socket direction, reasonable area, no thin necks, pieces in bounds.
- Determinism per seed; visible variety across seeds.
- Visual checks at 32–512 px on white, dark and transparent backgrounds.

## 15. Phases

1. PRNG + single-piece Bézier + mask preview (100 valid distinct outlines).
2. SDF + WebGPU material + shadow (a single-color piece already looks real).
3. Diffuse gradient + presets.
4. Shared-edge multi-piece layouts.
5. React component, playground, export, fallbacks, caching.
