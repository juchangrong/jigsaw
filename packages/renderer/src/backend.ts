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

/** Minimal LRU keyed by string with a disposer for evicted values. */
export class LruMap<V> {
  private map = new Map<string, V>();
  constructor(
    private capacity: number,
    private onEvict: (v: V) => void = () => {},
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
    this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.capacity) {
      const first = this.map.keys().next().value!;
      const old = this.map.get(first)!;
      this.map.delete(first);
      this.onEvict(old);
    }
  }
  clear() {
    for (const v of this.map.values()) this.onEvict(v);
    this.map.clear();
  }
  get size() {
    return this.map.size;
  }
}
