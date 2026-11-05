/**
 * Single pieces generated from different seeds fit each other: a tab on one
 * piece closes exactly into a socket on another placed next to it.
 */
import { describe, expect, it } from "vitest";
import { flattenPath, generatePuzzleIcon, SIDES, type PuzzleIconDescription, type Side, type Vec2 } from "@jigsaw/core";

const SEEDS = Array.from({ length: 120 }, (_, i) => `interlock-${i}`);
const piece = (d: PuzzleIconDescription) => d.pieces[0]!;

function distToPolyline(p: Vec2, poly: Vec2[]): number {
  let best = Infinity;
  for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
    const a = poly[k]!;
    const b = poly[i]!;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / (ex * ex + ey * ey || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey));
  }
  return best;
}

/** Which side faces which when piece B sits next to piece A, and the offset of B's cell. */
const NEIGHBOUR: Record<Side, { opposite: Side; offset: Vec2 }> = {
  right: { opposite: "left", offset: [1, 0] },
  left: { opposite: "right", offset: [-1, 0] },
  bottom: { opposite: "top", offset: [0, 1] },
  top: { opposite: "bottom", offset: [0, -1] },
};

/** Outline points beyond the shared side (inside the neighbour's cell) and in
 * the connector band along it, piece-local coordinates of A. The band leaves out
 * the rounded corners, which meet as separate notches at the seam. */
function beyond(pts: Vec2[], s: Side, depth: number): Vec2[] {
  const eps = 0.004;
  const reach = depth + 0.01;
  const inBand = (v: number) => v > 0.2 && v < 0.8;
  const out = (d: number) => d > eps && d < reach;
  if (s === "right") return pts.filter((p) => out(p[0] - 1) && inBand(p[1]));
  if (s === "left") return pts.filter((p) => out(-p[0]) && inBand(p[1]));
  if (s === "bottom") return pts.filter((p) => out(p[1] - 1) && inBand(p[0]));
  return pts.filter((p) => out(-p[1]) && inBand(p[0]));
}

describe("single pieces interlock across seeds", () => {
  const icons = SEEDS.map((seed) => generatePuzzleIcon({ seed, size: 256 }));

  it("share one connector: every tab and socket has the same parameters", () => {
    const params = icons.flatMap((d) =>
      SIDES.map((s) => piece(d).sides[s].edge)
        .filter((e) => e.kind !== "flat")
        .map(({ center, width, depth, neckWidth, asymmetry, curvature }) => ({ center, width, depth, neckWidth, asymmetry, curvature })),
    );
    expect(params.length).toBeGreaterThan(200);
    for (const p of params) expect(p).toEqual(params[0]);
    expect(params[0]!.center).toBe(0.5);
    expect(params[0]!.asymmetry).toBe(0);
  });

  it("draw the cell at the same size in every icon", () => {
    const scales = new Set(icons.map((d) => piece(d).transform.scale));
    expect(scales.size).toBe(1);
  });

  it("close a tab exactly into another seed's socket on every side", () => {
    let pairs = 0;
    for (const s of SIDES) {
      const { opposite, offset } = NEIGHBOUR[s];
      const a = icons.find((d) => piece(d).sides[s].kind === "tab");
      const b = icons.find((d) => d !== a && piece(d).sides[opposite].kind === "socket");
      expect(a, `a piece with a ${s} tab`).toBeDefined();
      expect(b, `a piece with a ${opposite} socket`).toBeDefined();
      const pa = flattenPath(piece(a!).path, 0.0005);
      const pb = flattenPath(piece(b!).path, 0.0005);
      // the part of A's tab that crosses into B's cell, and the outline of B's
      // socket seen from A
      const depth = piece(a!).sides[s].edge.depth;
      const tab = beyond(pa, s, depth);
      const socket = pb.map((p): Vec2 => [p[0] + offset[0], p[1] + offset[1]]);
      expect(tab.length).toBeGreaterThan(20);
      for (const p of tab) expect(distToPolyline(p, socket)).toBeLessThan(0.002);
      // and every point of B's socket wall lies on A's tab: no gap either way
      const wall = beyond(socket, s, depth);
      expect(wall.length).toBeGreaterThan(20);
      for (const p of wall) expect(distToPolyline(p, pa)).toBeLessThan(0.002);
      pairs++;
    }
    expect(pairs).toBe(4);
  });
});
