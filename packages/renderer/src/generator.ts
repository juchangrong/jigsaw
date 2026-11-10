import { buildRenderPlan, generatePuzzleIcon, sharedSdfCache, type PuzzleIconDescription, type PuzzleIconOptions, type RenderPlan } from "@jigsaw/core";
import { encodeImage, unpremultiply, type ExportFormat, type RgbaImage } from "@jigsaw/export";
import { LruMap, type BackendKind, type RenderBackend, type RendererPreference } from "./backend";
import { renderPlanCpu } from "./cpu";
import { WebGl2Backend } from "./webgl2";
import { WebGpuBackend } from "./webgpu";

export class CpuBackend implements RenderBackend {
  readonly kind = "cpu" as const;
  readonly liveTextures = 0;
  async render(plan: RenderPlan) {
    return renderPlanCpu(plan);
  }
  dispose() {}
}

/** how long plan building may run before the next build waits for a new task */
const SLICE_MS = 8;

/** Resolves in a new task, so the page can paint and handle input first. */
function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    // a message is not throttled in background tabs the way a timer is
    if (typeof MessageChannel !== "function") return void setTimeout(resolve, 0);
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("The render was aborted", "AbortError");
}

const ORDER: BackendKind[] = ["webgpu", "webgl2", "cpu"];

/** Create a backend, falling back WebGPU → WebGL2 → CPU. */
export async function createBackend(pref: RendererPreference = "auto"): Promise<{ backend: RenderBackend; errors: string[] }> {
  const start = pref === "auto" ? 0 : ORDER.indexOf(pref);
  const errors: string[] = [];
  for (const kind of ORDER.slice(start)) {
    try {
      if (kind === "webgpu") return { backend: await WebGpuBackend.create(), errors };
      if (kind === "webgl2") return { backend: await WebGl2Backend.create(), errors };
      return { backend: new CpuBackend(), errors };
    } catch (e) {
      errors.push(`${kind}: ${(e as Error).message}`);
    }
  }
  return { backend: new CpuBackend(), errors };
}

export interface GeneratorConfig {
  renderer?: RendererPreference;
  /** max cached rendered images */
  imageCacheSize?: number;
}

export interface RenderResult {
  image: RgbaImage;
  /** premultiplied pixels as produced by the backend */
  premultiplied: Uint8ClampedArray;
  backend: BackendKind;
  description: PuzzleIconDescription;
  /** time spent generating and rendering, not counting time queued behind other icons */
  ms: number;
  cached: boolean;
}

export interface RenderOptions {
  /** output size in pixels (defaults to the description size) */
  size?: number;
  transparent?: boolean;
  /** abort to skip a render that has not started; the promise rejects with an AbortError */
  signal?: AbortSignal;
}

export interface ExportOptions {
  format?: ExportFormat;
  /** output size in pixels (defaults to options.size) */
  size?: number;
  transparent?: boolean;
  quality?: number;
}

/**
 * High-level API. One generator owns one backend (one GPU device) and caches
 * descriptions, SDFs and rendered images; reuse it for every icon.
 */
export class PuzzleIconGenerator {
  private backendPromise: Promise<RenderBackend> | null = null;
  private descriptions = new LruMap<PuzzleIconDescription>(256);
  private images: LruMap<{ image: RgbaImage; premultiplied: Uint8ClampedArray }>;
  private planQueue: Promise<unknown> = Promise.resolve();
  private sliceMs = 0;
  readonly config: Required<GeneratorConfig>;
  /** messages from backends that failed to initialize */
  readonly fallbackErrors: string[] = [];

  constructor(config: GeneratorConfig = {}) {
    this.config = { renderer: config.renderer ?? "auto", imageCacheSize: config.imageCacheSize ?? 128 };
    this.images = new LruMap(this.config.imageCacheSize);
  }

  /** Deterministic description; no GPU needed. */
  generate(options: PuzzleIconOptions): PuzzleIconDescription {
    const key = JSON.stringify(options);
    const hit = this.descriptions.get(key);
    if (hit) return hit;
    const d = generatePuzzleIcon(options);
    this.descriptions.set(key, d);
    return d;
  }

  backend(): Promise<RenderBackend> {
    if (!this.backendPromise) {
      this.backendPromise = createBackend(this.config.renderer).then(({ backend, errors }) => {
        this.fallbackErrors.push(...errors);
        return backend;
      });
    }
    return this.backendPromise;
  }

  /**
   * Run plan builds one at a time, yielding to the event loop once a slice of
   * work has run. Building a distance field is synchronous, so a page that
   * mounts many icons would otherwise build all of them in one long task.
   */
  private enqueue<T>(work: () => T, signal?: AbortSignal): Promise<T> {
    const run = this.planQueue.then(async () => {
      throwIfAborted(signal);
      if (this.sliceMs >= SLICE_MS) {
        await nextTask();
        this.sliceMs = 0;
        throwIfAborted(signal);
      }
      const t = performance.now();
      try {
        return work();
      } finally {
        this.sliceMs += performance.now() - t;
      }
    });
    this.planQueue = run.catch(() => {});
    return run;
  }

  async render(options: PuzzleIconOptions | PuzzleIconDescription, o: RenderOptions = {}): Promise<RenderResult> {
    const backend = await this.backend();
    const { description, plan, t0 } = await this.enqueue(() => {
      const t0 = performance.now();
      const description = "metadata" in options ? options : this.generate(options);
      return { description, plan: buildRenderPlan(description, { size: o.size, transparent: o.transparent, cache: sharedSdfCache }), t0 };
    }, o.signal);
    const key = `${backend.kind}|${plan.key}`;
    const hit = this.images.get(key);
    if (hit) return { ...hit, backend: backend.kind, description, ms: performance.now() - t0, cached: true };
    const premultiplied = await backend.render(plan);
    const image = { width: plan.width, height: plan.height, data: unpremultiply(premultiplied) };
    this.images.set(key, { image, premultiplied });
    return { image, premultiplied, backend: backend.kind, description, ms: performance.now() - t0, cached: false };
  }

  async export(options: PuzzleIconOptions, e: ExportOptions = {}): Promise<Blob> {
    const r = await this.render(options, { size: e.size ?? options.size, transparent: e.transparent });
    return encodeImage(r.image, e.format ?? "png", e.quality);
  }

  toPNG(options: PuzzleIconOptions, e: Omit<ExportOptions, "format"> = {}) {
    return this.export(options, { ...e, format: "png" });
  }

  toWebP(options: PuzzleIconOptions, e: Omit<ExportOptions, "format"> = {}) {
    return this.export(options, { ...e, format: "webp" });
  }

  clearCaches() {
    this.images.clear();
    this.descriptions.clear();
    sharedSdfCache.clear();
  }

  async dispose() {
    const b = await this.backendPromise;
    b?.dispose();
    this.backendPromise = null;
    this.images.clear();
  }
}

let shared: PuzzleIconGenerator | null = null;
/** Process-wide generator so every icon shares one device. */
export function getSharedGenerator(config?: GeneratorConfig): PuzzleIconGenerator {
  if (!shared || (config?.renderer && config.renderer !== shared.config.renderer)) {
    void shared?.dispose();
    shared = new PuzzleIconGenerator(config);
  }
  return shared;
}
