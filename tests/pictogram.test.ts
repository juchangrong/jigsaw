/**
 * Vector forms of a piece: the geometric pictogram, the realistic outline,
 * the standalone SVG, and the colour families that go with them.
 */
import { describe, expect, it } from "vitest";
import {
  COLOR_SETS,
  colorFamily,
  generateMosaic,
  generatePictogram,
  generatePuzzleIcon,
  hexToOklch,
  isIconicArrangement,
  MOSAIC_CORNER,
  MOSAIC_GAP,
  mosaicDrawing,
  mosaicFills,
  mosaicOf,
  mosaicOutline,
  mosaicSvg,
  PICTOGRAM_ARRANGEMENTS,
  PICTOGRAM_FILLET,
  PICTOGRAM_KNOB_OFFSET,
  PICTOGRAM_RADIUS,
  pictogramColor,
  pictogramContains,
  pictogramOf,
  pieceArrangement,
  pieceOutline,
  tileColor,
  tintColor,
  vectorSvg,
  type Arrangement,
} from "@jigsaw/core";

const SEEDS = Array.from({ length: 300 }, (_, i) => `pictogram-${i}`);
const viewOf = (viewBox: string) => viewBox.split(" ").map(Number) as [number, number, number, number];

describe("pictogram arrangements", () => {
  it("keeps the 30 arrangements that read as a puzzle piece", () => {
    expect(PICTOGRAM_ARRANGEMENTS).toHaveLength(30);
    for (const k of PICTOGRAM_ARRANGEMENTS) expect(isIconicArrangement(k)).toBe(true);
    expect(isIconicArrangement(["tab", "tab", "tab", "socket"])).toBe(false); // a cross
    expect(isIconicArrangement(["socket", "socket", "socket", "tab"])).toBe(false); // an X
    expect(isIconicArrangement(["flat", "flat", "tab", "socket"])).toBe(false); // a blob
    expect(isIconicArrangement(["tab", "socket", "tab", "socket"])).toBe(true);
  });

  it("gives every seed an iconic pictogram and keeps the piece's own arrangement when it qualifies", () => {
    let kept = 0;
    let replaced = 0;
    for (const seed of SEEDS) {
      const own = pieceArrangement(seed);
      const g = generatePictogram(seed);
      expect(isIconicArrangement(g.kinds)).toBe(true);
      if (isIconicArrangement(own)) {
        expect(g.kinds).toEqual(own);
        kept++;
      } else replaced++;
    }
    expect(kept).toBeGreaterThan(20);
    expect(replaced).toBeGreaterThan(20);
  });

  it("is deterministic and reaches most of the set", () => {
    expect(generatePictogram("alpha")).toEqual(generatePictogram("alpha"));
    expect(new Set(SEEDS.map((s) => generatePictogram(s).key)).size).toBeGreaterThanOrEqual(24);
  });
});

describe("pictogram geometry", () => {
  it("is one closed path of lines and arcs: one radius for corners, knobs and notches, a smaller one for the joins", () => {
    for (const kinds of PICTOGRAM_ARRANGEMENTS) {
      const { path } = pictogramOf(kinds);
      expect(path.startsWith("M ")).toBe(true);
      expect(path.endsWith(" Z")).toBe(true);
      expect(path).not.toMatch(/[CQSTHV]/);
      const arcs = [...path.matchAll(/A (\S+) (\S+) 0 ([01]) ([01])/g)].map((a) => ({ r: Number(a[1]), ry: Number(a[2]), large: a[3], sweep: a[4] }));
      for (const a of arcs) {
        expect(a.r).toBe(a.ry);
        expect(a.large).toBe("0");
      }
      const tabs = kinds.filter((k) => k === "tab").length;
      const sockets = kinds.filter((k) => k === "socket").length;
      const big = arcs.filter((a) => a.r === PICTOGRAM_RADIUS);
      const joins = arcs.filter((a) => a.r === PICTOGRAM_FILLET);
      expect(big.length + joins.length).toBe(arcs.length);
      // corners and knobs turn clockwise with the outline, notches the other way
      expect(big.filter((a) => a.sweep === "1")).toHaveLength(4 + tabs);
      expect(big.filter((a) => a.sweep === "0")).toHaveLength(sockets);
      // each knob or notch has a join on both sides, turning against it
      expect(joins.filter((a) => a.sweep === "0")).toHaveLength(2 * tabs);
      expect(joins.filter((a) => a.sweep === "1")).toHaveLength(2 * sockets);
    }
  });

  it("draws the outline that pictogramContains describes", () => {
    const e = 0.004;
    for (const kinds of PICTOGRAM_ARRANGEMENTS) {
      const points = [...pictogramOf(kinds).path.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)(?= [LAZ]|$)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
      expect(points.length).toBeGreaterThanOrEqual(8);
      for (const [x, y] of points) {
        // every vertex of the path sits on the edge: inside and outside are both within reach
        const near = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => pictogramContains(kinds, x + e * Math.cos((i * Math.PI) / 4), y + e * Math.sin((i * Math.PI) / 4)));
        expect(near).toContain(true);
        expect(near).toContain(false);
      }
    }
  });

  it("eases knobs and notches into the side instead of meeting it at a cusp", () => {
    const tab: Arrangement = ["tab", "socket", "flat", "socket"];
    const notch: Arrangement = ["socket", "tab", "flat", "tab"];
    // beside the root of the top knob or notch, where a bare circle would leave a sharp corner
    expect(pictogramContains(tab, 0.3, -0.01)).toBe(true);
    expect(pictogramContains(notch, 0.3, 0.01)).toBe(false);
    // further out the join has already returned to the side
    expect(pictogramContains(tab, 0.24, -0.03)).toBe(false);
    expect(pictogramContains(notch, 0.24, 0.03)).toBe(true);
  });

  it("puts knobs outside the cell and notches inside it", () => {
    const kinds: Arrangement = ["tab", "socket", "flat", "socket"];
    const reach = PICTOGRAM_RADIUS + PICTOGRAM_KNOB_OFFSET;
    expect(pictogramContains(kinds, 0.5, -reach + 0.01)).toBe(true); // top knob
    expect(pictogramContains(kinds, 0.5, -reach - 0.01)).toBe(false);
    expect(pictogramContains(kinds, 1 - reach + 0.01, 0.5)).toBe(false); // right notch
    expect(pictogramContains(kinds, 1 - reach - 0.01, 0.5)).toBe(true);
    expect(pictogramContains(kinds, 0.5, 0.99)).toBe(true); // flat bottom
    expect(pictogramContains(kinds, 0.5, 1.01)).toBe(false);
    expect(pictogramContains(kinds, 0.01, 0.01)).toBe(false); // rounded corner
  });

  it("centres the view on the area centroid and keeps the whole shape inside it", () => {
    for (const kinds of PICTOGRAM_ARRANGEMENTS) {
      const [x, y, w, h] = viewOf(pictogramOf(kinds).viewBox);
      expect(w).toBe(h);
      // independent centroid estimate on a different grid
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let j = 0; j < 97; j++)
        for (let i = 0; i < 97; i++) {
          const px = x + (w * (i + 0.5)) / 97;
          const py = y + (h * (j + 0.5)) / 97;
          if (pictogramContains(kinds, px, py)) {
            n++;
            sx += px;
            sy += py;
          }
        }
      expect(sx / n).toBeCloseTo(x + w / 2, 2);
      expect(sy / n).toBeCloseTo(y + h / 2, 2);
      // nothing touches the edge of the view
      for (let i = 0; i < 97; i++) {
        const t = (i + 0.5) / 97;
        for (const [px, py] of [
          [x + w * t, y + 0.004],
          [x + w * t, y + h - 0.004],
          [x + 0.004, y + h * t],
          [x + w - 0.004, y + h * t],
        ] as const)
          expect(pictogramContains(kinds, px, py)).toBe(false);
      }
    }
  });
});

describe("piece outline", () => {
  it("is the realistic piece's closed Bézier path inside the icon canvas", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const piece = generatePuzzleIcon({ seed, layout: "single" }).pieces[0]!;
      const { path, viewBox } = pieceOutline({ seed });
      expect(viewBox).toBe("0 0 1 1");
      expect(path.startsWith("M ")).toBe(true);
      expect(path.endsWith(" Z")).toBe(true);
      expect(path.match(/C /g)).toHaveLength(piece.path.length);
      for (const v of path.match(/-?\d+\.\d+/g)!.map(Number)) {
        // control points may overshoot the outline a little; the canvas has a margin
        expect(v).toBeGreaterThan(-0.2);
        expect(v).toBeLessThan(1.2);
      }
    }
  });
});

describe("vectorSvg", () => {
  const g = generatePictogram("alpha");

  it("draws a filled pictogram, hidden from assistive technology by default", () => {
    const svg = vectorSvg(g, { size: 32, color: "#607D9B" });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="32" height="32" viewBox="0 0 1 1" aria-hidden="true">/);
    expect(svg).toContain(`viewBox="${g.viewBox}"`);
    expect(svg).toContain(`<path d="${g.path}" fill="#607D9B"/>`);
    expect(svg).not.toContain("<rect");
    expect(svg.endsWith("</svg></svg>")).toBe(true);
  });

  it("adds a tile, an outline stroke and an escaped accessible name", () => {
    const svg = vectorSvg(pieceOutline({ seed: "alpha" }), { outline: true, background: "#fff", radius: 0.3, scale: 0.6, title: 'A "puzzle" <piece>' });
    expect(svg).toContain('<rect width="1" height="1" rx="0.3" fill="#fff"/>');
    expect(svg).toContain('x="0.2000" y="0.2000" width="0.6000" height="0.6000"');
    expect(svg).toContain('fill="none" stroke="currentColor" stroke-width="1.1"');
    expect(svg).toContain('role="img" aria-label="A &quot;puzzle&quot; &lt;piece&gt;"');
  });
});

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

  it("picks flat colours that stand clear of white, and a light tint", () => {
    for (const set of COLOR_SETS)
      for (const f of set.families) {
        const deepest = Math.min(...f.colors.map((c) => hexToOklch(c)[0]));
        const pic = hexToOklch(pictogramColor(f))[0];
        const tile = hexToOklch(tileColor(f))[0];
        expect(f.colors).toContain(pictogramColor(f));
        expect(f.colors).toContain(tileColor(f));
        expect(pic <= 0.68 + 1e-9 || Math.abs(pic - deepest) < 1e-9).toBe(true);
        expect(tile <= 0.6 + 1e-9 || Math.abs(tile - deepest) < 1e-9).toBe(true);
        expect(tile).toBeLessThanOrEqual(pic + 1e-9);
        expect(hexToOklch(tintColor(f))[0]).toBeGreaterThan(0.93);
      }
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
        const reach = PICTOGRAM_RADIUS / 2 + PICTOGRAM_KNOB_OFFSET / 2;
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
      expect(mosaicFills(m, colors)).toEqual(m.tones.map((t) => colors[t]));
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
        expect([...pts[0]!, ...pts[pts.length - 1]!]).toEqual(ends[i]);
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
