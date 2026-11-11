/**
 * <PuzzleIcon> without a browser: its server markup, its accessibility
 * defaults, and the device-pixel-ratio store it reads.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "bun:test";
import { PuzzleIcon } from "@jigsaw/react";
import { clientDpr, serverDpr, subscribeDpr } from "../packages/react/src/dpr";

/** A window whose pixel ratio can change, with the media queries listening for it. */
function fakeWindow(ratio: number) {
  const queries: { media: string; listeners: Set<() => void> }[] = [];
  const win = {
    devicePixelRatio: ratio,
    matchMedia: (media: string) => {
      const q = { media, listeners: new Set<() => void>() };
      queries.push(q);
      return {
        addEventListener: (_: string, fn: () => void) => q.listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => q.listeners.delete(fn),
      };
    },
  };
  // like a real MediaQueryList, a query fires only when it starts or stops matching
  const change = (next: number) => {
    const flipped = queries.filter((q) => q.media === `(resolution: ${win.devicePixelRatio}dppx)` || q.media === `(resolution: ${next}dppx)`);
    win.devicePixelRatio = next;
    for (const q of flipped) for (const fn of [...q.listeners]) fn();
  };
  return { win, queries, change };
}

const realWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
function stubWindow(win: unknown) {
  Object.defineProperty(globalThis, "window", { value: win, configurable: true, writable: true });
}
afterEach(() => {
  if (realWindow) Object.defineProperty(globalThis, "window", realWindow);
  else delete (globalThis as { window?: unknown }).window;
});

describe("<PuzzleIcon> markup", () => {
  it("is hidden from assistive technology without a title, and an image with one", () => {
    const plain = renderToStaticMarkup(createElement(PuzzleIcon, { seed: "alpha", size: 40 }));
    expect(plain).toContain('aria-hidden="true"');
    expect(plain).not.toContain("role=");
    expect(plain).not.toContain("aria-label");
    const named = renderToStaticMarkup(createElement(PuzzleIcon, { seed: "alpha", size: 40, title: "Alpha team" }));
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Alpha team"');
    expect(named).not.toContain("aria-hidden");
  });

  it("uses a pixel ratio of 1 on the server whatever the device, so hydration matches", () => {
    stubWindow(fakeWindow(2).win);
    const html = renderToStaticMarkup(createElement(PuzzleIcon, { seed: "alpha", size: 40 }));
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
  });
});

describe("device pixel ratio store", () => {
  it("reads the ratio, capped at 3, and 1 on the server", () => {
    stubWindow(fakeWindow(2).win);
    expect(clientDpr()).toBe(2);
    stubWindow(fakeWindow(4).win);
    expect(clientDpr()).toBe(3);
    expect(serverDpr()).toBe(1);
  });

  it("reports every change, following the ratio to a new query each time", () => {
    const { win, queries, change } = fakeWindow(1);
    stubWindow(win);
    let calls = 0;
    const stop = subscribeDpr(() => calls++);
    expect(queries.map((q) => q.media)).toEqual(["(resolution: 1dppx)"]);
    change(2);
    expect(calls).toBe(1);
    expect(queries.at(-1)!.media).toBe("(resolution: 2dppx)");
    expect(queries[0]!.listeners.size).toBe(0);
    change(1.5);
    expect(calls).toBe(2);
    stop();
    expect(queries.every((q) => q.listeners.size === 0)).toBe(true);
    change(3);
    expect(calls).toBe(2);
  });
});
