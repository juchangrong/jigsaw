// Puzzle-piece material shader.
// Mirrors the TypeScript reference in packages/core/src/shading.ts.
// Output: premultiplied, sRGB-encoded RGBA. Lighting is evaluated in linear RGB.

struct Piece {
  inv0: vec4f,        // pixel → local, row 0 (a, b, c)
  inv1: vec4f,        // pixel → local, row 1 (d, e, f)
  sdfInfo: vec4f,     // originX, originY, texel, pxLocal
  sdfSize: vec4f,     // width, height, cos θ, sin θ
  mat: vec4f,         // bevel, heightScale, shininess, specScale
  mat2: vec4f,        // ao, shadowOpacity, shadowBlur, inset
  shadow: vec4f,      // shadowOffset.xy, spotCount, baseWeight
  base: vec4f,        // base color (linear)
  shadowColor: vec4f, // shadow color (sRGB)
  spotPos: array<vec4f, 5>,   // x, y, radius, intensity
  spotColor: array<vec4f, 5>, // linear RGB
  light: vec4f,       // L.xyz, intensity
  light2: vec4f,      // ambient, specular, flatDiffuse, -
  halfV: vec4f,       // H.xyz, flatSpec
  stampInfo: vec4f,   // originX, originY, texel, ink
  stampSize: vec4f,   // width, height, signed relief height, wall width
};

@group(0) @binding(0) var<uniform> P: Piece;
@group(0) @binding(1) var sdfTex: texture_2d<f32>;
@group(0) @binding(2) var stampTex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}

// Manual bilinear filtering (r32float is not filterable everywhere).
fn sdfAt(p: vec2f) -> f32 {
  let size = P.sdfSize.xy;
  let uv = clamp((p - P.sdfInfo.xy) / P.sdfInfo.z - 0.5, vec2f(0.0), size - 1.0);
  let i = min(floor(uv), size - 2.0);
  let f = uv - i;
  let ii = vec2i(i);
  let a = textureLoad(sdfTex, ii, 0).r;
  let b = textureLoad(sdfTex, ii + vec2i(1, 0), 0).r;
  let c = textureLoad(sdfTex, ii + vec2i(0, 1), 0).r;
  let d = textureLoad(sdfTex, ii + vec2i(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn stampAt(p: vec2f) -> f32 {
  let size = P.stampSize.xy;
  let uv = clamp((p - P.stampInfo.xy) / P.stampInfo.z - 0.5, vec2f(0.0), size - 1.0);
  let i = min(floor(uv), size - 2.0);
  let f = uv - i;
  let ii = vec2i(i);
  let a = textureLoad(stampTex, ii, 0).r;
  let b = textureLoad(stampTex, ii + vec2i(1, 0), 0).r;
  let c = textureLoad(stampTex, ii + vec2i(0, 1), 0).r;
  let d = textureLoad(stampTex, ii + vec2i(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

fn toLocal(frag: vec2f) -> vec2f {
  let q = vec3f(frag, 1.0);
  return vec2f(dot(P.inv0.xyz, q), dot(P.inv1.xyz, q));
}

fn linearToSrgb(c: vec3f) -> vec3f {
  let lo = c * 12.92;
  let hi = 1.055 * pow(max(c, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return select(hi, lo, c <= vec3f(0.0031308));
}

fn dither(px: vec2f) -> f32 {
  let f = 52.9829189 * fract(0.06711056 * px.x + 0.00583715 * px.y);
  return fract(f) - 0.5;
}

@fragment
fn fsShadow(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let l = toLocal(pos.xy);
  let d = sdfAt(l - P.shadow.xy) - P.mat2.w;
  let blur = P.mat2.z;
  let a = P.mat2.y * smoothstep(-blur, blur, d);
  return vec4f(P.shadowColor.rgb * a, a);
}

@fragment
fn fsSurface(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let l = toLocal(pos.xy);
  let pxLocal = P.sdfInfo.w;
  let d = sdfAt(l) - P.mat2.w; // eroded by the inset gap
  let coverage = clamp(d / pxLocal + 0.5, 0.0, 1.0);

  // Central differences of the SDF. Evaluated unconditionally so control
  // flow stays uniform; the step is in piece units, so the normal scale is
  // independent of SDF and output resolution.
  let e = max(P.sdfInfo.z, 0.5 * pxLocal);
  let gxL = (sdfAt(l + vec2f(e, 0.0)) - sdfAt(l - vec2f(e, 0.0))) / (2.0 * e);
  let gyL = (sdfAt(l + vec2f(0.0, e)) - sdfAt(l - vec2f(0.0, e))) / (2.0 * e);
  let cs = P.sdfSize.z;
  let sn = P.sdfSize.w;
  let g = vec2f(cs * gxL - sn * gyL, sn * gxL + cs * gyL);

  // h = H · smoothstep(0, b, d)
  let bevel = P.mat.x;
  let t = clamp(d / bevel, 0.0, 1.0);
  let dh = P.mat.y * 6.0 * t * (1.0 - t) / bevel;

  // Letter stamp: h_s = height · smoothstep(0, w, d_s). Walls sit inside the
  // letter's edge (no ring outside it); faded in over the bevel.
  let ds = stampAt(l);
  let es = max(P.stampInfo.z, 0.5 * pxLocal);
  let sxL = (stampAt(l + vec2f(es, 0.0)) - stampAt(l - vec2f(es, 0.0))) / (2.0 * es);
  let syL = (stampAt(l + vec2f(0.0, es)) - stampAt(l - vec2f(0.0, es))) / (2.0 * es);
  let sg = vec2f(cs * sxL - sn * syL, sn * sxL + cs * syL);
  let sw = P.stampSize.w;
  let ts = clamp(ds / sw, 0.0, 1.0);
  let inner = smoothstep(0.0, bevel, d);
  let dhs = inner * P.stampSize.z * 6.0 * ts * (1.0 - ts) / sw;
  let letter = inner * ts * ts * (3.0 - 2.0 * ts);

  let n = normalize(vec3f(-dh * g - dhs * sg, 1.0));

  let L = P.light.xyz;
  let ndl = max(dot(n, L), 0.0);
  let diffuse = (P.light2.x + P.light.w * ndl) / P.light2.z;
  let ndh = max(dot(n, P.halfV.xyz), 1e-6);
  let spec = P.light2.y * P.mat.w * max(pow(ndh, P.mat.z) - P.halfV.w, 0.0);
  let ao = 1.0 - P.mat2.x * 0.6 * (1.0 - smoothstep(0.0, bevel * 0.9, d));

  // Diffuse gradient: normalized Gaussian spots + base color (linear RGB).
  var col = P.base.rgb * P.shadow.w;
  var ws = P.shadow.w;
  let count = i32(P.shadow.z);
  for (var i = 0; i < 5; i++) {
    let s = P.spotPos[i];
    let dv = l - s.xy;
    let w = select(0.0, s.w * exp(-dot(dv, dv) / (2.0 * s.z * s.z)), i < count);
    col += P.spotColor[i].rgb * w;
    ws += w;
  }
  col = col / ws * (1.0 - 0.45 * P.stampInfo.w * letter);

  let lit = col * (diffuse * ao) + spec * (0.8 + 0.2 * col);
  let srgb = clamp(linearToSrgb(lit) + dither(floor(pos.xy)) / 255.0, vec3f(0.0), vec3f(1.0));
  return vec4f(srgb * coverage, coverage);
}
