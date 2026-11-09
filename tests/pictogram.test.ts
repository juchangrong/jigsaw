/**
 * Vector forms of a piece: the geometric pictogram, the realistic outline,
 * the standalone SVG, and the colour families that go with them.
 */
import { describe, expect, it } from "vitest";
import {
  COLOR_SETS,
  colorFamily,
  generatePictogram,
  generatePuzzleIcon,
  hexToOklch,
  isIconicArrangement,
  PICTOGRAM_ARRANGEMENTS,
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
  it("is one closed path of lines and equal-radius arcs", () => {
    for (const kinds of PICTOGRAM_ARRANGEMENTS) {
      const { path } = pictogramOf(kinds);
      expect(path.startsWith("M ")).toBe(true);
      expect(path.endsWith(" Z")).toBe(true);
      expect(path).not.toMatch(/[CQSTHV]/);
      const arcs = [...path.matchAll(/A (\S+) (\S+) 0 ([01]) ([01])/g)];
      // four corners plus one arc per knob or notch
      expect(arcs).toHaveLength(4 + kinds.filter((k) => k !== "flat").length);
      for (const a of arcs) expect([Number(a[1]), Number(a[2])]).toEqual([PICTOGRAM_RADIUS, PICTOGRAM_RADIUS]);
      // knobs turn clockwise (sweep 1), notches the other way; both take the larger arc
      const large = arcs.filter((a) => a[3] === "1");
      expect(large.filter((a) => a[4] === "1")).toHaveLength(kinds.filter((k) => k === "tab").length);
      expect(large.filter((a) => a[4] === "0")).toHaveLength(kinds.filter((k) => k === "socket").length);
    }
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
