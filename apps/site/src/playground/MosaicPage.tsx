import { COLOR_SETS, deriveSeed, hashString, tintColor, type ColorFamily, type MosaicVariant } from "@jigsaw/core";
import { PuzzleMosaic, PuzzleHills } from "@jigsaw/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MOSAIC_INSET } from "./CardsPage";
import { Choice, PlaygroundNav, Section, Segmented, nameOf } from "./controls";

type Backdrop = "checker" | "white" | "dark";
/** the sizes a list, a toolbar or a card shows an icon at */
const SIZES = [24, 32, 40, 64, 128] as const;
const PREVIEW_PX = 256;

type IconStyle = "mosaic" | "hills";

interface Look {
  style: IconStyle;
  variant: MosaicVariant;
  gaps: boolean;
  /** set the mosaic inside a tile with a margin around it */
  padding: boolean;
  /** colour that tile with a tint of the family */
  tint: boolean;
}

function Mosaic({ seed, size, family, look, title }: { seed: string; size: number; family: ColorFamily; look: Look; title?: string }) {
  // inside a tile the tile is the frame, so the icon drops its own edge line
  const common = {
    seed,
    size: look.padding ? Math.round(size * MOSAIC_INSET) : size,
    colors: family.colors,
    variant: look.variant,
    edge: !look.padding,
    className: "mosaic-icon",
    title,
  };
  const icon = look.style === "hills" ? <PuzzleHills {...common} /> : <PuzzleMosaic {...common} gap={look.gaps ? undefined : 0} />;
  if (!look.padding) return icon;
  return (
    <span className="mosaic-tile" style={{ width: size, height: size, background: look.tint ? tintColor(family) : "#ffffff" }}>
      {icon}
    </span>
  );
}

/** The playground's first page: a seed becomes a mosaic or hills icon, drawn as inline SVG. */
export function MosaicPage() {
  const [seed, setSeed] = useState("aurora-01");
  const [backdrop, setBackdrop] = useState<Backdrop>("checker");
  const [setId, setSetId] = useState("bright");
  // "" = the family the seed picks
  const [familyId, setFamilyId] = useState("");
  const [look, setLook] = useState<Look>({ style: "mosaic", variant: "accent", gaps: true, padding: false, tint: false });
  const counter = useRef(0);

  const randomize = useCallback(() => {
    counter.current++;
    setSeed((p) => deriveSeed(`${p}|${Date.now()}`, counter.current));
  }, []);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "r" && !(e.target instanceof HTMLInputElement)) randomize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [randomize]);

  const colorSet = COLOR_SETS.find((c) => c.id === setId) ?? COLOR_SETS[0]!;
  // the same pick as the installable component, whose palettes are the Bright set
  const familyFor = (s: string) =>
    colorSet.families.find((f) => f.id === familyId) ?? colorSet.families[hashString(`${s}:palette`) % colorSet.families.length]!;
  const variants = useMemo(() => Array.from({ length: 12 }, (_, i) => deriveSeed(seed, i + 1)), [seed]);
  const family = familyFor(seed);

  return (
    <div className="app">
      <header className="top">
        <PlaygroundNav page="mosaic" />
        <div className="status">
          <span className="badge">SVG</span>
          <span className="muted">{family.id}</span>
        </div>
      </header>

      <main className="main">
        <div className="stage">
          <div className="toolbar">
            <label className="seed">
              <span className="label">Seed</span>
              <input value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} />
            </label>
            <button type="button" className="primary" onClick={randomize} title="Shortcut: R" aria-keyshortcuts="r">
              Randomize
            </button>
          </div>
          <div className="toolbar">
            <Segmented label="Preview background" value={backdrop} options={["checker", "white", "dark"] as const} onChange={setBackdrop} render={nameOf} />
          </div>

          <div className={`preview ${backdrop}`}>
            <Mosaic seed={seed} size={PREVIEW_PX} family={family} look={look} title={`${nameOf(look.style)} icon for seed ${seed}`} />
          </div>

          <div className={`sizes ${backdrop}`}>
            {SIZES.map((px) => (
              <figure key={px}>
                <Mosaic seed={seed} size={px} family={family} look={look} />
                <figcaption>{px}</figcaption>
              </figure>
            ))}
          </div>

          <div className="gallery">
            {variants.map((v) => (
              <button key={v} type="button" className={`tile ${backdrop}`} onClick={() => setSeed(v)} title={v} aria-label={`Use seed ${v}`}>
                <Mosaic seed={v} size={64} family={familyFor(v)} look={look} />
              </button>
            ))}
          </div>
        </div>

        <aside className="panel">
          <Section title="Colors">
            <Choice
              label="Set"
              value={colorSet.id}
              options={COLOR_SETS.map((c) => c.id)}
              onChange={(id) => {
                setSetId(id);
                setFamilyId("");
              }}
              render={(id) => COLOR_SETS.find((c) => c.id === id)?.label ?? id}
              wrap
            />
            <div className="palettes" role="group" aria-label="Color family">
              <button type="button" className={familyId === "" ? "on" : ""} aria-pressed={familyId === ""} onClick={() => setFamilyId("")}>
                From seed
              </button>
              {colorSet.families.map((f) => (
                <button key={f.id} type="button" className={familyId === f.id ? "on" : ""} aria-pressed={familyId === f.id} onClick={() => setFamilyId(f.id)}>
                  <span className="swatch" style={{ background: `linear-gradient(135deg, ${f.colors.join(",")})` }} />
                  {f.id}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Style">
            <Choice label="Icon" value={look.style} options={["mosaic", "hills"] as const} onChange={(style) => setLook((p) => ({ ...p, style }))} />
            <Choice label="Shading" value={look.variant} options={["accent", "tonal"] as const} onChange={(variant) => setLook((p) => ({ ...p, variant }))} />
            <label className="row check" title="Mosaic only: thin cuts between the four pieces">
              <input
                type="checkbox"
                role="switch"
                checked={look.gaps}
                disabled={look.style !== "mosaic"}
                onChange={(e) => setLook((p) => ({ ...p, gaps: e.target.checked }))}
              />
              <span>Gaps</span>
            </label>
            <label className="row check" title="Sets the icon inside a tile with a margin around it">
              <input type="checkbox" role="switch" checked={look.padding} onChange={(e) => setLook((p) => ({ ...p, padding: e.target.checked }))} />
              <span>Padding</span>
            </label>
            <label className="row check" title="With Padding: colours the tile with a tint of the family">
              <input
                type="checkbox"
                role="switch"
                checked={look.tint}
                disabled={!look.padding}
                onChange={(e) => setLook((p) => ({ ...p, tint: e.target.checked }))}
              />
              <span>Tint</span>
            </label>
          </Section>
        </aside>
      </main>
    </div>
  );
}
