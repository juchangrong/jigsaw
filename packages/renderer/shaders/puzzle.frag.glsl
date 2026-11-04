#version 300 es
// WebGL2 port of puzzle.wgsl (same math, same uniform layout).
precision highp float;
precision highp int;
precision highp sampler2D;

uniform vec4 u[22];
uniform sampler2D sdfTex;
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
#define LIGHT u[19]
#define LIGHT2 u[20]
#define HALFV u[21]

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
  vec3 n = normalize(vec3(-dh * g, 1.0));

  vec3 L = LIGHT.xyz;
  float ndl = max(dot(n, L), 0.0);
  float diffuse = (LIGHT2.x + LIGHT.w * ndl) / LIGHT2.z;
  float ndh = max(dot(n, HALFV.xyz), 1e-6);
  float spec = LIGHT2.y * MAT.w * max(pow(ndh, MAT.z) - HALFV.w, 0.0);
  float ao = 1.0 - MAT2.x * 0.6 * (1.0 - smoothstep(0.0, bevel * 0.9, d));

  vec3 col = BASE.rgb * SHADOW.w;
  float ws = SHADOW.w;
  int count = int(SHADOW.z);
  for (int i = 0; i < 5; i++) {
    vec4 s = u[9 + i];
    vec2 dv = l - s.xy;
    float w = i < count ? s.w * exp(-dot(dv, dv) / (2.0 * s.z * s.z)) : 0.0;
    col += u[14 + i].rgb * w;
    ws += w;
  }
  col /= ws;

  vec3 lit = col * (diffuse * ao) + spec * (0.8 + 0.2 * col);
  vec3 srgb = clamp(linearToSrgb(lit) + dither(floor(frag)) / 255.0, vec3(0.0), vec3(1.0));
  outColor = vec4(srgb * coverage, coverage);
}
