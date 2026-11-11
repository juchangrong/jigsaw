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
  shadow: vec4f,      // shadowOffset.xy, -, -
  base: vec4f,        // piece colour (linear)
  shadowColor: vec4f, // shadow color (sRGB)
  light: vec4f,       // L.xyz, intensity
  light2: vec4f,      // ambient, specular, flatDiffuse, -
  halfV: vec4f,       // H.xyz, flatSpec
  stampInfo: vec4f,   // originX, originY, texel, ink
  stampSize: vec4f,   // width, height, signed relief height, wall width
  tex: vec4f,         // texture kind, lattice seed, grain cos, grain sin
  tex2: vec4f,        // bump gain, albedo gain, grain scale, environment weight
  tex3: vec4f,        // metal, light direction on screen (x, y), -
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

// Surface textures: mirrors packages/core/src/material/texture.ts.
fn texHash(i: vec2i, s: u32) -> f32 {
  var h = (bitcast<u32>(i.x) * 0x8da6b343u) ^ (bitcast<u32>(i.y) * 0xd8163841u) ^ (s * 0xcb1ab31fu);
  h = (h ^ (h >> 16u)) * 0x7feb352du;
  h = (h ^ (h >> 15u)) * 0x846ca68bu;
  h = h ^ (h >> 16u);
  return f32(h >> 8u) / 16777216.0;
}

fn valueNoise(p: vec2f, s: u32) -> vec3f {
  let fl = floor(p);
  let i = vec2i(fl);
  let f = p - fl;
  let u = f * f * (3.0 - 2.0 * f);
  let du = 6.0 * f * (1.0 - f);
  let a = texHash(i, s);
  let b = texHash(i + vec2i(1, 0), s);
  let c = texHash(i + vec2i(0, 1), s);
  let d = texHash(i + vec2i(1, 1), s);
  let k = a - b - c + d;
  let v = a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y;
  return vec3f(2.0 * v - 1.0, 2.0 * du.x * (b - a + k * u.y), 2.0 * du.y * (c - a + k * u.x));
}

fn fbm(p: vec2f, s: u32, oct: i32, fpx: f32) -> vec3f {
  var acc = vec3f(0.0);
  var amp = 0.5;
  var f = 1.0;
  var norm = 0.0;
  for (var k = 0; k < oct; k++) {
    let w = amp * (1.0 - smoothstep(0.5, 1.0, fpx * f));
    let n = valueNoise(p * f, s + u32(k));
    acc += w * vec3f(n.x, f * n.y, f * n.z);
    norm += amp;
    amp *= 0.5;
    f *= 2.0;
  }
  return acc / norm;
}

fn texLayer(a: vec2f, fx: f32, fy: f32, s: u32, oct: i32, px: f32) -> vec3f {
  let n = fbm(a * vec2f(fx, fy), s, oct, max(fx, fy) * px);
  return vec3f(n.x, n.y * fx, n.z * fy);
}

fn texHeight(kind: i32, a: vec2f, sc: f32, s: u32, px: f32) -> vec3f {
  let q = 1.0 / sc;
  if (kind == 1) {
    let b = texLayer(a, 70.0 * q, 70.0 * q, s, 4, px);
    let f1 = texLayer(a, 10.0 * q, 140.0 * q, s + 8u, 2, px);
    let f2 = texLayer(a, 140.0 * q, 10.0 * q, s + 16u, 2, px);
    return 0.6 * b + 0.2 * (f1 + f2);
  }
  if (kind == 2) {
    let l1 = texLayer(a, 14.0 * q, 160.0 * q, s, 2, px);
    let l2 = texLayer(a, 160.0 * q, 14.0 * q, s + 8u, 2, px);
    return 0.5 * (l1 + l2);
  }
  if (kind == 3) {
    return 0.7 * texLayer(a, 150.0 * q, 150.0 * q, s, 3, px) + 0.3 * texLayer(a, 30.0 * q, 30.0 * q, s + 8u, 2, px);
  }
  if (kind == 4) {
    let warp = texLayer(a, 1.5 * q, 6.0 * q, s, 3, px);
    let rf = 12.0 * q;
    let w = a.y * rf + 1.4 * warp.x;
    let fade = 0.7 * (1.0 - smoothstep(0.25, 0.5, rf * px));
    let ph = 6.283185307 * (w - floor(w));
    let dr = fade * 6.283185307 * cos(ph);
    let pores = texLayer(a, 4.0 * q, 110.0 * q, s + 8u, 2, px);
    return vec3f(fade * sin(ph), dr * 1.4 * warp.y, dr * (rf + 1.4 * warp.z)) + 0.3 * pores;
  }
  if (kind == 5) {
    return 0.6 * texLayer(a, 2.0 * q, 320.0 * q, s, 3, px) + 0.4 * texLayer(a, 1.0 * q, 60.0 * q, s + 8u, 2, px);
  }
  if (kind == 6) {
    return texLayer(a, 12.0 * q, 12.0 * q, s, 2, px);
  }
  return vec3f(0.0);
}

fn envLight(t: f32) -> f32 {
  let band = 0.7 * exp(-((t - 0.3) * (t - 0.3)) / 0.015);
  let dark = 0.15 * exp(-((t + 0.35) * (t + 0.35)) / 0.02);
  return 0.15 + 0.6 * smoothstep(-0.9, 0.9, t) + band - dark;
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

  // Surface texture: bump from a height field in grain-aligned coordinates.
  let kind = i32(P.tex.x + 0.5);
  var tg = vec2f(0.0);
  var alb = 1.0;
  if (kind != 0) {
    let tc = P.tex.z;
    let ts2 = P.tex.w;
    let a = vec2f(tc * l.x + ts2 * l.y, -ts2 * l.x + tc * l.y);
    let h = texHeight(kind, a, P.tex2.z, u32(P.tex.y + 0.5), pxLocal);
    let gl = vec2f(tc * h.y - ts2 * h.z, ts2 * h.y + tc * h.z);
    tg = P.tex2.x * vec2f(cs * gl.x - sn * gl.y, sn * gl.x + cs * gl.y);
    alb = max(1.0 + P.tex2.y * h.x, 0.0);
  }

  let n = normalize(vec3f(-dh * g - dhs * sg - tg, 1.0));

  let L = P.light.xyz;
  let ndl = max(dot(n, L), 0.0);
  let diffuse = (P.light2.x + P.light.w * ndl) / P.light2.z;
  let ndh = max(dot(n, P.halfV.xyz), 1e-6);
  let spec = P.light2.y * P.mat.w * max(pow(ndh, P.mat.z) - P.halfV.w, 0.0);
  let ao = 1.0 - P.mat2.x * 0.6 * (1.0 - smoothstep(0.0, bevel * 0.9, d));

  let col = P.base.rgb * ((1.0 - 0.45 * P.stampInfo.w * letter) * alb);

  var lit = col * (diffuse * ao) + spec * (0.8 + 0.2 * col);
  if (kind != 0) {
    // Metals: little diffuse, tinted highlight, reflected studio environment.
    let q = l - vec2f(0.5);
    let ev = 0.8 * 2.0 * n.z * n.xy + 0.6 * vec2f(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
    let env = P.tex2.w * envLight(dot(ev, P.tex3.yz)) * ao;
    let m = P.tex3.x;
    let dk = diffuse * ao * (1.0 - 0.85 * m);
    lit = col * (dk + env) + spec * ((0.8 + 0.2 * col) * (1.0 - m) + m * (0.3 + 0.9 * col));
  }
  let srgb = clamp(linearToSrgb(lit) + dither(floor(pos.xy)) / 255.0, vec3f(0.0), vec3f(1.0));
  return vec4f(srgb * coverage, coverage);
}
