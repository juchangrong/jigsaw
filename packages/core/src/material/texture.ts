/**
 * Procedural surface textures (TypeScript reference).
 *
 * Mirrored line for line by `texHeight` and its helpers in
 * packages/renderer/shaders/puzzle.wgsl and puzzle.frag.glsl. The lattice
 * hash works on 32-bit integers and keeps 24 bits, so CPU and GPU see the
 * same lattice values exactly; only the interpolation is subject to float
 * precision.
 */
import type { SurfaceTexture } from "../types";

/** Shader-side texture id. */
export const TEXTURE_KIND: Record<SurfaceTexture, number> = {
  none: 0,
  paper: 1,
  linen: 2,
  frosted: 3,
  wood: 4,
  brushedMetal: 5,
  polishedMetal: 6,
};

export interface TextureLook {
  /** height-gradient gain at strength 1 (normal tilt ≈ bump × frequency) */
  bump: number;
  /** albedo variation at strength 1 */
  albedo: number;
  /** multipliers on the material's Blinn-Phong exponent and specular */
  shininess: number;
  specular: number;
  /** 0 = dielectric, 1 = metal (tinted highlight, little diffuse) */
  metal: number;
  /** weight of the environment reflection */
  env: number;
}

export const TEXTURE_LOOKS: Record<SurfaceTexture, TextureLook> = {
  none: { bump: 0, albedo: 0, shininess: 1, specular: 1, metal: 0, env: 0 },
  paper: { bump: 0.0035, albedo: 0.1, shininess: 0.35, specular: 0.3, metal: 0, env: 0 },
  linen: { bump: 0.0022, albedo: 0.12, shininess: 0.35, specular: 0.3, metal: 0, env: 0 },
  frosted: { bump: 0.002, albedo: 0.04, shininess: 0.3, specular: 0.7, metal: 0, env: 0 },
  wood: { bump: 0.0016, albedo: 0.22, shininess: 0.8, specular: 0.6, metal: 0, env: 0 },
  brushedMetal: { bump: 0.0016, albedo: 0.16, shininess: 1.5, specular: 1.2, metal: 1, env: 1 },
  polishedMetal: { bump: 0.0012, albedo: 0, shininess: 3, specular: 1.6, metal: 1, env: 1.05 },
};

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Lattice value in [0, 1) with 24-bit resolution. */
export function texHash(ix: number, iy: number, s: number): number {
  let h = Math.imul(ix, 0x8da6b343) ^ Math.imul(iy, 0xd8163841) ^ Math.imul(s, 0xcb1ab31f);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 8) / 16777216;
}

type V3 = [number, number, number];

/** Value noise in [-1, 1] with its analytic gradient. */
export function valueNoise(x: number, y: number, s: number): V3 {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const dux = 6 * fx * (1 - fx);
  const duy = 6 * fy * (1 - fy);
  const a = texHash(ix, iy, s);
  const b = texHash(ix + 1, iy, s);
  const c = texHash(ix, iy + 1, s);
  const d = texHash(ix + 1, iy + 1, s);
  const k = a - b - c + d;
  const v = a + (b - a) * ux + (c - a) * uy + k * ux * uy;
  return [2 * v - 1, 2 * dux * (b - a + k * uy), 2 * duy * (c - a + k * ux)];
}

/**
 * Fractal sum of `oct` octaves. `fpx` is lattice cells per output pixel at
 * the first octave; octaves finer than ~0.5 cells/px fade out, so a texture
 * averages to flat instead of aliasing at small sizes.
 */
function fbm(x: number, y: number, s: number, oct: number, fpx: number): V3 {
  let v = 0;
  let dx = 0;
  let dy = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let k = 0; k < oct; k++) {
    const w = amp * (1 - smooth(0.5, 1, fpx * f));
    const n = valueNoise(x * f, y * f, s + k);
    v += w * n[0];
    dx += w * f * n[1];
    dy += w * f * n[2];
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return [v / norm, dx / norm, dy / norm];
}

/** fbm stretched by (fx, fy) cells per piece unit; gradient w.r.t. a. */
function texLayer(ax: number, ay: number, fx: number, fy: number, s: number, oct: number, px: number): V3 {
  const n = fbm(ax * fx, ay * fy, s, oct, Math.max(fx, fy) * px);
  return [n[0], n[1] * fx, n[2] * fy];
}

/**
 * Height field of a texture at grain-aligned coordinates `a` (piece units),
 * roughly in [-1, 1], with its gradient w.r.t. a. `sc` is the grain scale,
 * `s` the lattice seed and `px` piece units per output pixel.
 */
export function texHeight(kind: number, ax: number, ay: number, sc: number, s: number, px: number): V3 {
  const q = 1 / sc;
  if (kind === 1) {
    const b = texLayer(ax, ay, 70 * q, 70 * q, s, 4, px);
    const f1 = texLayer(ax, ay, 10 * q, 140 * q, s + 8, 2, px);
    const f2 = texLayer(ax, ay, 140 * q, 10 * q, s + 16, 2, px);
    return [0.6 * b[0] + 0.2 * (f1[0] + f2[0]), 0.6 * b[1] + 0.2 * (f1[1] + f2[1]), 0.6 * b[2] + 0.2 * (f1[2] + f2[2])];
  }
  if (kind === 2) {
    const l1 = texLayer(ax, ay, 14 * q, 160 * q, s, 2, px);
    const l2 = texLayer(ax, ay, 160 * q, 14 * q, s + 8, 2, px);
    return [0.5 * (l1[0] + l2[0]), 0.5 * (l1[1] + l2[1]), 0.5 * (l1[2] + l2[2])];
  }
  if (kind === 3) {
    const g = texLayer(ax, ay, 150 * q, 150 * q, s, 3, px);
    const c = texLayer(ax, ay, 30 * q, 30 * q, s + 8, 2, px);
    return [0.7 * g[0] + 0.3 * c[0], 0.7 * g[1] + 0.3 * c[1], 0.7 * g[2] + 0.3 * c[2]];
  }
  if (kind === 4) {
    // growth rings: sin of a warped coordinate, faded before they alias
    const warp = texLayer(ax, ay, 1.5 * q, 6 * q, s, 3, px);
    const rf = 12 * q;
    const w = ay * rf + 1.4 * warp[0];
    const fade = 0.7 * (1 - smooth(0.25, 0.5, rf * px));
    const ph = 6.283185307 * (w - Math.floor(w));
    const ring = fade * Math.sin(ph);
    const dr = fade * 6.283185307 * Math.cos(ph);
    const pores = texLayer(ax, ay, 4 * q, 110 * q, s + 8, 2, px);
    return [ring + 0.3 * pores[0], dr * 1.4 * warp[1] + 0.3 * pores[1], dr * (rf + 1.4 * warp[2]) + 0.3 * pores[2]];
  }
  if (kind === 5) {
    const s1 = texLayer(ax, ay, 2 * q, 320 * q, s, 3, px);
    const s2 = texLayer(ax, ay, 1 * q, 60 * q, s + 8, 2, px);
    return [0.6 * s1[0] + 0.4 * s2[0], 0.6 * s1[1] + 0.4 * s2[1], 0.6 * s1[2] + 0.4 * s2[2]];
  }
  if (kind === 6) return texLayer(ax, ay, 12 * q, 12 * q, s, 2, px);
  return [0, 0, 0];
}

/**
 * Studio environment seen in reflection: a soft gradient towards the light
 * with one bright band and one dark band. `t` is the reflected direction
 * (plus a position term) projected on the light's screen direction.
 */
export function envLight(t: number): number {
  const band = 0.7 * Math.exp(-((t - 0.3) * (t - 0.3)) / 0.015);
  const dark = 0.15 * Math.exp(-((t + 0.35) * (t + 0.35)) / 0.02);
  return 0.15 + 0.6 * smooth(-0.9, 0.9, t) + band - dark;
}
