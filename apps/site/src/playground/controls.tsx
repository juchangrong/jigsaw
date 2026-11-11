import { COLOR_SETS } from "@jigsaw/core";
import { PuzzleMosaic } from "@jigsaw/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

const BRAND_COLORS = COLOR_SETS.find((c) => c.id === "bright")!.families[0]!.colors;

/** Radio group with roving focus: Tab enters at the selection, arrow keys move it. */
export function Segmented<T extends string | number>(props: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  render?: (v: T) => string;
  label?: string;
  labelledBy?: string;
}) {
  const { value, options, onChange, render, label, labelledBy } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number;
    if (e.key in keys) next = (options.indexOf(value) + keys[e.key]! + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next]!);
    refs.current[next]?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {options.map((o, i) => (
        <button
          key={String(o)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o === value}
          tabIndex={o === value ? 0 : -1}
          className={o === value ? "on" : ""}
          onClick={() => onChange(o)}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** Display names for option values that are identifiers in the API. */
const NAMES: Record<string, string> = {
  checker: "Checker",
  white: "White",
  dark: "Dark",
  mosaic: "Mosaic",
  petals: "Petals",
  accent: "Accent",
  tonal: "Tonal",
};
export const nameOf = (v: string | number) => NAMES[String(v)] ?? String(v);

/** A labeled segmented control laid out like a slider row. */
export function Choice<T extends string | number>(props: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  render?: (v: T) => string;
  wrap?: boolean;
}) {
  const id = useId();
  return (
    <div className={props.wrap ? "row choice wrap" : "row choice"}>
      <span className="label" id={id}>
        {props.label}
      </span>
      <Segmented {...props} render={props.render ?? nameOf} labelledBy={id} />
    </div>
  );
}

const ROOT = document.documentElement.dataset.root ?? "./";
const PAGES = [
  { id: "mosaic", label: "Mosaic", path: "playground/" },
  { id: "cards", label: "Cards", path: "playground/cards/" },
] as const;
export type PlaygroundPage = (typeof PAGES)[number]["id"];

/** Path of a playground page from the page being shown, which `data-root` on the `html` element locates. */
export const pagePath = (page: PlaygroundPage) => `${ROOT}${PAGES.find((p) => p.id === page)!.path}`;

/** The left half of every playground header: the way back to the site, the two pages, and the docs. */
export function PlaygroundNav({ page }: { page: PlaygroundPage }) {
  return (
    <div className="brand">
      <a className="home" href={ROOT} aria-label="jigsaw home">
        <PuzzleMosaic seed="brand" size={28} colors={BRAND_COLORS} variant="accent" />
      </a>
      <h1>Playground</h1>
      <nav className="segmented" aria-label="Playground pages">
        {PAGES.map((p) => (
          <a key={p.id} href={`${ROOT}${p.path}`} className={p.id === page ? "on" : undefined} aria-current={p.id === page ? "page" : undefined}>
            {p.label}
          </a>
        ))}
      </nav>
      <a className="nav-link" href={`${ROOT}docs/`}>
        Docs
      </a>
    </div>
  );
}
