/**
 * Render plan + reference shading.
 *
 * `buildRenderPlan` turns a description into the exact numbers every backend
 * consumes (per-piece SDF, inverse transform, material, gradient, shadow).
 * `shadeSurface` / `shadeShadow` are the TypeScript reference of the WGSL /
 * GLSL fragment shaders and back the CPU fallback renderer, so all three
 * backends produce the same image (up to float precision).
 */
import { hexToSrgb, linearToSrgbChannel, type RGB } from "./color/oklch";
import { gradientToLinear } from "./color/gradient";
import { recommendedSdfResolution, sampleSdf, sharedSdfCache, type SdfCache, type SdfField } from "./sdf/sdf";
import { envLight, texHeight, TEXTURE_KIND, TEXTURE_LOOKS } from "./material/texture";
import { EMPTY_STAMP, stampCache, stampResolution } from "./stamp/glyph";
import type { PuzzleIconDescription } from "./types";

export const MAX_SPOTS = 5;
/** vec4 count of the packed per-piece uniform block */
export const UNIFORM_VEC4S = 27;
/** relief height (piece units) of a stamp at depth 1 */
export const STAMP_MAX_HEIGHT = 0.02;

export interface PiecePlan {
  id: string;
  sdf: SdfField;
  /** SDF erosion (piece units) */
  inset: number;
  /** pixel (x+0.5, y+0.5) → piece-local: [a, b, c, d, e, f] */
  inv: [number, number, number, number, number, number];
  /** piece units per output pixel */
  pxLocal: number;
  cos: number;
  sin: number;
  bevel: number;
  /** thickness × bevelStrength */
  heightScale: number;
  shininess: number;
  specScale: number;
  ao: number;
  base: RGB;
  baseWeight: number;
  spots: { x: number; y: number; r: number; i: number; color: RGB }[];
  shadowOffset: [number, number];
  shadowBlur: number;
  shadowOpacity: number;
  shadowColor: RGB; // sRGB
  /** glyph SDF (EMPTY_STAMP when the piece has no letter) */
  stamp: SdfField;
  /** signed relief height, piece units (< 0 pressed in, 0 = none) */
  stampHeight: number;
  /** width of the stamp's walls, piece units */
  stampBevel: number;
  /** 0–1 darkening inside the letter */
  stampInk: number;
  /** TEXTURE_KIND id (0 = untextured; every term below is then inert) */
  texKind: number;
  texSeed: number;
  /** grain direction in piece-local space */
  texCos: number;
  texSin: number;
  texScale: number;
  /** height-gradient gain of the texture bump */
  bumpAmp: number;
  /** albedo variation, multiplied by the texture height */
  albedoAmp: number;
  /** 0 = dielectric, 1 = metal */
  metal: number;
  /** weight of the environment reflection */
  envAmount: number;
  /** screen direction towards the light, used to orient the environment */
  envDir: [number, number];
}

export interface RenderPlan {
  width: number;
  height: number;
  /** opaque background in sRGB, or null for transparent */
  background: RGB | null;
  shadowEnabled: boolean;
  light: [number, number, number];
  half: [number, number, number];
  intensity: number;
  ambient: number;
  specular: number;
  flatDiffuse: number;
  pieces: PiecePlan[];
  /** stable key of everything that affects the image */
  key: string;
}

const norm3 = (v: [number, number, number]): [number, number, number] => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export interface PlanOptions {
  /** output size in pixels (defaults to description size) */
  size?: number;
  /** override SDF resolution */
  sdfResolution?: number;
  /** force a transparent background (export option) */
  transparent?: boolean;
  cache?: SdfCache;
}

export function sdfResolutionFor(desc: PuzzleIconDescription, size: number): number {
  return recommendedSdfResolution(size, desc.pieces[0]?.transform.scale ?? 0.5);
}

export function buildRenderPlan(desc: PuzzleIconDescription, o: PlanOptions = {}): RenderPlan {
  const size = o.size ?? desc.size;
  const res = o.sdfResolution ?? sdfResolutionFor(desc, size);
  const cache = o.cache ?? sharedSdfCache;
  const light = norm3(desc.lighting.direction);
  const half = norm3([light[0], light[1], light[2] + 1]);
  const transparent = o.transparent || desc.background === "transparent";
  const ll = Math.hypot(light[0], light[1]);
  const envDir: [number, number] = ll > 1e-3 ? [light[0] / ll, light[1] / ll] : [0, -1];

  const pieces: PiecePlan[] = desc.pieces.map((p) => {
    const t = p.transform;
    const m = p.material;
    const cs = Math.cos(t.rotation);
    const sn = Math.sin(t.rotation);
    // local = pivot + R(-θ)·((px/size) − T)/s
    const k = 1 / (t.scale * size);
    const a = cs * k;
    const b = sn * k;
    const d = -sn * k;
    const e = cs * k;
    const c = t.pivot[0] - (cs * t.x + sn * t.y) / t.scale;
    const f = t.pivot[1] - (-sn * t.x + cs * t.y) / t.scale;
    const pxLocal = k;
    const so = desc.shadow.offset;
    const g = gradientToLinear(p.gradient);
    const rough = m.roughness;
    const st = desc.stamp;
    const stamp = p.stamp
      ? stampCache.get(p.stamp, { font: st.font, weight: st.weight, size: st.size, resolution: stampResolution(res, st.size) })
      : EMPTY_STAMP;
    const hasStamp = stamp !== EMPTY_STAMP;
    const look = TEXTURE_LOOKS[m.texture];
    const textured = m.texture !== "none";
    return {
      id: p.id,
      sdf: cache.get(p.geometryKey, p.path, res),
      inset: p.inset,
      inv: [a, b, c, d, e, f],
      pxLocal,
      cos: cs,
      sin: sn,
      // small-size tuning: keep the bevel at least ~1.25 px wide
      bevel: Math.max(m.bevelWidth, 1.25 * pxLocal),
      heightScale: m.thickness * m.bevelStrength,
      shininess: (6 + 42 * (1 - rough) * (1 - rough)) * look.shininess,
      specScale: (m.specularIntensity / 0.3) * look.specular,
      ao: m.ambientOcclusion,
      base: g.base,
      baseWeight: g.baseWeight,
      spots: g.spots.slice(0, MAX_SPOTS).map((s) => ({
        x: s.position[0],
        y: s.position[1],
        r: s.radius,
        i: s.intensity,
        color: s.color,
      })),
      shadowOffset: [(cs * so[0] + sn * so[1]) / t.scale, (-sn * so[0] + cs * so[1]) / t.scale],
      shadowBlur: Math.max(desc.shadow.blur / t.scale, 1.5 * pxLocal),
      shadowOpacity: desc.shadow.opacity,
      shadowColor: hexToSrgb(desc.shadow.color),
      stamp,
      stampHeight: hasStamp ? (st.style === "emboss" ? 1 : -1) * st.depth * STAMP_MAX_HEIGHT : 0,
      // walls scale with the letter; never narrower than ~1 px
      stampBevel: Math.max(0.035 * st.size, 0.9 * pxLocal),
      stampInk: hasStamp ? st.ink : 0,
      texKind: TEXTURE_KIND[m.texture],
      texSeed: m.textureSeed,
      texCos: Math.cos(m.textureAngle),
      texSin: Math.sin(m.textureAngle),
      texScale: m.textureScale,
      bumpAmp: textured ? m.textureStrength * look.bump * m.textureScale : 0,
      albedoAmp: textured ? m.textureStrength * look.albedo : 0,
      metal: look.metal,
      envAmount: look.env,
      envDir,
    };
  });

  return {
    width: size,
    height: size,
    background: transparent ? null : hexToSrgb(desc.background),
    shadowEnabled: desc.shadow.enabled && desc.shadow.opacity > 0,
    light,
    half,
    intensity: desc.lighting.intensity,
    ambient: desc.lighting.ambient,
    specular: desc.lighting.specular,
    flatDiffuse: desc.lighting.ambient + desc.lighting.intensity * Math.max(light[2], 0),
    pieces,
    key: `${JSON.stringify(desc.options)}|${size}|${res}|${transparent ? "t" : "o"}`,
  };
}

/** Pack a piece into UNIFORM_VEC4S vec4s (shared by WGSL and GLSL). */
export function packPieceUniforms(plan: RenderPlan, p: PiecePlan, out = new Float32Array(UNIFORM_VEC4S * 4)): Float32Array {
  const v = (i: number, x: number, y: number, z: number, w: number) => {
    out[i * 4] = x;
    out[i * 4 + 1] = y;
    out[i * 4 + 2] = z;
    out[i * 4 + 3] = w;
  };
  v(0, p.inv[0], p.inv[1], p.inv[2], 0);
  v(1, p.inv[3], p.inv[4], p.inv[5], 0);
  v(2, p.sdf.originX, p.sdf.originY, p.sdf.texel, p.pxLocal);
  v(3, p.sdf.width, p.sdf.height, p.cos, p.sin);
  v(4, p.bevel, p.heightScale, p.shininess, p.specScale);
  v(5, p.ao, p.shadowOpacity, p.shadowBlur, p.inset);
  v(6, p.shadowOffset[0], p.shadowOffset[1], p.spots.length, p.baseWeight);
  v(7, p.base[0], p.base[1], p.base[2], 0);
  v(8, p.shadowColor[0], p.shadowColor[1], p.shadowColor[2], 0);
  for (let i = 0; i < MAX_SPOTS; i++) {
    const s = p.spots[i];
    v(9 + i, s?.x ?? 0, s?.y ?? 0, s?.r ?? 1, s?.i ?? 0);
    v(14 + i, s?.color[0] ?? 0, s?.color[1] ?? 0, s?.color[2] ?? 0, 0);
  }
  v(19, plan.light[0], plan.light[1], plan.light[2], plan.intensity);
  v(20, plan.ambient, plan.specular, plan.flatDiffuse, 0);
  const flatSpec = Math.pow(Math.max(plan.half[2], 0), p.shininess);
  v(21, plan.half[0], plan.half[1], plan.half[2], flatSpec);
  v(22, p.stamp.originX, p.stamp.originY, p.stamp.texel, p.stampInk);
  v(23, p.stamp.width, p.stamp.height, p.stampHeight, p.stampBevel);
  v(24, p.texKind, p.texSeed, p.texCos, p.texSin);
  v(25, p.bumpAmp, p.albedoAmp, p.texScale, p.envAmount);
  v(26, p.metal, p.envDir[0], p.envDir[1], 0);
  return out;
}

// ---------------------------------------------------------------------------
// Reference shading (mirrors packages/renderer/shaders/puzzle.wgsl)

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Interleaved-gradient-noise dither in [-0.5, 0.5). */
export function ditherNoise(x: number, y: number): number {
  const f = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
  return (f % 1) - 0.5;
}

export function toLocal(p: PiecePlan, px: number, py: number): [number, number] {
  const x = px + 0.5;
  const y = py + 0.5;
  return [p.inv[0] * x + p.inv[1] * y + p.inv[2], p.inv[3] * x + p.inv[4] * y + p.inv[5]];
}

/** Premultiplied sRGB RGBA (0..1) of the soft shadow of a piece. */
export function shadeShadow(p: PiecePlan, px: number, py: number): [number, number, number, number] {
  const [lx, ly] = toLocal(p, px, py);
  const d = sampleSdf(p.sdf, lx - p.shadowOffset[0], ly - p.shadowOffset[1]) - p.inset;
  const a = p.shadowOpacity * smoothstep(-p.shadowBlur, p.shadowBlur, d);
  return [p.shadowColor[0] * a, p.shadowColor[1] * a, p.shadowColor[2] * a, a];
}

/** Premultiplied sRGB RGBA (0..1) of the lit piece surface. */
export function shadeSurface(plan: RenderPlan, p: PiecePlan, px: number, py: number): [number, number, number, number] {
  const [lx, ly] = toLocal(p, px, py);
  const d = sampleSdf(p.sdf, lx, ly) - p.inset;
  const coverage = clamp01(d / p.pxLocal + 0.5);

  // central differences of the SDF (piece-local gradient)
  const e = Math.max(p.sdf.texel, 0.5 * p.pxLocal);
  const gxL = (sampleSdf(p.sdf, lx + e, ly) - sampleSdf(p.sdf, lx - e, ly)) / (2 * e);
  const gyL = (sampleSdf(p.sdf, lx, ly + e) - sampleSdf(p.sdf, lx, ly - e)) / (2 * e);
  // rotate into screen space
  const gx = p.cos * gxL - p.sin * gyL;
  const gy = p.sin * gxL + p.cos * gyL;

  // h = H·smoothstep(0, b, d)  →  ∂h/∂d = H·6t(1−t)/b
  const t = clamp01(d / p.bevel);
  const dh = (p.heightScale * 6 * t * (1 - t)) / p.bevel;

  // letter stamp: second height field h_s = height · smoothstep(0, w, d_s).
  // The walls sit inside the letter's edge, so nothing outside it changes;
  // faded in over the bevel so it never touches the outline.
  const st = p.stamp;
  const ds = sampleSdf(st, lx, ly);
  const es = Math.max(st.texel, 0.5 * p.pxLocal);
  const sxL = (sampleSdf(st, lx + es, ly) - sampleSdf(st, lx - es, ly)) / (2 * es);
  const syL = (sampleSdf(st, lx, ly + es) - sampleSdf(st, lx, ly - es)) / (2 * es);
  const sgx = p.cos * sxL - p.sin * syL;
  const sgy = p.sin * sxL + p.cos * syL;
  const ts = clamp01(ds / p.stampBevel);
  const inner = smoothstep(0, p.bevel, d);
  const dhs = (inner * p.stampHeight * 6 * ts * (1 - ts)) / p.stampBevel;
  const letter = inner * ts * ts * (3 - 2 * ts);

  // surface texture: bump from a height field in grain-aligned coordinates
  let tgx = 0;
  let tgy = 0;
  let alb = 1;
  if (p.texKind !== 0) {
    const ax = p.texCos * lx + p.texSin * ly;
    const ay = -p.texSin * lx + p.texCos * ly;
    const [hv, hax, hay] = texHeight(p.texKind, ax, ay, p.texScale, p.texSeed, p.pxLocal);
    const glx = p.texCos * hax - p.texSin * hay;
    const gly = p.texSin * hax + p.texCos * hay;
    tgx = p.bumpAmp * (p.cos * glx - p.sin * gly);
    tgy = p.bumpAmp * (p.sin * glx + p.cos * gly);
    alb = Math.max(1 + p.albedoAmp * hv, 0);
  }

  let nx = -dh * gx - dhs * sgx - tgx;
  let ny = -dh * gy - dhs * sgy - tgy;
  let nz = 1;
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl;
  ny /= nl;
  nz /= nl;

  const L = plan.light;
  const ndl = Math.max(nx * L[0] + ny * L[1] + nz * L[2], 0);
  const diffuse = (plan.ambient + plan.intensity * ndl) / plan.flatDiffuse;
  const H = plan.half;
  const ndh = Math.max(nx * H[0] + ny * H[1] + nz * H[2], 0);
  const flatSpec = Math.pow(Math.max(H[2], 0), p.shininess);
  const spec = plan.specular * p.specScale * Math.max(Math.pow(ndh, p.shininess) - flatSpec, 0);
  const ao = 1 - p.ao * 0.6 * (1 - smoothstep(0, p.bevel * 0.9, d));

  // diffuse gradient (linear RGB)
  let r = p.base[0] * p.baseWeight;
  let g = p.base[1] * p.baseWeight;
  let b = p.base[2] * p.baseWeight;
  let ws = p.baseWeight;
  for (const s of p.spots) {
    const dx = lx - s.x;
    const dy = ly - s.y;
    const w = s.i * Math.exp(-(dx * dx + dy * dy) / (2 * s.r * s.r));
    r += s.color[0] * w;
    g += s.color[1] * w;
    b += s.color[2] * w;
    ws += w;
  }
  const inkK = (1 - 0.45 * p.stampInk * letter) * alb;
  r = (r / ws) * inkK;
  g = (g / ws) * inkK;
  b = (b / ws) * inkK;

  const shade = diffuse * ao;
  const n = ditherNoise(px, py) / 255;
  let lit = (c: number) => c * shade + spec * (0.8 + 0.2 * c);
  if (p.texKind !== 0) {
    // metals: little diffuse, highlight tinted by the base color, plus a
    // reflected studio environment that also drifts across the flat face
    const qx = lx - 0.5;
    const qy = ly - 0.5;
    const ex = 0.8 * 2 * nz * nx + 0.6 * (p.cos * qx - p.sin * qy);
    const ey = 0.8 * 2 * nz * ny + 0.6 * (p.sin * qx + p.cos * qy);
    const env = p.envAmount * envLight(ex * p.envDir[0] + ey * p.envDir[1]) * ao;
    const dk = shade * (1 - 0.85 * p.metal);
    const m = p.metal;
    lit = (c: number) => c * (dk + env) + spec * ((0.8 + 0.2 * c) * (1 - m) + m * (0.3 + 0.9 * c));
  }
  const out = (c: number) => clamp01(linearToSrgbChannel(lit(c)) + n) * coverage;
  return [out(r), out(g), out(b), coverage];
}

