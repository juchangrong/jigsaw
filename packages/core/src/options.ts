import { DEFAULT_LIGHTING, DEFAULT_SHADOW, MATERIAL_PRESETS } from "./material/presets";
import type { LayoutKind, PuzzleIconOptions, ResolvedOptions, SurfaceTexture } from "./types";

export const SURFACE_TEXTURES: readonly SurfaceTexture[] = ["none", "paper", "linen", "frosted", "wood", "brushedMetal", "polishedMetal"];

export const ALGORITHM_VERSION = "1.9.0";
export const PRESET_VERSION = "1.2.0";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export const DEFAULT_STAMP_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function defaultPieceCount(layout: LayoutKind): number {
  return layout === "single" ? 1 : layout === "grid" ? 4 : 3;
}

export function resolveOptions(o: PuzzleIconOptions): ResolvedOptions {
  const layout: LayoutKind = o.layout ?? "single";
  let pieceCount = Math.round(num(o.pieceCount, defaultPieceCount(layout)));
  if (layout === "single") pieceCount = 1;
  else if (layout === "grid") pieceCount = pieceCount >= 9 ? 9 : 4;
  else pieceCount = clamp(pieceCount, 2, 5);

  const preset = o.material?.preset ?? "softResin";
  const base = MATERIAL_PRESETS[preset];
  const m = o.material ?? {};
  const g = o.geometry ?? {};
  const s = o.shadow ?? {};
  const l = o.lighting ?? {};
  const st = o.stamp ?? {};

  return {
    seed: String(o.seed),
    size: clamp(Math.round(num(o.size, 128)), 8, 4096),
    layout,
    pieceCount,
    geometry: {
      tabSize: clamp(num(g.tabSize, 0.5), 0, 1),
      curvature: clamp(num(g.curvature, 0.5), 0, 1),
      asymmetry: clamp(num(g.asymmetry, 0.6), 0, 1),
      separation: clamp(num(g.separation, layout === "cluster" ? 0.09 : 0.04), 0, 0.5),
      rotation: clamp(num(g.rotation, layout === "cluster" ? 6 : 0), 0, 30),
    },
    gradient: {
      palette: o.gradient?.palette ?? null,
      spots: o.gradient?.spots !== undefined ? clamp(Math.round(o.gradient.spots), 3, 5) : null,
      softness: clamp(num(o.gradient?.softness, 0.5), 0, 1),
    },
    material: {
      preset,
      bevelWidth: clamp(num(m.bevelWidth, base.bevelWidth), 0.005, 0.2),
      bevelStrength: clamp(num(m.bevelStrength, base.bevelStrength), 0, 2),
      roughness: clamp(num(m.roughness, base.roughness), 0.05, 1),
      specularIntensity: clamp(num(m.specularIntensity, base.specularIntensity), 0, 1),
      ambientOcclusion: clamp(num(m.ambientOcclusion, base.ambientOcclusion), 0, 1),
      thickness: clamp(num(m.thickness, base.thickness), 0, 0.1),
      texture: m.texture && SURFACE_TEXTURES.includes(m.texture) ? m.texture : "none",
      textureStrength: clamp(num(m.textureStrength, 0.6), 0, 1),
      textureScale: clamp(num(m.textureScale, 1), 0.25, 4),
    },
    lighting: {
      direction: l.direction ?? DEFAULT_LIGHTING.direction,
      intensity: clamp(num(l.intensity, DEFAULT_LIGHTING.intensity), 0, 2),
      ambient: clamp(num(l.ambient, DEFAULT_LIGHTING.ambient), 0, 2),
      specular: clamp(num(l.specular, DEFAULT_LIGHTING.specular), 0, 2),
    },
    shadow: {
      enabled: s.enabled ?? DEFAULT_SHADOW.enabled,
      opacity: clamp(num(s.opacity, DEFAULT_SHADOW.opacity), 0, 1),
      blur: clamp(num(s.blur, DEFAULT_SHADOW.blur), 0, 0.2),
      offset: s.offset ?? DEFAULT_SHADOW.offset,
      color: s.color ?? DEFAULT_SHADOW.color,
    },
    stamp: {
      // one character per piece, whitespace dropped
      text: Array.from((st.text ?? "").replace(/\s+/g, ""))
        .slice(0, pieceCount)
        .join(""),
      style: st.style === "emboss" ? "emboss" : "deboss",
      size: clamp(num(st.size, 0.3), 0.15, 0.7),
      depth: clamp(num(st.depth, 0.5), 0, 1),
      ink: clamp(num(st.ink, 0.25), 0, 1),
      font: st.font?.trim() || DEFAULT_STAMP_FONT,
      weight: clamp(Math.round(num(st.weight, 700) / 100) * 100, 100, 900),
    },
    background: o.background ?? "transparent",
  };
}
