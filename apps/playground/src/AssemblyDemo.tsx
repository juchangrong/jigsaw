import { assembleSinglePieces, deriveSeed, type PuzzleIconOptions } from "@jigsaw/core";
import { PuzzleIcon } from "@jigsaw/react";
import type { RendererPreference } from "@jigsaw/renderer";
import { useEffect, useId, useMemo, useState } from "react";

const GRIDS = [
  { id: "2x2", cols: 2, rows: 2 },
  { id: "3x3", cols: 3, rows: 3 },
  { id: "4x3", cols: 4, rows: 3 },
] as const;
type GridId = (typeof GRIDS)[number]["id"];

/** icon canvas size; the cell is the single-piece scale times this */
const ICON_PX = 132;
/** deterministic scatter for piece i: offset in cells and rotation in degrees */
function scatter(i: number, salt: number): { x: number; y: number; r: number } {
  const h = (k: number) => {
    const v = Math.sin((i + 1) * 12.9898 + salt * 78.233 + k * 37.719) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };
  return { x: h(1) * 0.45, y: h(2) * 0.45, r: h(3) * 14 };
}

/**
 * Picks single-piece icons from seeds derived from the current one that close
 * into a framed puzzle, and shows them fitted together. Each piece is a real
 * <PuzzleIcon>, placed so its cell lands on the grid.
 */
export function AssemblyDemo({ options, renderer, backdrop }: { options: PuzzleIconOptions; renderer: RendererPreference; backdrop: string }) {
  const labelId = useId();
  const [grid, setGrid] = useState<GridId>("3x3");
  const [round, setRound] = useState(0);
  const [assembled, setAssembled] = useState(false);
  const { cols, rows } = GRIDS.find((g) => g.id === grid)!;

  const { layout: _layout, pieceCount: _count, size: _size, ...look } = options;
  const lookKey = JSON.stringify(look);
  const pieces = useMemo(() => {
    const base = deriveSeed(`${String(options.seed)}|assembly`, round);
    for (const poolSize of [240, 600, 1500]) {
      const set = assembleSinglePieces({ ...look, seed: base, size: ICON_PX, cols, rows, poolSize });
      if (set) return set;
    }
    return null;
  }, [lookKey, options.seed, round, cols, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  // a new set arrives scattered, then snaps together on the next frame
  const [shown, setShown] = useState(pieces);
  if (shown !== pieces) {
    setShown(pieces);
    setAssembled(false);
  }
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAssembled(true)));
    return () => cancelAnimationFrame(id);
  }, [pieces]);

  const cell = pieces ? pieces[0]!.cellSize * ICON_PX : 0;
  const pad = Math.round(cell * 0.45);
  const width = cols * cell + 2 * pad;
  const height = rows * cell + 2 * pad;

  return (
    <section className="assembly" aria-labelledby={labelId}>
      <div className="assembly-head">
        <h2 id={labelId}>Assembly</h2>
        <p className="muted">Single pieces from different seeds share one connector, so they close into a puzzle with no gaps.</p>
      </div>
      <div className="toolbar">
        <div
          className="segmented"
          role="radiogroup"
          aria-label="Puzzle size"
          onKeyDown={(e) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (!step) return;
            e.preventDefault();
            const i = (GRIDS.findIndex((g) => g.id === grid) + step + GRIDS.length) % GRIDS.length;
            setGrid(GRIDS[i]!.id);
            (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
          }}
        >
          {GRIDS.map((g) => (
            <button key={g.id} type="button" role="radio" aria-checked={g.id === grid} tabIndex={g.id === grid ? 0 : -1} className={g.id === grid ? "on" : ""} onClick={() => setGrid(g.id)}>
              {g.cols}×{g.rows}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setAssembled((a) => !a)} disabled={!pieces}>
          {assembled ? "Scatter pieces" : "Assemble pieces"}
        </button>
        <button type="button" onClick={() => setRound((r) => r + 1)}>
          Shuffle pieces
        </button>
      </div>
      <div className={`assembly-stage ${backdrop}`}>
        {pieces ? (
          <div className="assembly-board" style={{ width, height }} role="img" aria-label={`${cols} by ${rows} puzzle assembled from ${pieces.length} single-piece icons`}>
            {pieces.map((p, i) => {
              const s = scatter(i, round);
              const x = pad + p.cell[0] * cell - p.cellOrigin[0] * ICON_PX;
              const y = pad + p.cell[1] * cell - p.cellOrigin[1] * ICON_PX;
              return (
                <div
                  key={p.description.metadata.seed}
                  className="assembly-piece"
                  aria-hidden="true"
                  style={{
                    left: x,
                    top: y,
                    transform: assembled ? "none" : `translate(${s.x * cell}px, ${s.y * cell}px) rotate(${s.r}deg)`,
                    transitionDelay: assembled ? `${i * 35}ms` : "0ms",
                  }}
                >
                  <PuzzleIcon {...look} seed={p.description.metadata.seed} layout="single" size={ICON_PX} renderer={renderer} />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">No fitting set found for these options. Try Shuffle pieces.</p>
        )}
      </div>
    </section>
  );
}
