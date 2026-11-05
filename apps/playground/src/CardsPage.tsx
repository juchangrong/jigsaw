import { deriveSeed, hexToOklch, mixOklab, oklchToHex, PALETTES, type PaletteName } from "@jigsaw/core";
import { PuzzleIcon } from "@jigsaw/react";
import { useEffect, useId, useState, type CSSProperties } from "react";

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

type IconStyle = "glass" | "tile" | "bare";
const STYLE_NAMES: Record<IconStyle, string> = { glass: "Glass", tile: "Plain tile", bare: "Bare piece" };
const ICON_PX = 40;
/** A color family: four shades from deep to light, used as an icon's gradient palette. */
interface Family {
  id: string;
  colors: string[];
}
/**
 * A family from OKLCH: lightness from `deep` to `light` in four steps, chroma
 * tapering toward the light end (less chroma reads cleaner near white), and a
 * small hue drift across the sweep.
 */
function family(id: string, hue: number, chroma: number, deep: number, light: number, drift = 10): Family {
  const taper = [1, 0.95, 0.8, 0.55];
  return {
    id,
    colors: taper.map((k, i) => oklchToHex([deep + ((light - deep) * i) / 3, chroma * k, hue - drift / 2 + (drift * i) / 3])),
  };
}
const core = (id: PaletteName): Family => ({ id, colors: [...PALETTES[id]] });

/**
 * Color sets for the list, each at most five families. They take their cue
 * from restrained product finishes: near-neutral metals with one accent, or a
 * few soft hues of equal weight. Names and values are original.
 */
const COLOR_SETS: { id: string; label: string; families: Family[] }[] = [
  { id: "studio", label: "Studio", families: [core("slate"), core("plum"), core("clay"), core("sage")] },
  {
    id: "aluminum",
    label: "Aluminum",
    families: [
      family("graphite", 265, 0.014, 0.34, 0.74),
      family("silver", 250, 0.012, 0.58, 0.92),
      family("champagne", 78, 0.035, 0.6, 0.9),
      family("navy", 258, 0.06, 0.3, 0.66),
      family("sky", 232, 0.05, 0.58, 0.9),
    ],
  },
  {
    id: "titanium",
    label: "Titanium",
    families: [
      family("dark", 265, 0.01, 0.28, 0.6),
      family("natural", 80, 0.02, 0.55, 0.86),
      // a white finish has to stay visible on a white tile, so it stops short of white
      family("white", 95, 0.01, 0.64, 0.9),
      family("blue", 245, 0.035, 0.36, 0.72),
      family("desert", 62, 0.045, 0.55, 0.86),
    ],
  },
  {
    id: "desktop",
    label: "Desktop",
    families: [
      family("blue", 250, 0.11, 0.5, 0.86),
      family("green", 152, 0.1, 0.5, 0.86),
      family("pink", 5, 0.1, 0.55, 0.88),
      family("orange", 55, 0.11, 0.58, 0.88),
      family("purple", 300, 0.1, 0.5, 0.86),
    ],
  },
  {
    // one gray-white family, so every icon shares a colour and only the shapes
    // differ; the deep end stays dark enough to read on a white tile
    id: "mono",
    label: "Mono",
    families: [family("gray", 255, 0.008, 0.52, 0.93, 4)],
  },
  {
    id: "system",
    label: "System",
    families: [
      family("blue", 255, 0.13, 0.48, 0.84),
      family("indigo", 282, 0.12, 0.44, 0.82),
      family("teal", 200, 0.08, 0.5, 0.86),
      family("orange", 58, 0.13, 0.58, 0.88),
      family("pink", 8, 0.12, 0.55, 0.86),
    ],
  },
];

/**
 * Gradient options for an icon. With the gradient off, the family collapses
 * to its main tone (its second, mid-deep shade), so the piece is one solid
 * color shaded only by the bevel and lighting.
 */
function gradientFor(f: Family, solid: boolean) {
  if (!solid) return { palette: f.colors };
  const tone = f.colors[1]!;
  return { palette: [tone, tone] };
}

/** A light tint of a family for the tile behind its icon: its OKLab mix at lightness 0.955 and low chroma. */
const tintCache = new Map<string, string>();
function tintOf(f: Family): string {
  const key = f.colors.join();
  let t = tintCache.get(key);
  if (!t) {
    const [, C, h] = hexToOklch(mixOklab(f.colors));
    t = oklchToHex([0.955, Math.min(C, 0.2) * 0.35, h]);
    tintCache.set(key, t);
  }
  return t;
}

function CardIcon({ seed, family: f, style, solid, tint }: { seed: string; family: Family; style: IconStyle; solid: boolean; tint: boolean }) {
  const gradient = gradientFor(f, solid);
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
      style={tint ? ({ "--glass-tint": tintOf(f), background: style === "glass" ? undefined : tintOf(f) } as CSSProperties) : undefined}
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
const STORAGE_KEY = "jigsaw.cardCandidates";
const SET_KEY = "jigsaw.cardColorSet";
const keyOf = (c: Candidate) => c.seed;
const candidateAt = (i: number): Candidate => ({ seed: deriveSeed("card-candidates", i), slot: i });
const familyOf = (set: Family[], slot: number) => set[((slot % set.length) + set.length) % set.length]!;

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
function CandidatePicker({ picks, onChange, solid, tint, set }: { picks: Candidate[]; onChange: (picks: Candidate[]) => void; solid: boolean; tint: boolean; set: Family[] }) {
  const headingId = useId();
  const [count, setCount] = useState(BATCH);
  const [note, setNote] = useState("");
  const picked = new Map(picks.map((c, i) => [keyOf(c), i]));
  const toggle = (c: Candidate) => {
    const k = keyOf(c);
    onChange(picked.has(k) ? picks.filter((p) => keyOf(p) !== k) : [...picks, c]);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(picks, null, 2));
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
        {Array.from({ length: count }, (_, i) => candidateAt(i)).map((c, i) => {
          const order = picked.get(keyOf(c));
          return (
            <li key={keyOf(c)}>
              <button
                type="button"
                className={`picker-tile${order !== undefined ? " on" : ""}`}
                style={tint ? { background: tintOf(familyOf(set, c.slot)) } : undefined}
                aria-pressed={order !== undefined}
                aria-label={`Candidate ${i + 1}, ${familyOf(set, c.slot).id}${order !== undefined ? `, pick ${order + 1}` : ""}`}
                onClick={() => toggle(c)}
              >
                <PuzzleIcon seed={c.seed} layout="single" gradient={gradientFor(familyOf(set, c.slot), solid)} size={46} />
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
        <button type="button" onClick={() => setCount((n) => n + BATCH)}>
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
  const [style, setStyle] = useState<IconStyle>("glass");
  const [salt, setSalt] = useState(0);
  const [picks, setPicks] = useState<Candidate[]>(loadPicks);
  const [gradientOn, setGradientOn] = useState(true);
  const [tintOn, setTintOn] = useState(false);
  const [setId, setSetId] = useState<string>(() => {
    try {
      return window.localStorage.getItem(SET_KEY) ?? "studio";
    } catch {
      return "studio";
    }
  });
  const colorSet = COLOR_SETS.find((c) => c.id === setId) ?? COLOR_SETS[0]!;
  useEffect(() => savePicks(picks), [picks]);
  useEffect(() => {
    try {
      window.localStorage.setItem(SET_KEY, colorSet.id);
    } catch {
      // storage blocked: the set lasts for this visit only
    }
  }, [colorSet.id]);
  const styles: IconStyle[] = ["glass", "tile", "bare"];
  const setsLabelId = useId();
  /** icon for the card at list position `index` */
  const iconFor = (name: string, index: number): { seed: string; family: Family } => {
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
              const i = (styles.indexOf(style) + step + styles.length) % styles.length;
              setStyle(styles[i]!);
              (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
            }}
          >
            {styles.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={s === style} tabIndex={s === style ? 0 : -1} className={s === style ? "on" : ""} onClick={() => setStyle(s)}>
                {STYLE_NAMES[s]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setSalt((n) => n + 1)}>
            Shuffle icons
          </button>
          <label className="row check">
            <input type="checkbox" role="switch" checked={gradientOn} onChange={(e) => setGradientOn(e.target.checked)} />
            <span>Gradient</span>
          </label>
          <label className="row check">
            <input type="checkbox" role="switch" checked={tintOn} onChange={(e) => setTintOn(e.target.checked)} />
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
        <CandidatePicker picks={picks} onChange={setPicks} solid={!gradientOn} tint={tintOn} set={colorSet.families} />
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
