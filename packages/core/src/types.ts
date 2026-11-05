import type { Seed } from "./prng";

export type Vec2 = [number, number];

/** A cubic Bézier segment. */
export interface BezierSegment {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

export type EdgeKind = "flat" | "tab" | "socket";
export type Side = "top" | "right" | "bottom" | "left";
export const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

/** Edge parameters, normalized to the side length. `kind` is relative to the
 * piece that traverses the edge in its forward direction (owner A). */
export interface PuzzleEdge {
  id: string;
  kind: EdgeKind;
  /** 0.42 – 0.58 */
  center: number;
  /** 0.22 – 0.35: head size (sets the head handle length λ) */
  width: number;
  /** 0.24 – 0.30: how far a tab reaches past the side (head top) */
  depth: number;
  /** 0.18 – 0.26: neck-point spacing; the narrowest neck is ≈ 0.78 × this */
  neckWidth: number;
  /** ±0.08 */
  asymmetry: number;
  /** 0.5 – 0.9 */
  curvature: number;
  /** 0.025 – 0.045: how far each side run bows (peak offset) in a gentle S between corner and connector */
  wave: number;
}

/** An edge shared by two neighbouring pieces. `geometry` is in layout (world)
 * coordinates in ownerA's traversal direction; ownerB walks it in reverse. */
export interface SharedEdge {
  id: string;
  edge: PuzzleEdge;
  geometry: BezierSegment[];
  ownerA: string;
  ownerB: string;
}

export interface PieceSide {
  /** Edge as seen by this piece (kind already flipped for owner B). */
  kind: EdgeKind;
  edgeId: string;
  /** Present when the edge is shared with a neighbour. */
  sharedEdgeId?: string;
  /** True when this piece walks the shared geometry in reverse (owner B). */
  reversed: boolean;
  /** Edge parameters (in owner A's orientation; `kind` above is this piece's view). */
  edge: PuzzleEdge;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Maps piece-local coordinates to icon coordinates ([0,1]², y down):
 *  icon = (x, y) + scale · R(rotation) · (local − pivot) */
export interface PieceTransform {
  x: number;
  y: number;
  /** radians */
  rotation: number;
  scale: number;
  pivot: Vec2;
}

export type LayoutKind = "single" | "cluster" | "grid";

export interface GradientSpot {
  /** piece-local coordinates (cell is [0,1]²) */
  position: Vec2;
  /** sRGB hex */
  color: string;
  radius: number;
  intensity: number;
}

export interface PieceGradient {
  base: string;
  baseWeight: number;
  spots: GradientSpot[];
}

export type MaterialPreset = "softResin" | "matteAcrylic" | "satinResin";

export interface MaterialParams {
  /** bevel width in piece units (side = 1) */
  bevelWidth: number;
  /** multiplier on the bevel normal tilt */
  bevelStrength: number;
  roughness: number;
  specularIntensity: number;
  ambientOcclusion: number;
  /** height of the slab in piece units */
  thickness: number;
}

/** Procedural surface finish layered on the material. */
export type SurfaceTexture = "none" | "paper" | "linen" | "frosted" | "wood" | "brushedMetal" | "polishedMetal";

export interface TextureParams {
  texture: SurfaceTexture;
  /** 0–1, depth of the bump and albedo variation */
  textureStrength: number;
  /** grain size multiplier (1 = default, larger = coarser) */
  textureScale: number;
}

/** Material of one generated piece: shared params plus its texture placement. */
export interface PieceMaterial extends MaterialParams, TextureParams {
  /** integer seed of the noise lattice, 0–65535 */
  textureSeed: number;
  /** direction of grain and streaks, radians in piece-local space */
  textureAngle: number;
}

export interface LightingParams {
  /** direction towards the light, screen space (x right, y down, z to viewer) */
  direction: [number, number, number];
  intensity: number;
  ambient: number;
  specular: number;
}

export interface ShadowParams {
  enabled: boolean;
  opacity: number;
  /** icon-normalized units */
  blur: number;
  /** icon-normalized units */
  offset: Vec2;
  color: string;
}

export type StampStyle = "deboss" | "emboss";

export interface StampOptions {
  /** letters to stamp; character i goes on piece i ("" = no stamp) */
  text?: string;
  /** deboss = pressed into the surface, emboss = raised (default deboss) */
  style?: StampStyle;
  /** glyph height in piece units, side = 1 (0.15–0.7, default 0.3) */
  size?: number;
  /** 0–1, depth of the relief (default 0.5) */
  depth?: number;
  /** 0–1, how much the letter darkens the surface color (default 0.25) */
  ink?: number;
  /** CSS font family */
  font?: string;
  /** CSS font weight, 100–900 (default 700) */
  weight?: number;
}

export type ResolvedStamp = Required<StampOptions>;

export interface GeneratorMetadata {
  seed: string;
  algorithmVersion: string;
  presetVersion: string;
}

export interface PieceDescription {
  id: string;
  /** grid cell (column, row) */
  cell: [number, number];
  sides: Record<Side, PieceSide>;
  /** closed outline in piece-local coordinates, clockwise on screen */
  path: BezierSegment[];
  bounds: Bounds;
  transform: PieceTransform;
  /** the rendered outline is eroded by this much (piece units) to form the
   * gap between neighbours; the path itself stays exact */
  inset: number;
  gradient: PieceGradient;
  material: PieceMaterial;
  /** stable hash of the outline, used as the SDF cache key */
  geometryKey: string;
  /** letter stamped on this piece ("" = none) */
  stamp: string;
}

export interface PuzzleIconDescription {
  metadata: GeneratorMetadata;
  size: number;
  layout: LayoutKind;
  background: string | "transparent";
  palette: { name: string; colors: string[] };
  pieces: PieceDescription[];
  sharedEdges: SharedEdge[];
  lighting: LightingParams;
  shadow: ShadowParams;
  stamp: ResolvedStamp;
  /** recommended SDF resolution (longest side, texels) for this size */
  sdfResolution: number;
  options: ResolvedOptions;
}

export interface GeometryOptions {
  /** 0–1, biases tab width/depth within the allowed range (default 0.5) */
  tabSize?: number;
  /** 0–1, biases curvature within 0.5–0.9 (default 0.5) */
  curvature?: number;
  /** 0–1, scales the ±0.08 asymmetry range (default 0.6) */
  asymmetry?: number;
  /** gap between pieces in piece units (multi-piece layouts) */
  separation?: number;
  /** maximum rotation in degrees for cluster pieces */
  rotation?: number;
}

export interface GradientOptions {
  palette?: string | string[];
  /** spots per piece, 3–5 */
  spots?: number;
  /** 0–1, larger = softer, wider spots (default 0.5) */
  softness?: number;
}

export interface PuzzleIconOptions {
  seed: Seed;
  size?: number;
  layout?: LayoutKind;
  pieceCount?: number;
  geometry?: GeometryOptions;
  gradient?: GradientOptions;
  material?: Partial<MaterialParams> & Partial<TextureParams> & { preset?: MaterialPreset };
  lighting?: Partial<LightingParams>;
  shadow?: Partial<ShadowParams>;
  stamp?: StampOptions;
  background?: string | "transparent";
}

export interface ResolvedOptions {
  seed: string;
  size: number;
  layout: LayoutKind;
  pieceCount: number;
  geometry: Required<GeometryOptions>;
  gradient: { palette: string | string[] | null; spots: number | null; softness: number };
  material: MaterialParams & TextureParams & { preset: MaterialPreset };
  lighting: LightingParams;
  shadow: ShadowParams;
  stamp: ResolvedStamp;
  background: string | "transparent";
}
