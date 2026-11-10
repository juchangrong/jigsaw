import { useRef, type KeyboardEvent } from "react";

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
