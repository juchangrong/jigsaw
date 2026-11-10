import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

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

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const { label, value, min, max, step, onChange, format } = props;
  return (
    <label className="row">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="value">{format ? format(value) : value.toFixed(step < 0.01 ? 3 : 2)}</span>
    </label>
  );
}

/** Display names for option values that are identifiers in the API. */
const NAMES: Record<string, string> = {
  checker: "Checker",
  white: "White",
  dark: "Dark",
  single: "Single",
  cluster: "Cluster",
  grid: "Grid",
  softResin: "Soft resin",
  matteAcrylic: "Matte acrylic",
  satinResin: "Satin resin",
  deboss: "Deboss",
  emboss: "Emboss",
  auto: "Auto",
  webgpu: "WebGPU",
  webgl2: "WebGL2",
  cpu: "CPU",
  mosaic: "Mosaic",
  piece: "Piece",
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

/** The playground's two modes. The URL hash holds the mode, so a reload keeps it. */
export function ModeSwitch({ mode }: { mode: "mosaic" | "piece" }) {
  return (
    <Segmented
      label="Mode"
      value={mode}
      options={["mosaic", "piece"] as const}
      onChange={(m) => {
        window.location.hash = m === "piece" ? "#/piece" : "#/";
      }}
      render={nameOf}
    />
  );
}
