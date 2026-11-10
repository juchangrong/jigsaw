import { generateMosaic, mixOklab, mosaicFills, type MosaicVariant, type Seed } from "@jigsaw/core";
import { useId, useMemo, type CSSProperties } from "react";

export interface PuzzleMosaicProps {
  seed: Seed;
  /** four shades of one colour, deep to light, such as a `ColorFamily`'s `colors` */
  colors: readonly string[];
  /** CSS pixel size (default 24) */
  size?: number;
  /** `tonal`: one shade per piece. `accent`: one deep piece on light ones. */
  variant?: MosaicVariant;
  /** tile corner radius as a fraction of its side (default 0.25) */
  radius?: number;
  className?: string;
  style?: CSSProperties;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/**
 * `<PuzzleMosaic seed="alpha" size={40} colors={family.colors} />`
 *
 * A tile cut into four puzzle pieces in the shades of one colour, as inline
 * SVG: no canvas and no GPU.
 */
export function PuzzleMosaic({ seed, colors, size = 24, variant = "tonal", radius = 0.25, className, style, title }: PuzzleMosaicProps) {
  const clipId = `mosaic${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const mosaic = useMemo(() => generateMosaic(seed), [seed]);
  const colorKey = colors.join();
  const fills = useMemo(() => mosaicFills(mosaic, colors, variant), [mosaic, colorKey, variant]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = useMemo(() => mixOklab(fills), [fills]);
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
  return (
    <svg className={className} style={style} width={size} height={size} viewBox={mosaic.viewBox} {...a11y}>
      <clipPath id={clipId}>
        <rect width={1} height={1} rx={radius} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {/* a mid tone underneath, so antialiasing along the seams never shows the page through */}
        <rect width={1} height={1} fill={back} />
        {mosaic.layers.map((l, i) => (
          <path key={i} d={l.path} fill={fills[l.cell]} />
        ))}
      </g>
    </svg>
  );
}
