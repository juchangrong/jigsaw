/**
 * PuzzleIconGenerator on the CPU backend: renders queue in call order, yield
 * between slices of work, skip icons whose render was aborted, recover when
 * the device is lost, and keep the image cache within its byte budget.
 */
import { describe, expect, it } from "vitest";
import { sharedSdfCache } from "@jigsaw/core";
import { CpuBackend, getSharedGenerator, LruMap, PuzzleIconGenerator, type RenderBackend } from "@jigsaw/renderer";

const make = () => new PuzzleIconGenerator({ renderer: "cpu" });

describe("PuzzleIconGenerator", () => {
  it("renders many icons at once, in call order, the same as one at a time", async () => {
    const seeds = Array.from({ length: 12 }, (_, i) => `queue-${i}`);
    const order: string[] = [];
    const gen = make();
    const together = await Promise.all(
      seeds.map((seed) =>
        gen.render({ seed, size: 32 }).then((r) => {
          order.push(seed);
          return r;
        }),
      ),
    );
    expect(order).toEqual(seeds);
    const alone = make();
    for (const [i, seed] of seeds.entries()) {
      const r = await alone.render({ seed, size: 32 });
      expect(together[i]!.description.metadata.seed).toBe(r.description.metadata.seed);
      expect(Array.from(together[i]!.image.data)).toEqual(Array.from(r.image.data));
    }
  });

  it("yields to the event loop while a batch is building", async () => {
    sharedSdfCache.clear();
    const gen = make();
    let tasks = 0;
    let done = false;
    const tick = () => {
      if (done) return;
      tasks++;
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
    // 512 px fields take long enough that each one fills a slice
    await Promise.all(Array.from({ length: 6 }, (_, i) => gen.render({ seed: `yield-${i}`, size: 64 }, { size: 512 })));
    done = true;
    expect(tasks).toBeGreaterThan(0);
  });

  it("skips an aborted render and keeps going with the rest", async () => {
    const gen = make();
    const abort = new AbortController();
    const first = gen.render({ seed: "kept-1", size: 32 });
    const dropped = gen.render({ seed: "dropped", size: 32 }, { signal: abort.signal });
    const last = gen.render({ seed: "kept-2", size: 32 });
    abort.abort();
    await expect(dropped).rejects.toMatchObject({ name: "AbortError" });
    expect((await first).description.metadata.seed).toBe("kept-1");
    expect((await last).description.metadata.seed).toBe("kept-2");

    const already = new AbortController();
    already.abort();
    await expect(gen.render({ seed: "never", size: 32 }, { signal: already.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("serves a repeated render from the image cache", async () => {
    const gen = make();
    const a = await gen.render({ seed: "cached", size: 32 });
    const b = await gen.render({ seed: "cached", size: 32 });
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
    expect(b.image.data).toBe(a.image.data);
  });
});

/** A CPU backend whose device can be lost on demand, the way a GPU device or context can. */
function losable(loseOnRender = false) {
  const cpu = new CpuBackend();
  let report!: (reason: string) => void;
  let gone = false;
  const lose = () => {
    gone = true;
    report("test loss");
  };
  const backend: RenderBackend = {
    kind: "cpu",
    liveTextures: 0,
    lost: new Promise<string>((resolve) => (report = resolve)),
    render: (plan) => {
      if (loseOnRender) lose();
      return gone ? Promise.reject(new Error("device is gone")) : cpu.render(plan);
    },
    dispose: () => {},
  };
  return { backend, lose };
}

/** A generator whose backends come from `next`, counting how many were created. */
function withBackends(next: (index: number) => RenderBackend) {
  const created: RenderBackend[] = [];
  const gen = new PuzzleIconGenerator({
    renderer: "cpu",
    createBackend: () => {
      const backend = next(created.length);
      created.push(backend);
      return Promise.resolve({ backend, errors: [] });
    },
  });
  return { gen, created };
}

describe("a lost device", () => {
  it("is replaced before the next render when it is lost while idle", async () => {
    const first = losable();
    const { gen, created } = withBackends((i) => (i === 0 ? first.backend : losable().backend));
    await gen.render({ seed: "idle-1", size: 32 });
    first.lose();
    await new Promise((r) => setTimeout(r, 0));
    const r = await gen.render({ seed: "idle-2", size: 32 });
    expect(r.cached).toBe(false);
    expect(created).toHaveLength(2);
    expect(await gen.backend()).toBe(created[1]);
    expect(gen.fallbackErrors).toEqual(["cpu: test loss"]);
  });

  it("retries on a new backend when it is lost during a render", async () => {
    const { gen, created } = withBackends((i) => losable(i === 0).backend);
    const reference = await new PuzzleIconGenerator({ renderer: "cpu" }).render({ seed: "mid-render", size: 32 });
    const r = await gen.render({ seed: "mid-render", size: 32 });
    expect(created).toHaveLength(2);
    expect(Array.from(r.image.data)).toEqual(Array.from(reference.image.data));
  });

  it("is retried once, not forever", async () => {
    const { gen, created } = withBackends(() => losable(true).backend);
    await expect(gen.render({ seed: "always-lost", size: 32 })).rejects.toThrow("device is gone");
    expect(created).toHaveLength(2);
  });

  it("is not assumed when a render fails for another reason", async () => {
    const failing: RenderBackend = { ...losable().backend, render: () => Promise.reject(new Error("shader bug")) };
    const { gen, created } = withBackends(() => failing);
    await expect(gen.render({ seed: "bug", size: 32 })).rejects.toThrow("shader bug");
    expect(created).toHaveLength(1);
  });
});

describe("image cache budget", () => {
  const entry = 32 * 32 * 4 * 2; // one 32 px image, stored straight and premultiplied

  it("evicts the oldest image once the cached bytes pass the budget", async () => {
    const gen = new PuzzleIconGenerator({ renderer: "cpu", imageCacheBytes: entry * 2 });
    for (const seed of ["bytes-1", "bytes-2", "bytes-3"]) await gen.render({ seed, size: 32 });
    expect((await gen.render({ seed: "bytes-3", size: 32 })).cached).toBe(true);
    expect((await gen.render({ seed: "bytes-2", size: 32 })).cached).toBe(true);
    expect((await gen.render({ seed: "bytes-1", size: 32 })).cached).toBe(false);
  });

  it("does not keep an image larger than the whole budget", async () => {
    const gen = new PuzzleIconGenerator({ renderer: "cpu", imageCacheBytes: entry - 1 });
    await gen.render({ seed: "too-big", size: 32 });
    expect((await gen.render({ seed: "too-big", size: 32 })).cached).toBe(false);
  });

  it("LruMap tracks weight through replace, evict and clear", () => {
    const evicted: number[] = [];
    const map = new LruMap<number>(
      10,
      (v) => evicted.push(v),
      (v) => v,
      10,
    );
    map.set("a", 4);
    map.set("b", 4);
    map.set("a", 5); // replaces, so "b" is now the oldest
    expect(map.totalWeight).toBe(9);
    map.set("c", 3);
    expect(evicted).toEqual([4]);
    expect(map.get("b")).toBeUndefined();
    expect(map.totalWeight).toBe(8);
    map.clear();
    expect(map.totalWeight).toBe(0);
    expect(map.size).toBe(0);
  });
});

describe("getSharedGenerator", () => {
  it("keeps one generator per renderer, so asking for another does not dispose the first", async () => {
    const cpu = getSharedGenerator({ renderer: "cpu" });
    expect(getSharedGenerator({ renderer: "cpu" })).toBe(cpu);
    const pending = cpu.render({ seed: "shared", size: 32 });
    expect(getSharedGenerator({ renderer: "webgl2" })).not.toBe(cpu);
    expect(getSharedGenerator()).toBe(getSharedGenerator({ renderer: "auto" }));
    expect(getSharedGenerator({ renderer: "cpu" })).toBe(cpu);
    expect((await pending).backend).toBe("cpu");
  });
});
