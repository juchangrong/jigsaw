import { COLOR_SETS, hashString } from "@jigsaw/core";
import { PuzzleMosaic } from "@jigsaw/react";
import { useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { escapeHtml, highlight, unescapeHtml } from "./highlight";

/** path from this page to the site's root, set on `<html data-root>`, so the site works under any base path */
export const ROOT = document.documentElement.dataset.root ?? "./";
export const BRIGHT = COLOR_SETS.find((s) => s.id === "bright")!.families;
/** the pick the installable component makes when no palette is given */
export const familyFor = (seed: string) => BRIGHT[hashString(`${seed}:palette`) % BRIGHT.length]!;

type Theme = "light" | "dark";
const THEME_KEY = "jigsaw-site-theme";
function savedTheme(): Theme | null {
  try {
    const t = window.localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}
const systemTheme = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
// set before the first paint, so a dark page does not flash light
document.documentElement.dataset.theme = savedTheme() ?? systemTheme();

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme as Theme);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // private mode: the choice lasts for this page only
    }
  };
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
        )}
      </svg>
    </button>
  );
}

export function Header({ current }: { current?: "docs" }) {
  return (
    <header className="site-head">
      <div>
        <a className="wordmark" href={ROOT}>
          <PuzzleMosaic seed="brand" size={26} colors={BRIGHT[0]!.colors} variant="accent" />
          jigsaw
        </a>
        <nav aria-label="Site">
          <a href={`${ROOT}docs/`} aria-current={current === "docs" ? "page" : undefined}>
            Docs
          </a>
          <a href={`${ROOT}docs/api/`}>API</a>
          <a href={`${ROOT}playground/`}>Playground</a>
        </nav>
        <ThemeToggle />
        <a className="button primary small" href={`${ROOT}docs/registry/`}>
          Install
        </a>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-foot">
      <div>
        <span>jigsaw: procedural puzzle-piece icons</span>
        <nav aria-label="Footer">
          <a href={`${ROOT}docs/`}>Usage</a>
          <a href={`${ROOT}docs/api/`}>API</a>
          <a href={`${ROOT}docs/registry/`}>Registry</a>
          <a href={`${ROOT}playground/`}>Playground</a>
        </nav>
      </div>
    </footer>
  );
}

/** A dark code block with a copy button. Pass plain text as `children`, or already-escaped HTML as `html`. */
export function CodeBlock({ children, html, label }: { children?: string; html?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const escaped = (html ?? escapeHtml(children ?? "")).replace(/\n$/, "");
  const copy = () => {
    void navigator.clipboard.writeText(unescapeHtml(escaped)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="code">
      <pre tabIndex={0} aria-label={label ?? "Code"}>
        <code dangerouslySetInnerHTML={{ __html: highlight(escaped) }} />
      </pre>
      <button type="button" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** A live example over its code, switched by two tabs. */
export function Example({ preview, code }: { preview: ReactNode; code: ReactNode }) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  return (
    <div className="example">
      <div className="tabs" role="group" aria-label="Example view">
        {(["preview", "code"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === "preview" ? "Preview" : "Code"}
          </button>
        ))}
      </div>
      {tab === "preview" ? <div className="stagebox">{preview}</div> : code}
    </div>
  );
}

/** Renders a page into `#root`. Bun's hot reload runs the entry module again, so the root it already made is reused. */
export function mount(page: ReactNode) {
  const data = import.meta.hot.data as { root?: Root };
  (data.root ??= createRoot(document.getElementById("root")!)).render(page);
}
