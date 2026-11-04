/**
 * Letter stamp. Node has no canvas, so these tests install a rasterizer that
 * draws a vertical bar (an "I") and check the option handling, the glyph SDF
 * and how the relief is lit by the CPU reference renderer.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  buildRenderPlan,
  buildStampSdf,
  EMPTY_STAMP,
  generatePuzzleIcon,
  resolveOptions,
  sampleSdf,
  setGlyphRasterizer,
  type GlyphRasterizer,
  type PiecePlan,
  type PuzzleIconOptions,
} from "@jigsaw/core";
import { renderPlanCpu } from "../packages/renderer/src/cpu";

/** Bar covering x ∈ [0.4, 0.6]·n, y ∈ [0.19, 0.81]·n with soft 1-texel edges. */
const bar: GlyphRasterizer = ({ size: n }) => {
  const alpha = new Float32Array(n * n);
  const cov = (v: number, lo: number, hi: number) => Math.min(1, Math.max(0, Math.min(v - lo, hi - v) + 0.5));
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) alpha[j * n + i] = cov(i + 0.5, 0.4 * n, 0.6 * n) * cov(j + 0.5, 0.19 * n, 0.81 * n);
  return { alpha, size: n };
};

let previous: GlyphRasterizer;
beforeAll(() => {
  previous = setGlyphRasterizer(bar);
});
afterAll(() => {
  setGlyphRasterizer(previous);
});

const BASE: PuzzleIconOptions = { seed: "stamp-test", size: 256, shadow: { enabled: false } };

function render(o: PuzzleIconOptions) {
  const plan = buildRenderPlan(generatePuzzleIcon(o));
  return { plan, px: renderPlanCpu(plan) };
}

/** piece-local → pixel index, inverting the plan's pixel → local transform */
function pixelAt(p: PiecePlan, lx: number, ly: number, w: number): number {
  const [a, b, c, d, e, f] = p.inv;
  const det = a * e - b * d;
  const ux = lx - c;
  const uy = ly - f;
  const x = (e * ux - b * uy) / det - 0.5;
  const y = (-d * ux + a * uy) / det - 0.5;
  return (Math.round(y) * w + Math.round(x)) * 4;
}

const luma = (px: Uint8ClampedArray, i: number) => 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;

describe("stamp options", () => {
  it("defaults to no stamp", () => {
    const r = resolveOptions({ seed: 1 });
    expect(r.stamp.text).toBe("");
    expect(generatePuzzleIcon({ seed: 1 }).pieces.every((p) => p.stamp === "")).toBe(true);
  });

  it("keeps one character per piece and drops whitespace", () => {
    expect(resolveOptions({ seed: 1, stamp: { text: "AB" } }).stamp.text).toBe("A");
    const d = generatePuzzleIcon({ seed: 1, layout: "grid", pieceCount: 4, stamp: { text: "a b c d e" } });
    expect(d.pieces.map((p) => p.stamp)).toEqual(["a", "b", "c", "d"]);
  });

  it("clamps numeric parameters", () => {
    const s = resolveOptions({ seed: 1, stamp: { text: "A", size: 5, depth: -1, ink: 3, weight: 1234 } }).stamp;
    expect(s).toMatchObject({ size: 0.7, depth: 0, ink: 1, weight: 900, style: "deboss" });
  });
});

describe("glyph SDF", () => {
  it("is positive inside the letter and measures distance in piece units", () => {
    const f = buildStampSdf("I", { font: "x", weight: 700, size: 0.42, resolution: 256 })!;
    expect(f).not.toBeNull();
    const side = 0.42 / 0.62;
    const left = f.originX + 0.4 * side; // left edge of the bar
    expect(sampleSdf(f, 0.5, 0.5)).toBeGreaterThan(0);
    expect(sampleSdf(f, left - 0.05, 0.5)).toBeCloseTo(-0.05, 2);
    expect(sampleSdf(f, left + 0.02, 0.5)).toBeCloseTo(0.02, 2);
    expect(Math.abs(sampleSdf(f, left, 0.5))).toBeLessThan(0.5 * f.texel);
  });
});

describe("stamp rendering", () => {
  const plain = render(BASE);
  const top = 0.5 - (0.42 / 0.62) * 0.31; // top edge of the bar, piece-local
  const bottom = 0.5 + (0.42 / 0.62) * 0.31;

  it("leaves the image unchanged without a letter", () => {
    const empty = render({ ...BASE, stamp: { text: "" } });
    expect(empty.plan.pieces[0]!.stamp).toBe(EMPTY_STAMP);
    expect(Buffer.from(empty.px).equals(Buffer.from(plain.px))).toBe(true);
  });

  it("falls back to no stamp when glyphs cannot be rasterized", () => {
    setGlyphRasterizer(() => null);
    try {
      const r = render({ ...BASE, stamp: { text: "A" } });
      expect(r.plan.pieces[0]!.stamp).toBe(EMPTY_STAMP);
      expect(Buffer.from(r.px).equals(Buffer.from(plain.px))).toBe(true);
    } finally {
      setGlyphRasterizer(bar);
    }
  });

  it("debossed walls: the side facing the light is in shade, the far side is lit", () => {
    const s = render({ ...BASE, stamp: { text: "I", style: "deboss", ink: 0 } });
    const p = s.plan.pieces[0]!;
    // walls run from the edge to w inside it; sample their middle
    const t = pixelAt(p, 0.5, top + p.stampBevel / 2, 256);
    const b = pixelAt(p, 0.5, bottom - p.stampBevel / 2, 256);
    expect(luma(s.px, t) - luma(plain.px, t)).toBeLessThan(-4);
    expect(luma(s.px, b) - luma(plain.px, b)).toBeGreaterThan(4);
    // the floor of the letter is flat: same light as the surface
    const c = pixelAt(p, 0.5, 0.5, 256);
    expect(Math.abs(luma(s.px, c) - luma(plain.px, c))).toBeLessThan(1.5);
  });

  it("embossed walls are lit the other way round", () => {
    const s = render({ ...BASE, stamp: { text: "I", style: "emboss", ink: 0 } });
    const p = s.plan.pieces[0]!;
    const t = pixelAt(p, 0.5, top + p.stampBevel / 2, 256);
    const b = pixelAt(p, 0.5, bottom - p.stampBevel / 2, 256);
    expect(luma(s.px, t) - luma(plain.px, t)).toBeGreaterThan(4);
    expect(luma(s.px, b) - luma(plain.px, b)).toBeLessThan(-4);
  });

  it("leaves no ring outside the letter", () => {
    for (const style of ["deboss", "emboss"] as const) {
      const s = render({ ...BASE, stamp: { text: "I", style, ink: 1 } });
      const p = s.plan.pieces[0]!;
      const px = p.pxLocal;
      // one pixel outside each edge of the bar
      const left = 0.5 - (0.42 / 0.62) * 0.1;
      for (const [x, y] of [
        [0.5, top - 1.5 * px],
        [0.5, bottom + 1.5 * px],
        [left - 1.5 * px, 0.5],
        [1 - left + 1.5 * px, 0.5],
      ] as const) {
        const i = pixelAt(p, x, y, 256);
        expect(Math.abs(luma(s.px, i) - luma(plain.px, i)), `${style} at ${x.toFixed(3)},${y.toFixed(3)}`).toBeLessThan(1);
      }
    }
  });

  it("ink darkens the inside of the letter only", () => {
    const s = render({ ...BASE, stamp: { text: "I", ink: 1 } });
    const p = s.plan.pieces[0]!;
    const c = pixelAt(p, 0.5, 0.5, 256);
    const out = pixelAt(p, 0.3, 0.5, 256);
    // ink 1 scales linear color by 0.55 ≈ 0.76 in sRGB
    expect(luma(s.px, c)).toBeLessThan(luma(plain.px, c) * 0.82);
    expect(Math.abs(luma(s.px, out) - luma(plain.px, out))).toBeLessThan(1);
  });

  it("is deterministic", () => {
    const a = render({ ...BASE, stamp: { text: "I" } });
    const b = render({ ...BASE, stamp: { text: "I" } });
    expect(Buffer.from(a.px).equals(Buffer.from(b.px))).toBe(true);
  });
});
