import { shadeShadow, shadeSurface, type RenderPlan } from "@jigsaw/core";

/**
 * CPU reference renderer. Produces premultiplied sRGB RGBA bytes using exactly
 * the same shading functions the GPU shaders mirror. Used as the last fallback
 * and for tests / visual regression in Node.
 */
export function renderPlanCpu(plan: RenderPlan): Uint8ClampedArray {
  const { width: w, height: h } = plan;
  const acc = new Float32Array(w * h * 4);
  if (plan.background) {
    for (let i = 0; i < w * h; i++) {
      acc[i * 4] = plan.background[0];
      acc[i * 4 + 1] = plan.background[1];
      acc[i * 4 + 2] = plan.background[2];
      acc[i * 4 + 3] = 1;
    }
  }
  const over = (i: number, c: [number, number, number, number]) => {
    const k = 1 - c[3];
    acc[i] = c[0] + acc[i]! * k;
    acc[i + 1] = c[1] + acc[i + 1]! * k;
    acc[i + 2] = c[2] + acc[i + 2]! * k;
    acc[i + 3] = c[3] + acc[i + 3]! * k;
  };
  // Same order as the GPU backends: every shadow first, then every surface.
  const boxes = plan.pieces.map((p) => {
    // conservative pixel bounds of the piece's SDF domain (incl. shadow)
    const corners: [number, number][] = [];
    const f = p.sdf;
    const x0 = f.originX;
    const y0 = f.originY;
    const x1 = f.originX + f.width * f.texel;
    const y1 = f.originY + f.height * f.texel;
    // inverse of inv: local → pixel
    const det = p.inv[0] * p.inv[4] - p.inv[1] * p.inv[3];
    for (const [lx, ly] of [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ] as const) {
      const ux = lx - p.inv[2];
      const uy = ly - p.inv[5];
      corners.push([(p.inv[4] * ux - p.inv[1] * uy) / det, (-p.inv[3] * ux + p.inv[0] * uy) / det]);
    }
    const so = Math.hypot(p.shadowOffset[0], p.shadowOffset[1]) / p.pxLocal + 2;
    const minX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])) - so));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(...corners.map((c) => c[0])) + so));
    const minY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])) - so));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(...corners.map((c) => c[1])) + so));
    return { p, minX, maxX, minY, maxY };
  });
  if (plan.shadowEnabled) {
    for (const { p, minX, maxX, minY, maxY } of boxes)
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const c = shadeShadow(p, x, y);
          if (c[3] > 0) over((y * w + x) * 4, c);
        }
  }
  for (const { p, minX, maxX, minY, maxY } of boxes)
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const c = shadeSurface(plan, p, x, y);
        if (c[3] > 0) over((y * w + x) * 4, c);
      }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(acc[i]! * 255);
  return out;
}
