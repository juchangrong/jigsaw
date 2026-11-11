import { generatePetals, petalsDrawing, type MosaicShape, type MosaicVariant, type Seed } from "@jigsaw/core";
import { useId, useMemo, type CSSProperties } from "react";

export interface PuzzlePetalsProps {
  seed: Seed;
  /** four shades of one colour, deep to light, such as a `ColorFamily`'s `colors` */
  colors: readonly string[];
  /** CSS pixel size (default 24) */
  size?: number;
  /** `tonal`: one shade per leaf. `accent`: one deep leaf among light ones. */
  variant?: MosaicVariant;
  /** the tile's outline (default squircle) */
  shape?: MosaicShape;
  /** corner radius of a `round` tile, as a fraction of its side (default 0.25) */
  radius?: number;
  /** a hairline around the tile, so a light ground holds on a light page (default true) */
  edge?: boolean;
  className?: string;
  style?: CSSProperties;
  /** accessible name; without one the image is hidden from assistive technology */
  title?: string;
}

/**
 * `<PuzzlePetals seed="alpha" size={40} colors={family.colors} />`
 *
 * A tile of four leaves in the shades of one colour, as inline SVG. The
 * leaves meet at their tips with nothing between the cells, so they read as
 * one figure.
 */
export function PuzzlePetals({ seed, colors, size = 24, variant, shape, radius, edge, className, style, title }: PuzzlePetalsProps) {
  const id = `petals${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const petals = useMemo(() => generatePetals(seed), [seed]);
  const colorKey = colors.join();
  const d = useMemo(() => petalsDrawing(petals, colors, { variant, shape, radius, edge }), [petals, colorKey, variant, shape, radius, edge]);
  const a11y = title ? ({ role: "img", "aria-label": title } as const) : ({ "aria-hidden": true } as const);
  return (
    <svg className={className} style={style} width={size} height={size} viewBox={petals.viewBox} {...a11y}>
      <clipPath id={id}>
        <path d={d.outline} />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width={1} height={1} fill={d.ground} />
        {petals.leaves.map((leaf, i) => (
          <path key={i} d={leaf} fill={d.fills[i]} />
        ))}
        {d.edge && <path d={d.outline} fill="none" stroke={d.edge} strokeWidth={d.edgeWidth} />}
      </g>
    </svg>
  );
}
