import { deriveSeed } from "@jigsaw/core";
import { PuzzleIcon } from "@jigsaw/react";
import { useEffect, useId, useState } from "react";

/** Mock items, in the copy style of the product list this page imitates. */
const ITEMS = [
  { name: "Opero", tag: "我开发的", desc: "" },
  { name: "Atlas 数据看板", tag: "我开发的", desc: "汇总业务核心指标，每日自动刷新" },
  { name: "Nimbus", tag: "我参与的", desc: "" },
  { name: "Quill 文档助手", tag: "团队共享", desc: "根据会议纪要生成结构化文档" },
  { name: "Harbor", tag: "我开发的", desc: "内部服务的部署与回滚面板" },
  { name: "Lumen", tag: "我参与的", desc: "" },
  { name: "Cobalt", tag: "团队共享", desc: "评测集管理与批量实验" },
  { name: "Orbit 监控", tag: "我开发的", desc: "告警聚合、值班排班与复盘记录" },
  { name: "Sprout", tag: "我参与的", desc: "" },
  { name: "Mosaic", tag: "团队共享", desc: "多来源素材的标注与审核" },
  { name: "Relay", tag: "我开发的", desc: "跨团队需求流转与进度同步" },
  { name: "Beacon", tag: "我参与的", desc: "" },
] as const;

/** Items grouped into sections by their tag, in first-appearance order. */
const SECTIONS = [...new Set(ITEMS.map((item) => item.tag))];
/** `index` is the position on screen (sections in order), so icons rotate the way they are read. */
const INDEXED = SECTIONS.flatMap((tag) => ITEMS.filter((item) => item.tag === tag)).map((item, index) => ({ ...item, index }));

type IconStyle = "tile" | "bare";
const ICON_PX = 40;
/** The list uses at most these four palettes, so the page stays calm. */
const CARD_PALETTES = ["tide", "dusk", "ember", "meadow"] as const;

function CardIcon({ seed, palette, style }: { seed: string; palette: string; style: IconStyle }) {
  const gradient = { palette };
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
    return Array.isArray(list) ? list.filter((c): c is Candidate => typeof c?.seed === "string" && typeof c?.palette === "string") : [];
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
function CandidatePicker({ picks, onChange }: { picks: Candidate[]; onChange: (picks: Candidate[]) => void }) {
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
                <PuzzleIcon seed={c.seed} layout="single" gradient={{ palette: c.palette }} size={46} />
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
        </div>
        <CandidatePicker picks={picks} onChange={setPicks} />
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
                  <CardIcon {...iconFor(item.name, item.index)} style={style} />
                  <div className="card-body">
                    <span className="card-name">{item.name}</span>
                    <p className="card-desc">{item.desc || "暂无描述"}</p>
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
