import { describe, expect, it } from "bun:test";
import { createRng, generateMosaic, hashString, Rng } from "@jigsaw/core";

describe("PRNG", () => {
  it("Mulberry32 is stable and in range", () => {
    const r = new Rng(12345);
    const seq = Array.from({ length: 5 }, () => r.next());
    const again = new Rng(12345);
    expect(Array.from({ length: 5 }, () => again.next())).toEqual(seq);
    for (const v of seq) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    // pinned values guard against accidental algorithm changes
    expect(hashString("seed:geometry")).toMatchInlineSnapshot(`2514295190`);
    expect(new Rng(1).next()).toMatchInlineSnapshot(`0.6270739405881613`);
  });

  it("streams are independent", () => {
    const draws = ["mosaic", "a", "b", "c"].map((stream) => createRng("x", stream).next());
    expect(new Set(draws).size).toBe(4);
  });

  it("never touches Math.random", () => {
    const orig = Math.random;
    Math.random = () => {
      throw new Error("Math.random used");
    };
    try {
      for (let i = 0; i < 50; i++) generateMosaic(`nr-${i}`);
    } finally {
      Math.random = orig;
    }
  });
});
