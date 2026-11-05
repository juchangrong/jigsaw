import { generatePuzzleIcon } from "./generate";
import { deriveSeed } from "./prng";
import type { EdgeKind, PuzzleIconDescription, PuzzleIconOptions, Side, Vec2 } from "./types";

export interface AssemblyOptions extends Omit<PuzzleIconOptions, "layout" | "pieceCount"> {
  cols: number;
  rows: number;
  /** how many seeds derived from `seed` to search (default 600) */
  poolSize?: number;
}

export interface AssembledPiece {
  description: PuzzleIconDescription;
  /** grid cell (column, row) */
  cell: [number, number];
  /** top-left of the piece's cell inside its own icon, in icon units ([0,1]²) */
  cellOrigin: Vec2;
  /** cell side length in icon units */
  cellSize: number;
}

const opposite = (k: EdgeKind): EdgeKind => (k === "tab" ? "socket" : k === "socket" ? "tab" : "flat");
const kindsKey = (d: PuzzleIconDescription) => {
  const s = d.pieces[0]!.sides;
  return `${s.top.kind},${s.right.kind},${s.bottom.kind},${s.left.kind}`;
};

/**
 * Pick single-piece icons, from seeds derived from `options.seed`, that
 * assemble into a framed `cols × rows` puzzle: outer sides flat, every interior
 * seam a tab against a socket. Single pieces share one connector and one
 * scale, so the result closes with no gaps. Returns null if the pool has no
 * fitting set. Deterministic for the same options.
 */
export function assembleSinglePieces(options: AssemblyOptions): AssembledPiece[] | null {
  const { cols, rows, poolSize = 600, ...rest } = options;
  if (cols < 1 || rows < 1) throw new Error("An assembly needs at least one column and one row");
  // a single piece needs at least one connector, so a 1×1 frame cannot exist
  if (cols * rows < 2) return null;

  const byKinds = new Map<string, PuzzleIconDescription[]>();
  for (let i = 0; i < poolSize; i++) {
    const d = generatePuzzleIcon({ ...rest, seed: deriveSeed(options.seed, i), layout: "single" });
    const k = kindsKey(d);
    if (!byKinds.has(k)) byKinds.set(k, []);
    byKinds.get(k)!.push(d);
  }

  const n = cols * rows;
  const grid: PuzzleIconDescription[] = [];
  const used = new Set<PuzzleIconDescription>();
  const kind = (d: PuzzleIconDescription, s: Side) => d.pieces[0]!.sides[s].kind;
  // kinds the cell must have on each side; "inner" means any connector
  const needs = (i: number): Record<Side, EdgeKind | "inner"> => {
    const x = i % cols;
    const y = Math.floor(i / cols);
    return {
      top: y === 0 ? "flat" : opposite(kind(grid[i - cols]!, "bottom")),
      left: x === 0 ? "flat" : opposite(kind(grid[i - 1]!, "right")),
      right: x === cols - 1 ? "flat" : "inner",
      bottom: y === rows - 1 ? "flat" : "inner",
    };
  };
  const candidates = (need: Record<Side, EdgeKind | "inner">) => {
    const out: PuzzleIconDescription[] = [];
    const opts = (s: Side): EdgeKind[] => (need[s] === "inner" ? ["tab", "socket"] : [need[s] as EdgeKind]);
    for (const t of opts("top"))
      for (const r of opts("right"))
        for (const b of opts("bottom"))
          for (const l of opts("left")) for (const d of byKinds.get(`${t},${r},${b},${l}`) ?? []) out.push(d);
    return out;
  };
  const place = (i: number): boolean => {
    if (i === n) return true;
    for (const d of candidates(needs(i))) {
      if (used.has(d)) continue;
      grid[i] = d;
      used.add(d);
      if (place(i + 1)) return true;
      used.delete(d);
    }
    return false;
  };
  if (!place(0)) return null;

  return grid.map((d, i) => {
    const t = d.pieces[0]!.transform;
    return {
      description: d,
      cell: [i % cols, Math.floor(i / cols)],
      cellOrigin: [t.x - t.scale * t.pivot[0], t.y - t.scale * t.pivot[1]],
      cellSize: t.scale,
    };
  });
}
