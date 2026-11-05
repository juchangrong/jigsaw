import { describe, expect, it } from "vitest";
import { generatePuzzleIcon, hexToOklch, PALETTES, PASTEL_PALETTES, SEED_PALETTE_NAMES, VIVID_PALETTES } from "@jigsaw/core";

const SEEDS = Array.from({ length: 200 }, (_, i) => `palette-${i}`);

describe("palettes", () => {
  it("seeds pick only the vivid palettes", () => {
    const picked = new Set(SEEDS.map((seed) => generatePuzzleIcon({ seed }).palette.name));
    expect([...picked].sort()).toEqual([...SEED_PALETTE_NAMES].sort());
  });

  it("keeps the pastel palettes selectable by name", () => {
    for (const name of Object.keys(PASTEL_PALETTES)) {
      expect(generatePuzzleIcon({ seed: 1, gradient: { palette: name } }).palette.name).toBe(name);
    }
    expect(Object.keys(PALETTES)).toEqual([...Object.keys(VIVID_PALETTES), ...Object.keys(PASTEL_PALETTES)]);
  });

  it("orders each vivid palette from deep to light", () => {
    for (const colors of Object.values(VIVID_PALETTES)) {
      const L = colors.map((c) => hexToOklch(c)[0]);
      expect(L).toEqual([...L].sort((a, b) => a - b));
    }
  });
});

describe("gradient flow", () => {
  it("puts lighter colors toward the top-left light", () => {
    // Over many seeds, spot lightness falls as spots move toward the bottom-right.
    let n = 0;
    let sxy = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    for (const seed of SEEDS) {
      for (const s of generatePuzzleIcon({ seed }).pieces[0]!.gradient.spots) {
        const t = s.position[0] + s.position[1]; // grows toward the bottom-right
        const L = hexToOklch(s.color)[0];
        n++;
        sx += t;
        sy += L;
        sxy += t * L;
        sxx += t * t;
      }
    }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    expect(slope).toBeLessThan(-0.1);
  });
});
