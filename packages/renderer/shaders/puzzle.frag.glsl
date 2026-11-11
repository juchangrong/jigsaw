#version 300 es
// WebGL2 port of puzzle.wgsl (same math, same uniform layout).
precision highp float;
precision highp int;
precision highp sampler2D;

uniform vec4 u[17];
uniform sampler2D sdfTex;
uniform sampler2D stampTex;
uniform float uHeight;
uniform int uMode; // 0 = shadow, 1 = surface

out vec4 outColor;

#define INV0 u[0]
#define INV1 u[1]
#define SDF_INFO u[2]
#define SDF_SIZE u[3]
#define MAT u[4]
#define MAT2 u[5]
#define SHADOW u[6]
#define BASE u[7]
#define SHADOW_COLOR u[8]
#define LIGHT u[9]
#define LIGHT2 u[10]
#define HALFV u[11]
#define STAMP_INFO u[12]
#define STAMP_SIZE u[13]
#define TEX u[14]
#define TEX2 u[15]
#define TEX3 u[16]

float sdfAt(vec2 p) {
  vec2 size = SDF_SIZE.xy;
  vec2 uv = clamp((p - SDF_INFO.xy) / SDF_INFO.z - 0.5, vec2(0.0), size - 1.0);
  vec2 i = min(floor(uv), size - 2.0);
  vec2 f = uv - i;
  ivec2 ii = ivec2(i);
  float a = texelFetch(sdfTex, ii, 0).r;
  float b = texelFetch(sdfTex, ii + ivec2(1, 0), 0).r;
  float c = texelFetch(sdfTex, ii + ivec2(0, 1), 0).r;
  float d = texelFetch(sdfTex, ii + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float stampAt(vec2 p) {
  vec2 size = STAMP_SIZE.xy;
  vec2 uv = clamp((p - STAMP_INFO.xy) / STAMP_INFO.z - 0.5, vec2(0.0), size - 1.0);
  vec2 i = min(floor(uv), size - 2.0);
  vec2 f = uv - i;
  ivec2 ii = ivec2(i);
  float a = texelFetch(stampTex, ii, 0).r;
  float b = texelFetch(stampTex, ii + ivec2(1, 0), 0).r;
  float c = texelFetch(stampTex, ii + ivec2(0, 1), 0).r;
  float d = texelFetch(stampTex, ii + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 toLocal(vec2 frag) {
  vec3 q = vec3(frag, 1.0);
  return vec2(dot(INV0.xyz, q), dot(INV1.xyz, q));
}

vec3 linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(hi, lo, vec3(lessThanEqual(c, vec3(0.0031308))));
}

float dither(vec2 px) {
  float f = 52.9829189 * fract(0.06711056 * px.x + 0.00583715 * px.y);
  return fract(f) - 0.5;
}

// Surface textures: mirrors packages/core/src/material/texture.ts.
float texHash(ivec2 i, uint s) {
  uint h = (uint(i.x) * 0x8da6b343u) ^ (uint(i.y) * 0xd8163841u) ^ (s * 0xcb1ab31fu);
  h = (h ^ (h >> 16u)) * 0x7feb352du;
  h = (h ^ (h >> 15u)) * 0x846ca68bu;
  h = h ^ (h >> 16u);
  return float(h >> 8u) / 16777216.0;
}

vec3 valueNoise(vec2 p, uint s) {
  vec2 fl = floor(p);
  ivec2 i = ivec2(fl);
  vec2 f = p - fl;
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = texHash(i, s);
  float b = texHash(i + ivec2(1, 0), s);
  float c = texHash(i + ivec2(0, 1), s);
  float d = texHash(i + ivec2(1, 1), s);
  float k = a - b - c + d;
  float v = a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y;
  return vec3(2.0 * v - 1.0, 2.0 * du.x * (b - a + k * u.y), 2.0 * du.y * (c - a + k * u.x));
}

vec3 fbm(vec2 p, uint s, int oct, float fpx) {
  vec3 acc = vec3(0.0);
  float amp = 0.5;
  float f = 1.0;
  float norm = 0.0;
  for (int k = 0; k < oct; k++) {
    float w = amp * (1.0 - smoothstep(0.5, 1.0, fpx * f));
    vec3 n = valueNoise(p * f, s + uint(k));
    acc += w * vec3(n.x, f * n.y, f * n.z);
    norm += amp;
    amp *= 0.5;
    f *= 2.0;
  }
  return acc / norm;
}

vec3 texLayer(vec2 a, float fx, float fy, uint s, int oct, float px) {
  vec3 n = fbm(a * vec2(fx, fy), s, oct, max(fx, fy) * px);
  return vec3(n.x, n.y * fx, n.z * fy);
}

vec3 texHeight(int kind, vec2 a, float sc, uint s, float px) {
  float q = 1.0 / sc;
  if (kind == 1) {
    vec3 b = texLayer(a, 70.0 * q, 70.0 * q, s, 4, px);
    vec3 f1 = texLayer(a, 10.0 * q, 140.0 * q, s + 8u, 2, px);
    vec3 f2 = texLayer(a, 140.0 * q, 10.0 * q, s + 16u, 2, px);
    return 0.6 * b + 0.2 * (f1 + f2);
  }
  if (kind == 2) {
    vec3 l1 = texLayer(a, 14.0 * q, 160.0 * q, s, 2, px);
    vec3 l2 = texLayer(a, 160.0 * q, 14.0 * q, s + 8u, 2, px);
    return 0.5 * (l1 + l2);
  }
  if (kind == 3) {
    return 0.7 * texLayer(a, 150.0 * q, 150.0 * q, s, 3, px) + 0.3 * texLayer(a, 30.0 * q, 30.0 * q, s + 8u, 2, px);
  }
  if (kind == 4) {
    vec3 warp = texLayer(a, 1.5 * q, 6.0 * q, s, 3, px);
    float rf = 12.0 * q;
    float w = a.y * rf + 1.4 * warp.x;
    float fade = 0.7 * (1.0 - smoothstep(0.25, 0.5, rf * px));
    float ph = 6.283185307 * (w - floor(w));
    float dr = fade * 6.283185307 * cos(ph);
    vec3 pores = texLayer(a, 4.0 * q, 110.0 * q, s + 8u, 2, px);
    return vec3(fade * sin(ph), dr * 1.4 * warp.y, dr * (rf + 1.4 * warp.z)) + 0.3 * pores;
  }
  if (kind == 5) {
    return 0.6 * texLayer(a, 2.0 * q, 320.0 * q, s, 3, px) + 0.4 * texLayer(a, 1.0 * q, 60.0 * q, s + 8u, 2, px);
  }
  if (kind == 6) {
    return texLayer(a, 12.0 * q, 12.0 * q, s, 2, px);
  }
  return vec3(0.0);
}

float envLight(float t) {
  float band = 0.7 * exp(-((t - 0.3) * (t - 0.3)) / 0.015);
  float dark = 0.15 * exp(-((t + 0.35) * (t + 0.35)) / 0.02);
  return 0.15 + 0.6 * smoothstep(-0.9, 0.9, t) + band - dark;
}

void main() {
  // flip to a top-left origin so pixel coordinates match WebGPU / CPU
  vec2 frag = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  vec2 l = toLocal(frag);

  if (uMode == 0) {
    float d = sdfAt(l - SHADOW.xy) - MAT2.w;
    float blur = MAT2.z;
    float a = MAT2.y * smoothstep(-blur, blur, d);
    outColor = vec4(SHADOW_COLOR.rgb * a, a);
    return;
  }

  float pxLocal = SDF_INFO.w;
  float d = sdfAt(l) - MAT2.w;
  float coverage = clamp(d / pxLocal + 0.5, 0.0, 1.0);

  float e = max(SDF_INFO.z, 0.5 * pxLocal);
  float gxL = (sdfAt(l + vec2(e, 0.0)) - sdfAt(l - vec2(e, 0.0))) / (2.0 * e);
  float gyL = (sdfAt(l + vec2(0.0, e)) - sdfAt(l - vec2(0.0, e))) / (2.0 * e);
  float cs = SDF_SIZE.z;
  float sn = SDF_SIZE.w;
  vec2 g = vec2(cs * gxL - sn * gyL, sn * gxL + cs * gyL);

  float bevel = MAT.x;
  float t = clamp(d / bevel, 0.0, 1.0);
  float dh = MAT.y * 6.0 * t * (1.0 - t) / bevel;

  float ds = stampAt(l);
  float es = max(STAMP_INFO.z, 0.5 * pxLocal);
  float sxL = (stampAt(l + vec2(es, 0.0)) - stampAt(l - vec2(es, 0.0))) / (2.0 * es);
  float syL = (stampAt(l + vec2(0.0, es)) - stampAt(l - vec2(0.0, es))) / (2.0 * es);
  vec2 sg = vec2(cs * sxL - sn * syL, sn * sxL + cs * syL);
  float sw = STAMP_SIZE.w;
  float ts = clamp(ds / sw, 0.0, 1.0);
  float inner = smoothstep(0.0, bevel, d);
  float dhs = inner * STAMP_SIZE.z * 6.0 * ts * (1.0 - ts) / sw;
  float letter = inner * ts * ts * (3.0 - 2.0 * ts);

  int kind = int(TEX.x + 0.5);
  vec2 tg = vec2(0.0);
  float alb = 1.0;
  if (kind != 0) {
    float tc = TEX.z;
    float ts2 = TEX.w;
    vec2 a = vec2(tc * l.x + ts2 * l.y, -ts2 * l.x + tc * l.y);
    vec3 h = texHeight(kind, a, TEX2.z, uint(TEX.y + 0.5), pxLocal);
    vec2 gl = vec2(tc * h.y - ts2 * h.z, ts2 * h.y + tc * h.z);
    tg = TEX2.x * vec2(cs * gl.x - sn * gl.y, sn * gl.x + cs * gl.y);
    alb = max(1.0 + TEX2.y * h.x, 0.0);
  }

  vec3 n = normalize(vec3(-dh * g - dhs * sg - tg, 1.0));

  vec3 L = LIGHT.xyz;
  float ndl = max(dot(n, L), 0.0);
  float diffuse = (LIGHT2.x + LIGHT.w * ndl) / LIGHT2.z;
  float ndh = max(dot(n, HALFV.xyz), 1e-6);
  float spec = LIGHT2.y * MAT.w * max(pow(ndh, MAT.z) - HALFV.w, 0.0);
  float ao = 1.0 - MAT2.x * 0.6 * (1.0 - smoothstep(0.0, bevel * 0.9, d));

  vec3 col = BASE.rgb * ((1.0 - 0.45 * STAMP_INFO.w * letter) * alb);

  vec3 lit = col * (diffuse * ao) + spec * (0.8 + 0.2 * col);
  if (kind != 0) {
    vec2 q = l - vec2(0.5);
    vec2 ev = 0.8 * 2.0 * n.z * n.xy + 0.6 * vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
    float env = TEX2.w * envLight(dot(ev, TEX3.yz)) * ao;
    float m = TEX3.x;
    float dk = diffuse * ao * (1.0 - 0.85 * m);
    lit = col * (dk + env) + spec * ((0.8 + 0.2 * col) * (1.0 - m) + m * (0.3 + 0.9 * col));
  }
  vec3 srgb = clamp(linearToSrgb(lit) + dither(floor(frag)) / 255.0, vec3(0.0), vec3(1.0));
  outColor = vec4(srgb * coverage, coverage);
}
