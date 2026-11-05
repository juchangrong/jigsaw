import { deriveSeed, PALETTES, type PaletteName } from "@jigsaw/core";
import { PuzzleIcon } from "@jigsaw/react";
import { useEffect, useId, useState } from "react";

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

type IconStyle = "tile" | "bare";
const ICON_PX = 40;
/** The list uses at most these four low-saturation palettes, so the page stays calm. */
const CARD_PALETTES = ["slate", "plum", "clay", "sage"] as const;
/** picks saved while the list used the vivid palettes keep their seed and move to the matching muted family */
const LEGACY_PALETTE: Record<string, string> = { tide: "slate", meadow: "sage", ember: "clay", dusk: "plum" };

/**
 * Gradient options for an icon. With the gradient off, the palette collapses
 * to its main tone (its second, mid-light color), so the piece is one solid
 * color shaded only by the bevel and lighting.
 */
function gradientFor(palette: string, solid: boolean) {
  if (!solid) return { palette };
  const tone = PALETTES[palette as PaletteName]?.[1] ?? "#888888";
  return { palette: [tone, tone] };
}

function CardIcon({ seed, palette, style, solid }: { seed: string; palette: string; style: IconStyle; solid: boolean }) {
  const gradient = gradientFor(palette, solid);
  if (style === "bare") {
    return (
      <span className="card-icon bare" aria-hidden="true">
        <PuzzleIcon seed={seed} layout="single" gradient={gradient} size={ICON_PX} />
      </span>
    );
  }
  return (
    <span className="card-icon tile" aria-hidden="true">
      <PuzzleIcon seed={seed} layout="single" gradient={gradient} size={Math.round(ICON_PX * 0.95)} />
    </span>
  );
}

interface Candidate {
  seed: string;
  palette: string;
}
const BATCH = 24;
const STORAGE_KEY = "jigsaw.cardCandidates";
const keyOf = (c: Candidate) => `${c.seed}|${c.palette}`;
/** The i-th candidate: a fixed seed and one of the four card palettes. */
const candidateAt = (i: number): Candidate => ({ seed: deriveSeed("card-candidates", i), palette: CARD_PALETTES[i % CARD_PALETTES.length]! });

/** Saved picks: a per-viewer convenience, so any storage failure just starts empty. */
function loadPicks(): Candidate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list
          .filter((c): c is Candidate => typeof c?.seed === "string" && typeof c?.palette === "string")
          .map((c) => ({ seed: c.seed, palette: LEGACY_PALETTE[c.palette] ?? c.palette }))
      : [];
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
function CandidatePicker({ picks, onChange, solid }: { picks: Candidate[]; onChange: (picks: Candidate[]) => void; solid: boolean }) {
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
                aria-pressed={order !== undefined}
                aria-label={`Candidate ${i + 1}, ${c.palette}${order !== undefined ? `, pick ${order + 1}` : ""}`}
                onClick={() => toggle(c)}
              >
                <PuzzleIcon seed={c.seed} layout="single" gradient={gradientFor(c.palette, solid)} size={46} />
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
  const [style, setStyle] = useState<IconStyle>("tile");
  const [salt, setSalt] = useState(0);
  const [picks, setPicks] = useState<Candidate[]>(loadPicks);
  const [gradientOn, setGradientOn] = useState(true);
  useEffect(() => savePicks(picks), [picks]);
  const styles: IconStyle[] = ["tile", "bare"];
  /** icon for the card at list position `index` */
  const iconFor = (name: string, index: number): Candidate =>
    picks.length
      ? picks[(index + salt) % picks.length]!
      : { seed: salt ? `${name}#${salt}` : name, palette: CARD_PALETTES[(index + salt) % CARD_PALETTES.length]! };

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
                {s === "tile" ? "On a tile" : "Bare piece"}
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
        </div>
        <CandidatePicker picks={picks} onChange={setPicks} solid={!gradientOn} />
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
                  <CardIcon {...iconFor(item.name, item.index)} style={style} solid={!gradientOn} />
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
