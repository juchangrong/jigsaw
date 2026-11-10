/**
 * The installable PuzzleMosaic (registry/jigsaw-ui/puzzle-mosaic.tsx) is a
 * self-contained copy of the library's mosaic, so it is checked against the
 * library, rendered to markup, and compared with the built registry file.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COLOR_SETS, generateMosaic as libraryMosaic, MOSAIC_GAP, mosaicDrawing, mosaicFills as libraryFills } from "@jigsaw/core";
import { DEFAULT_MOSAIC_PALETTES, generateMosaic, MOSAIC_PALETTES, mosaicFills, mosaicPaletteFor, PuzzleMosaic, type PuzzleMosaicProps } from "../registry/jigsaw-ui/puzzle-mosaic";

const SEEDS = [...Array.from({ length: 300 }, (_, i) => `registry-${i}`), 7, "alpha", ""];
const render = (props: PuzzleMosaicProps) => renderToStaticMarkup(createElement(PuzzleMosaic, props));
const family = (set: string, id: string) => COLOR_SETS.find((s) => s.id === set)!.families.find((f) => f.id === id)!.colors;

describe("installable PuzzleMosaic: parity with the library", () => {
  it("draws the same design for every seed", () => {
    for (const seed of SEEDS) {
      const mine = generateMosaic(seed);
      const theirs = libraryMosaic(seed);
      expect(mine.tones).toEqual(theirs.tones);
      expect(mine.layers).toEqual(theirs.layers);
      expect(mine.seams).toEqual(theirs.seams);
    }
  });

  it("fills the cells with the same colours in both variants", () => {
    const shades = family("bright", "coral");
    for (const seed of SEEDS.slice(0, 60)) {
      expect(mosaicFills(generateMosaic(seed), shades, "tonal")).toEqual(libraryFills(libraryMosaic(seed), shades, "tonal"));
      expect(mosaicFills(generateMosaic(seed), shades, "accent")).toEqual(libraryFills(libraryMosaic(seed), shades, "accent"));
    }
  });

  it("carries the library's Bright, Candy and Mono families as its palettes", () => {
    const expected = Object.fromEntries([...["bright", "candy", "mono"].flatMap((id) => COLOR_SETS.find((s) => s.id === id)!.families)].map((f) => [f.id, f.colors]));
    expect(MOSAIC_PALETTES).toEqual(expected);
    expect([...DEFAULT_MOSAIC_PALETTES]).toEqual(COLOR_SETS.find((s) => s.id === "bright")!.families.map((f) => f.id));
  });

  it("uses the library's outline, cut width, cut corners and ground", () => {
    const shades = family("bright", "blue");
    const d = mosaicDrawing(libraryMosaic("alpha"), shades, { variant: "accent" });
    const svg = render({ seed: "alpha", palette: "blue" });
    expect(svg).toContain(`<path d="${d.outline}">`);
    expect(svg).toContain(`<path d="${d.corners}" fill="#000">`);
    expect(svg.match(new RegExp(`stroke="#000" stroke-width="${MOSAIC_GAP}"`, "g"))).toHaveLength(4);
    expect(svg).toContain(`<rect width="1" height="1" fill="${d.ground}">`);
    expect(svg).toContain(`stroke="${d.edge}" stroke-width="${d.edgeWidth}"`);
    for (const fill of d.fills) expect(svg).toContain(`fill="${fill}"`);
  });
});

describe("installable PuzzleMosaic: rendering", () => {
  it("is one decorative SVG of the given size by default", () => {
    const svg = render({ seed: "alpha" });
    expect(svg).toMatch(/^<svg width="40" height="40" viewBox="0 0 1 1" aria-hidden="true">/);
    expect(svg.match(/<svg/g)).toHaveLength(1);
    expect(svg).toMatch(/<clipPath id="(mosaic\w+)">.*clip-path="url\(#\1\)"/);
    expect(svg).toMatch(/<mask id="(mosaic\w+cuts)">.*mask="url\(#\1\)"/);
    // the clip, four seams, the cut corners, eight layers and the edge
    expect(svg.match(/<path /g)).toHaveLength(1 + 4 + 1 + 8 + 1);
  });

  it("is deterministic, and different seeds differ", () => {
    expect(render({ seed: "alpha" })).toBe(render({ seed: "alpha" }));
    expect(new Set(SEEDS.map((seed) => render({ seed }))).size).toBeGreaterThan(150);
  });

  it("picks a default palette from the seed, and takes a name or four shades", () => {
    const used = new Set(SEEDS.map((seed) => mosaicPaletteFor(seed)));
    expect(used.size).toBe(DEFAULT_MOSAIC_PALETTES.length);
    expect(render({ seed: "alpha", palette: "teal", variant: "tonal" })).toContain(`fill="${MOSAIC_PALETTES.teal[0]}"`);
    const custom = ["#101010", "#505050", "#909090", "#D0D0D0"] as const;
    const svg = render({ seed: "alpha", palette: custom, variant: "tonal" });
    for (const c of custom) expect(svg).toContain(`fill="${c}"`);
  });

  it("joins the pieces when gaps are off", () => {
    const svg = render({ seed: "alpha", gaps: false });
    expect(svg).not.toContain("<mask");
    expect(svg).not.toContain("mask=");
    expect(svg.match(/<path /g)).toHaveLength(1 + 8 + 1);
  });

  it("sets the icon inside a tile when padding is on", () => {
    const svg = render({ seed: "alpha", padding: true, size: 40, tile: "var(--card)" });
    expect(svg.match(/<svg/g)).toHaveLength(2);
    // a one-pixel line around the tile, then the icon at three quarters of its side, centred
    expect(svg).toContain('<rect x="0.0125" y="0.0125" width="0.975" height="0.975" rx="0.25" fill="var(--card)" stroke="rgba(20,20,40,0.1)" stroke-width="0.025">');
    expect(svg).toContain('<svg x="0.125" y="0.125" width="0.75" height="0.75" viewBox="0 0 1 1">');
    // the tile is the frame, so the icon's own edge line is gone
    expect(svg).not.toContain("rgba(20,20,40,0.14)");
  });

  it("takes an accessible name and passes other props to the SVG", () => {
    const svg = render({ seed: "alpha", title: 'Team "A"', className: "shrink-0", size: 24 });
    expect(svg).toMatch(/^<svg width="24" height="24" viewBox="0 0 1 1" role="img" aria-label="Team &quot;A&quot;" class="shrink-0">/);
  });
});

describe("registry build", () => {
  const source = readFileSync("registry/jigsaw-ui/puzzle-mosaic.tsx", "utf8");

  it("lists the component in registry.json", () => {
    const registry = JSON.parse(readFileSync("registry.json", "utf8")) as { name: string; items: { name: string; type: string; files: { path: string; type: string }[] }[] };
    expect(registry.name).toBe("jigsaw-ui");
    const item = registry.items.find((i) => i.name === "puzzle-mosaic")!;
    expect(item.type).toBe("registry:component");
    expect(item.files).toEqual([{ path: "registry/jigsaw-ui/puzzle-mosaic.tsx", type: "registry:component" }]);
  });

  it("has a built file that matches the source (run `pnpm registry:build` after editing it)", () => {
    const built = JSON.parse(readFileSync("public/r/puzzle-mosaic.json", "utf8")) as { name: string; files: { path: string; content: string; type: string }[]; dependencies?: string[] };
    expect(built.name).toBe("puzzle-mosaic");
    expect(built.files).toHaveLength(1);
    expect(built.files[0]!.content).toBe(source);
    expect(built.dependencies ?? []).toEqual([]);
  });

  it("depends on nothing but React", () => {
    const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports).toEqual(["react"]);
  });
});
