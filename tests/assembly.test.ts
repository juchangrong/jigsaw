/**
 * Single pieces from different seeds assemble into a framed puzzle with no
 * gaps: a 3×3 whose outer sides are flat and whose interior seams are all
 * tab-against-socket, like a real jigsaw. The assembled image is written to
 * tests/__output__/assembly-3x3.png for inspection.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildRenderPlan,
  flattenPath,
  generatePuzzleIcon,
  rasterizeMask,
  type EdgeKind,
  type PuzzleIconDescription,
  type Side,
  type Vec2,
} from "@jigsaw/core";
import { encodePNG, unpremultiply } from "@jigsaw/export";
import { renderPlanCpu } from "../packages/renderer/src/cpu";

const N = 3;
const pool = Array.from({ length: 800 }, (_, i) => generatePuzzleIcon({ seed: `asm-${i}`, size: 256 }));
const kind = (d: PuzzleIconDescription, s: Side): EdgeKind => d.pieces[0]!.sides[s].kind;
const opposite = (k: EdgeKind): EdgeKind => (k === "tab" ? "socket" : k === "socket" ? "tab" : "flat");

/** Pick one seed per cell, row by row: outer sides flat, interior sides
 * complementary to the neighbour already placed. */
function assemble(): PuzzleIconDescription[] | null {
  const grid: PuzzleIconDescription[] = [];
  const used = new Set<PuzzleIconDescription>();
  const want = (i: number, d: PuzzleIconDescription) => {
    const x = i % N;
    const y = Math.floor(i / N);
    const edge = (s: Side, outer: boolean, need?: EdgeKind) => (outer ? kind(d, s) === "flat" : kind(d, s) !== "flat" && (!need || kind(d, s) === need));
    return (
      edge("top", y === 0, y > 0 ? opposite(kind(grid[i - N]!, "bottom")) : undefined) &&
      edge("left", x === 0, x > 0 ? opposite(kind(grid[i - 1]!, "right")) : undefined) &&
      edge("right", x === N - 1) &&
      edge("bottom", y === N - 1)
    );
  };
  const place = (i: number): boolean => {
    if (i === N * N) return true;
    for (const d of pool) {
      if (used.has(d) || !want(i, d)) continue;
      grid[i] = d;
      used.add(d);
      if (place(i + 1)) return true;
      used.delete(d);
    }
    return false;
  };
  return place(0) ? grid : null;
}

describe("single pieces assemble without gaps", () => {
  const set = assemble();

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
