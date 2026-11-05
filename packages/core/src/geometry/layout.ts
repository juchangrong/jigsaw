import { createRng, hashString, type Rng } from "../prng";
import type {
  BezierSegment,
  Bounds,
  EdgeKind,
  LayoutKind,
  PieceSide,
  PieceTransform,
  PuzzleEdge,
  ResolvedOptions,
  SharedEdge,
  Side,
  Vec2,
} from "../types";
import { SIDES } from "../types";
import { flattenPath, mapSegment, pathBounds, pointInPolygon, polygonBounds, reversePath } from "./bezier";
import { cornerArc, placeEdge, randomEdge, sanitizeEdge, SOFT_CORNER, SQUARE_CORNER, standardEdge, trimEdgeEnds, type CornerShape, type EdgeBias } from "./edge";

/** Minimum neck width in output pixels. */
export const MIN_NECK_PX = 3;
/** Corner rounding radius in piece units. */
export const CORNER_RADIUS = SOFT_CORNER.trim;

export interface LayoutPiece {
  id: string;
  cell: [number, number];
  sides: Record<Side, PieceSide>;
  path: BezierSegment[];
  bounds: Bounds;
  transform: PieceTransform;
  /** SDF erosion in piece units (gap between neighbours) */
  inset: number;
  geometryKey: string;
}

export interface LayoutResult {
  layout: LayoutKind;
  pieces: LayoutPiece[];
  sharedEdges: SharedEdge[];
  /** icon units per piece unit */
  scale: number;
}

const SIDE_FRAME: Record<Side, { a: Vec2; b: Vec2; n: Vec2; d: [number, number] }> = {
  // clockwise on screen (y down); d = neighbour offset
  top: { a: [0, 0], b: [1, 0], n: [0, -1], d: [0, -1] },
  right: { a: [1, 0], b: [1, 1], n: [1, 0], d: [1, 0] },
  bottom: { a: [1, 1], b: [0, 1], n: [0, 1], d: [0, 1] },
  left: { a: [0, 1], b: [0, 0], n: [-1, 0], d: [-1, 0] },
};

const flip = (k: EdgeKind): EdgeKind => (k === "tab" ? "socket" : k === "socket" ? "tab" : "flat");
const cellKey = (c: [number, number]) => `${c[0]},${c[1]}`;

function chooseCells(layout: LayoutKind, count: number, rng: Rng): [number, number][] {
  if (layout === "single") return [[0, 0]];
  if (layout === "grid") {
    const n = count >= 9 ? 3 : 2;
    const cells: [number, number][] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) cells.push([i, j]);
    return cells;
  }
  // cluster: grow a compact connected patch inside a 3×3 grid
  const target = Math.min(5, Math.max(2, count));
  const chosen = new Map<string, [number, number]>([["1,1", [1, 1]]]);
  while (chosen.size < target) {
    const frontier: [number, number][] = [];
    for (const c of chosen.values()) {
      for (const s of SIDES) {
        const d = SIDE_FRAME[s].d;
        const n: [number, number] = [c[0] + d[0], c[1] + d[1]];
        if (n[0] < 0 || n[1] < 0 || n[0] > 2 || n[1] > 2 || chosen.has(cellKey(n))) continue;
        // weight cells with more chosen neighbours (keeps the patch compact)
        let nb = 0;
        for (const s2 of SIDES) {
          const d2 = SIDE_FRAME[s2].d;
          if (chosen.has(cellKey([n[0] + d2[0], n[1] + d2[1]]))) nb++;
        }
        for (let w = 0; w < nb * nb; w++) frontier.push(n);
      }
    }
    const pick = rng.pick(frontier);
    chosen.set(cellKey(pick), pick);
  }
  const cells = [...chosen.values()];
  const minI = Math.min(...cells.map((c) => c[0]));
  const minJ = Math.min(...cells.map((c) => c[1]));
  return cells
    .map((c) => [c[0] - minI, c[1] - minJ] as [number, number])
    .sort((p, q) => p[1] - q[1] || p[0] - q[0]);
}

/** Per-piece validity rules for the edge kinds (top, right, bottom, left). */
export function validKinds(kinds: EdgeKind[]): boolean {
  const tabs = kinds.filter((k) => k === "tab").length;
  const nonFlat = kinds.filter((k) => k !== "flat").length;
  const allSame = kinds.every((k) => k === kinds[0]);
  return nonFlat >= 1 && tabs <= 3 && !allSame;
}

/** Bounding-box aspect ratio of a unit cell with the given kinds and depths. */
function aspectFor(kinds: Record<Side, EdgeKind>, depth: Record<Side, number>): number {
  const ext = (s: Side) => (kinds[s] === "tab" ? depth[s] : 0);
  const w = 1 + ext("left") + ext("right");
  const h = 1 + ext("top") + ext("bottom");
  return Math.max(w / h, h / w);
}

interface EdgeSlot {
  edge: PuzzleEdge;
  shared: boolean;
  /** world-space geometry in owner A's direction */
  geometry: BezierSegment[];
  ownerA: string;
  ownerB?: string;
  /** which side of owner A this is (boundary edges only) */
  side?: Side;
  /** world-space side for owner A */
  a: Vec2;
  b: Vec2;
  n: Vec2;
}

function pieceId(c: [number, number]) {
  return `p${c[0]}_${c[1]}`;
}

export function buildLayout(opts: ResolvedOptions): LayoutResult {
  const layoutRng = createRng(opts.seed, "layout");
  const geomRng = createRng(opts.seed, "geometry");
  const cells = chooseCells(opts.layout, opts.pieceCount, layoutRng);
  const present = new Set(cells.map(cellKey));
  const bias: EdgeBias = {
    tabSize: opts.geometry.tabSize,
    curvature: opts.geometry.curvature,
    asymmetry: opts.geometry.asymmetry,
  };

  // 1. topology: which edges exist and what kind they are
  const slots = new Map<string, EdgeSlot>();
  const pieceSides = new Map<string, Record<Side, { slot: string; reversed: boolean }>>();
  for (const c of cells) pieceSides.set(pieceId(c), {} as Record<Side, { slot: string; reversed: boolean }>);

  const worldFrame = (c: [number, number], s: Side) => {
    const f = SIDE_FRAME[s];
    return {
      a: [c[0] + f.a[0], c[1] + f.a[1]] as Vec2,
      b: [c[0] + f.b[0], c[1] + f.b[1]] as Vec2,
      n: f.n,
    };
  };

  // shared edges: owner A is the left / upper piece
  for (const c of cells) {
    for (const s of ["right", "bottom"] as const) {
      const d = SIDE_FRAME[s].d;
      const nb: [number, number] = [c[0] + d[0], c[1] + d[1]];
      if (!present.has(cellKey(nb))) continue;
      const id = `${s === "right" ? "v" : "h"}${nb[0]}_${nb[1]}`;
      const kind: EdgeKind = geomRng.bool() ? "tab" : "socket";
      const edge = randomEdge(geomRng.fork(id), id, kind, bias);
      const wf = worldFrame(c, s);
      slots.set(id, { edge, shared: true, geometry: [], ownerA: pieceId(c), ownerB: pieceId(nb), ...wf });
      pieceSides.get(pieceId(c))![s] = { slot: id, reversed: false };
      pieceSides.get(pieceId(nb))![s === "right" ? "left" : "top"] = { slot: id, reversed: true };
    }
  }

  // boundary edges, chosen per piece so each piece obeys the rules
  for (const c of cells) {
    const pid = pieceId(c);
    const sides = pieceSides.get(pid)!;
    const free = SIDES.filter((s) => !sides[s]);
    const fixedKind = (s: Side): EdgeKind => {
      const ref = sides[s]!;
      const k = slots.get(ref.slot)!.edge.kind;
      return ref.reversed ? flip(k) : k;
    };
    // single pieces share one connector so they fit each other
    const edgeFor = (s: Side, kind: EdgeKind) =>
      opts.layout === "single" ? standardEdge(`${pid}:${s}`, kind, bias) : randomEdge(geomRng.fork(`${pid}:${s}`), `${pid}:${s}`, kind, bias);
    let chosen: Record<Side, EdgeKind> | null = null;
    if (opts.layout === "grid") {
      chosen = {} as Record<Side, EdgeKind>;
      for (const s of SIDES) chosen[s] = sides[s] ? fixedKind(s) : "flat";
    } else {
      for (let attempt = 0; attempt < 96 && !chosen; attempt++) {
        const kinds = {} as Record<Side, EdgeKind>;
        for (const s of SIDES) {
          if (sides[s]) kinds[s] = fixedKind(s);
          else {
            const r = geomRng.next();
            kinds[s] = r < 0.2 ? "flat" : r < 0.6 ? "tab" : "socket";
          }
        }
        if (!validKinds(SIDES.map((s) => kinds[s]))) continue;
        if (opts.layout === "single") {
          const depth = {} as Record<Side, number>;
          for (const s of SIDES) depth[s] = edgeFor(s, kinds[s]).depth;
          if (aspectFor(kinds, depth) > 1.3) continue;
        }
        chosen = kinds;
      }
      if (!chosen) {
        chosen = {} as Record<Side, EdgeKind>;
        const fallback: EdgeKind[] = ["tab", "socket", "socket", "tab"];
        SIDES.forEach((s, i) => (chosen![s] = sides[s] ? fixedKind(s) : fallback[i]!));
      }
    }
    for (const s of free) {
      const id = `${pid}:${s}`;
      slots.set(id, { edge: edgeFor(s, chosen[s]), shared: false, geometry: [], ownerA: pid, side: s, ...worldFrame(c, s) });
      sides[s] = { slot: id, reversed: false };
    }
  }

  // Corner shape, as on a real puzzle: a corner is rounded only where both of
  // its sides are flat, i.e. a corner of the finished puzzle's frame. Every
  // other corner is square, so pieces that meet there (in a grid, or single
  // pieces fitted together) close to a point with no hole or notch.
  const next = (s: Side) => SIDES[(SIDES.indexOf(s) + 1) % 4]!;
  const prev = (s: Side) => SIDES[(SIDES.indexOf(s) + 3) % 4]!;
  const isFlat = (pid: string, s: Side) => slots.get(pieceSides.get(pid)![s].slot)!.edge.kind === "flat";
  /** shape of the corner between side `s` and the side after it */
  const cornerAfter = (pid: string, s: Side): CornerShape => (isFlat(pid, s) && isFlat(pid, next(s)) ? SOFT_CORNER : SQUARE_CORNER);

  // 2. geometry, built twice: the second pass widens necks for small sizes
  // depth of the shared single-piece connector at the current neck minimum
  let connectorDepth = standardEdge("connector", "tab", bias).depth;
  const build = (minNeck?: number) => {
    if (minNeck !== undefined) connectorDepth = sanitizeEdge(standardEdge("connector", "tab", bias), minNeck).depth;
    for (const slot of slots.values()) {
      if (minNeck !== undefined) slot.edge = sanitizeEdge(slot.edge, minNeck);
      // a shared edge is never flat, so both of its corners are square
      const side = slot.shared ? undefined : slot.side;
      const r0 = side ? cornerAfter(slot.ownerA, prev(side)).trim : 0;
      const r1 = side ? cornerAfter(slot.ownerA, side).trim : 0;
      slot.geometry = trimEdgeEnds(placeEdge(slot.edge, slot.a, slot.b, slot.n), r0, r1);
    }
    return cells.map((c) => {
      const pid = pieceId(c);
      const sides = pieceSides.get(pid)!;
      const world: BezierSegment[] = [];
      const outSides = {} as Record<Side, PieceSide>;
      SIDES.forEach((s, si) => {
        const ref = sides[s];
        const slot = slots.get(ref.slot)!;
        const segs = ref.reversed ? reversePath(slot.geometry) : slot.geometry;
        world.push(...segs);
        // round the corner between this side and the next
        const next = sides[SIDES[(si + 1) % 4]!];
        const nslot = slots.get(next.slot)!;
        const nsegs = next.reversed ? reversePath(nslot.geometry) : nslot.geometry;
        const shape = cornerAfter(pid, s);
        if (shape.trim > 0) {
          const corner = SIDE_FRAME[s].b;
          const v: Vec2 = [c[0] + corner[0], c[1] + corner[1]];
          world.push(cornerArc(segs[segs.length - 1]!.p3, v, nsegs[0]!.p0, shape.handle));
        }
        outSides[s] = {
          kind: ref.reversed ? flip(slot.edge.kind) : slot.edge.kind,
          edgeId: ref.slot,
          sharedEdgeId: slot.shared ? ref.slot : undefined,
          reversed: ref.reversed,
          edge: slot.edge,
        };
      });
      const path = world.map((seg) => mapSegment(seg, (p) => [p[0] - c[0], p[1] - c[1]]));
      return { id: pid, cell: c, sides: outSides, path, bounds: pathBounds(path) };
    });
  };

  // 3. placement in layout space.
  //  grid:    pieces stay interlocked; the visible gap comes from eroding each
  //           piece's SDF by `inset`, so it is uniform and nothing overlaps.
  //  cluster: pieces drift apart and rotate slightly. Pulling interlocked
  //           pieces apart drags heads against necks, so overlaps are resolved
  //           by spreading further and damping rotation until they clear.
  const isCluster = opts.layout === "cluster";
  const sep = opts.layout === "single" ? 0 : opts.geometry.separation;
  const inset = opts.layout === "grid" ? sep / 2 : isCluster ? Math.min(0.012, sep / 2) : 0;
  const maxRot = isCluster ? (opts.geometry.rotation * Math.PI) / 180 : 0;
  const centroid: Vec2 = [
    cells.reduce((a, c) => a + c[0] + 0.5, 0) / cells.length,
    cells.reduce((a, c) => a + c[1] + 0.5, 0) / cells.length,
  ];
  const jitter = cells.map(() => ({
    jx: isCluster ? layoutRng.signed(0.25) : 0,
    jy: isCluster ? layoutRng.signed(0.25) : 0,
    rot: maxRot ? layoutRng.signed(1) : 0,
  }));
  const place = (spread: number, rotScale: number) =>
    cells.map((c, i) => {
      const j = jitter[i]!;
      return {
        center: [
          c[0] + 0.5 + (c[0] + 0.5 - centroid[0]) * spread + j.jx * sep,
          c[1] + 0.5 + (c[1] + 0.5 - centroid[1]) * spread + j.jy * sep,
        ] as Vec2,
        rot: j.rot * maxRot * rotScale,
      };
    });
  type Placement = ReturnType<typeof place>;

  const worldPolys = (pieces: ReturnType<typeof build>, placement: Placement) =>
    pieces.map((p, i) => {
      const { center, rot } = placement[i]!;
      const cs = Math.cos(rot);
      const sn = Math.sin(rot);
      return flattenPath(p.path, 0.01).map((q): Vec2 => {
        const x = q[0] - 0.5;
        const y = q[1] - 0.5;
        return [center[0] + cs * x - sn * y, center[1] + sn * x + cs * y];
      });
    });

  const fit = (pieces: ReturnType<typeof build>, placement: Placement) => {
    const b = polygonBounds(worldPolys(pieces, placement).flat());
    // single pieces leave room for a tab on every side, so they need less margin
    const margin = opts.layout === "single" ? 0.06 : 0.08;
    // Single pieces share one scale: the widest a piece can be is the cell
    // plus a tab on each side, so every single icon draws its cell at the same
    // size and two icons line up when placed side by side.
    const k = (1 - 2 * margin) / (opts.layout === "single" ? 1 + 2 * connectorDepth : Math.max(b.maxX - b.minX, b.maxY - b.minY));
    const shadowLift = opts.shadow.enabled ? opts.shadow.offset[1] * 0.5 : 0;
    const ox = 0.5 - ((b.minX + b.maxX) / 2) * k;
    const oy = 0.5 - shadowLift - ((b.minY + b.maxY) / 2) * k;
    return { k, ox, oy };
  };

  let spread = isCluster ? sep : 0;
  let rotScale = 1;
  let placement = place(spread, rotScale);
  let pieces = build();
  let { k, ox, oy } = fit(pieces, placement);
  // Widening a neck can deepen its tab (heads stay round), and spreading a
  // cluster widens the bounds; both shrink the scale, so repeat until the
  // pixel minimum holds at the final scale.
  for (let pass = 0; pass < 6; pass++) {
    // 3% headroom so a last small shrink of the scale cannot undercut it
    pieces = build((1.03 * MIN_NECK_PX) / (k * opts.size));
    if (isCluster) {
      for (let it = 0; it < 24 && polygonsOverlap(worldPolys(pieces, placement)); it++) {
        spread += 0.04;
        rotScale *= 0.75;
        placement = place(spread, rotScale);
      }
    }
    const next = fit(pieces, placement);
    const settled = next.k >= k - 1e-9;
    ({ k, ox, oy } = next);
    if (settled && pass > 0) break;
  }

  const sharedEdges: SharedEdge[] = [];
  for (const [id, slot] of slots) {
    if (!slot.shared) continue;
    sharedEdges.push({ id, edge: slot.edge, geometry: slot.geometry, ownerA: slot.ownerA, ownerB: slot.ownerB! });
  }

  return {
    layout: opts.layout,
    scale: k,
    sharedEdges,
    pieces: pieces.map((p, i) => ({
      ...p,
      inset,
      transform: {
        x: ox + placement[i]!.center[0] * k,
        y: oy + placement[i]!.center[1] * k,
        rotation: placement[i]!.rot,
        scale: k,
        pivot: [0.5, 0.5],
      },
      geometryKey: geometryKey(p.path),
    })),
  };
}

/** True if any vertex of one polygon lies inside another. */
export function polygonsOverlap(polys: Vec2[][]): boolean {
  for (let i = 0; i < polys.length; i++) {
    const bi = polygonBounds(polys[i]!);
    for (let j = 0; j < polys.length; j++) {
      if (i === j) continue;
      const bj = polygonBounds(polys[j]!);
      if (bi.maxX < bj.minX || bj.maxX < bi.minX || bi.maxY < bj.minY || bj.maxY < bi.minY) continue;
      for (const q of polys[i]!) if (pointInPolygon(q, polys[j]!)) return true;
    }
  }
  return false;
}

export function geometryKey(path: BezierSegment[]): string {
  const parts: string[] = [];
  for (const s of path) for (const p of [s.p0, s.p1, s.p2, s.p3]) parts.push(p[0].toFixed(6), p[1].toFixed(6));
  return hashString(parts.join(",")).toString(36) + ":" + path.length;
}

/** Piece-local → icon coordinates. */
export function applyTransform(t: PieceTransform, p: Vec2): Vec2 {
  const cs = Math.cos(t.rotation);
  const sn = Math.sin(t.rotation);
  const x = p[0] - t.pivot[0];
  const y = p[1] - t.pivot[1];
  return [t.x + t.scale * (cs * x - sn * y), t.y + t.scale * (sn * x + cs * y)];
}
