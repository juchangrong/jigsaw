/**
 * Rendering + basic visual regression, using the CPU reference renderer (the
 * WGSL / GLSL shaders mirror it; browser parity is checked in the playground).
 *
 * - Property checks: AA edges, transparent corners, shadow alpha kept on
 *   transparent backgrounds, top-left bevel brighter than bottom-right,
 *   no banding in the flat interior.
 * - Golden signatures: an 8×8 grid of mean RGBA per image, compared with a
 *   tolerance against tests/golden/signatures.json (written on first run;
 *   delete the file and re-run to re-baseline after an intended change).
 * - PNG output is written to tests/__output__ for manual inspection.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { beforeAll, describe, expect, it } from "vitest";
import { buildRenderPlan, generatePuzzleIcon, sampleSdf, toLocal, type PuzzleIconOptions } from "@jigsaw/core";
import { encodePNG, unpremultiply } from "@jigsaw/export";
import { renderPlanCpu } from "../packages/renderer/src/cpu";

const OUT = "tests/__output__";
const GOLDEN = "tests/golden/signatures.json";
const BACKGROUNDS = { white: "#FFFFFF", dark: "#15151D", transparent: "transparent" } as const;
const SIZES = [32, 64, 128, 256, 512];

function render(o: PuzzleIconOptions) {
  const d = generatePuzzleIcon(o);
  const plan = buildRenderPlan(d);
  return { d, plan, px: renderPlanCpu(plan) };
}

function signature(px: Uint8ClampedArray, w: number, h: number, n = 8): number[] {
  const out: number[] = [];
  for (let gy = 0; gy < n; gy++)
    for (let gx = 0; gx < n; gx++) {
      const acc = [0, 0, 0, 0];
      let count = 0;
      for (let y = Math.floor((gy * h) / n); y < Math.floor(((gy + 1) * h) / n); y++)
        for (let x = Math.floor((gx * w) / n); x < Math.floor(((gx + 1) * w) / n); x++) {
          for (let c = 0; c < 4; c++) acc[c]! += px[(y * w + x) * 4 + c]!;
          count++;
        }
      out.push(...acc.map((v) => Math.round(v / count)));
    }
  return out;
}

const lum = (px: Uint8ClampedArray, i: number) => 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;

beforeAll(() => mkdirSync(OUT, { recursive: true }));

describe("visual matrix (32–512 px × white / dark / transparent)", () => {
  const golden: Record<string, number[]> = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, "utf8")) : {};
  const fresh: Record<string, number[]> = {};

  for (const layout of ["single", "cluster", "grid"] as const) {
    for (const size of SIZES) {
      for (const [bgName, bg] of Object.entries(BACKGROUNDS)) {
        const key = `${layout}-${size}-${bgName}`;
        it(key, async () => {
          const { plan, px } = render({ seed: "visual", layout, size, background: bg });
          const w = plan.width;
          // corners show the background (or nothing)
          const corner = px.slice(0, 4);
          if (bg === "transparent") expect(corner[3]).toBe(0);
          else expect(corner[3]).toBe(255);
          // the centre region is covered
          let covered = 0;
          for (let i = 3; i < px.length; i += 4) if (px[i] === 255) covered++;
          expect(covered / (w * w)).toBeGreaterThan(bg === "transparent" ? 0.2 : 0.99);

          const sig = signature(px, w, w);
          fresh[key] = sig;
          const ref = golden[key];
          if (ref) {
            const maxDiff = Math.max(...sig.map((v, i) => Math.abs(v - ref[i]!)));
            expect(maxDiff, `signature drift for ${key}`).toBeLessThanOrEqual(3);
          }
          if (size >= 128 || layout === "single") {
            writeFileSync(`${OUT}/${key}.png`, await encodePNG({ width: w, height: w, data: unpremultiply(px) }));
          }
        });
      }
    }
  }

  it("writes the golden file on first run", () => {
    if (!existsSync(GOLDEN)) {
      mkdirSync("tests/golden", { recursive: true });
      writeFileSync(GOLDEN, JSON.stringify(fresh, null, 0) + "\n");
    }
    expect(Object.keys(fresh).length).toBe(3 * SIZES.length * 3);
  });
});

describe("material properties", () => {
  // a flat single color isolates the lighting from the gradient
  const flat: PuzzleIconOptions = {
    seed: "material",
    size: 256,
    gradient: { palette: ["#A49CF0", "#A49CF0", "#A49CF0"] },
    background: "transparent",
  };

  it("lights top/left bevels and darkens bottom/right bevels", () => {
    const { plan, px } = render(flat);
    const p = plan.pieces[0]!;
    const b = p.bevel;
    const sums = { lit: [0, 0], dim: [0, 0], flat: [0, 0] };
    for (let y = 0; y < plan.height; y++)
      for (let x = 0; x < plan.width; x++) {
        const [lx, ly] = toLocal(p, x, y);
        const d = sampleSdf(p.sdf, lx, ly);
        const i = (y * plan.width + x) * 4;
        if (px[i + 3] !== 255) continue;
        const e = p.sdf.texel;
        const gx = sampleSdf(p.sdf, lx + e, ly) - sampleSdf(p.sdf, lx - e, ly);
        const gy = sampleSdf(p.sdf, lx, ly + e) - sampleSdf(p.sdf, lx, ly - e);
        const gl = Math.hypot(gx, gy) || 1;
        const facing = (gx + gy) / gl / Math.SQRT2; // >0: gradient points down-right ⇒ edge on the top-left
        const bucket = d > b * 1.5 ? "flat" : d > b * 0.2 && d < b * 0.8 ? (facing > 0.6 ? "lit" : facing < -0.6 ? "dim" : null) : null;
        if (!bucket) continue;
        sums[bucket][0] += lum(px, i);
        sums[bucket][1]++;
      }
    const mean = (k: keyof typeof sums) => sums[k][0] / sums[k][1];
    expect(sums.lit[1]).toBeGreaterThan(50);
    expect(sums.dim[1]).toBeGreaterThan(50);
    expect(mean("lit")).toBeGreaterThan(mean("flat") + 6);
    expect(mean("dim")).toBeLessThan(mean("flat") - 3);
    // subtle: the bevel must not blow out to white or crush to black
    expect(mean("lit")).toBeLessThan(250);
    expect(mean("dim")).toBeGreaterThan(mean("flat") * 0.7);
  });

  it("keeps the flat top close to the albedo (no global over-exposure)", () => {
    const { plan, px } = render(flat);
    const c = Math.floor(plan.width / 2);
    const i = (c * plan.width + c) * 4;
    // #A49CF0 → (164, 156, 240)
    expect(Math.abs(px[i]! - 164)).toBeLessThanOrEqual(6);
    expect(Math.abs(px[i + 1]! - 156)).toBeLessThanOrEqual(6);
    expect(Math.abs(px[i + 2]! - 240)).toBeLessThanOrEqual(6);
  });

  it("has no banding in the diffuse gradient", () => {
    const { plan, px } = render({ seed: "banding", size: 512, background: "#FFFFFF" });
    const w = plan.width;
    const p = plan.pieces[0]!;
    let maxStep = 0;
    for (let y = 1; y < w; y++)
      for (let x = 1; x < w; x++) {
        const [lx, ly] = toLocal(p, x, y);
        if (sampleSdf(p.sdf, lx, ly) < p.bevel * 1.6) continue; // flat interior only
        const i = (y * w + x) * 4;
        for (const j of [i - 4, i - w * 4]) for (let c = 0; c < 3; c++) maxStep = Math.max(maxStep, Math.abs(px[i + c]! - px[j + c]!));
      }
    expect(maxStep).toBeLessThanOrEqual(3);
  });

  it("anti-aliases the outline (partial alpha on the edge)", () => {
    const { px } = render({ ...flat, shadow: { enabled: false } });
    let partial = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i]! > 0 && px[i]! < 255) partial++;
    expect(partial).toBeGreaterThan(300);
  });

  it("keeps soft shadow alpha on a transparent background", () => {
    const { plan, px } = render({ ...flat, size: 128, shadow: { enabled: true } });
    const p = plan.pieces[0]!;
    let shadowPx = 0;
    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3]!;
      const x = (i / 4) % plan.width;
      const y = Math.floor(i / 4 / plan.width);
      const [lx, ly] = toLocal(p, x, y);
      if (sampleSdf(p.sdf, lx, ly) < -p.pxLocal && a > 0) {
        expect(a).toBeLessThanOrEqual(Math.ceil(0.12 * 255) + 1);
        shadowPx++;
      }
    }
    expect(shadowPx).toBeGreaterThan(100);
    const none = render({ ...flat, size: 128, shadow: { enabled: false } });
    let outside = 0;
    for (let i = 3; i < none.px.length; i += 4) {
      const x = ((i - 3) / 4) % 128;
      const y = Math.floor((i - 3) / 4 / 128);
      const [lx, ly] = toLocal(none.plan.pieces[0]!, x, y);
      if (sampleSdf(none.plan.pieces[0]!.sdf, lx, ly) < -2 * p.pxLocal && none.px[i]! > 0) outside++;
    }
    expect(outside).toBe(0);
  });

  it("re-renders large exports from a higher-resolution SDF", () => {
    const d = generatePuzzleIcon({ seed: "res", size: 128 });
    expect(buildRenderPlan(d, { size: 128 }).pieces[0]!.sdf.width).toBeLessThanOrEqual(300);
    expect(buildRenderPlan(d, { size: 1024 }).pieces[0]!.sdf.width).toBeGreaterThan(900);
  });
});

describe("PNG export", () => {
  it("encodes a valid RGBA PNG that round-trips the pixels", async () => {
    const { plan, px } = render({ seed: "png", size: 64 });
    const data = unpremultiply(px);
    const png = await encodePNG({ width: plan.width, height: plan.height, data });
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dv = new DataView(png.buffer, png.byteOffset);
    expect(dv.getUint32(16)).toBe(64);
    expect(dv.getUint32(20)).toBe(64);
    expect(png[25]).toBe(6); // RGBA
    // collect IDAT and inflate
    let off = 8;
    const idat: Uint8Array[] = [];
    while (off < png.length) {
      const len = dv.getUint32(off);
      const type = String.fromCharCode(...png.slice(off + 4, off + 8));
      if (type === "IDAT") idat.push(png.slice(off + 8, off + 8 + len));
      off += 12 + len;
    }
    const raw = inflateSync(Buffer.concat(idat));
    for (let y = 0; y < 64; y++) {
      expect(raw[y * 257]).toBe(0);
      expect(Buffer.from(raw.subarray(y * 257 + 1, (y + 1) * 257)).equals(Buffer.from(data.subarray(y * 256, (y + 1) * 256)))).toBe(true);
    }
  });
});
