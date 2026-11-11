import { describe, expect, it } from "bun:test";
import { generatePuzzleIcon, hexToOklch, MUTED_PALETTES, PALETTES, PASTEL_PALETTES, SEED_PALETTE_NAMES, VIVID_PALETTES } from "@jigsaw/core";

const SEEDS = Array.from({ length: 200 }, (_, i) => `palette-${i}`);

describe("palettes", () => {
  it("seeds pick only the vivid palettes", () => {
    const picked = new Set(SEEDS.map((seed) => generatePuzzleIcon({ seed }).palette.name));
    expect([...picked].sort()).toEqual([...SEED_PALETTE_NAMES].sort());
  });

  it("keeps the pastel palettes selectable by name", () => {
    for (const name of Object.keys(PASTEL_PALETTES)) {
      expect(generatePuzzleIcon({ seed: 1, palette: name }).palette.name).toBe(name);
    }
    expect(Object.keys(PALETTES)).toEqual([...Object.keys(VIVID_PALETTES), ...Object.keys(MUTED_PALETTES), ...Object.keys(PASTEL_PALETTES)]);
  });

  it("keeps the muted palettes low in chroma", () => {
    for (const colors of Object.values(MUTED_PALETTES)) {
      for (const c of colors) expect(hexToOklch(c)[1]).toBeLessThan(0.07);
    }
  });

  it("orders each vivid and muted palette from deep to light", () => {
    for (const colors of [...Object.values(VIVID_PALETTES), ...Object.values(MUTED_PALETTES)]) {
      const L = colors.map((c) => hexToOklch(c)[0]);
      expect(L).toEqual([...L].sort((a, b) => a - b));
    }
  });
});

describe("piece colour", () => {
  it("gives a single piece one colour of its palette", () => {
    for (const seed of SEEDS) {
      const d = generatePuzzleIcon({ seed });
      expect(d.palette.colors).toContain(d.pieces[0]!.color);
    }
  });

  it("uses a custom colour exactly as given", () => {
    for (const seed of SEEDS.slice(0, 20)) expect(generatePuzzleIcon({ seed, palette: ["#A49CF0"] }).pieces[0]!.color).toBe("#A49CF0");
  });

  it("reaches every colour of a palette across seeds", () => {
    const picked = new Set(SEEDS.map((seed) => generatePuzzleIcon({ seed, palette: ["#111111", "#222222", "#333333"] }).pieces[0]!.color));
    expect(picked.size).toBe(3);
  });
});
