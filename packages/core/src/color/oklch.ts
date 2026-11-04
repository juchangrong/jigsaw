/** Color conversions: sRGB hex ↔ linear RGB ↔ OKLab ↔ OKLCH. */

export type RGB = [number, number, number];
export type OKLCH = [number, number, number]; // L 0..1, C, h degrees

export function hexToSrgb(hex: string): RGB {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function srgbToHex(c: RGB): string {
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(c[0])}${to(c[1])}${to(c[2])}`.toUpperCase();
}

export const srgbToLinearChannel = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgbChannel = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;

export const srgbToLinear = (c: RGB): RGB => [srgbToLinearChannel(c[0]), srgbToLinearChannel(c[1]), srgbToLinearChannel(c[2])];
export const linearToSrgb = (c: RGB): RGB => [linearToSrgbChannel(c[0]), linearToSrgbChannel(c[1]), linearToSrgbChannel(c[2])];

export function hexToLinear(hex: string): RGB {
  return srgbToLinear(hexToSrgb(hex));
}

export function linearToOklab([r, g, b]: RGB): RGB {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklabToOklch([L, a, b]: RGB): OKLCH {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, Math.hypot(a, b), (h + 360) % 360];
}

export function oklchToOklab([L, C, h]: OKLCH): RGB {
  const r = (h * Math.PI) / 180;
  return [L, C * Math.cos(r), C * Math.sin(r)];
}

export const hexToOklch = (hex: string): OKLCH => oklabToOklch(linearToOklab(hexToLinear(hex)));

const inGamut = (c: RGB) => c.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH → sRGB hex, reducing chroma until the color fits the sRGB gamut. */
export function oklchToHex(lch: OKLCH): string {
  let [L, C, h] = lch;
  L = Math.min(1, Math.max(0, L));
  let lin = oklabToLinear(oklchToOklab([L, C, h]));
  for (let i = 0; i < 24 && !inGamut(lin); i++) {
    C *= 0.92;
    lin = oklabToLinear(oklchToOklab([L, C, h]));
  }
  return srgbToHex(linearToSrgb(lin.map((v) => Math.min(1, Math.max(0, v))) as RGB));
}

/** Average colors perceptually (in OKLab). */
export function mixOklab(hexes: string[]): string {
  const acc: RGB = [0, 0, 0];
  for (const h of hexes) {
    const lab = linearToOklab(hexToLinear(h));
    acc[0] += lab[0];
    acc[1] += lab[1];
    acc[2] += lab[2];
  }
  const n = hexes.length || 1;
  const lin = oklabToLinear([acc[0] / n, acc[1] / n, acc[2] / n]);
  return srgbToHex(linearToSrgb(lin.map((v) => Math.min(1, Math.max(0, v))) as RGB));
}
