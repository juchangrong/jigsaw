import {
  deriveSeed,
  MATERIAL_PRESETS,
  PALETTE_NAMES,
  PALETTES,
  type LayoutKind,
  type MaterialPreset,
  type PuzzleIconOptions,
  type StampStyle,
} from "@jigsaw/core";
import { downloadBlob } from "@jigsaw/export";
import { PuzzleIcon, getSharedGenerator, useRendererBackend } from "@jigsaw/react";
import type { RendererPreference, RenderResult } from "@jigsaw/renderer";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Backdrop = "checker" | "white" | "dark";
const SIZES = [32, 64, 128, 256] as const;
const BACKDROP_COLOR: Record<Backdrop, string> = { checker: "#FFFFFF", white: "#FFFFFF", dark: "#15151D" };

interface State {
  seed: string;
  layout: LayoutKind;
  pieceCount: number;
  tabSize: number;
  curvature: number;
  asymmetry: number;
  separation: number;
  rotation: number;
  palette: string; // "" = from seed
  spots: number; // 0 = from seed
  softness: number;
  preset: MaterialPreset;
  bevelWidth: number;
  bevelStrength: number;
  roughness: number;
  specularIntensity: number;
  ambientOcclusion: number;
  thickness: number;
  lightAngle: number; // degrees, 0 = from the right, counter-clockwise
  lightElevation: number;
  intensity: number;
  ambient: number;
  specular: number;
  stampText: string;
  stampStyle: StampStyle;
  stampSize: number;
  stampDepth: number;
  stampInk: number;
  stampWeight: number;
}

const initial: State = {
  seed: "aurora-01",
  layout: "single",
  pieceCount: 3,
  tabSize: 0.5,
  curvature: 0.5,
  asymmetry: 0.6,
  separation: 0.09,
  rotation: 6,
  palette: "",
  spots: 0,
  softness: 0.5,
  preset: "softResin",
  ...MATERIAL_PRESETS.softResin,
  // default direction [-0.5, -0.6, 1]
  lightAngle: 129.8,
  lightElevation: 52,
  intensity: 0.85,
  ambient: 0.65,
  specular: 0.28,
  stampText: "",
  stampStyle: "deboss",
  stampSize: 0.36,
  stampDepth: 0.5,
  stampInk: 0.25,
  stampWeight: 700,
};

function toOptions(s: State, size: number): PuzzleIconOptions {
  const az = (s.lightAngle * Math.PI) / 180;
  const el = (s.lightElevation * Math.PI) / 180;
  const h = Math.cos(el);
  return {
    seed: s.seed,
    size,
    layout: s.layout,
    pieceCount: s.layout === "single" ? 1 : s.pieceCount,
    geometry: {
      tabSize: s.tabSize,
      curvature: s.curvature,
      asymmetry: s.asymmetry,
      separation: s.layout === "single" ? undefined : s.separation,
      rotation: s.rotation,
    },
    gradient: { palette: s.palette || undefined, spots: s.spots || undefined, softness: s.softness },
    material: {
      preset: s.preset,
      bevelWidth: s.bevelWidth,
      bevelStrength: s.bevelStrength,
      roughness: s.roughness,
      specularIntensity: s.specularIntensity,
      ambientOcclusion: s.ambientOcclusion,
      thickness: s.thickness,
    },
    // screen space: x right, y down → angle measured counter-clockwise on screen
    lighting: {
      direction: [+(h * Math.cos(az)).toFixed(3), +(-h * Math.sin(az)).toFixed(3), +Math.sin(el).toFixed(3)],
      intensity: s.intensity,
      ambient: s.ambient,
      specular: s.specular,
    },
    stamp: s.stampText
      ? { text: s.stampText, style: s.stampStyle, size: s.stampSize, depth: s.stampDepth, ink: s.stampInk, weight: s.stampWeight }
      : undefined,
    background: "transparent",
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  const { label, value, min, max, step, onChange, format } = props;
  return (
    <label className="row">
      <span className="label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="value">{format ? format(value) : value.toFixed(step < 0.01 ? 3 : 2)}</span>
    </label>
  );
}

function Segmented<T extends string | number>(props: { value: T; options: readonly T[]; onChange: (v: T) => void; render?: (v: T) => string; label?: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o)} role="radio" aria-checked={o === props.value} className={o === props.value ? "on" : ""} onClick={() => props.onChange(o)}>
          {props.render ? props.render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [s, setS] = useState<State>(initial);
  const [size, setSize] = useState<(typeof SIZES)[number]>(256);
  const [backdrop, setBackdrop] = useState<Backdrop>("checker");
  const [renderer, setRenderer] = useState<RendererPreference>("auto");
  const [stats, setStats] = useState<RenderResult | null>(null);
  const [exportFormat, setExportFormat] = useState<"png" | "webp">("png");
  const [exportSize, setExportSize] = useState(1024);
  const [transparent, setTransparent] = useState(true);
  const [toast, setToast] = useState("");
  const counter = useRef(0);
  const backend = useRendererBackend(renderer);

  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const randomize = useCallback(() => {
    counter.current++;
    setS((p) => ({ ...p, seed: deriveSeed(`${p.seed}|${Date.now()}`, counter.current) }));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) randomize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [randomize]);

  const options = useMemo(() => toOptions(s, size), [s, size]);
  const variants = useMemo(() => Array.from({ length: 12 }, (_, i) => deriveSeed(s.seed, i + 1)), [s.seed]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1800);
  };

  const doExport = async () => {
    try {
      const gen = getSharedGenerator({ renderer });
      const opts = { ...options, background: transparent ? "transparent" : BACKDROP_COLOR[backdrop] };
      const blob = await gen.export(opts, { format: exportFormat, size: exportSize, transparent });
      downloadBlob(blob, `puzzle-${s.seed}-${exportSize}.${exportFormat}`);
      flash(`Exported ${exportSize}px ${exportFormat.toUpperCase()} (${(blob.size / 1024).toFixed(0)} KB)`);
    } catch (e) {
      flash(`Export failed: ${(e as Error).message}`);
    }
  };

  const copyConfig = async () => {
    const gen = getSharedGenerator({ renderer });
    const d = gen.generate(options);
    const text = JSON.stringify({ metadata: d.metadata, options }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      flash("Config copied");
    } catch {
      flash("Clipboard unavailable");
    }
  };

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <PuzzleIcon seed="brand" size={28} gradient={{ palette: "aurora" }} renderer={renderer} />
          <h1>Puzzle Icon Playground</h1>
        </div>
        <div className="status">
          <span className={`badge ${backend ?? ""}`}>{backend ?? "…"}</span>
          {stats && (
            <span className="muted">
              {stats.cached ? "cached" : `${stats.ms.toFixed(1)} ms`} · {stats.image.width}px
            </span>
          )}
        </div>
      </header>

      <main className="main">
        <div className="stage">
          <div className="toolbar">
            <label className="seed">
              <span className="label">Seed</span>
              <input value={s.seed} onChange={(e) => set("seed", e.target.value)} spellCheck={false} />
            </label>
            <button className="primary" onClick={randomize} title="Shortcut: R">
              Randomize
            </button>
          </div>
          <div className="toolbar">
            <Segmented label="Preview size" value={size} options={SIZES} onChange={setSize} render={(v) => `${v}`} />
            <Segmented label="Background" value={backdrop} options={["checker", "white", "dark"] as const} onChange={setBackdrop} />
          </div>

          <div className={`preview ${backdrop}`}>
            <PuzzleIcon {...options} renderer={renderer} onRender={setStats} />
          </div>

          <div className={`sizes ${backdrop}`}>
            {SIZES.map((px) => (
              <figure key={px}>
                <PuzzleIcon {...options} size={px} renderer={renderer} />
                <figcaption>{px}</figcaption>
              </figure>
            ))}
          </div>

          <div className="gallery">
            {variants.map((seed) => (
              <button key={seed} className={`tile ${backdrop}`} onClick={() => set("seed", seed)} title={seed}>
                <PuzzleIcon {...options} seed={seed} size={64} renderer={renderer} />
              </button>
            ))}
          </div>
        </div>

        <aside className="panel">
          <Section title="Layout">
            <Segmented label="Layout" value={s.layout} options={["single", "cluster", "grid"] as const} onChange={(v) => set("layout", v)} />
            {s.layout === "cluster" && <Slider label="Pieces" value={s.pieceCount} min={2} max={5} step={1} onChange={(v) => set("pieceCount", v)} format={(v) => String(v)} />}
            {s.layout === "grid" && (
              <Segmented label="Grid size" value={s.pieceCount >= 9 ? 9 : 4} options={[4, 9] as const} onChange={(v) => set("pieceCount", v)} render={(v) => (v === 4 ? "2×2" : "3×3")} />
            )}
          </Section>

          <Section title="Geometry">
            <Slider label="Tab size" value={s.tabSize} min={0} max={1} step={0.01} onChange={(v) => set("tabSize", v)} />
            <Slider label="Curvature" value={s.curvature} min={0} max={1} step={0.01} onChange={(v) => set("curvature", v)} />
            <Slider label="Asymmetry" value={s.asymmetry} min={0} max={1} step={0.01} onChange={(v) => set("asymmetry", v)} />
            {s.layout !== "single" && <Slider label="Separation" value={s.separation} min={0} max={0.3} step={0.005} onChange={(v) => set("separation", v)} />}
            {s.layout === "cluster" && <Slider label="Rotation" value={s.rotation} min={0} max={20} step={0.5} onChange={(v) => set("rotation", v)} format={(v) => `${v}°`} />}
          </Section>

          <Section title="Gradient">
            <div className="palettes">
              <button className={s.palette === "" ? "on" : ""} onClick={() => set("palette", "")}>
                seed
              </button>
              {PALETTE_NAMES.map((name) => (
                <button key={name} className={s.palette === name ? "on" : ""} onClick={() => set("palette", name)} title={name}>
                  <span className="swatch" style={{ background: `linear-gradient(135deg, ${PALETTES[name].join(",")})` }} />
                  {name}
                </button>
              ))}
            </div>
            <Slider label="Spots" value={s.spots} min={0} max={5} step={1} onChange={(v) => set("spots", v < 3 ? 0 : v)} format={(v) => (v < 3 ? "seed" : String(v))} />
            <Slider label="Softness" value={s.softness} min={0} max={1} step={0.01} onChange={(v) => set("softness", v)} />
          </Section>

          <Section title="Material">
            <Segmented label="Preset" value={s.preset} options={Object.keys(MATERIAL_PRESETS) as MaterialPreset[]} onChange={(v) => setS((p) => ({ ...p, preset: v, ...MATERIAL_PRESETS[v] }))} />
            <Slider label="Bevel width" value={s.bevelWidth} min={0.01} max={0.15} step={0.001} onChange={(v) => set("bevelWidth", v)} />
            <Slider label="Bevel strength" value={s.bevelStrength} min={0} max={1.5} step={0.01} onChange={(v) => set("bevelStrength", v)} />
            <Slider label="Thickness" value={s.thickness} min={0} max={0.06} step={0.001} onChange={(v) => set("thickness", v)} />
            <Slider label="Roughness" value={s.roughness} min={0.05} max={1} step={0.01} onChange={(v) => set("roughness", v)} />
            <Slider label="Specular" value={s.specularIntensity} min={0} max={1} step={0.01} onChange={(v) => set("specularIntensity", v)} />
            <Slider label="Occlusion" value={s.ambientOcclusion} min={0} max={0.6} step={0.01} onChange={(v) => set("ambientOcclusion", v)} />
          </Section>

          <Section title="Stamp">
            <label className="row text">
              <span className="label">Letters</span>
              <input
                value={s.stampText}
                maxLength={s.layout === "single" ? 1 : 9}
                placeholder={s.layout === "single" ? "A" : "one per piece"}
                onChange={(e) => set("stampText", e.target.value)}
                spellCheck={false}
              />
            </label>
            {s.stampText && (
              <>
                <Segmented label="Style" value={s.stampStyle} options={["deboss", "emboss"] as const} onChange={(v) => set("stampStyle", v)} />
                <Slider label="Size" value={s.stampSize} min={0.15} max={0.7} step={0.01} onChange={(v) => set("stampSize", v)} />
                <Slider label="Depth" value={s.stampDepth} min={0} max={1} step={0.01} onChange={(v) => set("stampDepth", v)} />
                <Slider label="Ink" value={s.stampInk} min={0} max={1} step={0.01} onChange={(v) => set("stampInk", v)} />
                <Slider label="Weight" value={s.stampWeight} min={300} max={900} step={100} onChange={(v) => set("stampWeight", v)} format={(v) => String(v)} />
              </>
            )}
          </Section>

          <Section title="Lighting">
            <Slider label="Angle" value={s.lightAngle} min={0} max={360} step={1} onChange={(v) => set("lightAngle", v)} format={(v) => `${v.toFixed(0)}°`} />
            <Slider label="Elevation" value={s.lightElevation} min={15} max={85} step={1} onChange={(v) => set("lightElevation", v)} format={(v) => `${v.toFixed(0)}°`} />
            <Slider label="Intensity" value={s.intensity} min={0} max={1.5} step={0.01} onChange={(v) => set("intensity", v)} />
            <Slider label="Ambient" value={s.ambient} min={0} max={1.5} step={0.01} onChange={(v) => set("ambient", v)} />
            <Slider label="Specular" value={s.specular} min={0} max={1} step={0.01} onChange={(v) => set("specular", v)} />
          </Section>

          <Section title="Export">
            <Segmented label="Format" value={exportFormat} options={["png", "webp"] as const} onChange={setExportFormat} render={(v) => v.toUpperCase()} />
            <Segmented label="Resolution" value={exportSize} options={[256, 512, 1024] as const} onChange={setExportSize} render={(v) => `${v}px`} />
            <label className="row check">
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
              <span>Transparent background</span>
            </label>
            <div className="buttons">
              <button className="primary" onClick={doExport}>
                Download
              </button>
              <button onClick={copyConfig}>Copy config</button>
            </div>
          </Section>

          <Section title="Renderer">
            <Segmented label="Renderer" value={renderer} options={["auto", "webgpu", "webgl2", "cpu"] as const} onChange={setRenderer} />
          </Section>
        </aside>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
