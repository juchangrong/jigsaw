/**
 * Deterministic pseudo-random numbers. `Math.random` is never used anywhere in
 * the generator; every random decision comes from a named stream derived from
 * the seed (e.g. `"<seed>:mosaic"`).
 */

export type Seed = string | number;

/** Stream names. Each concern draws from its own stream, so a new concern never perturbs an existing one. */
export type RngStream = "mosaic" | "hills";

/** 32-bit string hash (cyrb53 folded to 32 bits). */
export function hashString(str: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Mulberry32. Returns a float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Symmetric value in [-amplitude, amplitude]. */
  signed(amplitude: number): number {
    return (this.next() * 2 - 1) * amplitude;
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }

  /** Derive an independent child stream. */
  fork(label: string): Rng {
    return new Rng(hashString(`${this.state}:${label}`));
  }
}

export function createRng(seed: Seed, stream: RngStream | (string & {})): Rng {
  return new Rng(hashString(`${String(seed)}:${stream}`));
}

/** A short human-friendly random seed derived from an existing value. */
export function deriveSeed(from: Seed, counter: number): string {
  const n = hashString(`${String(from)}#${counter}`);
  return n.toString(36).padStart(6, "0").slice(0, 7);
}
