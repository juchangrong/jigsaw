import type { Rng } from "../prng";
import type { GradientSpot, PieceGradient, Vec2 } from "../types";
import { hexToLinear, hexToOklch, mixOklab, oklchToHex, type RGB } from "./oklch";

export interface GradientSpec {
  palette: string[];
  spots: number | null; // null = random 3–5
  softness: number; // 0..1
}

/** Seeded diffuse gradient for one piece. Spots are spread around the cell so
 * every piece gets a soft multi-color blend rather than a single blob. */
export function generateGradient(rng: Rng, spec: GradientSpec): PieceGradient {
  const count = Math.min(5, Math.max(3, spec.spots ?? rng.int(3, 5)));
  const phase = rng.next() * Math.PI * 2;
  const soft = Math.min(1, Math.max(0, spec.softness));
  // Light flows from the top-left (where the default light sits) to the
  // bottom-right, with some seeded tilt.
  const flow = (-3 * Math.PI) / 4 + rng.signed(0.6);
  const fx = Math.cos(flow);
  const fy = Math.sin(flow);
  const positions: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const ang = phase + (i / count) * Math.PI * 2 + rng.signed(0.5);
    const rad = i === count - 1 && count >= 4 ? rng.range(0, 0.12) : rng.range(0.28, 0.5);
    positions.push([0.5 + Math.cos(ang) * rad, 0.5 + Math.sin(ang) * rad]);
  }
  // Rank spots along the flow and palette colors by lightness, then pair them,
  // so lighter colors sit toward the light and the deep anchor sits opposite.
  const byFlow = positions
    .map((p, i) => ({ i, t: (p[0] - 0.5) * fx + (p[1] - 0.5) * fy }))
    .sort((a, b) => b.t - a.t)
    .map((e) => e.i);
  const byLight = [...spec.palette].sort((a, b) => hexToOklch(b)[0] - hexToOklch(a)[0]);
  // An occasional swap of neighbouring ranks lets a second hue cross the flow,
  // which keeps the blend diffuse instead of a straight two-tone sweep.
  for (let r = 0; r + 1 < byFlow.length; r++) {
    if (rng.next() < 0.3) [byFlow[r], byFlow[r + 1]] = [byFlow[r + 1]!, byFlow[r]!];
  }
  const spots: GradientSpot[] = new Array(count);
  byFlow.forEach((pi, rank) => {
    const ci = count === 1 ? 0 : Math.round((rank * (byLight.length - 1)) / (count - 1));
    const [L, C, h] = hexToOklch(byLight[ci]!);
    spots[pi] = {
      position: positions[pi]!,
      color: oklchToHex([L + rng.signed(0.025), C * (1 + rng.signed(0.08)), h + rng.signed(5)]),
      radius: (0.2 + 0.22 * soft) * rng.range(0.85, 1.2),
      intensity: rng.range(0.75, 1),
    };
  });
  return { base: mixOklab(spec.palette), baseWeight: 0.06, spots };
}

/** Evaluate the gradient at a piece-local point, in linear RGB. This is the
 * reference implementation mirrored by the shaders. */
export function evalGradientLinear(
  g: { base: RGB; baseWeight: number; spots: { position: Vec2; color: RGB; radius: number; intensity: number }[] },
  p: Vec2,
): RGB {
  let r = g.base[0] * g.baseWeight;
  let gg = g.base[1] * g.baseWeight;
  let b = g.base[2] * g.baseWeight;
  let wsum = g.baseWeight;
  for (const s of g.spots) {
    const dx = p[0] - s.position[0];
    const dy = p[1] - s.position[1];
    const w = s.intensity * Math.exp(-(dx * dx + dy * dy) / (2 * s.radius * s.radius));
    r += s.color[0] * w;
    gg += s.color[1] * w;
    b += s.color[2] * w;
    wsum += w;
  }
  return [r / wsum, gg / wsum, b / wsum];
}

export function gradientToLinear(g: PieceGradient) {
  return {
    base: hexToLinear(g.base),
    baseWeight: g.baseWeight,
    spots: g.spots.map((s) => ({ ...s, color: hexToLinear(s.color) })),
  };
}
