import { readFileSync } from "node:fs";

/**
 * Bundle-time macro: the HTML of a page in the repository's `docs/`, so the
 * site shows the same text as the Markdown source. Runs in Bun, never in the browser.
 */
export function docHtml(name: "usage" | "api" | "registry"): string {
  const text = readFileSync(new URL(`../../../docs/${name}.md`, import.meta.url), "utf8");
  return Bun.markdown.html(text, { headings: { ids: true } });
}
