import { describe, expect, it } from "vitest";
import {
  applyTransform,
  EDGE_LIMITS,
  flattenPath,
  generatePuzzleIcon,
  MIN_NECK_PX,
  pointInPolygon,
  polygonArea,
  polygonSelfIntersects,
  polygonsOverlap,
  reverseSegment,
  SIDES,
  validKinds,
  type BezierSegment,
  type LayoutKind,
  type PieceDescription,
  type Vec2,
} from "@jigsaw/core";

const seeds = (n: number, prefix = "s") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const close = (a: Vec2, b: Vec2, eps = 1e-9) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
const segClose = (a: BezierSegment, b: BezierSegment) =>
  close(a.p0, b.p0) && close(a.p1, b.p1) && close(a.p2, b.p2) && close(a.p3, b.p3);
const toWorld = (p: PieceDescription) =>
  p.path.map((s) => {
    const f = (q: Vec2): Vec2 => [q[0] + p.cell[0], q[1] + p.cell[1]];
    return { p0: f(s.p0), p1: f(s.p1), p2: f(s.p2), p3: f(s.p3) };
  });

describe("single piece", () => {
  const icons = seeds(100).map((seed) => generatePuzzleIcon({ seed, size: 128 }));

  // Single pieces share one connector so any two fit together (see
  // tests/interlock.test.ts); an outline is therefore set by its side kinds.
  it("varies the outline through its side kinds", () => {
    const kindsOf = (d: (typeof icons)[number]) => SIDES.map((s) => d.pieces[0]!.sides[s].kind).join(",");
    const byKinds = new Map<string, Set<string>>();
    for (const d of icons) {
      const k = kindsOf(d);
      if (!byKinds.has(k)) byKinds.set(k, new Set());
      byKinds.get(k)!.add(d.pieces[0]!.geometryKey);
    }
    // the same kinds always give the same outline, different kinds a different one
    for (const keys of byKinds.values()) expect(keys.size).toBe(1);
    const outlines = new Set([...byKinds.values()].map((k) => [...k][0]));
    expect(outlines.size).toBe(byKinds.size);
    // 100 seeds reach a wide spread of the valid kind combinations
    expect(byKinds.size).toBeGreaterThanOrEqual(30);
  });

  it("paths are closed and continuous", () => {
    for (const d of icons) {
      const path = d.pieces[0]!.path;
      for (let i = 0; i < path.length; i++) {
        expect(close(path[i]!.p3, path[(i + 1) % path.length]!.p0)).toBe(true);
      }
    }
  });

  it("never self-intersects", () => {
    for (const d of icons) expect(polygonSelfIntersects(flattenPath(d.pieces[0]!.path, 0.004))).toBe(false);
  });

  it("is clockwise on screen with a reasonable area", () => {
    for (const d of icons) {
      const area = polygonArea(flattenPath(d.pieces[0]!.path, 0.004));
      // y-down clockwise ⇒ positive shoelace area
      expect(area).toBeGreaterThan(0.65);
      expect(area).toBeLessThan(1.45);
    }
  });

  it("obeys the edge-kind rules and stays balanced", () => {
    for (const d of icons) {
      const p = d.pieces[0]!;
      const kinds = SIDES.map((s) => p.sides[s].kind);
      expect(validKinds(kinds)).toBe(true);
      expect(kinds.filter((k) => k === "tab").length).toBeLessThanOrEqual(3);
      const w = p.bounds.maxX - p.bounds.minX;
      const h = p.bounds.maxY - p.bounds.minY;
      expect(Math.max(w / h, h / w)).toBeLessThan(1.35);
    }
  });

  it("points tabs outward and sockets inward", () => {
    for (const d of icons) {
      const p = d.pieces[0]!;
      const poly = flattenPath(p.path, 0.004);
      const reach = {
        top: -Math.min(...poly.map((q) => q[1])),
        bottom: Math.max(...poly.map((q) => q[1])) - 1,
        left: -Math.min(...poly.map((q) => q[0])),
        right: Math.max(...poly.map((q) => q[0])) - 1,
      };
      for (const s of SIDES) {
        const side = p.sides[s];
        if (side.kind === "tab") expect(reach[s]).toBeGreaterThan(EDGE_LIMITS.depth[0] - 1e-6);
        else expect(reach[s]).toBeLessThan(1e-6);
        if (side.kind === "socket") {
          // the point a little inside the side's centre must be outside the piece
          const c = side.edge.center;
          const probe: Record<string, Vec2> = {
            top: [c, 0.05],
            right: [0.95, c],
            bottom: [1 - c, 0.95],
            left: [0.05, 1 - c],
          };
          expect(pointInPolygon(probe[s]!, poly)).toBe(false);
        }
      }
    }
  });

  it("keeps necks wide enough (parameter limits and pixel minimum)", () => {
    for (const size of [24, 32, 128]) {
      for (const seed of seeds(30, "n")) {
        const d = generatePuzzleIcon({ seed, size });
        const p = d.pieces[0]!;
        const minPx = Math.min(EDGE_LIMITS.neckWidth[1], MIN_NECK_PX / (p.transform.scale * size));
        for (const s of SIDES) {
          const e = p.sides[s].edge;
          if (e.kind === "flat") continue;
          expect(e.neckWidth).toBeGreaterThanOrEqual(EDGE_LIMITS.neckWidth[0]);
          expect(e.neckWidth).toBeGreaterThanOrEqual(minPx - 1e-9);
          expect(e.width).toBeGreaterThanOrEqual(e.neckWidth + EDGE_LIMITS.headOverNeck - 1e-9);
          expect(e.center).toBeGreaterThanOrEqual(EDGE_LIMITS.center[0]);
          expect(e.center).toBeLessThanOrEqual(EDGE_LIMITS.center[1]);
          expect(e.depth).toBeGreaterThanOrEqual(EDGE_LIMITS.depth[0]);
          expect(e.depth).toBeLessThanOrEqual(EDGE_LIMITS.depth[1]);
        }
      }
    }
  });
});

describe("multi-piece layouts", () => {
  const cases: { layout: LayoutKind; pieceCount: number }[] = [
    { layout: "cluster", pieceCount: 2 },
    { layout: "cluster", pieceCount: 3 },
    { layout: "cluster", pieceCount: 5 },
    { layout: "grid", pieceCount: 4 },
    { layout: "grid", pieceCount: 9 },
  ];

  for (const c of cases) {
    describe(`${c.layout} ×${c.pieceCount}`, () => {
      const icons = seeds(25, `${c.layout}${c.pieceCount}-`).map((seed) => generatePuzzleIcon({ seed, size: 256, ...c }));

      it("has the requested piece count and connected shared edges", () => {
        for (const d of icons) {
          expect(d.pieces.length).toBe(c.pieceCount);
          expect(d.sharedEdges.length).toBeGreaterThanOrEqual(c.pieceCount - 1);
        }
      });

      it("shared edges match exactly, traversed in opposite directions", () => {
        for (const d of icons) {
          const byId = new Map(d.pieces.map((p) => [p.id, p]));
          for (const e of d.sharedEdges) {
            const a = toWorld(byId.get(e.ownerA)!);
            const b = toWorld(byId.get(e.ownerB)!);
            for (const seg of e.geometry) {
              expect(a.some((s) => segClose(s, seg))).toBe(true);
              expect(b.some((s) => segClose(s, reverseSegment(seg)))).toBe(true);
            }
          }
        }
      });

      it("a tab on one side is a socket on the other", () => {
        for (const d of icons) {
          const byId = new Map(d.pieces.map((p) => [p.id, p]));
          for (const e of d.sharedEdges) {
            const sideA = Object.values(byId.get(e.ownerA)!.sides).find((s) => s.sharedEdgeId === e.id)!;
            const sideB = Object.values(byId.get(e.ownerB)!.sides).find((s) => s.sharedEdgeId === e.id)!;
            expect(sideA.kind).not.toBe("flat");
            expect(sideB.kind).toBe(sideA.kind === "tab" ? "socket" : "tab");
            expect(sideA.reversed).toBe(false);
            expect(sideB.reversed).toBe(true);
          }
        }
      });

      it("every piece is valid and inside the icon bounds", () => {
        for (const d of icons) {
          for (const p of d.pieces) {
            const poly = flattenPath(p.path, 0.005);
            expect(polygonSelfIntersects(poly)).toBe(false);
            if (c.layout !== "grid") expect(validKinds(SIDES.map((s) => p.sides[s].kind))).toBe(true);
            for (const q of poly) {
              const [x, y] = applyTransform(p.transform, q);
              expect(x).toBeGreaterThan(0.02);
              expect(x).toBeLessThan(0.98);
              expect(y).toBeGreaterThan(0.02);
              expect(y).toBeLessThan(0.98);
            }
          }
        }
      });

      it("pieces do not overlap", () => {
        for (const d of icons) {
          if (c.layout === "grid") {
            // grid pieces stay exactly interlocked; the gap is an SDF inset
            const k = d.pieces[0]!.transform.scale;
            const p0 = d.pieces[0]!;
            for (const p of d.pieces) {
              expect(p.inset).toBeGreaterThan(0);
              expect(p.transform.rotation).toBe(0);
              expect(p.transform.x - p0.transform.x).toBeCloseTo((p.cell[0] - p0.cell[0]) * k, 12);
              expect(p.transform.y - p0.transform.y).toBeCloseTo((p.cell[1] - p0.cell[1]) * k, 12);
            }
          } else {
            const polys = d.pieces.map((p) => flattenPath(p.path, 0.01).map((q) => applyTransform(p.transform, q)));
            expect(polygonsOverlap(polys)).toBe(false);
          }
        }
      });
    });
  }
});

describe("corner rounding", () => {
  // Distance from a sharp cell corner to the nearest outline point (piece-local
  // units): larger means rounder.
  const sampled = (o: Parameters<typeof generatePuzzleIcon>[0]) => {
    const d = generatePuzzleIcon(o);
    return d.pieces.map((p) => ({ p, flat: flattenPath(p.path, 0.002) }));
  };
  const nearest = (poly: [number, number][], cx: number, cy: number) => Math.min(...poly.map((q) => Math.hypot(q[0] - cx, q[1] - cy)));

  it("rounds a single piece's corner only where both sides are flat", () => {
    // corner (cx, cy) sits between these two sides
    const corners = [
      { at: [0, 0], sides: ["left", "top"] },
      { at: [1, 0], sides: ["top", "right"] },
      { at: [1, 1], sides: ["right", "bottom"] },
      { at: [0, 1], sides: ["bottom", "left"] },
    ] as const;
    let soft = 0;
    let square = 0;
    for (let i = 0; i < 60; i++) {
      const [{ p, flat }] = sampled({ seed: `corner-${i}` });
      for (const c of corners) {
        const frame = c.sides.every((s) => p.sides[s].kind === "flat");
        const d = nearest(flat!, c.at[0], c.at[1]);
        // a circular corner of radius r sits r(√2 − 1) from the sharp corner
        if (frame) {
          expect(d).toBeGreaterThan(0.045);
          soft++;
        } else {
          expect(d).toBeLessThan(1e-9);
          square++;
        }
      }
    }
    expect(soft).toBeGreaterThan(5);
    expect(square).toBeGreaterThan(50);
  });

  it("keeps square corners where grid pieces meet and soft ones on the outside", () => {
    const pieces = sampled({ seed: "corner-grid", layout: "grid", pieceCount: 4 });
    const topLeft = pieces.find(({ p }) => p.cell[0] === 0 && p.cell[1] === 0)!;
    // outer corner of the 2×2 grid vs the shared centre vertex, in piece-local units
    expect(nearest(topLeft.flat, 0, 0)).toBeGreaterThan(0.045);
    expect(nearest(topLeft.flat, 1, 1)).toBeLessThan(1e-9);
  });
});
