import { generateHills, hillsDrawing, type MosaicShape, type MosaicVariant, type Seed } from "@jigsaw/core";
import { useId, useMemo, type CSSProperties } from "react";

export interface PuzzleHillsProps {
  seed: Seed;
  /** four shades of one colour, deep to light, such as a `ColorFamily`'s `colors` */
  colors: readonly string[];
  /** CSS pixel size (default 24) */
  size?: number;
  /** `tonal`: the hills deepen toward the front. `accent`: one deep hill in front of light ones. */
  variant?: MosaicVariant;
  /** the tile's outline (default squircle) */
  shape?: MosaicShape;
  /** corner radius of a `round` tile, as a fraction of its side (default 0.25) */
  radius?: number;
  /** a hairline around the tile, so a light sky holds on a light page (default true) */
  edge?: boolean;
  className?: string;
  style?: CSSProperties;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/**
 * `<PuzzleHills seed="alpha" size={40} colors={family.colors} />`
 *
 * Three hills under a sun in the shades of one colour, as inline SVG.
 */
export function PuzzleHills({ seed, colors, size = 24, variant, shape, radius, edge, className, style, title }: PuzzleHillsProps) {
  const id = `hills${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const hills = useMemo(() => generateHills(seed), [seed]);
  const colorKey = colors.join();
  const d = useMemo(() => hillsDrawing(colors, { variant, shape, radius, edge }), [colorKey, variant, shape, radius, edge]);
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
  return (
    <svg className={className} style={style} width={size} height={size} viewBox={hills.viewBox} {...a11y}>
      <clipPath id={id}>
        <path d={d.outline} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width={1} height={1} fill={d.sky} />
        <circle cx={hills.sun.x} cy={hills.sun.y} r={hills.sun.r} fill={d.sun} />
        {hills.hills.map((h, i) => (
          <circle key={i} cx={h.x} cy={h.y} r={h.r} fill={d.fills[i]} />
        ))}
        {d.edge && <path d={d.outline} fill="none" stroke={d.edge} strokeWidth={d.edgeWidth} />}
      </g>
    </svg>
  );
}
