/**
 * Single pieces from different seeds assemble into a framed puzzle with no
 * gaps: a 3×3 whose outer sides are flat and whose interior seams are all
 * tab-against-socket, like a real jigsaw. The assembled image is written to
 * tests/__output__/assembly-3x3.png for inspection.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assembleSinglePieces,
  buildRenderPlan,
  flattenPath,
  generatePuzzleIcon,
  rasterizeMask,
  resolveOptions,
  SIDES,
  singlePieceKinds,
  type PuzzleIconDescription,
  type PuzzleIconOptions,
  type Vec2,
} from "@jigsaw/core";
import { encodePNG, unpremultiply } from "@jigsaw/export";
import { renderPlanCpu } from "../packages/renderer/src/cpu";

const N = 3;

describe("assembleSinglePieces", () => {
  it("builds a framed puzzle: flat outside, tab against socket inside", () => {
    for (const [cols, rows] of [
      [2, 2],
      [3, 3],
      [4, 3],
    ] as const) {
      const set = assembleSinglePieces({ seed: `frame-${cols}x${rows}`, size: 256, cols, rows })!;
      expect(set).toHaveLength(cols * rows);
      const at = (x: number, y: number) => set.find((p) => p.cell[0] === x && p.cell[1] === y)!.description.pieces[0]!.sides;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const s = at(x, y);
          expect(s.top.kind === "flat").toBe(y === 0);
          expect(s.left.kind === "flat").toBe(x === 0);
          expect(s.right.kind === "flat").toBe(x === cols - 1);
          expect(s.bottom.kind === "flat").toBe(y === rows - 1);
          if (x > 0) expect(new Set([s.left.kind, at(x - 1, y).right.kind])).toEqual(new Set(["tab", "socket"]));
          if (y > 0) expect(new Set([s.top.kind, at(x, y - 1).bottom.kind])).toEqual(new Set(["tab", "socket"]));
        }
      expect(new Set(set.map((p) => p.description.metadata.seed)).size).toBe(cols * rows);
    }
  });

  it("is deterministic and reports where each cell sits in its icon", () => {
    const a = assembleSinglePieces({ seed: "same", size: 128, cols: 3, rows: 2 })!;
    const b = assembleSinglePieces({ seed: "same", size: 128, cols: 3, rows: 2 })!;
    expect(a.map((p) => p.description.metadata.seed)).toEqual(b.map((p) => p.description.metadata.seed));
    for (const p of a) {
      const t = p.description.pieces[0]!.transform;
      expect(p.cellSize).toBe(t.scale);
      // the cell's top-left corner maps to cellOrigin in icon units
      expect(p.cellOrigin[0]).toBeCloseTo(t.x - t.scale * t.pivot[0], 12);
      expect(p.cellOrigin[1]).toBeCloseTo(t.y - t.scale * t.pivot[1], 12);
    }
  });

  it("has no answer for a single cell", () => {
    expect(assembleSinglePieces({ seed: 1, cols: 1, rows: 1 })).toBeNull();
  });
});

describe("single pieces assemble without gaps", () => {
  const set = assembleSinglePieces({ seed: "asm", size: 256, cols: N, rows: N })?.map((p) => p.description) ?? null;

  it("finds a framed 3×3 from different seeds", () => {
    expect(set).not.toBeNull();
    expect(new Set(set!.map((d) => d.metadata.seed)).size).toBe(N * N);
  });

  it("leaves no gap, overlap or hole between pieces", async () => {
    const tex = 0.0025;
    const o = -0.35;
    const n = Math.ceil((N + 0.7) / tex);
    const cover = new Uint8Array(n * n);
    let overlap = 0;
    set!.forEach((d, i) => {
      const cx = i % N;
      const cy = Math.floor(i / N);
      const poly = flattenPath(d.pieces[0]!.path, 0.0005).map((p): Vec2 => [p[0] + cx, p[1] + cy]);
      const m = rasterizeMask(poly, n, n, o, o, tex);
      for (let j = 0; j < n * n; j++) {
        if (m[j] && cover[j]) overlap++;
        cover[j] |= m[j]!;
      }
    });
    expect(overlap).toBe(0);

    // every uncovered texel inside the puzzle's outline sits at one of its four
    // rounded frame corners; anywhere else would be a gap
    const corner = 0.2;
    const gaps: Vec2[] = [];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (cover[y * n + x]) continue;
        const px = o + (x + 0.5) * tex;
        const py = o + (y + 0.5) * tex;
        const inside = px > tex && px < N - tex && py > tex && py < N - tex;
        const atFrameCorner = (px < corner || px > N - corner) && (py < corner || py > N - corner);
        if (inside && !atFrameCorner) gaps.push([px, py]);
      }
    expect(gaps).toEqual([]);

    // render the assembled puzzle for a look
    const s = 0.84 / N;
    const desc: PuzzleIconDescription = {
      ...set![0]!,
      size: 768,
      background: "#FFFFFF",
      pieces: set!.map((d, i) => ({
        ...d.pieces[0]!,
        id: `p${i}`,
        transform: { x: 0.08 + s * (i % N), y: 0.08 + s * Math.floor(i / N), rotation: 0, scale: s, pivot: [0, 0] },
      })),
    };
    const px = renderPlanCpu(buildRenderPlan(desc, { size: 768 }));
    mkdirSync("tests/__output__", { recursive: true });
    writeFileSync("tests/__output__/assembly-3x3.png", await encodePNG({ width: 768, height: 768, data: unpremultiply(px) }));
  });
});

describe("singlePieceKinds", () => {
  it("matches the generated piece for any seed and geometry, whatever the other options", () => {
    const looks: Omit<PuzzleIconOptions, "seed">[] = [
      {},
      { geometry: { tabSize: 0, curvature: 1, asymmetry: 1 } },
      { geometry: { tabSize: 1 }, size: 24, gradient: { palette: "slate" }, stamp: { text: "A" } },
    ];
    for (const look of looks)
      for (let i = 0; i < 200; i++) {
        const options: PuzzleIconOptions = { ...look, seed: `kinds-${i}`, layout: "single" };
        const sides = generatePuzzleIcon(options).pieces[0]!.sides;
        const kinds = singlePieceKinds(resolveOptions(options));
        for (const s of SIDES) expect(kinds[s]).toBe(sides[s].kind);
      }
  });

  it("keeps the assembly independent of everything but seed and geometry", () => {
    const seeds = (o: Partial<PuzzleIconOptions>) => assembleSinglePieces({ seed: "indep", cols: 3, rows: 3, ...o })!.map((p) => p.description.metadata.seed);
    expect(seeds({ size: 32, gradient: { palette: "sage" }, material: { preset: "matteAcrylic" } })).toEqual(seeds({}));
  });
});
