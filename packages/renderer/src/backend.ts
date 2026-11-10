import type { RenderPlan } from "@jigsaw/core";

export type BackendKind = "webgpu" | "webgl2" | "cpu";
export type RendererPreference = BackendKind | "auto";

export interface RenderBackend {
  readonly kind: BackendKind;
  /** Render the plan and return premultiplied sRGB RGBA bytes (top row first). */
  render(plan: RenderPlan): Promise<Uint8ClampedArray>;
  /** Release every GPU resource. The backend is unusable afterwards. */
  dispose(): void;
  /** Number of live GPU textures (for leak checks). */
  readonly liveTextures: number;
  /**
   * Resolves with a reason when the GPU device or context is lost for any cause
   * other than `dispose`. A lost backend cannot render again; create a new one.
   */
  readonly lost: Promise<string>;
}

/** Serializes async work so renders sharing one target never interleave. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

/**
 * Minimal LRU keyed by string with a disposer for evicted values. `weigh` and
 * `maxWeight` add a limit on the total weight; a value heavier than the whole
 * limit is not kept.
 */
export class LruMap<V> {
  private map = new Map<string, V>();
  private weight = 0;
  constructor(
    private capacity: number,
    private onEvict: (v: V) => void = () => {},
    private weigh: (v: V) => number = () => 0,
    private maxWeight = Infinity,
  ) {}
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    const replaced = this.map.get(k);
    if (replaced !== undefined) {
      this.map.delete(k);
      this.weight -= this.weigh(replaced);
    }
    this.map.set(k, v);
    this.weight += this.weigh(v);
    while (this.map.size > this.capacity || (this.weight > this.maxWeight && this.map.size > 0)) {
      const first = this.map.keys().next().value!;
      const old = this.map.get(first)!;
      this.map.delete(first);
      this.weight -= this.weigh(old);
      this.onEvict(old);
    }
  }
  clear() {
    for (const v of this.map.values()) this.onEvict(v);
    this.map.clear();
    this.weight = 0;
  }
  get size() {
    return this.map.size;
  }
  get totalWeight() {
    return this.weight;
  }
}
