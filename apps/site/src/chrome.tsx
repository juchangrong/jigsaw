import { COLOR_SETS } from "@jigsaw/core";
import { PuzzleMosaic } from "@jigsaw/react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/** path from this page to the site's root, set on `<html data-root>`, so the site works under any base path */
export const ROOT = document.documentElement.dataset.root ?? "./";
export const BRIGHT = COLOR_SETS.find((s) => s.id === "bright")!.families;

export function Header({ current }: { current?: "docs" }) {
  return (
    <header className="site-head">
      <a className="wordmark" href={ROOT}>
        <PuzzleMosaic seed="brand" size={26} colors={BRIGHT[0]!.colors} variant="accent" />
        jigsaw
      </a>
      <nav aria-label="Site">
        <a href={`${ROOT}docs/`} aria-current={current === "docs" ? "page" : undefined}>
          Docs
        </a>
        <a href={`${ROOT}playground/`}>Playground</a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-foot">
      <span>jigsaw: procedural puzzle-piece icons</span>
      <nav aria-label="Footer">
        <a href={`${ROOT}docs/`}>Usage</a>
        <a href={`${ROOT}docs/api/`}>API</a>
        <a href={`${ROOT}docs/registry/`}>Registry</a>
        <a href={`${ROOT}playground/`}>Playground</a>
      </nav>
    </footer>
  );
}

/** Renders a page into `#root`. Bun's hot reload runs the entry module again, so the root it already made is reused. */
export function mount(page: ReactNode) {
  const data = import.meta.hot.data as { root?: Root };
  (data.root ??= createRoot(document.getElementById("root")!)).render(page);
}
