/**
 * Surface textures on the CPU reference renderer (the shaders mirror it;
 * WebGPU / WebGL2 parity is checked in the playground).
 */
import { describe, expect, it } from "bun:test";
import { buildRenderPlan, generatePuzzleIcon, SURFACE_TEXTURES, texHash, valueNoise, type PuzzleIconOptions, type SurfaceTexture } from "@jigsaw/core";
import { renderPlanCpu } from "../packages/renderer/src/cpu";

const base: PuzzleIconOptions = {
  seed: "texture",
  size: 256,
  palette: ["#7FA6E8"],
  background: "transparent",
};

const render = (texture?: SurfaceTexture, extra: Partial<PuzzleIconOptions> = {}) =>
  renderPlanCpu(buildRenderPlan(generatePuzzleIcon({ ...base, ...extra, material: texture ? { texture } : undefined })));

const lum = (px: Uint8ClampedArray, i: number) => 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;

/** Luminance of fully covered pixels, sorted ascending. */
function lums(px: Uint8ClampedArray): number[] {
  const out: number[] = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] === 255) out.push(lum(px, i));
  return out.sort((a, b) => a - b);
}

const plain = render();

describe("surface textures", () => {
  it("defaults to none, and none renders exactly the untextured surface", () => {
    expect(generatePuzzleIcon(base).options.material.texture).toBe("none");
    expect(Buffer.from(render("none")).equals(Buffer.from(plain))).toBe(true);
    // an unknown name falls back to none
    const bogus = { ...base, material: { texture: "velvet" as SurfaceTexture } };
    expect(Buffer.from(renderPlanCpu(buildRenderPlan(generatePuzzleIcon(bogus)))).equals(Buffer.from(plain))).toBe(true);
  });

  for (const t of SURFACE_TEXTURES.filter((t) => t !== "none")) {
    it(`${t} changes the surface but not the coverage`, () => {
      const px = render(t);
      let changed = 0;
      let covered = 0;
      for (let i = 0; i < px.length; i += 4) {
        expect(px[i + 3]).toBe(plain[i + 3]);
        if (plain[i + 3] !== 255) continue;
        covered++;
        if (Math.abs(lum(px, i) - lum(plain, i)) > 1) changed++;
      }
      expect(changed / covered).toBeGreaterThan(0.1);
    });
  }

  it("is deterministic per seed and placed per piece", () => {
    for (const t of SURFACE_TEXTURES) expect(Buffer.from(render(t)).equals(Buffer.from(render(t)))).toBe(true);
    const a = generatePuzzleIcon({ ...base, layout: "grid", material: { texture: "paper" } });
    const seeds = new Set(a.pieces.map((p) => p.material.textureSeed));
    expect(seeds.size).toBe(4);
    const b = generatePuzzleIcon({ ...base, seed: "other", layout: "grid", material: { texture: "paper" } });
    expect(b.pieces[0]!.material.textureSeed).not.toBe(a.pieces[0]!.material.textureSeed);
    // the texture stream never perturbs geometry or colours
    const c = generatePuzzleIcon({ ...base, layout: "grid" });
    expect(c.pieces.map((p) => p.geometryKey)).toEqual(a.pieces.map((p) => p.geometryKey));
    expect(c.pieces.map((p) => p.color)).toEqual(a.pieces.map((p) => p.color));
  });

  it("metal is visibly more specular and less diffuse than resin", () => {
    const resin = lums(plain);
    const pct = (v: number[], q: number) => v[Math.floor(q * (v.length - 1))]!;
    for (const t of ["brushedMetal", "polishedMetal"] as const) {
      const metal = lums(render(t));
      // brighter highlights and a wider spread between highlight and shadow
      expect(pct(metal, 0.99)).toBeGreaterThan(pct(resin, 0.99) + 5);
      expect(pct(metal, 0.99) - pct(metal, 0.05)).toBeGreaterThan(2 * (pct(resin, 0.99) - pct(resin, 0.05)));
    }
  });

  it("strength 0 leaves only the material response", () => {
    const flat = renderPlanCpu(buildRenderPlan(generatePuzzleIcon({ ...base, material: { texture: "paper", textureStrength: 0 } })));
    // no bump or albedo variation: neighbouring interior pixels stay smooth
    const v = lums(flat);
    const v2 = lums(render("paper"));
    expect(v[v.length - 1]! - v[0]!).toBeLessThan(v2[v2.length - 1]! - v2[0]!);
  });

  it("the lattice hash and noise are pinned", () => {
    expect(texHash(3, -7, 42)).toMatchInlineSnapshot(`0.10017514228820801`);
    expect(valueNoise(1.25, -0.5, 9)).toMatchInlineSnapshot(`
      [
        -0.08622601255774498,
        -0.3741825073957443,
        0.36224564909935,
      ]
    `);
  });
});
