import { COLOR_SETS, deriveSeed, generatePictogram, pictogramColor, pieceArrangement, pieceOutline, tileColor, tintColor, type ColorFamily } from "@jigsaw/core";
import { PuzzleIcon, PuzzlePictogram } from "@jigsaw/react";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useStoredState } from "./storage";

/** Mock items, in the copy style of the product list this page imitates. */
const ITEMS = [
  { name: "Opero", tag: "Built by me", desc: "" },
  { name: "Atlas Dashboard", tag: "Built by me", desc: "Key business metrics, refreshed daily" },
  { name: "Nimbus", tag: "Contributing", desc: "" },
  { name: "Quill Docs", tag: "Shared with team", desc: "Turns meeting notes into structured docs" },
  { name: "Harbor", tag: "Built by me", desc: "Deploy and roll back internal services" },
  { name: "Lumen", tag: "Contributing", desc: "" },
  { name: "Cobalt", tag: "Shared with team", desc: "Eval sets and batch experiments" },
  { name: "Orbit Monitor", tag: "Built by me", desc: "Alert grouping, on-call rotas and postmortems" },
  { name: "Sprout", tag: "Contributing", desc: "" },
  { name: "Mosaic", tag: "Shared with team", desc: "Label and review assets from many sources" },
  { name: "Relay", tag: "Built by me", desc: "Hand off requests across teams and track progress" },
  { name: "Beacon", tag: "Contributing", desc: "" },
] as const;

/** Items grouped into sections by their tag, in first-appearance order. */
const SECTIONS = [...new Set(ITEMS.map((item) => item.tag))];
/** `index` is the position on screen (sections in order), so icons rotate the way they are read. */
const INDEXED = SECTIONS.flatMap((tag) => ITEMS.filter((item) => item.tag === tag)).map((item, index) => ({ ...item, index }));

type IconStyle = "glass" | "tile" | "outline" | "abstract" | "solid" | "bare";
const STYLE_NAMES: Record<IconStyle, string> = { glass: "Glass", tile: "Plain tile", outline: "Outline", abstract: "Abstract", solid: "Solid", bare: "Bare piece" };
/** which switches change anything in each style */
const STYLES: readonly IconStyle[] = ["glass", "tile", "outline", "abstract", "solid", "bare"];
const asBoolean = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const USES_GRADIENT: IconStyle[] = ["glass", "tile", "bare"];
const USES_TINT: IconStyle[] = ["glass", "tile", "abstract"];
const isGlyph = (s: IconStyle) => s === "abstract" || s === "solid";

/** The realistic piece as a line; its colour comes from CSS. */
const OutlineIcon = ({ seed, size }: { seed: string; size: number }) => <PuzzlePictogram seed={seed} size={size} variant="outline" className="outline-icon" />;
/** The geometric pictogram in one flat colour. */
const AbstractIcon = ({ seed, size, color }: { seed: string; size: number; color: string }) => <PuzzlePictogram seed={seed} size={size} color={color} className="outline-icon" />;

const ICON_PX = 40;
/**
 * Gradient options for an icon. With the gradient off, the family collapses
 * to its main tone (its second, mid-deep shade), so the piece is one solid
 * color shaded only by the bevel and lighting.
 */
function gradientFor(f: ColorFamily, solid: boolean) {
  if (!solid) return { palette: f.colors };
  const tone = f.colors[1]!;
  return { palette: [tone, tone] };
}

function CardIcon({ seed, family: f, style, solid, tint }: { seed: string; family: ColorFamily; style: IconStyle; solid: boolean; tint: boolean }) {
  const gradient = gradientFor(f, solid);
  if (style === "solid") {
    return (
      <span className="card-icon tile solid" style={{ background: tileColor(f) }} aria-hidden="true">
        <AbstractIcon seed={seed} size={Math.round(ICON_PX * 0.8)} color="#ffffff" />
      </span>
    );
  }
  if (style === "abstract") {
    return (
      <span className="card-icon tile abstract" style={tint ? { background: tintColor(f) } : undefined} aria-hidden="true">
        <AbstractIcon seed={seed} size={Math.round(ICON_PX * 0.8)} color={pictogramColor(f)} />
      </span>
    );
  }
  if (style === "outline") {
    return (
      <span className="card-icon tile outline" aria-hidden="true">
        {/* the outline fills about half the tile, like line icons in a product list */}
        <OutlineIcon seed={seed} size={Math.round(ICON_PX * 0.68)} />
      </span>
    );
  }
  if (style === "bare") {
    return (
      <span className="card-icon bare" aria-hidden="true">
        <PuzzleIcon seed={seed} layout="single" gradient={gradient} size={ICON_PX} />
      </span>
    );
  }
  return (
    <span
      className={`card-icon tile${style === "glass" ? " glass" : ""}`}
      style={tint ? ({ "--glass-tint": tintColor(f), background: style === "glass" ? undefined : tintColor(f) } as CSSProperties) : undefined}
      aria-hidden="true"
    >
      <PuzzleIcon seed={seed} layout="single" gradient={gradient} size={Math.round(ICON_PX * 0.95)} />
    </span>
  );
}

/**
 * A candidate is a fixed seed and a slot. The slot picks the color family in
 * whichever set is active (slot mod the set's size), so switching sets
 * re-colors the same shapes and keeps the picks.
 */
interface Candidate {
  seed: string;
  slot: number;
}
const BATCH = 24;
/** how many candidates to look through for distinct ones */
const SCAN_LIMIT = 400;
const STORAGE_KEY = "jigsaw.cardCandidates";
const keyOf = (c: Candidate) => c.seed;
const candidateAt = (i: number): Candidate => ({ seed: deriveSeed("card-candidates", i), slot: i });
const familyOf = (set: ColorFamily[], slot: number) => set[((slot % set.length) + set.length) % set.length]!;

/** Saved picks: a per-viewer convenience, so any storage failure just starts empty. */
function loadPicks(): Candidate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    // picks saved before slots existed only have a seed: find its candidate slot
    let index: Map<string, number> | null = null;
    const slotOf = (seed: string) => {
      index ??= new Map(Array.from({ length: 5000 }, (_, i) => [deriveSeed("card-candidates", i), i] as const));
      return index.get(seed) ?? 0;
    };
    return list
      .filter((c): c is { seed: string; slot?: unknown } => typeof c?.seed === "string")
      .map((c) => ({ seed: c.seed, slot: typeof c.slot === "number" ? c.slot : slotOf(c.seed) }));
  } catch {
    return [];
  }
}
function savePicks(picks: Candidate[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(picks));
  } catch {
    // storage blocked: picks last for this visit only
  }
}

/** A grid of candidate icons; clicking one picks or unpicks it. */
function CandidatePicker(props: { picks: Candidate[]; onChange: (picks: Candidate[]) => void; solid: boolean; tint: boolean; set: ColorFamily[]; setId: string; style: IconStyle }) {
  const { picks, onChange, solid, tint, set, setId, style } = props;
  const headingId = useId();
  const [count, setCount] = useState(BATCH);
  const [note, setNote] = useState("");
  const picked = new Map(picks.map((c, i) => [keyOf(c), i]));
  const pickedKey = picks.map(keyOf).join();
  // Line and glyph styles have few distinct shapes, so candidates that would
  // look identical are skipped (a picked one always stays visible).
  const { list, exhausted } = useMemo(() => {
    const lookKey = (c: Candidate) =>
      style === "outline" ? pieceArrangement(c.seed).join() : isGlyph(style) ? `${generatePictogram(c.seed).key}|${familyOf(set, c.slot).id}` : c.seed;
    const chosen = new Set(pickedKey.split(","));
    const seen = new Set<string>();
    const out: Candidate[] = [];
    let i = 0;
    for (; i < SCAN_LIMIT && out.length < count; i++) {
      const c = candidateAt(i);
      const k = lookKey(c);
      if (seen.has(k) && !chosen.has(c.seed)) continue;
      seen.add(k);
      out.push(c);
    }
    return { list: out, exhausted: out.length < count };
  }, [count, style, set, pickedKey]);
  const toggle = (c: Candidate) => {
    const k = keyOf(c);
    onChange(picked.has(k) ? picks.filter((p) => keyOf(p) !== k) : [...picks, c]);
  };
  const copy = async () => {
    try {
      // everything needed to redraw each pick elsewhere: its seed, its colours and, for vector styles, its path
      const payload = {
        style,
        colorSet: setId,
        picks: picks.map((p) => {
          const fam = familyOf(set, p.slot);
          const g = isGlyph(style) ? generatePictogram(p.seed) : null;
          return {
            seed: p.seed,
            family: fam.id,
            colors: fam.colors,
            ...(g ? { glyph: { path: g.path, viewBox: g.viewBox, fill: style === "solid" ? "#ffffff" : pictogramColor(fam), tile: style === "solid" ? tileColor(fam) : "#ffffff" } } : {}),
            ...(style === "outline" ? { outline: pieceOutline({ seed: p.seed }) } : {}),
          };
        }),
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setNote(`Copied ${picks.length} picks`);
    } catch {
      setNote("Couldn't copy: clipboard access is blocked");
    }
  };
  return (
    <section className="picker" aria-labelledby={headingId}>
      <div className="picker-head">
        <h2 id={headingId} className="cards-heading">
          Icon candidates
        </h2>
        <span className="muted" aria-live="polite">
          {picks.length ? `${picks.length} picked, used in pick order` : "Pick the icons the cards may use"}
          {note ? ` · ${note}` : ""}
        </span>
      </div>
      <ul className="picker-grid" role="list">
        {list.map((c, i) => {
          const order = picked.get(keyOf(c));
          return (
            <li key={keyOf(c)}>
              <button
                type="button"
                className={`picker-tile${order !== undefined ? " on" : ""}`}
                style={tint && USES_TINT.includes(style) ? { background: tintColor(familyOf(set, c.slot)) } : undefined}
                aria-pressed={order !== undefined}
                aria-label={`Candidate ${i + 1}, ${familyOf(set, c.slot).id}${order !== undefined ? `, pick ${order + 1}` : ""}`}
                onClick={() => toggle(c)}
              >
                {style === "outline" ? (
                  <OutlineIcon seed={c.seed} size={40} />
                ) : style === "abstract" ? (
                  <AbstractIcon seed={c.seed} size={46} color={pictogramColor(familyOf(set, c.slot))} />
                ) : style === "solid" ? (
                  <span className="picker-solid" style={{ background: tileColor(familyOf(set, c.slot)) }}>
                    <AbstractIcon seed={c.seed} size={36} color="#ffffff" />
                  </span>
                ) : (
                  <PuzzleIcon seed={c.seed} layout="single" gradient={gradientFor(familyOf(set, c.slot), solid)} size={46} />
                )}
                {order !== undefined && (
                  <span className="picker-badge" aria-hidden="true">
                    {order + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="toolbar">
        <button type="button" onClick={() => setCount((n) => n + BATCH)} disabled={exhausted} title={exhausted ? "This style has no more distinct shapes" : undefined}>
          Show more candidates
        </button>
        <button type="button" onClick={() => onChange([])} disabled={!picks.length}>
          Clear picks
        </button>
        <button type="button" onClick={copy} disabled={!picks.length}>
          Copy picks
        </button>
      </div>
    </section>
  );
}

/**
 * A product-style card list where every item gets a puzzle icon, to judge the
 * icons in the context they are meant for. Icons come from the picks in the
 * candidate picker, or, with no picks, from each card's name.
 */
export function CardsPage() {
  const groupId = useId();
  const [style, setStyle] = useStoredState<IconStyle>("cardStyle", "glass", (v) => STYLES.find((s) => s === v));
  const [salt, setSalt] = useState(0);
  const [picks, setPicks] = useState<Candidate[]>(loadPicks);
  const [gradientOn, setGradientOn] = useStoredState("cardGradient", true, asBoolean);
  const [tintOn, setTintOn] = useStoredState("cardTint", false, asBoolean);
  const [setId, setSetId] = useStoredState("cardColorSet", "studio", (v) => COLOR_SETS.find((c) => c.id === v)?.id);
  const colorSet = COLOR_SETS.find((c) => c.id === setId) ?? COLOR_SETS[0]!;
  useEffect(() => savePicks(picks), [picks]);
  const setsLabelId = useId();
  /** icon for the card at list position `index` */
  const iconFor = (name: string, index: number): { seed: string; family: ColorFamily } => {
    if (picks.length) {
      const p = picks[(index + salt) % picks.length]!;
      return { seed: p.seed, family: familyOf(colorSet.families, p.slot) };
    }
    return { seed: salt ? `${name}#${salt}` : name, family: familyOf(colorSet.families, index + salt) };
  };

  return (
    <div className="app cards-app">
      <header className="top">
        <div className="brand">
          <h1>Card list</h1>
          <a className="nav-link" href="#/">
            Back to playground
          </a>
        </div>
      </header>
      <main className="cards-main">
        <div className="toolbar">
          <span className="label" id={groupId}>
            Icon
          </span>
          <div
            className="segmented"
            role="radiogroup"
            aria-labelledby={groupId}
            onKeyDown={(e) => {
              const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
              if (!step) return;
              e.preventDefault();
              const i = (STYLES.indexOf(style) + step + STYLES.length) % STYLES.length;
              setStyle(STYLES[i]!);
              (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
            }}
          >
            {STYLES.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={s === style} tabIndex={s === style ? 0 : -1} className={s === style ? "on" : ""} onClick={() => setStyle(s)}>
                {STYLE_NAMES[s]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setSalt((n) => n + 1)}>
            Shuffle icons
          </button>
          <label className="row check">
            <input type="checkbox" role="switch" checked={gradientOn} disabled={!USES_GRADIENT.includes(style)} onChange={(e) => setGradientOn(e.target.checked)} />
            <span>Gradient</span>
          </label>
          <label className="row check">
            <input type="checkbox" role="switch" checked={tintOn} disabled={!USES_TINT.includes(style)} onChange={(e) => setTintOn(e.target.checked)} />
            <span>Tint</span>
          </label>
        </div>
        <div className="toolbar">
          <span className="label" id={setsLabelId}>
            Colors
          </span>
          <div
            className="segmented"
            role="radiogroup"
            aria-labelledby={setsLabelId}
            onKeyDown={(e) => {
              const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
              if (!step) return;
              e.preventDefault();
              const i = (COLOR_SETS.indexOf(colorSet) + step + COLOR_SETS.length) % COLOR_SETS.length;
              setSetId(COLOR_SETS[i]!.id);
              (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
            }}
          >
            {COLOR_SETS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={c === colorSet} tabIndex={c === colorSet ? 0 : -1} className={c === colorSet ? "on" : ""} onClick={() => setSetId(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <span className="set-swatches" aria-label={`${colorSet.label}: ${colorSet.families.map((f) => f.id).join(", ")}`}>
            {colorSet.families.map((f) => (
              <span key={f.id} className="set-swatch" title={f.id} style={{ background: `linear-gradient(135deg, ${f.colors.join(", ")})` }} />
            ))}
          </span>
        </div>
        <CandidatePicker picks={picks} onChange={setPicks} solid={!gradientOn} tint={tintOn} set={colorSet.families} setId={colorSet.id} style={style} />
        {SECTIONS.map((section) => (
          <section key={section} className="cards-section" aria-labelledby={`${groupId}-${section}`}>
            <h2 id={`${groupId}-${section}`} className="cards-heading">
              {section}
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M5 2.5 9.5 7 5 11.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </h2>
            <ul className="cards" role="list">
              {INDEXED.filter((item) => item.tag === section).map((item) => (
                <li key={item.name} className="card">
                  <CardIcon {...iconFor(item.name, item.index)} style={style} solid={!gradientOn} tint={tintOn} />
                  <div className="card-body">
                    <span className="card-name">{item.name}</span>
                    <p className="card-desc">{item.desc || "No description yet"}</p>
                  </div>
                  <button type="button" className="card-more" aria-label={`More actions for ${item.name}`}>
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <circle cx="4" cy="9" r="1.4" fill="currentColor" />
                      <circle cx="9" cy="9" r="1.4" fill="currentColor" />
                      <circle cx="14" cy="9" r="1.4" fill="currentColor" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
