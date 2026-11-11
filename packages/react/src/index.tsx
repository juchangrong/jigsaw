import { generateMosaic, mosaicDrawing, type MosaicShape, type MosaicVariant, type Seed } from "@jigsaw/core";
import { useId, useMemo, type CSSProperties } from "react";

export interface PuzzleMosaicProps {
  seed: Seed;
  /** four shades of one colour, deep to light, such as a `ColorFamily`'s `colors` */
  colors: readonly string[];
  /** CSS pixel size (default 24) */
  size?: number;
  /** `tonal`: one shade per piece. `accent`: one deep piece on light ones. */
  variant?: MosaicVariant;
  /** the tile's outline (default squircle) */
  shape?: MosaicShape;
  /** corner radius of a `round` tile, as a fraction of its side (default 0.25) */
  radius?: number;
  /** width of the cuts between pieces, as a fraction of the tile; 0 joins them */
  gap?: number;
  /** a hairline around the pieces, so light ones hold on a light page (default true) */
  edge?: boolean;
  className?: string;
  style?: CSSProperties;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/**
 * `<PuzzleMosaic seed="alpha" size={40} colors={family.colors} />`
 *
 * A tile cut into four puzzle pieces in the shades of one colour, as inline
 * SVG: no canvas and no GPU. The cuts are transparent, so it sits on any
 * background.
 */
export function PuzzleMosaic({ seed, colors, size = 24, variant, shape, radius, gap, edge, className, style, title }: PuzzleMosaicProps) {
  const id = `mosaic${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mosaic = useMemo(() => generateMosaic(seed), [seed]);
  const colorKey = colors.join();
  const d = useMemo(() => mosaicDrawing(mosaic, colors, { variant, shape, radius, gap, edge }), [mosaic, colorKey, variant, shape, radius, gap, edge]);
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
  return (
    <svg className={className} style={style} width={size} height={size} viewBox={mosaic.viewBox} {...a11y}>
      <clipPath id={id}>
        <path d={d.outline} />
      </clipPath>
      {d.gap > 0 && (
        <mask id={`${id}cuts`}>
          <rect width={1} height={1} fill="#fff" />
          {mosaic.seams.map((s, i) => (
            <path key={i} d={s} fill="none" stroke="#000" strokeWidth={d.gap} />
          ))}
          <path d={d.corners} fill="#000" />
        </mask>
      )}
      <g clipPath={`url(#${id})`}>
        <g mask={d.gap > 0 ? `url(#${id}cuts)` : undefined}>
          <rect width={1} height={1} fill={d.ground} />
          {mosaic.layers.map((l, i) => (
            <path key={i} d={l.path} fill={d.fills[l.cell]} />
          ))}
          {d.edge && <path d={d.outline} fill="none" stroke={d.edge} strokeWidth={d.edgeWidth} />}
        </g>
      </g>
    </svg>
  );
}
