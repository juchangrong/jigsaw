/**
 * PuzzleIconGenerator on the CPU backend: renders queue in call order, yield
 * between slices of work, and skip icons whose render was aborted.
 */
import { describe, expect, it } from "vitest";
import { sharedSdfCache } from "@jigsaw/core";
import { PuzzleIconGenerator } from "@jigsaw/renderer";

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
