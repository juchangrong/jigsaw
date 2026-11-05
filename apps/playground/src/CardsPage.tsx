import { PuzzleIcon } from "@jigsaw/react";
import { useId, useState } from "react";

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

type IconStyle = "tile" | "bare";
const ICON_PX = 48;
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

/**
 * A product-style card list where every item gets a puzzle icon generated
 * from its name, to judge the icons in the context they are meant for.
 */
export function CardsPage() {
  const groupId = useId();
  const [style, setStyle] = useState<IconStyle>("tile");
  const [salt, setSalt] = useState(0);
  const styles: IconStyle[] = ["tile", "bare"];

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
        <ul className="cards" role="list">
          {ITEMS.map((item, i) => (
            <li key={item.name} className="card">
              {/* palettes rotate through the list, so neighbours differ and only four appear */}
              <CardIcon seed={salt ? `${item.name}#${salt}` : item.name} palette={CARD_PALETTES[(i + salt) % CARD_PALETTES.length]!} style={style} />
              <div className="card-body">
                <div className="card-title">
                  <span className="card-name">{item.name}</span>
                  <span className="card-tag">{item.tag}</span>
                </div>
                <p className="card-desc">{item.desc || "暂无描述"}</p>
              </div>
              <button type="button" className="card-more" aria-label={`More actions for ${item.name}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="3" cy="8" r="1.4" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.4" fill="currentColor" />
                  <circle cx="13" cy="8" r="1.4" fill="currentColor" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
