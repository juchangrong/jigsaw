/** The mosaic, its standalone SVG, and the colour families that go with it. */
import { describe, expect, it } from "bun:test";
import {
  COLOR_SETS,
  colorFamily,
  generateMosaic,
  hexToOklch,
  MOSAIC_CORNER,
  MOSAIC_GAP,
  mosaicDrawing,
  mosaicFills,
  mosaicOf,
  mosaicOutline,
  mosaicSvg,
  tintColor,
} from "@jigsaw/core";

const SEEDS = Array.from({ length: 300 }, (_, i) => `pictogram-${i}`);

describe("colour families", () => {
  it("builds four shades from deep to light with tapering chroma", () => {
    const f = colorFamily("test", 250, 0.1, 0.4, 0.85);
    const lch = f.colors.map((c) => hexToOklch(c));
    expect(lch[0]![0]).toBeCloseTo(0.4, 1);
    expect(lch[3]![0]).toBeCloseTo(0.85, 1);
    for (let i = 1; i < 4; i++) {
      expect(lch[i]![0]).toBeGreaterThan(lch[i - 1]![0]);
      expect(lch[i]![1]).toBeLessThanOrEqual(lch[i - 1]![1] + 0.005);
    }
  });

  it("keeps every set to at most five families with unique ids", () => {
    expect(new Set(COLOR_SETS.map((s) => s.id)).size).toBe(COLOR_SETS.length);
    for (const set of COLOR_SETS) {
      expect(set.families.length).toBeGreaterThanOrEqual(1);
      expect(set.families.length).toBeLessThanOrEqual(5);
      expect(new Set(set.families.map((f) => f.id)).size).toBe(set.families.length);
      for (const f of set.families) expect(f.colors).toHaveLength(4);
    }
  });

  it("has bright sets, and an ink set whose families share one deep navy", () => {
    const set = (id: string) => COLOR_SETS.find((s) => s.id === id)!;
    for (const id of ["bright", "candy"]) {
      for (const f of set(id).families) {
        const lch = f.colors.map((c) => hexToOklch(c));
        for (let i = 1; i < 4; i++) expect(lch[i]![0]).toBeGreaterThan(lch[i - 1]![0]);
        // vivid at the deep end, a pale tint at the light end
        expect(lch[0]![1]).toBeGreaterThan(0.09);
        // 0.88 or more before rounding to hex
        expect(lch[3]![0]).toBeGreaterThan(0.87);
      }
    }
    const ink = set("ink").families;
    const navy = ink[0]!.colors[0]!;
    expect(hexToOklch(navy)[0]).toBeLessThan(0.4);
    for (const f of ink) {
      expect(f.colors[0]).toBe(navy);
      const rest = f.colors.slice(1).map((c) => hexToOklch(c));
      // the other three are one bright hue, stepping up from the full colour to a tint
      expect(rest[0]![0]).toBeGreaterThan(0.6);
      expect(rest[0]![1]).toBeGreaterThan(0.1);
      for (let i = 1; i < 3; i++) expect(rest[i]![0]).toBeGreaterThan(rest[i - 1]![0]);
    }
  });

  it("gives every family a light tint", () => {
    for (const set of COLOR_SETS) for (const f of set.families) expect(hexToOklch(tintColor(f))[0]).toBeGreaterThan(0.93);
  });
});

describe("mosaic", () => {
  const colors = colorFamily("test", 250, 0.1, 0.35, 0.9).colors;
  // the points of a path, without the radii of its arcs
  const numbers = (path: string) =>
    [...path.replace(/A \S+ \S+ 0 [01] [01]/g, "A").matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

  it("is deterministic and varied", () => {
    expect(generateMosaic("alpha")).toBe(generateMosaic("alpha"));
    expect(new Set(SEEDS.map((s) => generateMosaic(s).key)).size).toBeGreaterThan(80);
  });

  it("puts the two deep tones on one diagonal and the two light ones on the other", () => {
    for (const seed of SEEDS) {
      const [tl, tr, bl, br] = generateMosaic(seed).tones;
      expect([tl, tr, bl, br].slice().sort()).toEqual([0, 1, 2, 3]);
      expect([tl + br, tr + bl].sort()).toEqual([1, 5]);
    }
  });

  it("paints four cells, then one knob per half-seam over the neighbouring cell", () => {
    const seams = [
      { axis: 0, at: 0.5, cells: [0, 1] },
      { axis: 0, at: 0.5, cells: [2, 3] },
      { axis: 1, at: 0.5, cells: [0, 2] },
      { axis: 1, at: 0.5, cells: [1, 3] },
    ] as const;
    for (const knobs of [
      [true, true, true, true],
      [false, false, false, false],
      [true, false, false, true],
    ] as const) {
      const m = mosaicOf([0, 2, 3, 1], knobs);
      expect(m.viewBox).toBe("0 0 1 1");
      expect(m.layers).toHaveLength(8);
      expect(m.layers.slice(0, 4).map((l) => l.cell)).toEqual([0, 1, 2, 3]);
      m.layers.slice(4).forEach((layer, i) => {
        const seam = seams[i]!;
        const across = numbers(layer.path).map((p) => p[seam.axis] - seam.at);
        const reach = 0.09 + 0.03;
        // the knob belongs to the cell behind it and reaches into the cell in front (the path's points stop where the knob's arc starts)
        expect(layer.cell).toBe(seam.cells[knobs[i] ? 0 : 1]);
        if (knobs[i]) {
          expect(Math.max(...across)).toBeGreaterThan(0.03);
          expect(Math.max(...across)).toBeLessThanOrEqual(reach);
          expect(Math.min(...across)).toBeGreaterThan(-0.02);
        } else {
          expect(Math.min(...across)).toBeLessThan(-0.03);
          expect(Math.min(...across)).toBeGreaterThanOrEqual(-reach);
          expect(Math.max(...across)).toBeLessThan(0.02);
        }
      });
    }
  });

  it("fills cells with their own shade, or keeps one deep piece as an accent", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const m = generateMosaic(seed);
      expect(mosaicFills(m, colors)).toEqual(m.tones.map((t) => colors[t]!));
      const accent = mosaicFills(m, colors, "accent");
      expect(accent[m.tones.indexOf(0)]).toBe(colors[0]);
      expect(accent[m.tones.indexOf(1)]).toBe(colors[3]);
      const soft = accent[m.tones.indexOf(2)]!;
      expect(accent[m.tones.indexOf(3)]).toBe(soft);
      const L = hexToOklch(soft)[0];
      expect(L).toBeGreaterThan(hexToOklch(colors[2]!)[0]);
      expect(L).toBeLessThan(hexToOklch(colors[3]!)[0]);
    }
    // a short palette still gives every cell a colour
    expect(mosaicFills(generateMosaic("alpha"), ["#112233"])).toEqual(["#112233", "#112233", "#112233", "#112233"]);
  });

  it("gives the four cuts as open paths from the tile's edge to its centre", () => {
    const ends = [
      [0.5, 0, 0.5, 0.5],
      [0.5, 0.5, 0.5, 1],
      [0, 0.5, 0.5, 0.5],
      [0.5, 0.5, 1, 0.5],
    ];
    for (const seed of SEEDS.slice(0, 20)) {
      const m = generateMosaic(seed);
      expect(m.seams).toHaveLength(4);
      m.seams.forEach((seam, i) => {
        expect(seam.endsWith("Z")).toBe(false);
        const pts = numbers(seam);
        expect([...pts[0]!, ...pts[pts.length - 1]!]).toEqual(ends[i]!);
        // one knob with a join on both sides
        expect(seam.match(/A /g)).toHaveLength(3);
      });
    }
  });

  it("outlines the tile as a squircle through the edge midpoints, or as a rounded rectangle", () => {
    const squircle = mosaicOutline();
    expect(squircle.match(/C /g)).toHaveLength(4);
    expect(squircle).not.toMatch(/[AL]/);
    for (const mid of ["1 0.5", "0.5 1", "0 0.5", "0.5 0"]) expect(squircle).toContain(mid);
    const round = mosaicOutline("round", 0.3);
    expect(round.match(/A 0\.3 0\.3 0 0 1/g)).toHaveLength(4);
    expect(round).not.toContain("C ");
  });

  it("plans the drawing: cuts with rounded corners and a hairline by default", () => {
    const m = generateMosaic("alpha");
    const d = mosaicDrawing(m, colors);
    expect(d.outline).toBe(mosaicOutline());
    expect(d.fills).toEqual(mosaicFills(m, colors));
    expect(d.gap).toBe(MOSAIC_GAP);
    expect(d.edge).not.toBeNull();
    // the opening where the cuts cross and a notch on each edge, every corner an arc of MOSAIC_CORNER
    expect(d.corners.match(/M /g)).toHaveLength(5);
    expect(d.corners.match(/A /g)).toHaveLength(4 + 4 * 2);
    for (const a of d.corners.matchAll(/A (\S+) (\S+) /g)) expect([Number(a[1]), Number(a[2])]).toEqual([MOSAIC_CORNER, MOSAIC_CORNER]);
    // the ground is a mid tone between the lightest and deepest fills
    const L = (hex: string) => hexToOklch(hex)[0];
    expect(L(d.ground)).toBeGreaterThan(L(colors[0]!));
    expect(L(d.ground)).toBeLessThan(L(colors[3]!));

    const joined = mosaicDrawing(m, colors, { gap: 0, edge: false, shape: "round", variant: "accent" });
    expect(joined.gap).toBe(0);
    expect(joined.corners).toBe("");
    expect(joined.edge).toBeNull();
    expect(joined.outline).toBe(mosaicOutline("round"));
    expect(joined.fills).toEqual(mosaicFills(m, colors, "accent"));
  });

  it("writes a standalone SVG clipped to the outline, with the cuts masked out", () => {
    const m = generateMosaic("alpha");
    const svg = mosaicSvg(m, colors, { size: 40, title: 'Team "A"' });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="40" height="40" viewBox="0 0 1 1" role="img" aria-label="Team &quot;A&quot;">/);
    expect(svg).toMatch(/<clipPath id="(mosaic-[0-9-]+)"><path d="M 1 0\.5 C .*clip-path="url\(#\1\)"/);
    expect(svg).toMatch(/<mask id="(mosaic-[0-9-]+-cuts)">.*mask="url\(#\1\)"/);
    expect(svg.match(new RegExp(`stroke="#000" stroke-width="${MOSAIC_GAP}"`, "g"))).toHaveLength(4);
    // the clip, four seams, the corners, eight layers and the edge
    expect(svg.match(/<path /g)).toHaveLength(1 + 4 + 1 + 8 + 1);
    for (const fill of mosaicFills(m, colors)) expect(svg).toContain(`fill="${fill}"`);
    expect(svg.endsWith("</g></g></svg>")).toBe(true);

    const plain = mosaicSvg(m, colors, { gap: 0, edge: false, shape: "round", radius: 0.3 });
    expect(plain).toContain('aria-hidden="true"');
    expect(plain).not.toContain("<mask");
    expect(plain).toContain("A 0.3 0.3 0 0 1");
    expect(plain.match(/<path /g)).toHaveLength(1 + 8);
  });
});
