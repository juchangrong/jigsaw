import { hexToOklch, mixOklab, oklchToHex, type PuzzleIconOptions } from "@jigsaw/core";
import { getSharedGenerator, PuzzleIcon } from "@jigsaw/react";
import type { RendererPreference } from "@jigsaw/renderer";
import { useId, useMemo, useState } from "react";

const SIZES = [120, 80, 60, 40] as const;
const SHAPES = [
  // app-icon corner: about 22.5% of the side
  // `fill` is the icon canvas size relative to the tile. A single icon keeps
  // room for a tab on every side (its reach is about 0.89 of the canvas), so the
  // canvas can be a little larger than the tile; the tile clips like an icon mask.
  { id: "rounded", label: "Rounded square", radius: "22.5%", fill: 1.04 },
  // a circle cuts deeper into the corners, so the piece sits a bit smaller
  { id: "circle", label: "Circle", radius: "50%", fill: 0.96 },
] as const;
const TILES = ["tint", "deep", "white"] as const;
type Tile = (typeof TILES)[number];
const TILE_NAMES: Record<Tile, string> = { tint: "Tint", deep: "Deep", white: "White" };

/**
 * The current icon as an app icon: on an opaque tile, as a rounded square and
 * as a circle, at the sizes it would appear on a home screen or in a launcher.
 */
export function AppIconPreview({ options, renderer, backdrop }: { options: PuzzleIconOptions; renderer: RendererPreference; backdrop: string }) {
  const labelId = useId();
  const [tile, setTile] = useState<Tile>("tint");
  const { size: _size, ...look } = options;
  const lookKey = JSON.stringify(look);

  // tile colors come from the icon's own palette, so the tile belongs to it
  const colors = useMemo(() => {
    const mix = mixOklab(getSharedGenerator({ renderer }).generate(options).palette.colors);
    const [, C, h] = hexToOklch(mix);
    return {
      tint: oklchToHex([0.955, Math.min(C, 0.2) * 0.18, h]),
      deep: oklchToHex([0.24, Math.min(C, 0.2) * 0.35, h]),
      white: "#ffffff",
    };
  }, [lookKey, renderer]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="appicons" aria-labelledby={labelId}>
      <div className="assembly-head">
        <h2 id={labelId}>App icon</h2>
        <p className="muted">The icon on an opaque tile, as a rounded square and as a circle, at home-screen and list sizes.</p>
      </div>
      <div className="toolbar">
        <div
          className="segmented"
          role="radiogroup"
          aria-label="Tile background"
          onKeyDown={(e) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
            if (!step) return;
            e.preventDefault();
            const i = (TILES.indexOf(tile) + step + TILES.length) % TILES.length;
            setTile(TILES[i]!);
            (e.currentTarget.children[i] as HTMLElement | undefined)?.focus();
          }}
        >
          {TILES.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={t === tile} tabIndex={t === tile ? 0 : -1} className={t === tile ? "on" : ""} onClick={() => setTile(t)}>
              {TILE_NAMES[t]}
            </button>
          ))}
        </div>
      </div>
      <div className={`appicons-stage ${backdrop}`}>
        {SHAPES.map((shape) => (
          <div key={shape.id} className="appicons-row">
            <span className="label">{shape.label}</span>
            <div className="appicons-set">
              {SIZES.map((px) => (
                <figure key={px} className="appicon">
                  <div className="appicon-tile" style={{ width: px, height: px, borderRadius: shape.radius, background: colors[tile] }}>
                    <PuzzleIcon {...look} size={Math.round(px * shape.fill)} renderer={renderer} title={`${shape.label} app icon, ${px} px`} />
                  </div>
                  <figcaption>{px} px</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
