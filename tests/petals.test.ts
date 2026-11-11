/** The petals design, its fills, its drawing plan, its standalone SVG and its React markup. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "bun:test";
import { colorFamily, generatePetals, petalsDrawing, petalsFills, petalsOf, petalsSvg } from "@jigsaw/core";
import { PuzzlePetals } from "@jigsaw/react";

const SEEDS = Array.from({ length: 400 }, (_, i) => `petals-${i}`);
const colors = colorFamily("test", 250, 0.1, 0.35, 0.9).colors;

describe("petals", () => {
  it("is deterministic and reaches every design", () => {
    expect(generatePetals("alpha")).toBe(generatePetals("alpha"));
    // twelve tone layouts by sixteen lean layouts
    expect(new Set(Array.from({ length: 6000 }, (_, i) => generatePetals(`all-${i}`).key)).size).toBe(192);
  });

  it("gives every tile one deep leaf, one middle leaf and two light ones", () => {
    for (const seed of SEEDS) expect([...generatePetals(seed).tones].sort()).toEqual([0, 1, 2, 2]);
  });

  it("draws each leaf as two arcs between opposite corners of its cell", () => {
    const corners = (path: string) => [...path.matchAll(/(?:M|1) (\d(?:\.\d)?) (\d(?:\.\d)?)(?= A| Z)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const p = petalsOf([0, 1, 2, 2], [true, false, false, true]);
    expect(p.leaves).toHaveLength(4);
    // rising: bottom-left to top-right; falling: top-left to bottom-right
    expect(corners(p.leaves[0]!)).toEqual([
      [0, 0.5],
      [0.5, 0],
      [0, 0.5],
    ]);
    expect(corners(p.leaves[1]!)).toEqual([
      [0.5, 0],
      [1, 0.5],
      [0.5, 0],
    ]);
    expect(corners(p.leaves[3]!)).toEqual([
      [0.5, 1],
      [1, 0.5],
      [0.5, 1],
    ]);
    for (const leaf of p.leaves) expect(leaf.match(/A 0\.5 0\.5 0 0 1/g)).toHaveLength(2);
  });

  it("fills the ground with the lightest shade and leaves by tone, or keeps one deep leaf as an accent", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const p = generatePetals(seed);
      const tonal = petalsFills(p, colors);
      expect(tonal.ground).toBe(colors[3]!);
      expect(tonal.leaves).toEqual(p.tones.map((t) => colors[t]!));
      const accent = petalsFills(p, colors, "accent");
      expect(accent.leaves.filter((c) => c === colors[0]).length).toBe(1);
      expect(accent.leaves.filter((c) => c === colors[2]).length).toBe(3);
      expect(accent.leaves[p.tones.indexOf(0)]).toBe(colors[0]!);
    }
  });

  it("plans the drawing with a hairline by default and no divider between cells", () => {
    const p = generatePetals("alpha");
    const d = petalsDrawing(p, colors);
    expect(d.outline.startsWith("M 1 0.5 C")).toBe(true);
    expect(d.edge).not.toBeNull();
    expect(petalsDrawing(p, colors, { edge: false }).edge).toBeNull();
    expect(petalsDrawing(p, colors, { shape: "round", radius: 0.3 }).outline).toContain("A 0.3 0.3 0 0 1");
    expect(Object.keys(d).sort()).toEqual(["edge", "edgeWidth", "fills", "ground", "outline"]);
  });

  it("writes a standalone SVG clipped to the outline, with no mask and no stroked seams", () => {
    const p = generatePetals("alpha");
    const svg = petalsSvg(p, colors, { size: 40, title: 'Team "A"' });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="40" height="40" viewBox="0 0 1 1" role="img" aria-label="Team &quot;A&quot;">/);
    expect(svg).toMatch(/<clipPath id="(petals-[0-9-]+)"><path d="M 1 0\.5 C .*clip-path="url\(#\1\)"/);
    expect(svg).not.toContain("<mask");
    // the clip, four leaves and the edge
    expect(svg.match(/<path /g)).toHaveLength(1 + 4 + 1);
    expect(svg.match(/stroke=/g)).toHaveLength(1);
    expect(petalsSvg(p, colors, { edge: false })).not.toContain("stroke=");
    expect(petalsSvg(p, colors)).toContain('aria-hidden="true"');
  });

  it("renders the same leaves and fills from the React component", () => {
    const p = generatePetals("alpha");
    const html = renderToStaticMarkup(createElement(PuzzlePetals, { seed: "alpha", colors, size: 40, variant: "accent", title: "Alpha" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Alpha"');
    for (const leaf of p.leaves) expect(html).toContain(`d="${leaf}"`);
    for (const fill of petalsFills(p, colors, "accent").leaves) expect(html).toContain(`fill="${fill}"`);
    expect(html).not.toContain("<mask");
    expect(renderToStaticMarkup(createElement(PuzzlePetals, { seed: "alpha", colors }))).toContain('aria-hidden="true"');
  });
});
