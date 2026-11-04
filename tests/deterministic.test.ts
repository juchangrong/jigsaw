import { describe, expect, it } from "vitest";
import {
  ALGORITHM_VERSION,
  buildRenderPlan,
  createRng,
  generatePuzzleIcon,
  hashString,
  PRESET_VERSION,
  Rng,
  SIDES,
  type LayoutKind,
} from "@jigsaw/core";
import { renderPlanCpu } from "../packages/renderer/src/cpu";

describe("PRNG", () => {
  it("Mulberry32 is stable and in range", () => {
    const r = new Rng(12345);
    const seq = Array.from({ length: 5 }, () => r.next());
    const again = new Rng(12345);
    expect(Array.from({ length: 5 }, () => again.next())).toEqual(seq);
    for (const v of seq) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    // pinned values guard against accidental algorithm changes
    expect(hashString("seed:geometry")).toMatchInlineSnapshot(`2514295190`);
    expect(new Rng(1).next()).toMatchInlineSnapshot(`0.6270739405881613`);
  });

  it("streams are independent", () => {
    const a = createRng("x", "geometry").next();
    const b = createRng("x", "palette").next();
    const c = createRng("x", "gradient").next();
    const d = createRng("x", "layout").next();
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it("never touches Math.random", () => {
    const orig = Math.random;
    Math.random = () => {
      throw new Error("Math.random used");
    };
    try {
      for (const layout of ["single", "cluster", "grid"] as LayoutKind[]) generatePuzzleIcon({ seed: "nr", layout });
    } finally {
      Math.random = orig;
    }
  });
});

describe("determinism", () => {
  const layouts: LayoutKind[] = ["single", "cluster", "grid"];

  it("same seed + options → identical description", () => {
    for (const layout of layouts) {
      for (const seed of ["alpha", "beta", 42]) {
        const a = generatePuzzleIcon({ seed, layout, size: 128 });
        const b = generatePuzzleIcon({ seed, layout, size: 128 });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });

  it("carries generator metadata", () => {
    const d = generatePuzzleIcon({ seed: 7 });
    expect(d.metadata).toEqual({ seed: "7", algorithmVersion: ALGORITHM_VERSION, presetVersion: PRESET_VERSION });
  });

  it("same seed → identical pixels (CPU reference)", () => {
    const render = () => renderPlanCpu(buildRenderPlan(generatePuzzleIcon({ seed: "px", layout: "cluster", size: 64 })));
    expect(Buffer.from(render()).equals(Buffer.from(render()))).toBe(true);
  });

  it("palette choice does not perturb geometry (separate streams)", () => {
    const a = generatePuzzleIcon({ seed: "iso", gradient: { palette: "aurora" } });
    const b = generatePuzzleIcon({ seed: "iso", gradient: { palette: "candy" } });
    expect(a.pieces[0]!.geometryKey).toBe(b.pieces[0]!.geometryKey);
    expect(a.pieces[0]!.gradient.spots.map((s) => s.position)).toEqual(b.pieces[0]!.gradient.spots.map((s) => s.position));
    expect(a.palette.colors).not.toEqual(b.palette.colors);
  });

  it("different seeds give visibly different icons", () => {
    const icons = Array.from({ length: 60 }, (_, i) => generatePuzzleIcon({ seed: `v${i}` }));
    const kinds = new Set(icons.map((d) => SIDES.map((s) => d.pieces[0]!.sides[s].kind).join("")));
    const palettes = new Set(icons.map((d) => d.palette.name));
    const firstSpot = new Set(icons.map((d) => d.pieces[0]!.gradient.spots[0]!.color));
    expect(kinds.size).toBeGreaterThanOrEqual(15);
    expect(palettes.size).toBeGreaterThanOrEqual(4);
    expect(firstSpot.size).toBeGreaterThanOrEqual(40);
  });

  it("pieces in one icon share a palette but get their own spots", () => {
    const d = generatePuzzleIcon({ seed: "share", layout: "grid", pieceCount: 4 });
    const spots = d.pieces.map((p) => JSON.stringify(p.gradient.spots));
    expect(new Set(spots).size).toBe(4);
    const spotsPerPiece = d.pieces.map((p) => p.gradient.spots.length);
    for (const n of spotsPerPiece) {
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
});
