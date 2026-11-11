/** The hills design, its fills, its drawing plan, its standalone SVG and its React markup. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "bun:test";
import { colorFamily, generateHills, hillsDrawing, hillsFills, hillsSvg, hexToOklch } from "@jigsaw/core";
import { PuzzleHills } from "@jigsaw/react";

const SEEDS = Array.from({ length: 400 }, (_, i) => `hills-${i}`);
const colors = colorFamily("test", 250, 0.1, 0.35, 0.9).colors;
/** how far a hill's crest is above the tile's bottom edge */
const crest = (h: { y: number; r: number }) => 1 - (h.y - h.r);

describe("hills", () => {
  it("is deterministic and varied", () => {
    expect(generateHills("alpha")).toEqual(generateHills("alpha"));
    expect(new Set(SEEDS.map((s) => generateHills(s).key)).size).toBe(SEEDS.length);
  });

  it("orders the hills from a tall back one to a low front one, all inside the tile", () => {
    for (const seed of SEEDS) {
      const { hills } = generateHills(seed);
      const heights = hills.map(crest);
      expect(heights[0]!).toBeGreaterThan(heights[1]! - 1e-9);
      expect(heights[1]!).toBeGreaterThan(heights[2]!);
      for (const h of heights) {
        expect(h).toBeGreaterThan(0.2);
        expect(h).toBeLessThan(0.62);
      }
      // each circle reaches below the tile, so only its top shows
      for (const h of hills) expect(h.y + h.r).toBeGreaterThan(1);
    }
  });

  it("puts the back two hills on opposite sides and mirrors half the scenes", () => {
    let backLeft = 0;
    for (const seed of SEEDS) {
      const { hills } = generateHills(seed);
      expect((hills[0].x - 0.5) * (hills[1].x - 0.5)).toBeLessThan(0);
      if (hills[0].x < 0.5) backLeft++;
    }
    expect(backLeft).toBeGreaterThan(SEEDS.length * 0.35);
    expect(backLeft).toBeLessThan(SEEDS.length * 0.65);
  });

  it("keeps the sun in the sky, above the middle of the tile", () => {
    for (const seed of SEEDS) {
      const { sun } = generateHills(seed);
      expect(sun.x).toBeGreaterThanOrEqual(0.25);
      expect(sun.x).toBeLessThanOrEqual(0.75);
      expect(sun.y + sun.r).toBeLessThan(0.5);
      expect(sun.y - sun.r).toBeGreaterThan(0.1);
    }
  });

  it("deepens the hills toward the front, or keeps one deep hill as an accent", () => {
    const tonal = hillsFills(colors);
    expect(tonal).toEqual({ sky: colors[3]!, sun: colors[2]!, hills: [colors[2]!, colors[1]!, colors[0]!] });
    const accent = hillsFills(colors, "accent");
    expect(accent.hills[2]).toBe(colors[0]!);
    expect(accent.hills[1]).toBe(colors[2]!);
    // the back hill sits between the light shade and the sky
    const L = (c: string) => hexToOklch(c)[0];
    expect(L(accent.hills[0])).toBeGreaterThan(L(colors[2]!));
    expect(L(accent.hills[0])).toBeLessThan(L(colors[3]!));
  });

  it("plans the drawing with a hairline by default", () => {
    const d = hillsDrawing(colors);
    expect(d.outline.startsWith("M 1 0.5 C")).toBe(true);
    expect(d.edge).not.toBeNull();
    expect(hillsDrawing(colors, { edge: false }).edge).toBeNull();
    expect(hillsDrawing(colors, { shape: "round", radius: 0.3 }).outline).toContain("A 0.3 0.3 0 0 1");
  });

  it("writes a standalone SVG: sky, sun and three hills clipped to the outline", () => {
    const h = generateHills("alpha");
    const svg = hillsSvg(h, colors, { size: 40, title: 'Team "A"' });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="40" height="40" viewBox="0 0 1 1" role="img" aria-label="Team &quot;A&quot;">/);
    expect(svg).toMatch(/<clipPath id="(hills-[0-9]+)"><path d="M 1 0\.5 C .*clip-path="url\(#\1\)"/);
    expect(svg.match(/<circle /g)).toHaveLength(4);
    expect(svg.indexOf(`cx="${h.sun.x}" cy="${h.sun.y}"`)).toBeLessThan(svg.indexOf(`cx="${h.hills[0].x}" cy="${h.hills[0].y}"`));
    expect(svg).not.toContain("<mask");
    expect(hillsSvg(h, colors, { edge: false })).not.toContain("stroke=");
    expect(hillsSvg(h, colors)).toContain('aria-hidden="true"');
  });

  it("renders the same circles and fills from the React component", () => {
    const h = generateHills("alpha");
    const html = renderToStaticMarkup(createElement(PuzzleHills, { seed: "alpha", colors, size: 40, title: "Alpha" }));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Alpha"');
    for (const c of [h.sun, ...h.hills]) expect(html).toContain(`cx="${c.x}" cy="${c.y}" r="${c.r}"`);
    for (const fill of hillsFills(colors).hills) expect(html).toContain(`fill="${fill}"`);
    expect(renderToStaticMarkup(createElement(PuzzleHills, { seed: "alpha", colors }))).toContain('aria-hidden="true"');
  });
});
